# Architecture

Next.js calls an authenticated Express API. MongoDB holds accounts, resumes, interview sessions and reports. The configured AI provider (Gemini by default, or Groq) generates questions and feedback; Judge0 executes code outside the API host. A private optional Python service reviews face presence.

Sessions freeze setup/resume context. Server-owned topic plans bound interview length. Questions are persisted before delivery. Atomic sequence checks and clientTurnId collapse duplicate answers. MongoDB leases serialize question generation across concurrent requests.

Completing sets durable evaluation state. The background worker leases a session, calls the configured AI provider and upserts a report at its preallocated ID. The model annotates the saved transcript but cannot rewrite it. Errors remain retryable. External AI calls are not guaranteed exactly once across process crashes.

The browser saves text/code drafts continuously in IndexedDB under user/session/sequence keys. Submitted history comes from MongoDB. The interview defaults to spoken questions and answers, with optional captions and typing. After microphone activation, an AudioWorklet captures a bounded in-memory clip. Finish answer flushes PCM audio, requests owner- and sequence-checked Gemini transcription, then submits the returned text once. Pausing speech does not submit it; retained audio can be retried or explicitly discarded. This path does not save audio as a recording.

Separately consented MediaRecorder capture creates a segment for each start and writes chunks locally before upload. The API checks ownership, consent, chunk identity and storage bounds. Authenticated endpoints stream segments for playback.

Files and MongoDB metadata are separate writes. Production needs durable storage, reconciliation and an operator-defined retention policy. API deletion removes the report, session and known media files. Uploaded content has no public static route.

API validators bound inputs, IDs and uploads. Provider requests time out. Malformed AI responses never manufacture successful resume scores. Evaluation validates scores and per-answer feedback. Text transcripts are not used to infer vocal confidence or emotion.

Daily usage counters persist in MongoDB. IP limits are process-local. Logs contain request metadata, not resumes, answers, passwords or tokens. CORS origins are configured. Video-presence results are separate from scoring and require consent; poor-quality footage suppresses observations.
