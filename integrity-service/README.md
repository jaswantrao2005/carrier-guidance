# Interview Integrity Service

Server-side face-presence analysis over interview recordings.
Python 3.12+ · MediaPipe BlazeFace · FastAPI

**What it does:** looks at a finished interview recording and reports *when nobody was
visible* and *when more than one face was visible*, as timestamped events for a human
to review.

**What it deliberately does not do:** identify anyone, score anyone, or decide anything.
There is no "pass/fail", no automatic termination, and no path by which its output can
change a candidate's score.

---

## Why this replaced the browser version

The original implementation ran `FaceDetector` in the candidate's browser. It had three
problems, and only one of them was the bug:

1. **It never ran.** The polling interval closed over a stale `status` value, so its
   guard was permanently false and `detect()` was never called once.
2. **The API is not real.** `FaceDetector` was removed from MDN's compat data, is
   Chrome-only behind a flag, and its spec never left WICG incubation. Mozilla's
   position is `defer`; Safari shipped only barcode detection.
3. **Client-side integrity is unfalsifiable.** The browser computed the verdict *and*
   reported it. A candidate could POST a clean report from DevTools, so it only ever
   constrained honest people.

This service fixes all three by moving the analysis server-side, onto the recording the
server already holds.

---

## The bias problem, and what is actually done about it

This is the part that matters most, so it is stated plainly.

Yoder-Himes et al. (*Frontiers in Education*, 2022, n=357) measured automated proctoring
software and found "missing from frame" flags firing **4.79 times per assessment for
darker-skinned students versus 0.83 for lighter-skinned** — while reviewing the actual
videos showed **no difference in behaviour**. The disparity was a *detection failure*
being reported as a *behavioural* one.

Rewriting it in Python does not fix that. These four design decisions do:

### 1. Quality gating — the central safeguard

Every analysis reports how well the detector performed. If it struggled, the behavioural
signals are **withheld from the response entirely** (not merely flagged), and the caller
gets a recording-quality explanation instead.

The discriminator is **stability**, not detection rate, and the distinction is the whole
trick:

```
absent candidate : 1 1 1 0 0 0 0 0 0 1 1 1   50% detected,  2 transitions -> CLEAN
failing detector : 1 0 1 1 0 1 0 0 1 0 1 0   50% detected, 23 transitions -> FLICKER
```

Both have the same detected fraction. Only the second is a quality problem. Gating on
detected fraction — the obvious choice — would suppress genuine absences *and* fail to
catch the flicker that actually indicates the detector cannot hold a lock on this face.

### 2. Persistence thresholds

Absence must last **10s** (default) and a second face **5s** before either is reportable.
Momentary dropouts are overwhelmingly detector failure, and that failure is not evenly
distributed across skin tones.

### 3. Per-recording adaptive threshold

The confidence floor is derived from *this recording's* distribution rather than one
global constant. A global threshold is implicitly calibrated to whoever the model saw
most in training, so a consistently-but-weakly detected face gets read as absent. Anchoring
to the recording keeps it counted as present.

### 4. Severity caps at `review`

The `Severity` enum has exactly two values: `info` and `review`. There is no `critical`,
no `terminate`. The type system will not let this service authorise an automatic action.

**It also never identifies anyone.** No recognition, no embeddings, no matching — only
"how many face-like regions are in this frame". Face data must never feed a competence
score; HireVue dropped facial analysis in 2021 after finding it contributed ~0.25% of
predictive power.

---

## Setup

```bash
cd integrity-service
python -m venv .venv
.venv/Scripts/activate          # Windows
# source .venv/bin/activate     # macOS/Linux

pip install -r requirements-dev.txt
python scripts/fetch_model.py   # BlazeFace short-range, Apache-2.0, ~224 KB
pytest -q
```

## Command line

```bash
python analyze.py recording.webm
python analyze.py recording.webm --json
python analyze.py recording.webm --sample-fps 4 --min-absence 5
```

```
  Recording : interview.mp4
  Duration  : 0:29
  Frames    : 60 @ 2.0fps  (640x480)
  Detection : 60% of frames, stability 97%, mean confidence 0.90

  2 event(s) for human review:

    [0:08–0:20] no_face_detected  (confidence 0.36)
      No face was detected for 12s. This can mean the candidate stepped away,
      but also occurs with poor lighting or camera angle.
    [0:22–0:28] multiple_faces_detected  (confidence 0.27)
      More than one face was visible for 6s. This may be another person in the
      room, a photo, or a reflection.
```

The same tool on a well-behaved but badly-lit recording:

```
  Detection : 70% of frames, stability 59%, mean confidence 0.33

  ⚠ RECORDING QUALITY TOO LOW FOR ANALYSIS
    Face detection was unstable (stability 59%): the detector repeatedly lost
    and reacquired the face...
    No behavioural signals are reported. This is a video problem,
    not a statement about the candidate.
```

The candidate never left. A naive implementation would have accused them.

## HTTP API

```bash
RECORDINGS_DIR=/path/to/recordings uvicorn app.main:app --port 8077
```

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness + model presence |
| `POST /analyze` | analyse `{filename}` inside `RECORDINGS_DIR` (preferred) |
| `POST /analyze-upload` | analyse an uploaded file (small files only) |

```jsonc
{
  "duration_ms": 29500,
  "quality": {
    "frames_analysed": 60, "mean_confidence": 0.9,
    "detection_rate": 0.6, "stability": 0.97,
    "resolution": [640, 480], "fps_sampled": 2.0,
    "reliable": true, "reason": ""
  },
  "signals": [
    { "type": "no_face_detected", "start_ms": 8000, "end_ms": 20000,
      "duration_ms": 12000, "severity": "review", "confidence": 0.36,
      "verified": true, "description": "No face was detected for 12s..." }
  ],
  "suppressed": false,
  "analysis_ms": 1435
}
```

**Consumer contract:** when `suppressed` is `true`, `signals` is empty by design and
`quality.reason` says why — render that as a recording-quality notice, never as candidate
behaviour. `verified: true` marks these as server-derived, to distinguish them from
client-reported hints, which stay `verified: false`.

⚠️ **Internal service.** It takes recordings and returns review data. Bind it to a private
network; do not expose it publicly.

## Wiring into the Node backend

Call it after a recording finishes uploading, from a background job — not on the request
path. Roughly:

```js
const res = await fetch(`${INTEGRITY_URL}/analyze`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filename: path.basename(interview.recordingUrl) }),
});
const analysis = await res.json();

interview.mediaAnalysis = analysis;   // store whole payload incl. quality
await interview.save();
// Do NOT branch on analysis.signals to change status, score, or eligibility.
```

## Performance

~**20× real-time** on CPU at the default 2 fps sampling (30s of video in ~1.4s). A
45-minute interview analyses in roughly two minutes on one core, so a single worker
comfortably keeps up; scale by adding workers, not by lowering `sample_fps`.

Tuning: raise `sample_fps` for tighter event boundaries at linear cost; raise
`min_absence_ms` to reduce false positives further.

## Tests

```bash
pytest -q          # 17 tests
```

Synthetic video only — no real faces, so the suite runs anywhere with no privacy
footprint. The load-bearing tests are:

| Test | Property |
|---|---|
| `test_stability_distinguishes_absence_from_detector_flicker` | absence ≠ flicker at equal detection rate |
| `test_poor_quality_video_suppresses_all_signals` | bad video yields **zero** signals on the wire |
| `test_brief_dropout_is_not_reported` | a 1s gap never becomes an event |
| `test_adaptive_threshold_lowers_for_consistently_weak_detection` | weak-but-steady detection counts as present |
| `test_result_payload_shape` | no severity above `review` can be emitted |

## Limits — read before deploying

- **It cannot tell why.** "No face detected" covers stepping away, poor lighting, a
  camera knocked askew, and a candidate who leans out of frame to think. The output is
  a prompt to look, never a conclusion.
- **It cannot see a second device.** Someone reading from a phone off-camera is invisible
  to this and to every other webcam-based approach.
- **Do not add gaze tracking.** Published cross-dataset gaze error runs 5°–31°; at a 60 cm
  viewing distance a 27° error is ~30 cm on screen, while a 15.6" laptop's half-width
  subtends only ~16°. The error budget is roughly twice the thing being measured.
- **Do not use this for identity.** Face-verification false-non-match rates in proctoring
  research reached ~11.5% on realistic data and were significantly higher for subjects
  labelled Black than White.
- **Disclose it.** Candidates must be told this analysis happens, and under DPDP §6(1)
  consent must be specific rather than bundled.

## References

- Yoder-Himes et al. (2022), *Racial, skin tone, and sex disparities in automated
  proctoring software*, Frontiers in Education 7:881449
- Burgess et al. (2022), *Watching the watchers*, USENIX Security
- MediaPipe Face Detector — https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector
- WICG Shape Detection API (the abandoned browser route) — https://github.com/WICG/shape-detection-api
