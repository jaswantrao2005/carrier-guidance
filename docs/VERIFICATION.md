# Verification results

Verified locally on 8 and 9 October 2026 against the implementation on `stage-0-safety-fixes`. This is a local working-tree change; no commit, push or deployment was performed.

## Automated checks

| Check | Result |
|---|---|
| `npm --prefix backend test` | Latest complete run: 88 passed, 0 failed, 0 skipped |
| `.\.venv\Scripts\python.exe -m pytest -q` from `integrity-service` | 18 passed |
| `npm --prefix frontend run build` | Next.js 15.5.27 production build passed; all pages compiled/generated |
| `npm --prefix frontend run typecheck` | Passed |
| `git diff --check` | Passed; only a Git line-ending notice for tsconfig |
| Frontend `npm audit --omit=dev` | 0 findings at verification time |

Backend integration tests use real Express HTTP routes and real local MongoDB. Each test run chooses its own `careerai_test_<uuid>` database and removes only that database. External AI/sandbox calls are controlled fixtures.

New coverage includes concurrent session creation, question generation leases, concurrent duplicate answers, lost-response retries, committed-answer recovery after provider failure, ownership and consent, ordered recording playback, content-digest conflicts, durable evaluation failure/retry, stable report identity, expired worker lease recovery, malformed inputs, concurrent daily quotas and video-review suppression without score changes. Unit coverage checks fabricated resume scores, transcript rewriting and code-output correctness.

## Real browser checks

Headful Chromium exercised the production frontend, actual API routes and an isolated MongoDB database. Only external AI responses were replaced with deterministic responses. Synthetic accounts, resume text and a simulated camera/microphone were used; no real personal media was captured.

- Register, log in, load dashboard and create an interview.
- Complete typed-answer flow with browser speech recognition unavailable.
- Restore an unfinished answer after reload; retain submitted answers after reload.
- Pause and resume through the saved session URL.
- Simulate first evaluation failure, reload, retry and open the saved report.
- Confirm the interview UI fits a 390-pixel viewport without horizontal overflow.
- Upload a generated valid PDF through the real extractor; display resume results; send mentor chat.
- Upload a TXT job description, show a company brief and enter the consent flow.
- Generate real browser MediaRecorder chunks from a simulated camera, upload them, reload and create a second segment.
- Finish during recording, load both recorded segments and verify the browser decodes video frames.
- Migrate an existing version-1 IndexedDB store to version 2 and preserve an unrelated draft.
- Delete an interview and its current-browser drafts/chunks; delete a resume and verify the empty dashboard.
- Type in the actual Monaco code editor, recover code after reload and show a clear configuration error when Judge0 is unavailable.
- Discard an unfinished coding interview and verify its saved browser draft is removed.

These flows reported no browser runtime errors. Temporary Playwright scripts were run outside the repository; browser checks are not part of the added GitHub Actions workflow.

## Limits and remaining checks

At the 8 October check, no Groq or Judge0 key was available. The results above used controlled AI responses and did not establish live provider availability. See the 9 October update below for Gemini live checks. Model quality and production load remain unverified. Actual Judge0 checks are recorded below.

A real local Node-to-Python shared-volume check passed on port 8001 with synthetic video, persisted results and unchanged interview score. Long-video processing and the intended hosting volume still need deployment checks. Real cameras, microphones, Safari/Firefox and multilingual browser speech were not tested.

The frontend full audit still has seven findings in the Tailwind 3 build-tool chain. The backend audit has three moderate findings in the Mammoth/argparse/sprintf-js chain. No forced dependency downgrade was applied. See the [ordered remaining work](IMPLEMENTATION_PLAN.md#remaining-work-ordered-for-deployment).

Filesystem and MongoDB updates are not one transaction. Known-file deletion, upload/discard race checks and junction/path containment passed. The read-only storage audit found zero local issues. Automated crash repair, retention, storage monitoring and cleanup of copies in other browsers remain deployment work. The initial checks were local; subsequent GitHub Actions results are recorded below.

## 9 October 2026: Gemini connection

- Configured Gemini locally in ignored `backend/.env` and selected `gemini-3.5-flash-lite`. The key is absent from tracked files and test output.
- Sent a short synthetic prompt to Google's API and received a successful text response.
- Called the application's real resume analysis, interview question generation, one-answer evaluation, mentor chat and company research services with synthetic/public data. All five returned usable results; evaluation preserved the submitted answer. These checks exercise the real Gemini service.
- Added adapter tests for prompt mapping, JSON mode and safe key/quota errors. Backend suite: **47 passed, 0 failed**. The automated tests remain deterministic and use controlled provider responses.
- The frontend production build passed with the Gemini provider label and free-tier notice.
- The original Gemini-only check did not include Judge0. The subsequent connection checks below use the actual public service.

## 9 October 2026: Coding, video, storage and launcher

- Official public Judge0 on https://ce.judge0.com passed seven real checks: correct sums in JavaScript, Python, Java and C++; incorrect output; first unique character; Java compiler failure. No API key was required. Submissions use queued token polling and server-owned expected outputs.
- The real Node-to-Python check assembled private chunks, decoded 12 synthetic frames, persisted a reliable review and retained the original score. MediaPipe tests: 18 passed.
- Storage regression tests use temporary upload directories and generated databases. They cover outside paths, a junction escape, already missing files, metadata traversal and session discard at both upload-write boundaries. All fixture files/databases were removed. The read-only local audit found zero issues.
- The Windows launcher passed initial startup, repeat startup, safe shutdown including the Python child process, restart and unavailable-Mongo preflight. MongoDB and saved data survived stopping. All managed services were healthy after the production rebuild.
- Company lookup returned actual sourced snippets for Google, Microsoft and Stripe. Forced DuckDuckGo challenge responses recovered through real matching Wikipedia extracts. Briefs attach fetched source URLs and retrieval time, with current-news limits stated in the UI. Seven company-search/research tests passed.
- Backend complete suite after these changes: 68 passed. Logs are in ignored test-results/demo/backend-tests.log.

## Final live browser rehearsal

Headful Chromium used the managed production app, real local MongoDB, Gemini, public Judge0 and Python. Only fictional account/resume/JD/code/answers and simulated media were used. The account and completed report remain available; no existing user data was deleted.

Registration/login, real PDF extraction and Gemini analysis, mentor chat, sourced company briefing, draft reload, pause/resume, Monaco with three passing Judge0 cases, background Gemini evaluation, private recording playback and actual Python report review passed. The interview score stayed unchanged after video review.

The rehearsal caught empty company lookup, unsupported legacy report messages and mobile navigation overflow. These were fixed and rebuilt. Final report checks passed at 390, 768 and 1366 pixels, verified misleading messages were absent, and found no runtime errors after reload. The 11 session integration tests passed again after the model change.

Ignored evidence is under `test-results/demo/`: `live-verification.json`, `report-verification.json`, `backend-tests.log`, `backend-session-tests.log`, `company-brief.png` and `report-390.png` / `report-768.png` / `report-1366.png`. Login values are local and absent from this document.

## Conversational interviewer on 9 October

The full backend suite passed 78 tests. The 42 conversation/session tests passed again after aligning the submitted-code marker with the frontend's language-labelled format. Frontend TypeScript passed after the mobile and capture-lifecycle fixes.

Headful Chromium against actual Gemini/API/MongoDB passed the personalized welcome and explicit Begin, opt-in voice/replay/stop, draft and preference recovery after reload, a project-specific personal-contribution follow-up, pause/resume, one-action skip, closing and a completed Gemini report containing only the actual scored Q&A. Report URL and check details are in ignored `test-results/demo/conversation-verification.json`; synthetic login details are in `conversation-login.txt`. Speech API events were simulated to verify controls and cancellation. Actual installed voice quality was not asserted.

The first production coding check passed three actual Judge0 cases but did not complete recording verification. The temporary helper needed to wait for nonempty native recording data and the completed stop/flush before checking saved metadata. Instrumentation showed one retry stopped the simulated camera within a millisecond and produced only an empty chunk, which the app correctly ignored. A separate retry injected code before Monaco's change handler was ready; the test now types through the real editor. Final coding/upload results are recorded below rather than treating those incomplete rehearsals as passes.

Independent visual review passed the desktop design, dark mode, draft recovery, skip cancellation and real saved-answer/next-question flow. It identified mobile controls before the primary action and a stale restored-draft banner; both were refined. The microphone restart and late permission bugs were reproduced in controlled browser tests before fixing them. Final production checks and evidence are recorded below.

- The rebuilt capture-lifecycle regression checks passed. Stopping dictation during the pending restart left one recognition start, rather than two. Resolving a held camera-permission promise after a real Next client-route unmount constructed no recorder and stopped the returned track. These controlled checks sent no answers, uploaded no recordings and used no physical devices. Safe evidence is in ignored `conversation-race-verification.json`.
- The final production rebuild passed compilation, type checking and generation of all pages. The managed health check confirmed frontend, backend/MongoDB, storage, Gemini configuration, coding configuration and the reachable Python service. The final greeting helper also passed twelve direct checks for generic or already personalized greetings and names containing punctuation.
- Final independent browser review passed on the rebuilt app. An already personalized greeting remains intact, Begin persists after reload, and compact settings/question screens fit 375, 390, 768, 1366 and 1440 pixels without horizontal overflow or page errors. Root independently inspected the refreshed desktop/mobile images in ignored `conversation-final-desktop.png` and `conversation-final-mobile.png`.
- The separate live coding rehearsal passed visible Monaco keyboard entry and all three actual Judge0 cases. Native MediaRecorder from Chrome's simulated devices produced two nonempty chunks; both uploads returned HTTP 200, a fresh session GET confirmed one segment with 50,171 bytes, and the local upload queue emptied. Gemini asked about the submitted `split`/`map` solution's time and space complexity, acknowledged the code and retained the `sum_integers` task for the follow-up.
- Safe coding evidence is in ignored `conversation-independent-coding-verification.json`. A supplemental raw substring comparison against the saved code failed and remains unconfirmed after the disposable session was deleted. The code-run comparison normalized CRLF/LF and passed, while that later comparison did not. The saved code was visible in the conversation screenshot. This formatting comparison is not recorded as a passing assertion.
- Only the isolated rehearsal sessions/media were removed. The final read-only storage audit found zero issues, including missing files, orphans and byte-counter mismatches. Evidence is in ignored `conversation-independent-storage-audit.json`. Managed services remain running at `http://localhost:3000`.

Some temporary browser helpers stalled during launch or cleanup. The completed checks above used a bounded owned-browser lifecycle and visible UI waits; unsuccessful helper attempts are not counted as application passes. No physical camera, microphone or installed voice quality was verified.

## Visible person and natural voice on 9 October

The latest complete backend suite passed **88 tests**. Speech coverage checks session ownership/current sequence, server-owned captions, allowed warm-up kinds, WAV validation, bounded provider reads, cancellation, caching and rate limits with controlled provider responses. Frontend TypeScript and the production rebuild passed. The managed health check confirmed the frontend, backend/MongoDB, storage, configured Gemini/coding and reachable Python service.

Headful Chromium then used the rebuilt production app and an isolated legacy zero-answer session. Alex's actual 3D canvas was visible before Join, with no audio or media-permission request. The first scored question/composer remained hidden during the welcome. Actual Gemini Kore speech returned HTTP 200 WAV for greeting, readiness and the first question; all three played through native Web Audio to completion. PCM activity and paired speaking/rest images confirmed the animated mouth. The readiness flow made **zero answer POSTs**.

Started phase and an unfinished draft survived reload without replaying the full warm-up. Controlled unavailable-speech and browser-fallback checks retained a usable Start questions path. After Stop, Replay greeting started a second native browser utterance; a second Stop restored the idle greeting. A forced model-load failure displayed the labelled still portrait of the same person. Stopping an intercepted delayed speech request left the room idle with zero late audio or browser-speech starts. These failure/replay checks did not make provider calls.

Independent round-one visual review passed. Lobby and question screens fit 375, 390, 768, 1366 and 1440 pixels without horizontal overflow. No browser runtime errors were recorded. Root inspected the actual desktop, phone and greeting images. Safe ignored evidence: `person-interview-functional-evidence.json`, `person-interview-greeting.png`, `person-interview-desktop.png` and `person-interview-mobile.png` under `test-results/demo/`. The owned browser closed cleanly; only the disposable session was discarded and its absence confirmed. Managed services remain running.

The person is a locally rendered AI avatar with approximate audio-amplitude mouth movement, not a photoreal live video feed or phoneme-perfect animation. Natural Gemini playback was verified; installed browser fallback voice quality, physical devices and other browsers remain unverified. Existing capture/scoring limits above still apply.

## Start interview returning to setup on 9 October

Reproduced the reported return in the real browser: a fresh creation returned 201 and opened the room, while an existing unfinished session returned `409 ACTIVE_SESSION_EXISTS` and the frontend silently hid the consent screen. The page now labels its primary action Resume interview for a saved session, or View interview progress during evaluation, and opens the saved room directly. A creation conflict also opens the returned room. Duplicate clicks are guarded through navigation, and ordinary errors allow retry.

Typecheck, production build and diff checks passed. The rebuilt browser checks passed all four cases: known-session Resume with no create POST, even with an empty custom-role field; a stale active-session lookup followed by an actual 409; an intercepted 500 that keeps consent/error/retry usable; and a fresh actual 201 that opens the new lobby. No browser runtime errors or media requests occurred. The backend and Python service stayed running while only the managed frontend was rebuilt. The original demo account/report and saved user sessions were preserved.

The initial failure reproduction is in ignored `test-results/demo/start-interview-repro-evidence.json`. A temporary test selector matched Next's empty route announcer as well as the visible error; narrowing that selector allowed the remaining error/retry checks to finish. That helper failure was not an application failure.

## Spoken answers and portrait refinement on 9 October

An isolated headful Chrome 154 check fed synthetic speech through Chrome's simulated microphone. Native browser recognition emitted audio and speech events but returned no transcript and no explicit error. This did not establish working dictation, so the primary answer path now uses the existing Gemini key for transcription. Browser dictation remains an optional alternative.

The complete backend suite passed **96 tests, 0 failed, 0 skipped** after adding the transcription route. New coverage includes ownership, consent, current sequence before and after the provider response, PCM WAV validation, duration and response bounds, deadlines, cancellation and safe provider errors. Automated provider responses are controlled; these tests do not claim live model accuracy.

A separate real Gemini service call accurately transcribed a synthetic 3.28-second clip in 2.4 seconds using the new structured response contract. The route accepts at most 120 seconds of mono PCM audio and does not itself save an answer or advance the interview. Captured dictation audio is kept temporarily in browser memory for retry; optional saved recordings remain separate.

Standalone renders of the actual avatar component passed at three aspect ratios with no runtime errors. Lighting and framing now preserve more facial texture, and a single restrained jaw movement replaces the doubled mouth deformation. The original CC0 model is unchanged. This remains a rendered AI avatar with approximate audio-driven movement.

The unified frontend typecheck and production build passed after integrating the voice-first room. Independent code review checked submission/sequence guards, automatic listening, pending microphone cancellation and retained-audio retry. It caught and fixed a case where editable fallback text could be overwritten by retrying an older clip. Retained audio now requires an explicit discard choice before text editing/submission. Native fallback checks cover trailing final words, once-only Finish, withdrawn interim text, empty restarts and cancellation.

Both managed backend and frontend were restarted for the new route/build. Health checks passed for the frontend, backend/MongoDB, storage, Gemini/coding configuration and reachable Python review service. MongoDB and existing saved data were preserved.

Ignored evidence: `native-recognition-probe-evidence.json`, `voice-transcription-service-probe.json`, `avatar-portrait-verification.json` and `backend-voice-tests.log` under `test-results/demo/`. These checks used synthetic media and no physical camera or microphone.

The rebuilt production browser rehearsal opened a fresh session with an actual 201 response, played the actual Gemini greeting/readiness/first question, and made no microphone request before Speak answer. Chrome's simulated microphone fed a 10.624-second candidate answer through the native AudioWorklet. Gemini transcription returned 200 with 137 characters, including the final words. Exactly one answer request returned 200 with `inputMode: speech`. Alex's next actual Gemini question played to completion, then automatic listening began. No browser runtime errors were recorded.

The helper subsequently failed while reading an optional uploaded-WAV metric: Chromium did not expose the multipart file bytes through `request.postDataBuffer()`. The capture metrics, successful API responses and playback/listening events were already saved in `voice-first-main-evidence.json`. That helper assertion is not counted as a passing check. Its cleanup removed only the fictional session and closed the owned browser. Initial desktop inspection also found an empty strip beside the portrait; final layout and recovery checks follow below after correction.

The portrait host now has an explicit full width and desktop height. The rebuilt canvas fills the stage at 375, 390, 768, 1366 and 1440 pixels, with no horizontal overflow. The default question view keeps the textarea and captions hidden; both remain available from the controls. Root inspected the corrected desktop and phone captures in `voice-first-desktop.png` and `voice-first-mobile.png`.

A controlled transcription 503 followed by a 200 retry reused the identical retained 16 kHz WAV without opening another microphone. The real answer endpoint saved exactly one speech turn, and a fresh state GET confirmed persistence. The initial helper checked a `readonly` attribute although the UI intentionally disables retained-audio editing; correcting the helper assertion confirmed the intended behavior. No application change was needed for that assertion.

Further production checks passed controlled permission denial with readable fallback, cancellation of late microphone permission with track cleanup, silence with no transcription/answer POST, cancellation of pending transcription with no late answer, real IndexedDB draft recovery and optional captions. Controlled native recognition retained final words after Stop, removed withdrawn provisional words and submitted once on double Finish. The coding workspace and Monaco remained accessible. A helper initially searched for the wrong visible coding-region label; the actual labelled region rendered correctly.

Independent round-two visual review passed the corrected stage and responsive layouts. Safe evidence is in `voice-first-round2-evidence.json`; failures deliberately injected by the helper are separate from the real Gemini speech/transcription check above. Final health checks passed for the frontend, backend/MongoDB, storage, AI/coding configuration and Python review service. Physical devices, other browsers and multilingual recognition remain unverified.

The completed round-two run passed 13 browser checks with zero page errors. Interviewer playback stopped active answer capture; Stop prevented automatic listening after a delayed playback end. Pause/leave during pending transcription stopped tracks and ignored late text without an answer POST. Controlled WebGL unavailability displayed the labelled still portrait, and the dark/reduced-motion screen rendered. The two owned browser helpers exited and their browsers closed. Only disposable test sessions were removed, with removal confirmed in the evidence; the original demo account/report and managed app remain available.

## GitHub Actions Linux runtime correction on 9 October

The initial [push run](https://github.com/jaswantrao2005/carrier-guidance/actions/runs/37889175585) and [pull-request run](https://github.com/jaswantrao2005/carrier-guidance/actions/runs/37891729605) passed the Node job. Both Python jobs installed the requirements and downloaded the model, then reported 10 passing and 8 failing tests. Every failure came from loading MediaPipe's native library: `libEGL.so.1` was absent from the Ubuntu runner.

Inspection of the published MediaPipe 1.1.0 Linux wheel confirmed direct dependencies on `libEGL.so.1` and `libGLESv2.so.2`. The workflow now installs Ubuntu's `libegl1` and `libgles2` packages before Python dependencies, and the service README includes the matching Linux setup. The full 18-test suite remains enabled. The local suite passed again, and workflow syntax/triggers were checked. Fresh Linux results are available in [PR #1 checks](https://github.com/jaswantrao2005/carrier-guidance/pull/1/checks).
