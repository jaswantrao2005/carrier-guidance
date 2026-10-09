# Optional video presence review

This local Python service analyzes face presence in a finished interview recording using MediaPipe BlazeFace. It reports sustained absence or multiple visible faces for human review. Its observations never change the interview score.

The interview setup requires separate consent for video recording and analysis. After a completed interview, select **Review video presence** on the report. The Node backend assembles its private recording chunks, asks this service to review them, saves the result, and deletes the temporary assembled video. Original recording chunks remain available until deletion or configured retention cleanup.

## Local setup

The existing `.venv` and downloaded model can be reused. For a new setup:

```powershell
cd integrity-service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe scripts/fetch_model.py
.\.venv\Scripts\python.exe -m pytest -q
```

For a fresh Debian/Ubuntu setup, install the native runtime libraries too. The
Linux MediaPipe wheel loads `libEGL.so.1` and `libGLESv2.so.2` even for CPU-only
inference. Installing the Python requirements alone does not supply these files.

```bash
cd integrity-service
sudo apt-get update
sudo apt-get install --no-install-recommends -y python3-venv libegl1 libgles2
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python scripts/fetch_model.py
.venv/bin/python -m pytest -q
```

The GitHub Actions Python job installs the same native libraries before running
the full detector test suite. No display server or GPU is required.

From the `integrity-service` directory, start the private service:

```powershell
$env:RECORDINGS_DIR = (Resolve-Path '..\backend').Path + '\uploads\recordings'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Set `INTEGRITY_SERVICE_URL=http://127.0.0.1:8001` for the backend process. Both services must see the same recordings directory. The demo launcher configures these process settings automatically. Bind the Python service to loopback for a local demo; it has no public authentication layer.

## Verify the complete connection

With local MongoDB and the Python service running, execute from this directory:

```powershell
node scripts/verify_connection.cjs http://127.0.0.1:8001
```

The check generates a six-second cartoon face video, splits it into two chunks, uploads through the Node recording service, calls the real Python detector, checks the saved review and unchanged score, and deletes its generated files and disposable `careerai_video_test_*` database. It uses no camera, personal uploads, provider API keys, or backend `.env` values.

Expected output includes `passed: true`, `framesAnalysed: 12`, `reliable: true`, and `scoreUnchanged: true`. A successful check verifies this Node-to-Python connection. Synthetic tests do not establish accuracy on every person, camera, or lighting condition.

## API

| Endpoint | Purpose |
|---|---|
| `GET /health` | Reports liveness, model availability, and shared recordings directory |
| `POST /analyze` | Reviews `{ "filename": "private-file.webm" }` inside `RECORDINGS_DIR` |
| `POST /analyze-upload` | Reviews an uploaded video with a 512 MB default limit |

Results include `quality`, `duration_ms`, `signals`, `suppressed`, and `analysis_ms`. When detection is unreliable, `suppressed` is true, `signals` is empty, and `quality.reason` explains the limitation. The UI shows a recording-quality notice.

Default sampling is two frames per second. Absence must persist ten seconds and multiple faces five seconds before an observation is emitted. The analyzer caps a review at 5,000 sampled frames, approximately 41 minutes at the default rate. Reaching this cap suppresses observations and explicitly says that the entire recording was not verified. Timestamp durations are approximate sampled boundaries.

## Limits

- Face detection can fail with poor lighting, camera angles, movement, or faces the model represents poorly. Quality checks can suppress observations; they do not guarantee fairness or accuracy.
- No detected face does not prove the person left. Multiple detected faces may be reflections or pictures. A human must review the recording before drawing a conclusion.
- The service does not identify people, detect off-camera devices, or judge honesty.
- Node gives each segment a two-minute request deadline. Long recordings can time out and require manual playback. Review failure leaves the interview report intact.
- Deployment requires a shared private storage volume or a different upload contract. A local recordings path on one host is insufficient for separate cloud hosts.

The tests use generated video and no real faces. Run `python -m pytest -q` through the configured virtual environment to check detection, quality suppression, persistence thresholds, and bounded review behavior.
