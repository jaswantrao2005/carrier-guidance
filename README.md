# CareerAI

Next.js frontend, Express/MongoDB API, Gemini or Groq resume analysis and interview practice, Judge0 code execution, and optional Python video-presence review.

Start with the [repository assessment and implementation plan](docs/IMPLEMENTATION_PLAN.md). Earlier root-level analysis documents are historical design notes, not current implementation status.

## Team demo on this laptop

From the `analysis` folder, start the configured app and its services in the background:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-demo.ps1 -OpenBrowser
```

Open [localhost:3000](http://localhost:3000). Follow the [presentation guide](docs/TEAM_DEMO.md) for rehearsal, service checks and safe shutdown. Saved data survives a stop/start. The launcher uses the installed Python environment for optional video review and refuses ports owned by other applications.

## Requirements and setup

- Node.js 22 or later, npm, MongoDB 7 or later.
- Gemini API key for resume analysis, interview questions, feedback, mentor chat, interviewer speech and spoken-answer transcription. Groq is an optional alternative for the text features; natural audio and Gemini transcription still use the Gemini key.
- Judge0 endpoint for code execution. The configured official public endpoint needs no API key. Private hosting and RapidAPI are also supported; see [coding setup](docs/CODING_SETUP.md).
- Python only for optional video-presence review.

From the repository root:

```powershell
npm --prefix backend ci
npm --prefix frontend ci
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.local.example frontend/.env.local
```

Copy examples only on a fresh checkout. Preserve existing environment files. Set MongoDB, JWT and `GEMINI_API_KEY` in `backend/.env`. Set `AI_PROVIDER=gemini` and use the default `gemini-3.5-flash-lite` model, or choose Groq with `AI_PROVIDER=groq` and `GROQ_API_KEY`. Keep `NEXT_PUBLIC_AI_PROVIDER` in the frontend environment aligned so the consent screen names the active provider. Never commit credentials or uploads.

In separate terminals:

```powershell
npm --prefix backend run dev
npm --prefix frontend run dev
```

Open http://localhost:3000. The API uses port 5000. `NEXT_PUBLIC_API_URL` accepts the backend origin with or without `/api` or a trailing slash. `FRONTEND_ORIGINS` must include the actual frontend origin.

## Features

Register and upload a PDF up to 5 MB. Resume text is sent to the configured AI provider and saved with its analysis. Provider failures return an error; they never fabricate a successful score.

For a Gemini free-tier project, [Google says submitted content may be used to improve its products](https://ai.google.dev/gemini-api/docs/pricing). Use synthetic resumes and answers while testing.

Select interview role, type, duration and optional resume/JD/company context. Accept transcript processing and choose recording permissions separately. Spoken answers use Gemini transcription after an explicit microphone action. Typing and captions remain available. Audio/video recording starts only when explicitly selected inside the room and is separate from the temporary audio used to transcribe a spoken answer.

Meet Alex, a visible animated AI interviewer. Choose Join with voice for a Gemini-spoken greeting, then respond Ready to begin or A little nervous before the first scored question. The warm-up is unscored. Use Speak answer to enable the microphone and Finish answer to send the spoken response; no typing is required. Join without audio, captions, typing, replay and stop remain available. The local human model has approximate mouth movement driven by playback; it is an AI avatar. See [CONVERSATIONAL_INTERVIEW.md](docs/CONVERSATIONAL_INTERVIEW.md).

Questions and submitted answers save to MongoDB. Unfinished text/code drafts and pending recording chunks save continuously in IndexedDB. Untranscribed microphone answers stay only in memory until submitted or discarded. Pause and return through the session URL or setup page's Resume link. Unsubmitted text/code drafts require the same browser profile; submitted answers can be resumed on another device.

Finishing queues evaluation in MongoDB. The API process polls every two seconds. Failed evaluations remain retryable. Database leases coordinate multiple workers and expire after five minutes following a crash. A crash after an external AI call but before saving can repeat the call, while the report still has one stable identity.

Reports expose owned recordings, optional presence review, and deletion. Deleting a report also deletes its session and known recordings. Resume deletion is available on the resume detail page.

## Optional presence review

Follow [integrity-service/README.md](integrity-service/README.md). Set its `RECORDINGS_DIR` to the absolute `backend/uploads/recordings` directory and set `INTEGRITY_SERVICE_URL` in the backend. The services require a shared recording volume when deployed separately. Keep the Python service private.

Candidates who consented can run video review from their report. Low-quality footage suppresses observations. Presence observations never change interview scores.

## Checks

```powershell
npm --prefix backend test
npm --prefix backend run coding:check
npm --prefix frontend run build
npm --prefix frontend run typecheck
```

Backend tests require local MongoDB, or `TEST_MONGO_URI` pointing to a dedicated test host. Each run creates/removes its own generated test database. External providers are controlled in tests. `coding:check` executes seven synthetic checks against the configured real Judge0 service. It needs internet for the public endpoint.

```powershell
cd integrity-service
.\.venv\Scripts\python.exe -m pytest -q
```

## Structure

```text
backend/src/
  controllers/        HTTP handlers
  models/             Accounts, resumes, reports, sessions, recordings, quotas
  routes/             Auth, resume, chat, interview and session APIs
  services/interview/ Session lifecycle, worker, coding, recordings, video review
  services/ai/        Provider selection and Gemini request adapter
  services/gemini/    Resume and interview prompts (historical folder name)
  services/groq/      Optional Groq client and mentor chat prompts
frontend/src/
  app/                Next.js pages, including interview/[sessionId]
  components/         Shared UI, interview room and report
  features/           Auth/API clients, interview types and browser storage
integrity-service/    Optional FastAPI/MediaPipe service
docs/                 Current plan, architecture and API documentation
database/             Historical schema notes
```

## Deployment limits

Use persistent upload storage and a continuously running API worker. Ephemeral/serverless API hosting can lose media or suspend queued work. Back up MongoDB and media together. Uploads have no public static route.

Daily account limits: 20 interviews, 20 resume analyses, 100 mentor messages, 50 code runs, 30 research requests, 20 report retries and 10 video reviews, resetting at UTC midnight. IP limits are process-local. Configure trusted proxies to match your host before scaling; do not blindly trust forwarded IP headers.

Recordings are limited to 250 MB per interview. Crashes may lose the recorder's current unflushed chunk. Recordings capture the consented candidate microphone/camera; Alex's generated speech is not mixed directly into them. Retention policy, storage reconciliation and interviewer-audio capture remain separate deployment/product work.

Public Git history contains old personal uploads. Ignoring new uploads does not erase old commits. Removal requires a coordinated history rewrite and force-push, neither of which this local implementation performs.
