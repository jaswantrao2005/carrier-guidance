"""
Face-presence analysis over a recorded interview.

DESIGN CONSTRAINTS — read before changing anything here.

1. This produces EVIDENCE FOR A HUMAN, never a verdict. Nothing in this module
   returns "cheated" / "clean", and nothing it emits may gate a score or end a
   session automatically. See `Signal.severity` — the highest level is REVIEW.

2. It runs SERVER-SIDE on the recorded media, not in the candidate's browser.
   Client-computed integrity is an assertion by an adversary; a signal derived
   from the media the server holds is evidence.

3. Bias is a first-class engineering concern, not a disclaimer.
   Yoder-Himes et al. (Frontiers in Education, 2022, n=357) measured automated
   proctoring flagging "missing from frame" 4.79x per assessment for darker-skinned
   students vs 0.83x for lighter-skinned -- while video review found NO difference
   in actual behaviour. That gap is a detection failure reported as a behavioural
   one. Concretely, this module mitigates it by:

     (a) Reporting DETECTION QUALITY alongside every signal. If the detector
         performed poorly on this recording (low mean confidence, unstable
         detection), `quality.reliable` is False and the caller must suppress
         the signals rather than present them. A weak detection is evidence
         about the video, not about the person.
     (b) Requiring absence to PERSIST (default 10s) before it is reportable,
         so momentary detector dropouts -- the dominant failure mode on darker
         skin and poor lighting -- do not become events.
     (c) Auto-tuning the confidence floor per recording from the observed
         distribution, instead of applying one global threshold that is
         implicitly calibrated to whoever the model saw most in training.
     (d) Emitting per-signal `confidence` so downstream UI can show a reviewer
         how strong the evidence is, rather than a bare flag.

4. It never identifies anyone. No face recognition, no embeddings, no identity
   matching -- only "how many face-like regions are in this frame". Face data
   must never become an input to a competence score (cf. HireVue dropping
   facial analysis in 2021 after it contributed ~0.25% predictive power).
"""

from __future__ import annotations

import dataclasses
import logging
import math
import statistics
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Iterator, Sequence

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

log = logging.getLogger(__name__)

# Bundled model: BlazeFace short-range, Apache-2.0, ~224 KB.
DEFAULT_MODEL = Path(__file__).resolve().parent.parent / "models" / "blaze_face_short_range.tflite"


class Severity(str, Enum):
    """
    Deliberately tops out at REVIEW. There is no CRITICAL, no TERMINATE.
    Nothing this service emits may end an interview or change a score.
    """
    INFO = "info"
    REVIEW = "review"


@dataclass(frozen=True)
class Signal:
    type: str
    start_ms: int
    end_ms: int
    severity: Severity
    description: str
    confidence: float  # 0..1 -- how much weight a reviewer should give this
    verified: bool = True  # server-derived; contrast with client-reported hints

    @property
    def duration_ms(self) -> int:
        return max(0, self.end_ms - self.start_ms)

    def to_dict(self) -> dict:
        d = dataclasses.asdict(self)
        d["severity"] = self.severity.value
        d["duration_ms"] = self.duration_ms
        return d


@dataclass
class Quality:
    """
    How much the signals below can be trusted for THIS recording.

    `reliable` False means: the detector struggled with this video. Report it as
    a media-quality problem, never as candidate behaviour.
    """
    frames_analysed: int
    mean_confidence: float
    detection_rate: float          # fraction of ALL frames with >=1 face
    stability: float               # 1.0 = clean presence signal, 0.0 = flickering
    resolution: tuple[int, int]
    fps_sampled: float
    reliable: bool
    reason: str = ""

    def to_dict(self) -> dict:
        d = dataclasses.asdict(self)
        d["resolution"] = list(self.resolution)
        return d


@dataclass
class AnalysisResult:
    signals: list[Signal] = field(default_factory=list)
    quality: Quality | None = None
    duration_ms: int = 0

    def to_dict(self) -> dict:
        return {
            "duration_ms": self.duration_ms,
            "quality": self.quality.to_dict() if self.quality else None,
            # Signals are withheld entirely when detection was unreliable --
            # the caller cannot accidentally render them.
            "signals": [s.to_dict() for s in self.signals]
            if (self.quality and self.quality.reliable)
            else [],
            "suppressed": bool(self.quality and not self.quality.reliable),
        }


@dataclass
class Config:
    sample_fps: float = 2.0
    # Absence must persist this long before it is reportable. Short dropouts are
    # overwhelmingly detector failure, not the candidate leaving.
    min_absence_ms: int = 10_000
    # A second face must persist this long too (a passer-by is not an event).
    min_multi_face_ms: int = 5_000
    # Floor for the detector itself. Kept low on purpose; the real threshold is
    # derived per-recording in _adaptive_threshold().
    min_detection_confidence: float = 0.3
    # Below these, we declare the analysis unreliable rather than emit signals.
    # Gate on detector STABILITY (how often presence flips), not detected fraction --
    # see _detection_stability(). An absent candidate and a failing detector have the
    # same detected fraction but different shapes; only flicker means low quality.
    quality_min_stability: float = 0.80
    quality_min_mean_confidence: float = 0.45
    max_frames: int = 5_000  # safety bound on very long recordings


def _iter_frames(path: Path, sample_fps: float, max_frames: int) -> Iterator[tuple[int, np.ndarray]]:
    """Yield (timestamp_ms, BGR frame) sampled at approximately `sample_fps`."""
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {path}")
    try:
        native_fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        # MediaRecorder WebM often reports a broken/zero fps -- fall back rather
        # than dividing by zero (see analysis Part 2: the WebM duration bug).
        if not math.isfinite(native_fps) or native_fps <= 0:
            native_fps = 30.0
        step = max(1, int(round(native_fps / max(0.1, sample_fps))))

        idx = 0
        emitted = 0
        while emitted < max_frames:
            ok, frame = cap.read()
            if not ok:
                break
            if idx % step == 0:
                ts_ms = int((idx / native_fps) * 1000)
                yield ts_ms, frame
                emitted += 1
            idx += 1
    finally:
        cap.release()


def _adaptive_threshold(confidences: Sequence[float], floor: float) -> float:
    """
    Derive a per-recording confidence threshold instead of using one global value.

    A single global threshold is implicitly calibrated to whoever the model saw
    most during training, so it systematically under-detects faces it represents
    poorly -- which is the mechanism behind the disparity cited in the module
    docstring. Anchoring to this recording's own distribution keeps a
    consistently-but-weakly detected face counted as PRESENT.
    """
    present = [c for c in confidences if c > 0]
    if len(present) < 10:
        return floor
    median = statistics.median(present)
    # Half the median, clamped so we never drift above the caller's floor
    # or below a noise threshold.
    return max(0.15, min(floor, median * 0.5))


def _merge_runs(flags: list[bool], times: list[int], min_ms: int) -> list[tuple[int, int]]:
    """Collapse a boolean-per-frame series into [start_ms, end_ms) runs of >= min_ms."""
    runs: list[tuple[int, int]] = []
    start: int | None = None
    for i, on in enumerate(flags):
        if on and start is None:
            start = times[i]
        elif not on and start is not None:
            end = times[i]
            if end - start >= min_ms:
                runs.append((start, end))
            start = None
    if start is not None:
        end = times[-1] if times else start
        if end - start >= min_ms:
            runs.append((start, end))
    return runs


class FacePresenceAnalyzer:
    """
    Counts face-like regions per sampled frame and derives persistence-based signals.

    Not thread-safe: MediaPipe's VIDEO running mode requires monotonically
    increasing timestamps per detector instance. Construct one per analysis.
    """

    def __init__(self, model_path: Path | str = DEFAULT_MODEL, config: Config | None = None):
        self.config = config or Config()
        self.model_path = Path(model_path)
        if not self.model_path.exists():
            raise FileNotFoundError(
                f"Face detector model not found at {self.model_path}. "
                "Run scripts/fetch_model.py to download it."
            )

    def _new_detector(self) -> vision.FaceDetector:
        return vision.FaceDetector.create_from_options(
            vision.FaceDetectorOptions(
                base_options=mp_python.BaseOptions(model_asset_path=str(self.model_path)),
                running_mode=vision.RunningMode.VIDEO,
                min_detection_confidence=self.config.min_detection_confidence,
            )
        )

    def analyze(self, video_path: Path | str) -> AnalysisResult:
        cfg = self.config
        video_path = Path(video_path)

        times: list[int] = []
        counts: list[int] = []
        top_conf: list[float] = []
        resolution = (0, 0)

        detector = self._new_detector()
        try:
            last_ts = -1
            for ts_ms, frame in _iter_frames(video_path, cfg.sample_fps, cfg.max_frames):
                # MediaPipe VIDEO mode rejects non-monotonic timestamps.
                if ts_ms <= last_ts:
                    ts_ms = last_ts + 1
                last_ts = ts_ms

                if resolution == (0, 0):
                    resolution = (frame.shape[1], frame.shape[0])

                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                res = detector.detect_for_video(mp_img, ts_ms)

                dets = res.detections or []
                scores = [
                    d.categories[0].score
                    for d in dets
                    if getattr(d, "categories", None)
                ]
                times.append(ts_ms)
                counts.append(len(dets))
                top_conf.append(max(scores) if scores else 0.0)
        finally:
            detector.close()

        if not times:
            return AnalysisResult(
                quality=Quality(0, 0.0, 0.0, resolution, cfg.sample_fps, False,
                                "No frames could be decoded from the recording."),
                duration_ms=0,
            )

        duration_ms = times[-1]
        threshold = _adaptive_threshold(top_conf, cfg.min_detection_confidence)

        # Re-derive presence using the per-recording threshold.
        present = [c > 0 and t >= threshold for c, t in zip(counts, top_conf)]
        detected = [t for t in top_conf if t > 0]
        mean_conf = float(statistics.fmean(detected)) if detected else 0.0
        detection_rate = sum(present) / len(present)

        # Detector STABILITY, measured only over the parts of the recording where a
        # face was found at all.
        #
        # This distinction matters and is easy to get wrong: a genuine long absence
        # drags the overall detection_rate down, which -- if used as the quality
        # gate -- would suppress exactly the signal we are meant to report. Worse,
        # the same gate would be tripped by any recording with a lot of true absence.
        # So the gate asks "when the candidate WAS on camera, did we see them
        # steadily?" rather than "were they on camera a lot?".
        stability = self._detection_stability(present)

        quality = self._assess_quality(
            frames=len(times),
            mean_conf=mean_conf,
            detection_rate=detection_rate,
            stability=stability,
            resolution=resolution,
        )

        signals: list[Signal] = []
        if quality.reliable:
            signals.extend(self._absence_signals(present, times, mean_conf))
            signals.extend(self._multi_face_signals(counts, present, times, mean_conf))

        signals.sort(key=lambda s: s.start_ms)
        return AnalysisResult(signals=signals, quality=quality, duration_ms=duration_ms)

    @staticmethod
    def _detection_stability(present: list[bool]) -> float:
        """
        1.0 = the presence signal is clean; 0.0 = it flickers every frame.

        The key insight, and the reason this is not simply "fraction of frames
        detected": a struggling detector and an absent candidate produce the SAME
        detected-fraction but very different SHAPES.

            absent candidate : 1 1 1 0 0 0 0 0 0 1 1 1   -> 2 transitions, clean
            failing detector : 1 0 1 1 0 1 0 0 1 0 1 0   -> 9 transitions, flicker

        Both are ~50% detected. Only the second is a quality problem. So we measure
        the transition rate: how often presence flips per frame. A handful of flips
        across a recording is normal (the candidate genuinely moved); flipping on a
        large share of frames means the detector cannot hold a lock -- which is the
        documented failure mode on darker skin and poor lighting, and exactly the
        case where signals must be suppressed rather than reported as behaviour.
        """
        if len(present) < 2 or not any(present):
            return 0.0
        transitions = sum(1 for a, b in zip(present, present[1:]) if a != b)
        return max(0.0, 1.0 - transitions / (len(present) - 1))

    def _assess_quality(
        self, frames: int, mean_conf: float, detection_rate: float,
        stability: float, resolution: tuple[int, int]
    ) -> Quality:
        cfg = self.config
        reasons: list[str] = []

        if frames < 10:
            reasons.append("Too few frames to analyse.")
        if detection_rate <= 0:
            reasons.append(
                "No face was detected anywhere in this recording. This indicates a camera, "
                "lighting, or encoding problem rather than candidate behaviour."
            )
        elif stability < cfg.quality_min_stability:
            reasons.append(
                f"Face detection was unstable (stability {stability:.0%}): the detector "
                "repeatedly lost and reacquired the face. This usually indicates poor "
                "lighting, camera placement, or video quality rather than candidate behaviour."
            )
        if mean_conf and mean_conf < cfg.quality_min_mean_confidence:
            reasons.append(
                f"Mean detection confidence was low ({mean_conf:.2f}); results are not dependable."
            )
        if resolution[0] and resolution[0] < 320:
            reasons.append(f"Video resolution is very low ({resolution[0]}x{resolution[1]}).")

        return Quality(
            frames_analysed=frames,
            mean_confidence=round(mean_conf, 3),
            detection_rate=round(detection_rate, 3),
            stability=round(stability, 3),
            resolution=resolution,
            fps_sampled=cfg.sample_fps,
            reliable=not reasons,
            reason=" ".join(reasons),
        )

    def _absence_signals(self, present: list[bool], times: list[int], mean_conf: float) -> list[Signal]:
        absent = [not p for p in present]
        out: list[Signal] = []
        for start, end in _merge_runs(absent, times, self.config.min_absence_ms):
            secs = (end - start) / 1000
            out.append(
                Signal(
                    type="no_face_detected",
                    start_ms=start,
                    end_ms=end,
                    severity=Severity.REVIEW,
                    description=(
                        f"No face was detected for {secs:.0f}s. This can mean the candidate "
                        "stepped away, but also occurs with poor lighting or camera angle."
                    ),
                    # Long, cleanly-detected absences in an otherwise well-detected
                    # video are stronger evidence than short ones in a marginal video.
                    confidence=round(min(1.0, mean_conf * min(1.0, secs / 30.0)), 3),
                )
            )
        return out

    def _multi_face_signals(
        self, counts: list[int], present: list[bool], times: list[int], mean_conf: float
    ) -> list[Signal]:
        multi = [c >= 2 and p for c, p in zip(counts, present)]
        out: list[Signal] = []
        for start, end in _merge_runs(multi, times, self.config.min_multi_face_ms):
            secs = (end - start) / 1000
            out.append(
                Signal(
                    type="multiple_faces_detected",
                    start_ms=start,
                    end_ms=end,
                    severity=Severity.REVIEW,
                    description=(
                        f"More than one face was visible for {secs:.0f}s. This may be another "
                        "person in the room, a photo, or a reflection."
                    ),
                    confidence=round(min(1.0, mean_conf * min(1.0, secs / 20.0)), 3),
                )
            )
        return out


def analyze_recording(video_path: Path | str, model_path: Path | str = DEFAULT_MODEL,
                      config: Config | None = None) -> AnalysisResult:
    """Convenience wrapper: analyse one recording with a fresh detector."""
    return FacePresenceAnalyzer(model_path=model_path, config=config).analyze(video_path)
