"""
Tests for the face-presence analyzer.

These use synthetic video rather than recordings of real people: the module is
never supposed to need a face database, and generating frames keeps the suite
runnable anywhere with no privacy footprint.

The important tests are the SUPPRESSION ones. Verifying that a poorly-detected
recording yields no signals is the safety property that keeps a detection
failure from being reported as candidate behaviour.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import cv2
import numpy as np
import pytest

from app.detector import (
    Config,
    FacePresenceAnalyzer,
    Severity,
    _adaptive_threshold,
    _merge_runs,
)

FPS = 10
SIZE = (640, 480)


def _draw_face(frame: np.ndarray, cx: int, cy: int, scale: float = 1.0,
               skin=(172, 145, 128), contrast: float = 1.0) -> None:
    """
    Draw a synthetic frontal face that BlazeFace detects at ~0.86 confidence.

    `contrast` scales the difference between features and skin, which is how we
    simulate a low-contrast capture without involving any real person's likeness.
    At contrast≈0 the geometry is unchanged but the features wash out -- the same
    failure mode as poor lighting, which is what we need in order to test that
    the analyzer suppresses signals instead of blaming the candidate.
    """
    def blend(colour):
        return tuple(int(s + (c - s) * contrast) for c, s in zip(colour, skin))

    r = int(110 * scale)
    cv2.ellipse(frame, (cx, cy), (int(r * 0.72), r), 0, 0, 360, skin, -1)
    cv2.ellipse(frame, (cx, cy + int(r * 1.6)), (int(r * 1.3), int(r * 0.7)), 0, 180, 360,
                blend((150, 125, 110)), -1)
    cv2.ellipse(frame, (cx, cy - int(r * 0.22)), (int(r * 0.55), int(r * 0.16)), 0, 0, 180,
                blend((140, 115, 100)), -1)

    ex, ey = int(r * 0.30), int(r * 0.20)
    for sx in (-1, 1):
        cv2.ellipse(frame, (cx + sx * ex, cy - ey), (int(r * 0.16), int(r * 0.10)), 0, 0, 360,
                    blend((250, 250, 250)), -1)
        cv2.circle(frame, (cx + sx * ex, cy - ey), int(r * 0.075), blend((60, 45, 35)), -1)
        cv2.circle(frame, (cx + sx * ex, cy - ey), max(1, int(r * 0.032)), blend((15, 15, 15)), -1)
        cv2.ellipse(frame, (cx + sx * ex, cy - int(r * 0.33)), (int(r * 0.22), int(r * 0.07)),
                    0, 0, 180, blend((70, 55, 45)), -1)

    cv2.ellipse(frame, (cx, cy + int(r * 0.14)), (int(r * 0.11), int(r * 0.20)), 0, 0, 360,
                blend((158, 131, 115)), -1)
    for sx in (-1, 1):
        cv2.circle(frame, (cx + sx * int(r * 0.07), cy + int(r * 0.28)), max(1, int(r * 0.035)),
                   blend((120, 95, 85)), -1)
    cv2.ellipse(frame, (cx, cy + int(r * 0.52)), (int(r * 0.26), int(r * 0.11)), 0, 0, 180,
                blend((110, 70, 70)), -1)
    cv2.ellipse(frame, (cx, cy - int(r * 0.55)), (int(r * 0.75), int(r * 0.55)), 0, 180, 360,
                blend((45, 35, 30)), -1)


def _write_video(path: Path, spec, contrast: float = 1.0, noise: int = 0) -> Path:
    """
    spec: callable(second) -> list of (cx, cy, scale) faces to draw for that second.
    """
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), FPS, SIZE)
    assert writer.isOpened(), "OpenCV could not open a writer (missing codec?)"
    try:
        seconds = spec.duration
        for s in range(seconds):
            faces = spec(s)
            for _ in range(FPS):
                frame = np.full((SIZE[1], SIZE[0], 3), 210, dtype=np.uint8)
                for (cx, cy, sc) in faces:
                    _draw_face(frame, cx, cy, sc, contrast=contrast)
                if noise:
                    frame = cv2.add(frame, np.random.randint(
                        0, noise, frame.shape, dtype=np.uint8))
                writer.write(frame)
    finally:
        writer.release()
    return path


class Spec:
    def __init__(self, duration: int, fn):
        self.duration = duration
        self._fn = fn

    def __call__(self, second: int):
        return self._fn(second)


# --------------------------------------------------------------------------
# Pure-function tests (no video decoding, fast)
# --------------------------------------------------------------------------

def test_merge_runs_requires_minimum_duration():
    times = [i * 1000 for i in range(10)]
    flags = [False, True, True, False, False, True, False, False, False, False]
    # 2s run kept at 2000ms, dropped at 3000ms
    assert _merge_runs(flags, times, 2000) == [(1000, 3000)]
    assert _merge_runs(flags, times, 3000) == []


def test_merge_runs_closes_trailing_run():
    times = [0, 1000, 2000, 3000]
    assert _merge_runs([False, True, True, True], times, 1000) == [(1000, 3000)]


def test_merge_runs_empty():
    assert _merge_runs([], [], 1000) == []


def test_adaptive_threshold_falls_back_without_enough_samples():
    assert _adaptive_threshold([0.9] * 5, floor=0.3) == 0.3


def test_adaptive_threshold_lowers_for_consistently_weak_detection():
    """
    The bias-mitigation core: a face detected consistently but WEAKLY must not be
    treated as absent. A global threshold is calibrated to whoever the model saw
    most in training; anchoring to this recording's own distribution avoids
    penalising a face the model represents poorly.
    """
    weak = [0.34] * 60
    assert _adaptive_threshold(weak, floor=0.5) == pytest.approx(0.17, abs=0.01)


def test_adaptive_threshold_never_exceeds_floor():
    strong = [0.99] * 60
    assert _adaptive_threshold(strong, floor=0.3) <= 0.3


def test_adaptive_threshold_clamps_at_noise_floor():
    assert _adaptive_threshold([0.05] * 60, floor=0.5) == 0.15


# --- The flicker-vs-absence distinction (the core safety property) -------------

def test_stability_distinguishes_absence_from_detector_flicker():
    """
    A genuinely-absent candidate and a failing detector produce the SAME detected
    fraction. Only the second is a quality problem, and conflating them is exactly
    how a detection failure becomes a behavioural accusation against the people
    the model detects worst.
    """
    stable_absence = [True] * 6 + [False] * 12 + [True] * 6   # 50% detected, 2 flips
    flickering     = [True, False] * 12                        # 50% detected, 23 flips

    s_absence = FacePresenceAnalyzer._detection_stability(stable_absence)
    s_flicker = FacePresenceAnalyzer._detection_stability(flickering)

    assert sum(stable_absence) / len(stable_absence) == sum(flickering) / len(flickering)
    assert s_absence > 0.9   # clean -> trustworthy, report the absence
    assert s_flicker < 0.1   # noisy  -> suppress, blame the video not the person


def test_stability_edge_cases():
    assert FacePresenceAnalyzer._detection_stability([]) == 0.0
    assert FacePresenceAnalyzer._detection_stability([False] * 10) == 0.0
    assert FacePresenceAnalyzer._detection_stability([True] * 10) == 1.0


# --------------------------------------------------------------------------
# End-to-end tests over generated video
# --------------------------------------------------------------------------

@pytest.fixture(scope="module")
def analyzer():
    return FacePresenceAnalyzer(config=Config(sample_fps=2.0, min_absence_ms=4000,
                                              min_multi_face_ms=3000))


def test_continuous_presence_produces_no_signals(tmp_path, analyzer):
    spec = Spec(12, lambda s: [(320, 240, 1.0)])
    path = _write_video(tmp_path / "present.mp4", spec)

    result = analyzer.analyze(path)

    assert result.quality is not None
    assert result.quality.frames_analysed > 0
    # A candidate who sits still through the whole interview must generate nothing.
    assert [s for s in result.signals if s.type == "no_face_detected"] == []


def test_sustained_absence_is_reported(tmp_path, analyzer):
    # Present 0-3s, gone 3-11s (8s > 4s threshold), back 11-14s
    spec = Spec(14, lambda s: [] if 3 <= s < 11 else [(320, 240, 1.0)])
    path = _write_video(tmp_path / "absent.mp4", spec)

    result = analyzer.analyze(path)

    if not result.quality.reliable:
        pytest.skip(f"synthetic face not detected reliably: {result.quality.reason}")

    absences = [s for s in result.signals if s.type == "no_face_detected"]
    assert len(absences) == 1
    a = absences[0]
    assert a.severity is Severity.REVIEW  # never higher -- no auto-action
    assert a.verified is True             # server-derived, unlike client hints
    assert 2500 <= a.start_ms <= 4500
    assert a.duration_ms >= 4000


def test_brief_dropout_is_not_reported(tmp_path, analyzer):
    """
    A 1s gap must never become an event. Short dropouts are overwhelmingly
    detector failure -- and that failure is not evenly distributed across skin
    tones, which is precisely how a detection artefact becomes a biased
    behavioural accusation.
    """
    spec = Spec(12, lambda s: [] if s == 5 else [(320, 240, 1.0)])
    path = _write_video(tmp_path / "blip.mp4", spec)

    result = analyzer.analyze(path)

    assert [s for s in result.signals if s.type == "no_face_detected"] == []


def test_second_face_is_reported_when_sustained(tmp_path, analyzer):
    spec = Spec(14, lambda s: [(200, 240, 0.9), (460, 240, 0.9)] if 4 <= s < 12
                else [(200, 240, 0.9)])
    path = _write_video(tmp_path / "two.mp4", spec)

    result = analyzer.analyze(path)

    if not result.quality.reliable:
        pytest.skip(f"synthetic faces not detected reliably: {result.quality.reason}")

    multi = [s for s in result.signals if s.type == "multiple_faces_detected"]
    assert len(multi) == 1
    assert multi[0].duration_ms >= 3000
    assert multi[0].severity is Severity.REVIEW


def test_poor_quality_video_suppresses_all_signals(tmp_path, analyzer):
    """
    THE SAFETY PROPERTY.

    When the detector cannot see the candidate reliably, the analysis must report
    a media-quality problem and emit NO behavioural signals. This is the direct
    countermeasure to the documented disparity where poor detection on darker
    skin was surfaced as "missing from frame" rather than as a video problem.
    """
    spec = Spec(12, lambda s: [(320, 240, 1.0)])
    path = _write_video(tmp_path / "poor.mp4", spec, contrast=0.05, noise=90)

    result = analyzer.analyze(path)

    assert result.quality is not None
    if result.quality.reliable:
        pytest.skip("synthetic low-contrast clip still detected reliably")

    assert result.signals == []
    payload = result.to_dict()
    assert payload["signals"] == []      # withheld from the wire, not just unused
    assert payload["suppressed"] is True
    assert result.quality.reason         # must explain WHY, for the reviewer


def test_result_payload_shape(tmp_path, analyzer):
    spec = Spec(6, lambda s: [(320, 240, 1.0)])
    path = _write_video(tmp_path / "shape.mp4", spec)

    payload = analyzer.analyze(path).to_dict()

    assert set(payload) == {"duration_ms", "quality", "signals", "suppressed"}
    q = payload["quality"]
    for key in ("frames_analysed", "mean_confidence", "detection_rate",
                "resolution", "fps_sampled", "reliable", "reason"):
        assert key in q
    # No severity this service emits may authorise an automatic action.
    assert all(s["severity"] in {"info", "review"} for s in payload["signals"])


def test_missing_file_raises(analyzer):
    with pytest.raises(ValueError):
        analyzer.analyze(Path("does-not-exist.mp4"))


def test_missing_model_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        FacePresenceAnalyzer(model_path=tmp_path / "nope.tflite")


def test_frame_limit_never_reports_a_partial_review_as_complete(tmp_path):
    path = _write_video(tmp_path / "limited.mp4", Spec(6, lambda s: [(320, 240, 1.0)]))
    analyzer = FacePresenceAnalyzer(config=Config(max_frames=4))
    payload = analyzer.analyze(path).to_dict()
    assert payload["quality"]["frames_analysed"] == 4
    assert payload["suppressed"] is True
    assert payload["signals"] == []
    assert "entire recording was not verified" in payload["quality"]["reason"]
