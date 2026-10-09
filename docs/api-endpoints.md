# API endpoints

Base: `http://localhost:5000/api`. Protected endpoints require a bearer token. Errors use `{success:false,error:string}`. IDs must be valid MongoDB ObjectIds. Cross-account reads return 404.

| Method | Path | Behavior |
|---|---|---|
| GET | /health | API health |
| POST | /auth/register | Name, normalized email, password |
| POST | /auth/login | Token and user |
| GET | /auth/profile | Stable id, name, email, role |
| POST | /resume/upload | Multipart resume PDF, maximum 5 MB |
| GET | /resume/history | Latest 100 summaries/analyses, excluding extracted text/path |
| GET / DELETE | /resume/:id | Read or delete owned resume |
| POST | /chat/roadmap | query, user/assistant history, resumeContext |
| POST | /interview/research | Company research and server-side snapshot cache |
| POST | /interview/upload-jd | Multipart file, PDF/TXT/DOCX, maximum 5 MB and 20,000 characters |
| POST | /interview/session | Create; 409 includes existing active session |
| GET | /interview/session/active | Active/evaluating session or null |
| GET | /interview/session/:id/state | Saved state; generates/persists missing question |
| POST | /interview/session/:id/speech | Owned current-sequence greeting, readiness reply or question as WAV audio |
| POST | /interview/session/:id/transcribe | Multipart spoken answer; returns transcript text without submitting a turn |
| POST | /interview/session/:id/turn | seq, clientTurnId, answer, inputMode; safe duplicate retries |
| POST | /interview/session/:id/complete | Queue saved answers; safe to retry |
| POST | /interview/session/:id/retry-evaluation | Retry failed report |
| POST | /interview/session/:id/abandon | Discard unfinished session/media |
| POST | /interview/session/:id/recordings/:segmentId/:seq | Multipart chunk/mimeType, maximum 6 MB |
| POST | /interview/code/run | sessionId, seq, code, language; server chooses correctness tests |
| GET | /interview/history | Latest 100 completed summaries |
| GET / DELETE | /interview/:id | Owned report; delete also removes session/media |
| GET | /interview/:id/recordings | Segment manifest |
| GET | /interview/:id/recordings/:segmentId | Authenticated segment playback |
| GET | /interview/:id/recording | Legacy recording read |
| POST | /interview/:id/presence-review | Optional consented video review |

Legacy stateless question/completion and whole-video upload routes return 410. Browser-supplied histories are no longer accepted for scoring.

Create a session with role, interviewType, durationPreset and consent:

```json
{
  "role": "Backend Developer",
  "interviewType": "Technical Interview",
  "durationPreset": "quick",
  "consent": {
    "storeTranscript": true,
    "recordAudio": false,
    "recordVideo": false,
    "analyzeVideo": false
  }
}
```

Optional fields: owned resumeId, jobDescriptionText, companyName, experienceLevel, totalExperienceYears and employmentHistory. Resume analysis is frozen at creation. Quick/standard/full question budgets are 6/12/20. Sessions accept answers for 24 hours, then can evaluate their saved answers.

State responses use `{success:true,data:<session>}`. A missing question can mean another request owns the generation lease; poll after two seconds. Evaluation status is pending, processing, failed or completed. Completed sessions include interviewId.

## Session speech

`POST /interview/session/:id/speech` requires the session owner's bearer token. The request contains the saved question sequence and an allowed speech kind:

```json
{
  "seq": 0,
  "kind": "greeting"
}
```

| Kind | Server-owned spoken content |
|---|---|
| `greeting` | Alex's welcome, personalized with the owner's first name and session role, ending with a readiness question |
| `warm_up_ready` | A short fixed acknowledgement before beginning |
| `warm_up_nervous` | A short fixed reassurance before beginning |
| `question` | The persisted acknowledgement, if present, followed by the actual current question; excludes the introduction |

`seq` must be a nonnegative integer matching the session's current sequence. Greeting and readiness kinds are available only at sequence 0. The session must be active, within its deadline, and accepting questions. Caller-supplied speech text is ignored. This endpoint does not append answers, advance the interview, or score the welcome. Ownership and state are checked before caption headers are set and again before audio is returned, including cached responses.

A successful response is binary `audio/wav`, not a JSON envelope. Audio is mono 24 kHz, 16-bit PCM, with a maximum size of 4 MB and duration of 60 seconds. These headers are exposed to browser clients through CORS:

| Header | Meaning |
|---|---|
| `X-Interviewer-Text` | URI-encoded server caption; decode with `decodeURIComponent` |
| `X-Interviewer-Voice` | Selected Gemini voice, currently `Kore` |
| `X-Speech-Kind` | The validated request kind |
| `Cache-Control` | `no-store`; the browser should not persist responses in its HTTP cache |

The backend uses Gemini `gemini-3.8-flash-lite-tts` with a 20-second provider deadline and at most 1,600 caption characters. Provider credentials remain on the backend. Identical requests share in-flight synthesis and a five-minute server cache scoped to the owner, session, sequence, kind and text. The cache holds at most 32 entries / 16 MB. At most four distinct syntheses run concurrently; each user can start at most 12 uncached syntheses per minute. Cache replays do not consume this allowance.

Failures use the usual safe JSON error envelope without provider response details. Invalid input returns 400, missing authentication 401, another owner's session 404, changed/expired/finished state 409, and overlong text 413. The local speech rate gate returns 429. Missing configuration, unavailable credentials/model, provider quota or a busy synthesis queue return 503; malformed audio or other provider failures return 502, and timeout returns 504.

Failures after successful owner/state validation retain the exposed caption headers so the UI can read the same text with browser voice or show captions. Do not use voice fallback for authentication, ownership, invalid-input or changed-state errors: reload the saved session when appropriate. Play audio only after an explicit user activation, and cancel pending playback when leaving or changing turns.

## Spoken-answer transcription

`POST /interview/session/:id/transcribe` requires the session owner's bearer token and a `multipart/form-data` request:

| Field | Value |
|---|---|
| `audio` | One WAV file with MIME type `audio/wav`, mono 16 kHz, 16-bit PCM |
| `seq` | Current question sequence as a canonical integer string, for example `"0"` |
| `language` | A two- or three-letter lowercase language code with optional uppercase region, for example `en-IN` or `hi-IN` |

The upload limit is 4 MiB and the spoken-answer duration limit is 120 seconds. Audio shorter than 0.2 seconds, effectively silent audio, malformed WAV chunks and unsupported formats are rejected. The session must belong to the caller, be active and within its deadline, have the same current question sequence, and include consent to store the transcript. Ownership is checked before buffering the upload; consent and question state are checked before provider work and again before returning text. Optional recording consent is separate because this endpoint does not store the uploaded audio in the app.

The backend sends audio in memory to the configured Gemini model for transcription, with a fixed instruction to preserve audible words in their original language. This is a completed-answer upload, not streaming recognition. See Google's [audio understanding documentation](https://ai.google.dev/gemini-api/docs/audio). Provider credentials remain on the backend. The entire provider request and response read have a 45-second deadline; response JSON is capped at 64 KiB and transcript text at 16,000 characters. At most four transcriptions run concurrently, and each user can start at most eight per minute. Cancelled or failed provider attempts count toward that allowance.

Success uses the regular JSON envelope and `Cache-Control: no-store`:

```json
{
  "success": true,
  "data": {
    "text": "I built a React interface with accessible controls.",
    "seq": 0
  }
}
```

Transcription does not persist raw audio, append an answer, score it, or advance the question. Submit the returned text separately through `/interview/session/:id/turn` with the normal `clientTurnId` for safe retries. The client should stop microphone capture before uploading, cancel the request on navigation or turn changes, and discard any result belonging to an old sequence.

Failures use safe JSON without provider response details. Invalid form/audio returns 400, missing authentication 401, missing transcript consent 403, another owner's session 404, changed/expired/finished question 409, oversized or overlong audio 413, and silence or unintelligible speech 422. Rate limits return 429. Missing configuration, provider quota or a busy transcription queue return 503; other provider failures, malformed JSON or incomplete transcription return 502; timeout returns 504. A cancelled provider operation uses 499 internally, and a disconnected client receives no completed response. Failures never silently skip or submit an answer; offer another recording attempt or typing instead.
