# Repository assessment and implementation plan

Assessment date: 8 October 2026. Local base: `4e9e42c`, branch `stage-0-safety-fixes`. GitHub default: `origin/master` at `96505d1`. The local branch contains six additional commits; it is the implementation base. Existing untracked logs and screenshots are preserved.

## Folder map

| Folder | Responsibility | Assessment |
|---|---|---|
| `frontend/src/app` | Next.js App Router pages: authentication, dashboard, resume details, interview setup and reports | Working scaffolding; no persistent interview route at baseline |
| `frontend/src/components` | Navigation, resume results, interview room/report, mentor chat | Interview room owns too much volatile state; speech support incorrectly gates all interviews |
| `frontend/src/features` | Axios client, authentication context, resume upload | API URL normalization fails with `/api/`; profile uses a different ID shape after reload |
| `backend/src/routes`, `controllers` | Express API and HTTP orchestration | Ownership checks exist for reports; legacy interview APIs trust browser history and completion retries create duplicates |
| `backend/src/services` | Groq analysis, question planning, company search, PDF extraction | Resume failures fabricate a successful score; coding execution is incorrectly called a correctness test |
| `backend/src/models` | Mongoose users, resumes, completed interviews | No in-progress sessions or recoverable evaluation jobs at baseline |
| `backend/tests` | Node test runner | 32 baseline tests pass, mostly pure conversation rules; missing API, concurrency and ownership coverage |
| `integrity-service` | FastAPI/MediaPipe recording analysis | 17 baseline tests pass; not connected to report flow |
| `database`, `docs` | Schema and architecture notes | Several documents describe older implementations |
| Root analysis documents | Earlier audits and backlog | Useful design history, not a reliable statement of implemented or verified behavior |
| Ignored `.env`, uploads, dependencies and build output | Local runtime files | Preserve locally; never commit personal uploads or credentials |

## Confirmed failures, in execution order

1. **Recovery and completion.** Refresh destroys all interview state. A failed report request returns to setup and loses the transcript. Repeated completion can create duplicate reports. A client can alter its transcript and question plan.
2. **Accessibility and media lifecycle.** No speech recognition means no first question. The microphone is required even for people who want to type. Recognition restarts every 500 ms; recording assumes one browser codec and buffers everything in memory.
3. **Truthful results.** Failed resume analysis returns made-up skills and score 78. Missing score becomes 80. Code execution without expected outputs reports “passed tests.” Reports infer confidence and voice style from text.
4. **API boundaries.** Registration assumes strings; login accepts arbitrary field types; email normalization differs across reads/writes. Missing/invalid IDs and uploads become 500s. Chat accepts system messages from client history. Provider requests need bounds and timeouts.
5. **Recordings and ownership.** Upload writes before report ownership is checked. Failed/replaced uploads leave files behind. No interview deletion. Recording load failures remain on a loading message.
6. **Reproducibility.** README describes Vite although this is Next.js. `.env.*` ignores the example files. No integrated verification command or CI. Dependency audit needed.

## Implementation sequence and acceptance checks

| Phase | Deliverable | Acceptance check | Status |
|---|---|---|---|
| 1 | Server-owned sessions, immutable setup/resume snapshot, question budgets, typed answers, dedicated resume URL | Refresh keeps question/transcript; another account gets 404; concurrent turns advance once | Implemented; API and browser checks passed |
| 2 | Durable evaluation state, background processing, retry UI, report identity | Failure preserves answers; retries and worker restarts produce one report | Implemented; concurrency/failure/recovery checks passed |
| 3 | Continuous draft storage and consent-aware media, recoverable recording segments | Draft restored after reload; recording retries do not duplicate segments; all tracks stop on leave | Implemented; browser recording, reload, two-segment playback, storage migration and local deletion passed |
| 4 | Honest AI outputs, normalized evaluation, coding fixtures and sandbox integration | Malformed/provider failure never fabricates success; original questions/answers survive scoring; wrong code fails cases | Implemented; Gemini live checks with synthetic content and live Judge0 checks passed in all four languages, including wrong answers and compiler errors |
| 5 | Auth/input hardening, bounded requests, upload ownership/cleanup, report deletion | Invalid bodies return 4xx; cross-user operations fail; report and media deletion work | Implemented; API and report deletion browser checks passed |
| 6 | Connect optional integrity analysis and expose useful provider availability/errors | Service failure leaves a usable report; analysis never changes scores | Implemented; real Node-to-Python review and score-invariance checks passed |
| 7 | Documentation, dependency updates, API integration tests, browser checks and CI | Backend/Python tests, typecheck, production build and real browser recovery flow pass | Local checks passed; GitHub Node checks passed; missing Linux detector libraries are now declared in the Python job. Current results are in PR #1 |

## Verification strategy

- Exercise the real Express routes and local MongoDB in an isolated test database. Stub only external AI/sandbox calls for deterministic failure and concurrency tests.
- Test question/evaluation retries, duplicate submissions, simultaneous requests, ownership, invalid inputs, deletion and media replay.
- Use a running Next.js app and browser checks for setup, typed answer, reload, resume, completion, report and mobile layout.
- Report live provider checks separately from deterministic tests. At the initial assessment, local configuration had MongoDB and JWT settings but no AI or Judge0 key. Gemini, official public Judge0 and local Python review were connected and checked with synthetic data on 9 October 2026.

## Deployment and later product work

- Public GitHub history still contains personal resumes. Removing them requires a separately authorized history rewrite and coordinated force-push. Publishing the current branch does not rewrite that history.
- Production needs durable storage for media, a running evaluation worker, provider credentials, explicit frontend origin, monitoring and backup/retention policy. Local filesystem storage cannot survive an ephemeral deployment.
- Gemini now supplies server-generated interviewer speech. The current optional recording still captures the consented microphone/camera; mixing Alex's audio into it needs a separate capture change and disclosure.
- Human calibration of scoring, multiple evaluator models, true realtime conversation and provider-specific multilingual speech require additional product/data/provider work. Do not label these complete through UI placeholders.

See [verification results](VERIFICATION.md) for executed checks and their limits.

## Additional fixes made during verification

- Request logs now omit request bodies. Previously they included resume context and interview answers.
- Login and profile now return the same user ID shape. A temporary network outage keeps the login and offers retry.
- Resume and report deletion are exposed in the UI. Removed unused placeholder components and nonfunctional login controls.
- Job description attachments retain their own extracted text. Removing one no longer leaves its text hidden in the interview context or clears manually entered text.
- Form input labels now link to their controls. The landing-page feature links navigate to real pages.
- Recording upload calls wait for their own upload pass, so finishing cannot skip a newly saved final chunk. IndexedDB queries load only the current session's chunks. Discarding or deleting a session also removes that session's local drafts/chunks on the current browser, while preserving unrelated sessions.
- Next.js moved from 14.2.15 to 15.5.27, React to 19, Axios and vulnerable transitive dependencies were updated. Removed unused VAD, ONNX, Google SDK and nodemon dependencies. Builds no longer need Google Fonts network access.

## Remaining work, ordered for deployment

1. **Rehearse on the presentation laptop.** The Windows start/check/stop scripts are implemented and verified. Gemini live checks and seven public Judge0 checks passed. Real Node-to-Python review passed on port 8001. Keep internet available for external requests; use the fictional samples in `demo/`.
2. **Deploy API, worker, MongoDB and durable media storage together.** The worker currently runs in the API process. Configure frontend origins, trusted proxy handling, backups and storage monitoring. Exercise restart/reconnect behavior on the intended host.
3. **Media lifecycle policy.** Upload/discard races and junction/path escapes now have regression coverage. A read-only `storage:check` command detects missing files, owned chunk orphans and counter mismatches. The local audit found zero issues. Automated crash repair, explicit retention, backup restore and cleanup of copies in other browser profiles still need deployment work. File and MongoDB updates are not a single transaction.
4. **History cleanup.** Coordinate collaborators and explicitly authorize a history rewrite before removing old personal uploads from GitHub history. This is still pending. Current uploads are excluded from Git; the earlier history has not been rewritten.
5. **Dependency follow-up.** Frontend production dependency audit now reports zero vulnerabilities. Seven findings remain in the Tailwind 3 build-tool dependency chain; fixing these needs a deliberate Tailwind 4 migration or upstream fixes. Backend has three moderate findings through Mammoth's argparse/sprintf-js CLI dependency chain. Do not use npm audit fix --force, which proposes an obsolete Mammoth version. Review the CLI exposure and upstream fix before release.
6. **Product extensions.** Interviewer-audio recording, precise phoneme/video animation, broader calibrated coding tasks, cross-browser hardware testing, persistent mentor conversations and human-calibrated scoring remain future work. The current coding library has two explicit stdin/stdout tasks. Other questions report execution-only results rather than claiming correctness.

The old backlog's multi-model scoring, automatic video review, session expiry sweeper, wake-lock/primary-tab coordination, automated retention, and realtime speech are not silently marked complete. Saved sessions currently expire for new answers after 24 hours, allow evaluation of submitted answers, and use sequence checks to handle competing tabs.

## Feature status

| Feature | Current implementation | What still needs verification or work |
|---|---|---|
| Registration/login/profile | Validated inputs, normalized emails, stable user ID, transient connection retry | Production TLS, token/session policy and abuse monitoring |
| Resume upload/analysis/history/delete | Real PDF extraction, bounded files, truthful provider failure, owned records and deletion | Gemini analysis passed with synthetic resume text; real content and score quality need human review |
| Mentor chat | Bounded user/assistant history, private context, duplicate-send protection | Live Gemini response passed; saved conversations are a separate extension |
| Company brief and JD | Real TXT/PDF/DOCX extraction, removable attachment text, server-side company cache | Live research flow passed for a public company; factual quality and freshness need review |
| Interview setup and question progression | Role/type/experience context, server budget and saved question/answer sequence | Live model quality across interview types |
| Recovery and feedback | Same session URL, same-browser unfinished drafts, saved answers across devices, durable report retry | Deployment restart/reconnect exercise; human score calibration |
| Visible interviewer and speech | Local human avatar, unscored greeting/readiness, Gemini question audio and spoken-answer transcription; optional captions/typing, explicit Finish answer and answer-language selector | Real hardware/browser coverage, phoneme-perfect animation and interviewer-audio capture; questions currently spoken in English |
| Recording/playback/delete | Explicit consent, private chunk uploads, separate resume segments, local cleanup | Real hardware across browsers, storage reconciliation/retention, copies in other browser profiles |
| Coding | Real editor, code included in answer, Judge0 adapter and two owned test sets | All four languages checked live; more calibrated problems remain |
| Optional video presence review | Consent-gated report action, shared private file service, quality suppression, separate from score | Local shared-volume integration passed; verify the intended deployment volume |
| Operations | Health, rate/usage limits, environment examples, reproducible lockfiles, CI | Windows launcher and read-only storage audit passed; persistent hosting, backup restore, monitoring and dependency follow-up remain |

On 9 October 2026 the backend gained a provider selector. `AI_PROVIDER=gemini` uses the Gemini API with `GEMINI_API_KEY` and configurable `GEMINI_MODEL`; `AI_PROVIDER=groq` retains the existing Groq integration. The local key stays in ignored `backend/.env`. The frontend's public provider label comes from `NEXT_PUBLIC_AI_PROVIDER` and should match the backend when deploying.

## Final demo fixes on 9 October

- Connected the official public Judge0 endpoint, with token polling and all-language live checks.
- Connected the actual local Python review service, including incomplete-review notices and retryable transport failures.
- Added safe Windows start/check/stop scripts with process ownership checks.
- Added configurable upload storage, physical path checks, upload/discard race protection and a read-only storage audit.
- Expired sessions now hide unanswered questions and retain submitted answers for evaluation.
- Company search now rejects challenge pages, falls back to matching public encyclopedia background and shows fetched source links with retrieval time.
- New reports no longer claim a default clean integrity result. Only real recordings and consented review results appear. Legacy recordings remain readable without invented success messages.
- Mobile navigation wraps instead of forcing a wide page. Transcript and report containers allow text wrapping.
- Added a fictional resume, matching job description and runnable coding example for the presentation.

## Conversational interview update

- Introduced Alex as an AI practice interviewer with a personalized welcome, explicit Begin, neutral acknowledgement and warm closing.
- Made substantive short answers eligible for one focused follow-up, while skips, uncertainty, introductions and closing avoid repeated probing.
- Kept greeting and acknowledgement metadata separate from the actual scored question, with durable retry and older-session compatibility.
- Added opt-in browser speech, English voice choice, replay/stop, real speech-event status and capture cancellation during navigation.
- Replaced the plain form with a responsive interviewer room, saved dialogue and compact mobile settings. Draft status reflects storage completion and stale restore notices clear after submission.
- Following the user's clarification, added a visible animated person and video-call layout. Joining starts a separate greeting/readiness conversation before the scored question, with a new phase key so an old zero-answer session does not silently skip it.
- Connected bounded owner-checked Gemini speech using the existing backend key, with caption headers, replay caching, safe failures and cancellation of late playback. The local CC0 avatar moves its mouth with actual audio amplitude; no paid avatar account is needed.
- Added Gemini transcription for spoken answers after a real Chrome probe detected speech but returned no transcript. The microphone captures only after activation, Finish answer commits the response, and pauses do not submit. The audio clip stays in memory for retry; optional interview recording remains a separate consented feature.
- Made the person and microphone controls the primary interface. Captions, written answers and conversation history remain available on demand. Softer lighting, closer framing and restrained mouth movement improve the existing avatar without another provider account.

The interaction rationale and source links are in [CONVERSATIONAL_INTERVIEW.md](CONVERSATIONAL_INTERVIEW.md). The actual service/browser checks and their limits are in [VERIFICATION.md](VERIFICATION.md).
