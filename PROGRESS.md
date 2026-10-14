# Current project status

Updated 9 October 2026. The local team demo is running at http://localhost:3000. Use [TEAM_DEMO.md](docs/TEAM_DEMO.md) for commands and rehearsal, and the [assessment and plan](docs/IMPLEMENTATION_PLAN.md) for folder structure and remaining work.

## Demo checklist

- [x] Registration, login and account-owned data.
- [x] PDF extraction, live Gemini resume analysis and mentor chat.
- [x] Company brief with retrieved source links, bounded search fallback and job-description context.
- [x] Saved interviews, typed answers, draft recovery, pause/resume and durable report retry.
- [x] Voice-first Alex interview with an unscored greeting/readiness, Gemini voice and spoken-answer transcription, optional captions/typing, saved conversation and focused follow-ups.
- [x] Start/Resume navigation opens the saved room instead of returning to setup; automatic listening requires explicit microphone activation.
- [x] Judge0 execution in JavaScript, Python, Java and C++; execution and correctness are separate.
- [x] Optional recording, private playback, consented Python video review and deletion.
- [x] Reports retain submitted answers, omit invented clean-monitoring claims, and keep video observations separate from scores.
- [x] Windows start/check/stop scripts, safe upload/discard cleanup, configurable storage and read-only storage audit.
- [x] Phone, tablet and desktop interview/report layouts verified after rebuilding.
- [x] Fictional resume, matching job description, code example and saved sample report prepared.

## Verification

96 backend tests and 18 Python tests passed. The voice-first production build passed. Actual Gemini Kore greeting, readiness and question audio played in Chrome; a 10.624-second simulated-microphone answer was transcribed with its final words intact, submitted once, and followed by the next question and automatic listening. The warm-up made no answer submissions. The microphone still requires explicit activation.

Independent visual review passed the refined portrait at five phone/tablet/desktop widths. Typing and captions are optional. Thirteen final browser checks passed with zero page errors, including retained-audio retry and real saved-answer persistence, permission cleanup, silence, cancellation, draft reload, native final words, coding access, Stop/leave and portrait fallback. Test browsers closed and only disposable sessions were removed. See [VERIFICATION.md](docs/VERIFICATION.md) for evidence and helper assertion corrections. Physical microphones, cameras and other browsers remain unverified.

The earlier real-provider rehearsal passed answer-specific follow-up, pause/resume, skip, closing and a saved Gemini report. The coding room passed three actual Judge0 cases, nonempty recording uploads and a task-specific Gemini follow-up. The storage audit found zero issues. Browser fallback/failure checks include controlled API events; backend tests use controlled provider responses. See [VERIFICATION.md](docs/VERIFICATION.md) for evidence and the unconfirmed supplemental code-format comparison.

The synthetic account login and report URL are in ignored `test-results/demo/demo-login.txt`. Credentials and user uploads remain ignored by Git.

## Remaining release work

- Hosted API/worker, MongoDB and durable media storage, with backups, restore checks, retention and monitoring.
- Automated cross-storage crash repair; the audit detects issues but does not repair them.
- Actual camera/microphone and other-browser checks, scoring calibration and company-fact review.
- Remaining dependency advisories and any separately authorized cleanup of personal uploads in old Git history.
- Later extensions such as persistent mentor history, broader coding tasks, phoneme-perfect avatar animation and interviewer-audio capture.

Git history has not been rewritten. Current changes can be reviewed on the `stage-0-safety-fixes` branch.
