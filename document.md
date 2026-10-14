# CareerAI / carrier-guidance — Codebase Analysis

**Repo:** https://github.com/jaswantrao2005/carrier-guidance
**Analyzed commit:** `96505d1` ("Full update", 2026-09-04) · 29 commits · branch `master`
**Cloned to:** `analysis/`

This document explains what the project *is*, how it *actually works* (not what the README claims), and what is broken or risky. It is written to be read top-to-bottom by someone who has never seen the code.

> **Part 2 — [interview-platform-analysis.md](interview-platform-analysis.md)** goes deep on the live interview / "video conferencing" subsystem: 12 confirmed defects, why there is in fact no WebRTC anywhere in the codebase, the legal exposure (DPDP, NYC LL144), a researched target architecture with vendor selection, a verified per-interview cost model, and a staged migration plan.

---

## 1. What this project is

An **AI-powered career guidance and mock-interview platform**. A student / job-seeker can:

1. **Register / log in** (email + password, JWT).
2. **Upload a resume PDF** → the backend extracts the text and sends it to an LLM, which returns an **ATS score (0–100)**, a candidate summary, technical/soft skills, missing skills, strengths, weaknesses, and suggested career roles.
3. **Chat with an AI career mentor** that already knows their resume, and ask it for a learning roadmap to a target role.
4. **Take a voice-driven AI mock interview** — the browser *speaks* the question aloud, listens to the spoken answer via speech recognition, and adapts the next question. Supports 12 interview types (HR, Technical, Behavioral, Coding, Panel, …), 11 Indian languages, an optional live coding editor, webcam recording, and anti-cheating proctoring.
5. **Get a graded report** — per-question feedback (good / bad / improved), 7 category scores, strong & weak areas, tech gaps, and a study roadmap.

It is a **portfolio / final-year-project scale** application: feature-rich and ambitious, but with a number of real correctness and security problems (Section 8).

---

## 2. Tech stack (what's actually in the code)

| Layer | Actual technology |
|---|---|
| Frontend | **Next.js 14.2.15 (App Router)**, React 18.3, **TypeScript**, Tailwind CSS 3.4 |
| UI extras | framer-motion (animation), lucide-react (icons), react-markdown, **@monaco-editor/react** (VS Code editor for the coding round) |
| Voice | Browser **Web Speech API** (`SpeechSynthesis` for TTS + `SpeechRecognition` for STT) + `@ricky0123/vad-react` (voice-activity detection, runs ONNX in-browser) |
| Backend | **Node.js + Express 4** (CommonJS) |
| Database | **MongoDB** via Mongoose 9 |
| Auth | **JWT** (`jsonwebtoken`) + **bcrypt** hashing |
| File handling | **multer** (disk storage), `pdf-parse-new` (PDF → text), `mammoth` (DOCX → text) |
| AI | **Groq SDK**, model **`openai/gpt-oss-120b`** for *everything* |
| Code execution | **Judge0** via RapidAPI |
| Web search | **DuckDuckGo HTML scraping** (no API key) |

> ⚠️ **The README is wrong in several places.** It says "React + Vite + React Router" — the app is **Next.js App Router**; there is no Vite and no React Router. It lists `@google/generative-ai` (Gemini) as the AI brain — Gemini is a **dependency but is never actually called**; every AI call goes to Groq. The folder is still *named* `services/gemini/` for historical reasons, which is confusing: `services/gemini/career.service.js` uses Groq.

---

## 3. Repository layout

```
carrier-guidance/
├── backend/
│   ├── src/
│   │   ├── server.js            # entry: dotenv → connect DB → listen
│   │   ├── app.js               # express app, CORS, routes, static /uploads
│   │   ├── config/db.js         # mongoose connect
│   │   ├── routes/              # auth, resume, chat, interview, health
│   │   ├── controllers/         # request handling
│   │   ├── services/            # business logic + AI calls
│   │   │   ├── gemini/          # (misnamed — actually Groq)
│   │   │   │   ├── career.service.js     # resume → ATS analysis
│   │   │   │   └── interview.service.js  # next question + final report
│   │   │   ├── groq/
│   │   │   │   ├── groqPool.js           # multi-API-key rotation
│   │   │   │   └── chatbot.service.js    # career mentor chat
│   │   │   ├── search/
│   │   │   │   ├── search.service.js     # DuckDuckGo scraper
│   │   │   │   └── research.service.js   # company research (BROKEN)
│   │   │   ├── resume/resume.service.js  # PDF text extraction
│   │   │   └── auth/auth.service.js      # register/login
│   │   ├── middlewares/         # auth, error, logger, upload, video
│   │   ├── models/              # User, Resume, Interview
│   │   └── validations/         # register field validation
│   ├── uploads/                 # real resume PDFs COMMITTED to git (5.9 MB)
│   ├── interview_copy.js        # dead backup file
│   ├── listModels.js, testGroq.js, testGeminiAnalysis.js   # ad-hoc scripts
│   └── tests/career.service.test.js   # the ONLY test (node:test)
├── frontend/
│   └── src/
│       ├── app/                 # Next.js routes
│       │   ├── page.tsx                     # landing page (361 ln)
│       │   ├── (auth)/login, (auth)/register
│       │   ├── dashboard/                   # resume history + ATS + chatbot
│       │   ├── dashboard/resume/[id]/
│       │   ├── resume-upload/
│       │   ├── mock-interview/              # setup wizard (1129 ln)
│       │   └── mock-interview/report/[id]/
│       ├── components/ui/       # InterviewRoom (980 ln), InterviewReport (473 ln), …
│       ├── components/layout/   # Navbar, Sidebar
│       └── features/
│           ├── api/client.ts    # axios instance + JWT interceptor
│           └── auth/AuthContext.tsx
├── docs/                        # architecture, api-endpoints, db-schema (partly stale)
└── database/                    # schema notes
```

**Size:** backend ≈ 1,300 lines of logic; frontend ≈ 4,400 lines of TSX. The two largest files are `mock-interview/page.tsx` (1,129) and `InterviewRoom.tsx` (980) — both would benefit from being split.

---

## 4. Data model (MongoDB)

### `User`
`name`, `email` (unique, lowercased), `password` (bcrypt hash), `role` (default `"student"`), timestamps.

### `Resume`
`user` (ref User), `filename`, `originalName`, `path`, `mimetype`, `size`, `resumeText` (full extracted text), `analysis` (free-form `Object` — the LLM result), timestamps.

> Note: `analysis` is typed as a bare `Object`, so Mongoose enforces **nothing** about its shape. The shape is instead guaranteed by `normalizeAnalysisPayload()` in code.

### `Interview` (the big one)
- **Setup:** `user`, `role`, `interviewType` (enum of 12), `resumeId`, `companyName`, `jobDescriptionText`, `companyResearch`
- **Experience:** `experienceLevel` (`fresher` | `experienced`), `totalExperienceYears`, `employmentHistory[]`
- **Transcript:** array of `{ question, answer, category, difficulty, evaluation: { good, bad, improved } }`
- **Scores:** `overallScore`, `categoryScores` { communication, technicalKnowledge, problemSolving, confidence, resumeKnowledge, behavioral, roleReadiness }
- **Feedback:** `strongAreas[]`, `weakAreas[]`, `techGaps[]`, `communicationFeedback`, `roadmap { conceptsToRevise, practiceTopics, suggestedNextSteps }`
- **JD match:** `jobMatchScore`, `jdMatchBreakdown { strongMatches, needsImprovement, notDemonstrated }`
- **Proctoring:** `recordingConsent`, `recordingUrl`, `recordingDuration`, `integrityStatus` (`Clean` | `Warnings` | `Terminated`), `integrityWarningsCount`, `integrityEvents[]`
- **Coding:** `codingData { language, codingQuestions[], codingSubmissions[] }`

---

## 5. API surface

All under `/api`. 🔒 = requires `Authorization: Bearer <jwt>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness probe |
| POST | `/api/auth/register` | create account (validates name / email / password ≥ 8) |
| POST | `/api/auth/login` | returns JWT (7-day expiry) + user |
| GET 🔒 | `/api/auth/profile` | current user (password stripped) |
| POST 🔒 | `/api/resume/upload` | multipart `resume` (PDF only, 10 MB) → extract → analyze → save |
| GET 🔒 | `/api/resume/history` | user's resumes, newest first |
| GET 🔒 | `/api/resume/:id` | one resume (scoped to owner) |
| DELETE 🔒 | `/api/resume/:id` | delete record + file from disk |
| POST 🔒 | `/api/chat/roadmap` | career-mentor chat (`query`, `history`, `resumeContext`) |
| POST 🔒 | `/api/interview/next-question` | adaptive next question |
| POST 🔒 | `/api/interview/complete` | evaluate whole transcript + persist |
| GET 🔒 | `/api/interview/history` | past sessions (summary fields only) |
| GET 🔒 | `/api/interview/:id` | full report |
| POST 🔒 | `/api/interview/research` | DuckDuckGo + LLM company brief |
| POST 🔒 | `/api/interview/upload-jd` | parse JD from PDF / TXT / DOCX (memory, 5 MB) |
| POST 🔒 | `/api/interview/:id/recording` | upload webm/mp4 blob (100 MB) |
| POST 🔒 | `/api/interview/code/run` | run code on Judge0 |
| POST 🔒 | `/api/interview/code/submit` | same as run + "accepted" wording |

Static: `GET /uploads/*` serves the uploads folder directly (see security note 8.2).

---

## 6. How the main flows actually work

### 6.1 Auth
1. `POST /auth/register` → `validateRegister` middleware checks name / email / password length → `registerUser` bcrypt-hashes (cost 10) and creates the user. **It does not return a token** — the frontend must then call login.
2. `POST /auth/login` → bcrypt compare → `jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '7d' })`.
3. Frontend stores the token in `localStorage`; the axios interceptor in `features/api/client.ts` attaches `Authorization: Bearer …` on every request.
4. `AuthContext` on mount reads the stored token and calls `GET /auth/profile` to rehydrate the user; any failure logs out and redirects to `/login`.
5. `authMiddleware` verifies the token and **normalizes** `decoded.userId || decoded.id` into `req.user.id` — this normalization exists because older tokens used a different claim name.

### 6.2 Resume upload → ATS analysis

```
Browser (FileUpload.tsx)
  → POST /api/resume/upload  (multipart "resume", PDF only, ≤10MB)
    → multer writes to backend/uploads/resumes/<timestamp>-<name>.pdf
    → extractResumeText()  — pdf-parse-new reads the file into text
    → guard: text must be ≥20 chars, else 400 "empty or unreadable"
    → analyzeResume(text)  — Groq gpt-oss-120b, temperature 0.2, JSON-only prompt
    → parseGroqResponse()  — strips code fences, regex-extracts the {...} block, JSON.parse
    → normalizeAnalysisPayload() — coerces every field to the right type;
        arrays accept "a, b, c" strings and split them; atsScore falls back to 80
    → Resume.create({ ..., resumeText, analysis })
  ← 201 with the resume + analysis

On ANY error: the uploaded file is deleted from disk (cleanup in the catch).
```

`normalizeAnalysisPayload` is the fix for the "zero-score bug" the README mentions: if the model returns nothing parseable, it substitutes a **hard-coded placeholder profile** (ATS 78, skills `["JavaScript", "Web Development"]`, role `"Software Developer"`). This never fails loudly — see issue 8.4.

### 6.3 Career-mentor chatbot

`RoadmapChatbot` (embedded in the dashboard) sends `{ query, history, resumeContext }`. The backend builds a system prompt that **inlines the whole resume analysis** (summary, ATS score, skills, gaps, recommended roles), then calls Groq at temperature 0.7, max 2048 tokens, and returns Markdown which is rendered by `react-markdown`. The prompt explicitly instructs: *"NEVER ask the user to upload their resume, you already have their data."*

### 6.4 Mock interview — the centerpiece

**Setup wizard** (`mock-interview/page.tsx`) collects, in order:
role (11 presets + custom) → interview type (12) → resume to use → optional JD (typed or uploaded PDF/TXT/DOCX) → optional company name → fresher/experienced + employment history (with a validation warning if durations sum exceeds stated total years) → optional company research brief screen → camera/mic permission screen → recording consent.

**The interview loop** (`InterviewRoom.tsx`):

```
fetchNextQuestion(history)
  → POST /interview/next-question { role, interviewType, history, jobDescriptionText,
                                    companyResearch, resumeId, experienceLevel, ... }
  → backend looks up the chosen Resume and injects its analysis as context
  → generateNextQuestion() picks a "phaseInstruction" (see below)
  → Groq with response_format: json_object → { question, category, difficulty }

speakQuestion()  → SpeechSynthesis reads it aloud (mic is stopped first)
  utterance.onend → startListening()

startListening() → SpeechRecognition (continuous, interim results, lang = chosen locale)

user clicks Stop → transcript (+ code block if coding mode) becomes the answer
  → history.length >= 10 ? finalizeInterview() : fetchNextQuestion()
```

**Question strategy.** For the 11 *specific* interview types, one fixed instruction shapes every question (e.g. Coding mode is told to skip pleasantries and open with a full DSA problem statement; Group/Panel prefixes each question with a simulated interviewer name). For the default **"Overall Interview"**, questions follow a 7-phase script driven by `history.length`:

| Q# | Phase |
|---|---|
| 0 | Welcome + "introduce yourself" |
| 1 | Education (fresher) *or* work history (experienced) |
| 2–3 | Personalized from the **resume** analysis |
| 4–5 | Tailored to the **job description** |
| 6–7 | Technical, escalating difficulty |
| 8 | Company-specific (from research brief) |
| 9+ | Behavioral + close |

**Proctoring / integrity** (all client-side):
- `FaceDetector` API (Chrome-only, behind a flag) samples the webcam every 3 s → flags 0 faces ("left frame") or >1 face ("multiple persons")
- `visibilitychange` + `window.blur` → "Tab Switched"
- `copy` / `paste` / `contextmenu` are blocked outside inputs
- VAD flags human speech *while the AI is speaking* as "Background Human Voice"
- Events are debounced to 1 per type per 10 s
- **Auto-termination thresholds:** 3 multiple-person, 2 tab-switch, or 5 background-voice warnings → the interview ends immediately and is saved with `integrityStatus: 'Terminated'`

**Recording:** if consented, `MediaRecorder` captures `video/webm;codecs=vp8,opus` in 1-second chunks; after the report is saved the blob is POSTed to `/interview/:id/recording` and stored under `uploads/recordings/`.

**Coding mode:** a Monaco editor sits beside the interviewer. *Run* and *Submit* both POST to Judge0 (`judge0-ce.p.rapidapi.com`, `wait=true`). Language IDs: JS 93, Python 71, Java 62, C++ 54. Submissions are appended to the answer text as a fenced code block plus the sandbox output, so the evaluating model can see both the code and whether it ran.

**Final evaluation:** `POST /interview/complete` sends the whole transcript to Groq with a long rubric prompt. Notable prompt-design choices:
- **Accent tolerance** — explicitly instructs the model not to penalize Indian/British English phonetic quirks in the speech transcription
- **Multilingual** — answers in a non-English language must be translated and judged on substance, not language
- **Exhaustiveness** — the output `transcript` array must have exactly one entry per question
- Interview-type-aware weighting (HR → communication; Coding → DSA/logic)

The parsed JSON is written straight into a new `Interview` document, and the user is redirected to `/mock-interview/report/<id>`.

### 6.5 Company research

`researchCompany(name)` scrapes DuckDuckGo's HTML endpoint (`html.duckduckgo.com/html/?q=…`) with a spoofed Chrome User-Agent, regex-extracts `result__snippet` blocks, and feeds **only those snippets** to the LLM with a strict anti-hallucination instruction ("Do NOT invent, assume, or extrapolate"). Returns `{ majorDevelopments, keyProducts, recentStrategy, focusAreas }`. **This function is currently broken — see 8.1.**

### 6.6 Groq key rotation

`groqPool.js` reads `GROQ_API_KEYS` (comma-separated) or `GROQ_API_KEY`, and wraps every AI call. On a 429 / rate-limit error it rotates to the next key and retries, up to `keys.length` attempts, then throws "All configured Groq API keys have exceeded their rate limits." A module-level `currentKeyIndex` persists across requests so the pool doesn't reset to a burned key each time. This is a pragmatic way to stretch free-tier quotas.

---

## 7. Environment variables

There is **no `.env.example`** in the repo — this is the single biggest onboarding blocker. From a full scan of the source, these are required:

**backend/.env**
```
PORT=5000
MONGO_URI=mongodb+srv://...
JWT_SECRET=<long random string>
GROQ_API_KEYS=key1,key2,key3      # or GROQ_API_KEY=key1
JUDGE0_API_KEY=<RapidAPI key>     # only needed for the coding round
```

**frontend/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

`client.ts` accepts the URL with or without a trailing `/api` and normalizes it.

**Running locally:** `cd backend && npm install && npm run dev` (nodemon, port 5000); `cd frontend && npm install && npm run dev` (port 3000).

Note: if `MONGO_URI` is missing, `connectDB` only **warns and continues** — the server boots but every DB operation fails at request time.

---

## 8. Issues found

### 🔴 8.1 `research.service.js` throws `ReferenceError` on every call — company research never works

`backend/src/services/search/research.service.js:65` calls `callGroqWithRotation(...)`, but that function is **never imported** in the file (its requires are only `searchWeb` and `Groq`). The file also creates an unused `groq` client at module load and checks `if (!groq)` — vestiges of an incomplete refactor from a single client to the rotating pool.

Because the whole body is wrapped in `try/catch` returning `{ success: false, message: "Company research is currently unavailable." }`, the failure is **completely silent** — the user always sees the friendly "unavailable" message and no one notices the bug.

**Fix:** add `const { callGroqWithRotation } = require('../groq/groqPool');` and delete the dead `groq` instance and its guard.

### 🔴 8.2 Real resume PDFs (personal data) are committed to git

`backend/uploads/resumes/` contains **24 real PDFs, 5.9 MB**, with people's actual names in the filenames (e.g. `…-SanjayKumarGouda_Resume .pdf`, `…-P Jaswant Rao_bnp.pdf`). These contain phone numbers, emails, and addresses of real individuals, and are **publicly readable** on GitHub.

Compounding it: `app.js` serves `/uploads` as a static directory with no auth, so on a deployed instance **anyone who guesses a filename can download any user's resume or interview recording**.

**Fix:** add `backend/uploads/` to `.gitignore`, purge the files from history (`git filter-repo`), and put the static route behind `authMiddleware` with an ownership check — or move to S3/R2 with signed URLs.

### 🟠 8.3 No `.env.example`

No example file means a new developer cannot run the project without reading every source file. (Good news: `.gitignore` does cover `.env`, `.env.local`, `.env.*`, and no secrets are currently committed.)

### 🟠 8.4 Silent AI failures produce fake data

`analyzeResume()` catches *every* error and returns `normalizeAnalysisPayload(null)` — a hard-coded fake profile with **ATS score 78** and skills `["JavaScript", "Web Development"]`. A user whose Groq quota ran out, or whose resume failed to parse, gets a plausible-looking score that is entirely fabricated, with no indication anything went wrong. The same pattern appears in `parseGroqResponse` (returns `null` on parse failure) and in the `atsScore` fallback of `80`.

**Fix:** propagate the error and let the controller return 502 (which it already has a code path for), rather than manufacturing a result.

### 🟠 8.5 Proctoring is entirely client-side and trivially bypassed

Every integrity signal (face count, tab switches, copy/paste, voice) is computed in the browser, and `integrityEvents` / `integrityWarningsCount` / `integrityStatus` are **sent from the client and trusted verbatim** by `completeInterview`. A user can open DevTools and POST a clean report. This is fine for self-practice (the stated use case) but must not be presented as real proctoring.

Also, `FaceDetector` is a Chrome-only experimental API — on Firefox and Safari it is silently absent and face monitoring simply never runs.

### 🟠 8.6 Judge0 integration doesn't actually test anything

`executeOnJudge0` always sends `stdin: ""` and reports `passed: true` whenever the program merely **compiles and runs** (Judge0 status 3). The `testCases` array exists in the `Interview` schema but is never populated or checked, and `runCode` / `submitCode` ignore the `questionText` they receive. So "Submission Accepted ✅" only means *"it didn't crash"* — and that verdict is then fed to the evaluating LLM as if it were a real test result. `executionTimeMs` and `memoryBytes` are hard-coded to `0`.

### 🟡 8.7 Silent fallback on a bad `resumeId`

In `getNextQuestion`, when a `resumeId` is supplied the query is `{ _id: resumeId, user: req.user.id }` — correctly scoped to the owner. But if the resume isn't found, it silently falls back to *no context* rather than erroring, so a typo'd or foreign ID degrades the interview invisibly.

### 🟡 8.8 CORS is fully open

`app.use(cors())` allows every origin. Combined with `localStorage` tokens this is a wide surface; lock it to the deployed frontend origin.

### 🟡 8.9 Speech-recognition watchdog hammers `start()`

A `setInterval` fires **every 500 ms** for the entire interview, calling `recognitionRef.current.start()` and swallowing the resulting exception when it's already running. It works (it's a deliberate workaround for Chrome killing recognition after ~60 s), but it means a caught exception twice a second. A state flag driven by `onstart` / `onend` would be cleaner.

### 🟡 8.10 Fixed 10-question limit, hard-coded

`updatedHistory.length >= 10` appears in two places in `InterviewRoom.tsx`. The "Overall Interview" 7-phase script is also tied to exact indices. Neither is configurable, and the phases silently stop mattering past Q9.

### 🟡 8.11 Dead code and stale artifacts

- `backend/interview_copy.js` (253 lines) — an orphaned backup of the interview service
- `backend/rawResponse.txt` — empty debug artifact
- `backend/testGroq.js` — **syntactically invalid** (all string quotes were stripped: `require(dotenv).config()`), and still references the retired `llama-3.3-70b-versatile` model
- `@google/generative-ai` is installed and imported nowhere
- `services/gemini/` no longer uses Gemini at all
- `frontend/tsconfig.tsbuildinfo` is committed (build artifact)
- `frontend/src/features/auth/AuthForm.tsx` and `features/resume-upload/ResumeUploadCard.tsx` are 8-line stubs

### 🟡 8.12 Only one test

`backend/tests/career.service.test.js` covers `normalizeAnalysisPayload` alone. There are no tests for auth, routes, the interview flow, or the frontend. `npm test` runs `node --test`.

### 🟡 8.13 DuckDuckGo scraping is fragile

`search.service.js` regex-matches `<a class="result__snippet">` against DuckDuckGo's HTML. Any markup change on their side, or rate-limiting/blocking of the server's IP, breaks company research with no signal beyond an empty array.

### 🟡 8.14 README is inaccurate and partly corrupted

Beyond the Vite/Gemini errors: several markdown links are malformed (`[Project Overview]#-project-overview)`), there are stray braces (`{**Framework**}`), a mojibake character, a typo'd model name `popenai/gpt-oss-120b`, a wrong path `srv/services/…`, and the "Directory Structure" section contains only the word `nodejs`. The `docs/` folder is more reliable but still describes Gemini and omits the entire interview subsystem.

---

## 9. What's genuinely well done

Worth saying explicitly — several things here are above the level typical for a project this size:

- **Clean layered backend.** routes → controllers → services → models, with no business logic leaking into route files. Easy to follow.
- **Multi-key Groq rotation** is a smart, practical answer to free-tier rate limits.
- **`normalizeAnalysisPayload`** defensively handles the reality that LLMs return inconsistent shapes — accepting both `camelCase` and `snake_case`, and splitting comma/newline strings into arrays.
- **Ownership scoping is consistent** — every resume and interview query filters on `user: req.user.id`, so there is no IDOR in the JSON API.
- **Thoughtful prompt engineering** — the accent-tolerance and multilingual clauses in the evaluation prompt show real awareness that speech-to-text mangles non-US accents and would otherwise unfairly tank scores. The anti-hallucination framing in company research ("use ONLY the snippets") is also the right instinct.
- **Genuine attention to voice UX** — stopping the mic before TTS to avoid self-capture, committing lingering interim transcript on `onend`, the 60-second-limit watchdog. These are bugs you only fix after actually using the thing.
- **Upload cleanup on failure** — the resume controller deletes the file from disk in its catch block.
- **Sensitive fields redacted in logs** — `logger.middleware.js` masks `password`, `token`, `accessToken`, `refreshToken`.

---

## 10. Suggested priority order for fixes

| # | Action | Why |
|---|---|---|
| 1 | Purge `backend/uploads/` from git + gitignore it | Real people's personal data is public right now |
| 2 | Auth-protect the `/uploads` static route | Anyone can fetch any resume/recording from a deployment |
| 3 | Add the missing `callGroqWithRotation` import in `research.service.js` | An entire advertised feature is dead |
| 4 | Add `.env.example` for both apps | Nobody can run the project otherwise |
| 5 | Stop fabricating analysis on AI failure — surface the 502 | Users are shown fake ATS scores |
| 6 | Restrict CORS to the real frontend origin | Wide attack surface |
| 7 | Wire real test cases into Judge0 (`stdin` + expected-output comparison) | "Accepted" currently means "compiled" |
| 8 | Rewrite the README; delete `interview_copy.js`, `rawResponse.txt`, `testGroq.js`, `tsbuildinfo` | Accuracy + hygiene |
| 9 | Split `InterviewRoom.tsx` and `mock-interview/page.tsx` into hooks + subcomponents | 980 and 1,129 lines |
| 10 | Validate integrity events server-side, or label proctoring as advisory-only | Currently client-trusted |

---

## 11. One-paragraph summary

CareerAI is a Next.js + Express + MongoDB application that turns an uploaded resume into an ATS score and skill profile via Groq's `gpt-oss-120b`, then drives a fully voice-based adaptive mock interview in the browser — the AI speaks each question, the Web Speech API transcribes the spoken answer, and each answer conditions the next question across 12 interview formats, 11 Indian languages, an optional Monaco/Judge0 coding round, webcam recording, and client-side cheating detection with auto-termination. It finishes by grading the whole transcript into per-question coaching, seven category scores, and a study roadmap. The architecture is clean and the prompt engineering is unusually thoughtful (accent tolerance, anti-hallucination grounding), but the project ships with real people's resumes committed to git behind an unauthenticated static route, a company-research feature that has been dead since a refactor dropped an import, AI failures that silently return fabricated scores, and a code judge that reports "accepted" for anything that compiles.
