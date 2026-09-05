# Survive Refresh — Implementation Spec

**Every remaining 🔴 and 🟠 item, one task at a time.**
Companion docs: [PROGRESS.md](PROGRESS.md) (plain English) · [checklist.md](checklist.md) (full backlog) · [implementation.md](implementation.md) (design rationale)

**Written:** 4 September 2026 · **Against commit:** `53e149d`

---

## What this covers

| Dot | Item | Section | Est. |
|---|---|---|---|
| 🔴 | Purge CVs from git history — **your decision** | [§0](#0--the-one-thing-i-cannot-do-alone) | 0.5 d |
| 🟠 | **Survive a page refresh** | [§1–§6](#1--the-shape-of-the-fix) | 8–10 d |
| 🟠 | Recording missing the interviewer's voice | [§7](#7--the-recording-only-has-half-the-interview) | see note |
| 🟠 | Firefox / Opera can't take an interview | [§8](#8--firefox-and-opera-cannot-take-an-interview) | 0.5 d |
| 🟠 | No way to type an answer | [§8](#8--firefox-and-opera-cannot-take-an-interview) | (same task) |
| 🟠 | Question count was editable in the browser | [§4.3](#43--the-server-decides-when-its-over) | ✅ done |

Everything here is ordered so each task leaves the app working. Nothing is a
big-bang rewrite.

---

## 0 — The one thing I cannot do alone

### 🔴 Task 0.1 — Purge the 23 CVs from git history

**Status: blocked on you.**

I untracked them and added `.gitignore`, so no *new* uploads get committed. But
the 23 real CVs — names, phone numbers, email addresses — are still in past
commits and remain downloadable from GitHub.

Removing them rewrites history, which breaks every existing clone.

```bash
pip install git-filter-repo
git filter-repo --path backend/uploads --invert-paths --force
git push --force --all
```

**What I need from you:**
1. Who else has a clone of this repo?
2. Is it OK to force-push?

Until you answer, that data stays public. **I will not force-push without an
explicit go-ahead.**

🔬 **Verify:** `git log --all --full-history -- backend/uploads` → empty.

---

## 1 — The shape of the fix

### Why a refresh currently destroys everything

I counted **41 pieces of state** in `InterviewRoom.tsx` and **zero** persistence
calls. The backend has no session model — it first hears about an interview when
`/complete` arrives with the whole history attached.

```
Today                              After
─────                              ─────
Browser owns:                      Server owns:
  qaHistory (the interview)          the transcript
  currentQuestion                    the current question
  topicPlan                          the topic plan
  integrityEvents                    the event log
  recorded chunks                    the chunk manifest
                                   
Server owns:                       Browser owns:
  nothing until /complete            what's on screen right now
                                     + an IndexedDB write-behind buffer
```

### What survives what — the table that drives the design

| Event | Do unload events fire? | React memory | IndexedDB | Server |
|---|---|---|---|---|
| F5 / reload | ✅ yes | ❌ lost | ✅ | ✅ |
| Close tab | ✅ yes | ❌ lost | ✅ | ✅ |
| **Tab crash (OOM)** | **❌ NONE** | ❌ lost | ✅ | ✅ |
| **Browser force-quit** | **❌ NONE** | ❌ lost | ✅ | ✅ |
| **Phone: swipe away app** | **❌ NONE** | ❌ lost | ✅ | ✅ |
| Battery dies | ❌ NONE | ❌ lost | ⚠️ last write may be lost | ✅ |
| **Different device** | — | ❌ | ❌ | ✅ |
| Network drop (page open) | — | ✅ | ✅ | ✅ |

**Two conclusions this forces:**

1. **Only the server survives everything** → the server must hold the truth.
   IndexedDB is a buffer for the *current unsubmitted answer* and recording
   chunks, never the record.
2. **In the crashes that matter, no unload event fires at all** → write
   continuously as the candidate types, never in a `beforeunload` handler.
   This is the single most common mistake in this design.

### State audit — where each of the 41 pieces goes

| State | Goes to | Why |
|---|---|---|
| `qaHistory` | **Server** | It *is* the interview |
| `topicPlanRef` | **Server** | Decides what's asked next; client could edit it |
| `currentQuestion`, `category`, `difficulty` | **Server** | Derived from the plan |
| `topicIndex`, `totalTopics`, `isFollowUp` | **Server** | Progress display |
| `integrityEventsRef`, `warningsCount` | **Server** | Must outlive the tab |
| `interviewStartTimeRef` | **Server** | Anti-abuse clock (§5.2) |
| `codingSubmissions`, `code` | **Server** + IDB draft | Work in progress |
| `transcript`, `interimTranscript` | **IndexedDB** | Unsubmitted answer |
| `recordedChunksRef` | **IndexedDB** → server | Too big for memory (§6) |
| `spokenLanguage` | localStorage | A preference, not interview data |
| `status`, `statusRef`, `timer` | Nothing | Rebuilt on load |
| `micError`, `voiceNotice`, `recentWarning` | Nothing | Transient UI |
| `synthesisRef`, `recognitionRef`, `videoRef`, `cameraStream`, `mediaRecorderRef` | Nothing | Browser objects; recreated |

---

## 2 — The session model

### Task 2.1 — Create `InterviewSession`

**File:** `backend/src/models/InterviewSession.js` (new)

Keep `Interview` as the finished, scored report. In-flight state goes in its own
collection — mixing them puts half-finished junk in the collection the report UI
reads.

```js
const interviewSessionSchema = new mongoose.Schema({
  user:   { type: ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, required: true, default: 'created',
            enum: ['created','in_progress','completed','abandoned'] },

  // Frozen at creation. If the candidate uploads a new CV in another tab
  // mid-interview, the questions must not silently start referring to it.
  role: String,
  interviewType: String,
  durationPreset: String,
  resumeId: { type: ObjectId, ref: 'Resume' },
  resumeAnalysisSnapshot: Object,
  jobDescriptionText: String,
  companyName: String,
  companyResearch: Object,
  experienceLevel: String,
  totalExperienceYears: Number,
  employmentHistory: Array,

  topicPlan: Array,          // from conversation.js -- server-owned now
  maxQuestions: Number,

  turns: [{
    seq:          { type: Number, required: true },
    question:     { type: String, required: true },
    category:     String,
    difficulty:   String,
    isFollowUp:   Boolean,
    topicId:      String,
    askedAt:      Date,
    answer:       { type: String, default: null },
    answeredAt:   Date,
    clientTurnId: String,     // idempotency key
    inputMode:    { type: String, enum: ['speech','text'], default: 'speech' },
  }],

  codingSubmissions: Array,
  clientEvents: [{ type: String, atMs: Number, verified: { type: Boolean, default: false } }],

  consent: {
    recordAudio: Boolean, recordVideo: Boolean, storeTranscript: Boolean,
    disclosureVersion: String, grantedAt: Date,
  },
  recordingChunks: [{ seq: Number, filename: String, bytes: Number, uploadedAt: Date }],

  startedAt: Date,
  deadlineAt: Date,                     // server-computed; see §5.2
  lastActivityAt: { type: Date, index: true },
  activeMs: { type: Number, default: 0 },
  cumulativeDisconnectedMs: { type: Number, default: 0 },
  completedAt: Date,
  interviewId: { type: ObjectId, ref: 'Interview' },
}, { timestamps: true });
```

**Size: S** · 🔬 create a session, read it back, fields intact.

---

### Task 2.2 — Indexes ⛔ BLOCKER

```js
// At most ONE live session per user. Verified: MongoDB supports unique +
// partialFilterExpression, and $in is an allowed operator. The constraint
// applies only to documents matching the filter, so completed/abandoned
// sessions don't block a new one.
interviewSessionSchema.index(
  { user: 1 },
  { unique: true,
    partialFilterExpression: { status: { $in: ['created', 'in_progress'] } } }
);

interviewSessionSchema.index({ lastActivityAt: 1 });   // sweeper
```

**Why it matters:** this is what makes "resume or discard?" reliable under
concurrent requests, and it blocks *"open five tabs, keep the best score."*

⚠️ **Gotchas, verified from MongoDB docs:**
- Cannot combine `partialFilterExpression` with `sparse`
- Keep the application-level check too — a unique index gives you a race-free
  guarantee but an ugly error; check first for a clean 409

**Size: S** · 🔬 fire two `POST /session` concurrently → exactly one wins.

---

## 3 — The API

Five new endpoints. All under `/api/interview`, all behind `authMiddleware`.

### Task 3.1 — `POST /api/interview/session`

Creates the session. Called from the pre-flight screen, **before** navigating
into the interview.

```jsonc
// → request: the whole setup form
{ "role":"Backend Developer", "interviewType":"Technical Interview",
  "durationPreset":"standard", "resumeId":"…", "jobDescriptionText":"…",
  "companyName":"…", "experienceLevel":"fresher", "consent":{…} }

// ← 201
{ "success":true, "sessionId":"…", "status":"created" }

// ← 409 — one is already running
{ "success":false, "error":"ACTIVE_SESSION_EXISTS", "sessionId":"…" }
```

The 409 drives the *"You have an interview in progress — resume or discard?"*
prompt. **Size: M**

---

### Task 3.2 — `GET /api/interview/session/:id/state` ⛔ BLOCKER

**This is the resume primitive.** Safe to call any number of times.

```jsonc
{ "success":true, "status":"in_progress", "seq":4,
  "question":"You mentioned the payments migration — how did you…",
  "category":"Resume", "difficulty":"Intermediate", "isFollowUp":true,
  "topicIndex":2, "totalTopics":5,
  "turnsAnswered":4, "maxQuestions":12,
  "activeMs":743000, "deadlineAt":"2026-09-04T12:34:56Z",
  "role":"Backend Developer", "interviewType":"Technical Interview" }
```

**The critical behaviour:** if `status === 'created'`, this call **generates turn
0, persists it, then responds.** If the response is lost in flight, the next call
returns *the same* question — never a fresh one, never a second LLM charge.
That is the entire idempotency story for question generation.

Ownership check → **404, not 403** (don't confirm the session exists).

**Size: M** · 🔬 call 5× on a fresh session → identical question each time, one
LLM call in the logs.

---

### Task 3.3 — `POST /api/interview/session/:id/turn` ⛔ BLOCKER

```jsonc
// → { seq, clientTurnId, answer, inputMode, codeSubmission? }
// ← next turn, or { done: true, interviewId }
// ← 409 { error:"SEQ_MISMATCH", expectedSeq: 5 }
```

**The failure this prevents:** candidate submits on a flaky connection, request
succeeds server-side, response is lost, client retries. Without protection you
get a duplicate turn, a second LLM charge, and a corrupted transcript.

Three layers, all required:

1. **`clientTurnId`** — a UUID generated **once per turn**, reused across every
   retry. Send it as the `Idempotency-Key` header too.
2. **Unique index** on `(sessionId, clientTurnId)` — the DB is the final arbiter.
3. **Catch the duplicate, don't pre-check.** A read-then-write has a race window;
   the index does not:

```js
try {
  await recordTurn({ sessionId, seq, clientTurnId, answer });
} catch (e) {
  if (e.code === 11000) {
    // Retry of a turn we already have. Return CURRENT STATE, not a bare 200 --
    // a client that lost the original response gets everything it needs.
    return res.json(await buildState(sessionId));
  }
  throw e;
}
```

Keep the turn write and the seq increment atomic with a compare-and-set:

```js
const r = await Session.updateOne(
  { _id: sessionId, currentSeq: seq },          // CAS guard
  { $push: { turns: turnDoc }, $inc: { currentSeq: 1 } }
);
if (r.matchedCount === 0) { /* someone already advanced -- treat as duplicate */ }
```

> **Terminology, stated precisely:** you cannot get exactly-once *delivery* over
> an unreliable network. This gives at-least-once delivery with an
> **exactly-once effect** — the client retries until answered, the server
> collapses duplicates so state changes once.

**Size: M** · 🔬 POST the same turn twice → second is a no-op, LLM count unchanged.

---

### Task 3.4 — `POST /session/:id/complete` + `GET /session/:id/evaluation`

`complete` marks the session and creates the `Interview` record. For now it may
stay synchronous; the queue is a separate task in [checklist.md](checklist.md)
Stage 5. **Size: S**

---

### Task 3.5 — `POST /session/:id/recording/chunk`

One chunk per request, multipart, carrying `seq`. Appends to the chunk manifest.
**Size: S**

---

## 4 — The client rewrite

### Task 4.1 — Dedicated route ⛔ BLOCKER

**New:** `frontend/src/app/interview/[sessionId]/page.tsx` and `layout.tsx`

**Not `window.open()`.** Verified reasons:
- Popup blockers kill it outside a direct gesture
- Mobile browsers largely ignore popups — fatal for an India-first product
- If the parent tab closes, coordination breaks
- **Decisively: resume needs a URL you can return to**

The nested `layout.tsx` must not render `<Navbar />` — the interview needs clean
chrome, and it removes the main way to accidentally navigate away.

Route guards: 401 → `/login`; not yours → 404; already completed → redirect to
the report. Add `export const dynamic = 'force-dynamic'` and `prefetch={false}`
on any link pointing here.

**Size: M**

---

### Task 4.2 — Launch sequence (gesture-ordered) ⛔ BLOCKER

All three APIs need a user gesture, so they must run **in one click handler, in
this order**:

```js
onClick(async () => {
  await navigator.mediaDevices.getUserMedia({ audio: true, video: wantsVideo });
  try { await el.requestFullscreen(); } catch { /* non-fatal, see below */ }
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  router.push(`/interview/${sessionId}`);
});
```

**Verified constraints:**
- `requestFullscreen()` **requires transient activation and rejects with
  `TypeError`** without it. A failed fullscreen must **never** abort the interview.
- **Fullscreen cannot be forced** — Esc always works, and browsers guarantee an
  exit even under keyboard lock. It is a focus aid, **not** a control. Treat
  exiting as a UI event to gently re-offer; **never** log it as a violation.
- **Screen Wake Lock is Baseline 2025** (safe), but is **released whenever the
  document is hidden** — so re-acquire on `visibilitychange`, or a candidate
  pausing to think watches their laptop sleep.

```js
document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible') {
    wakeLock = await navigator.wakeLock.request('screen');
  }
});
```

**Size: S**

---

### Task 4.3 — The server decides when it's over ✅ ALREADY DONE

Both hardcoded `updatedHistory.length >= 10` checks are gone (commit `53e149d`);
the server returns `done: true`. Listed here for completeness.

---

### Task 4.4 — One reducer, not 41 pieces of state ⛔ BLOCKER

**This is a correctness fix, not tidying.** The three bugs I fixed in Stage 0
(dead face detection, `status`/`statusRef` drift, stale `qaHistory` on
termination) were *all* closure/sync bugs caused by 41 mutable values in one
980-line function.

```ts
type Status = 'loading' | 'ready' | 'speaking' | 'listening'
            | 'submitting' | 'finishing' | 'completed' | 'error';

type State = {
  status: Status;
  sessionId: string;
  seq: number;
  question: string; category: string; difficulty: string; isFollowUp: boolean;
  topicIndex: number; totalTopics: number;
  transcript: string; interim: string; answerDraft: string;
  turnsAnswered: number; maxQuestions: number;
  error?: string;
};
```

Extract `useSpeech`, `useSessionSync`, `useRecorder`. Rule: **`statusRef` is
assigned in exactly one place.**

**Size: L** — riskiest item here. Write the acceptance tests (§9) first.

---

### Task 4.5 — First question renders before it is spoken

Show the question text on load; speak only after an explicit **Begin** /
**Continue** click; offer a 🔊 Replay button.

Three reasons: accessibility (a deaf candidate must be able to read it), autoplay
policy (speech right after navigation can be blocked), and a returning candidate
wants to *read and orient*, not be talked at.

**Size: S**

---

## 5 — Resume behaviour

### Task 5.1 — The resume banner ⛔ BLOCKER — the headline feature

```
┌──────────────────────────────────────────────────────────┐
│  ↻  Welcome back                                          │
│                                                            │
│  Your interview is still in progress.                      │
│  Topic 3 of 5 · 12 minutes of interview time so far        │
│                                                            │
│  We saved a draft of your answer.                          │
│                                                            │
│           [ Continue Interview ]   [ End & Score ]         │
└──────────────────────────────────────────────────────────┘
```

Deliberate choices:
- **No blame.** "Welcome back", not "you left the interview."
- **Show progress** so they can orient.
- **Offer an exit** — someone whose laptop died may not want to continue, and
  forcing them onward produces a worse interview and a worse score.
- **Never silently discard the draft.**
- **Do not auto-speak on resume** — needs a gesture to be reliable anyway.

Flow: `GET /state` → check IndexedDB for a draft at that `seq` → show banner →
on Continue, restore the draft and re-request mic permission.

**Size: M** · 🔬 the full matrix in §9.

---

### Task 5.2 — Two clocks, deliberately different

| Clock | Runs while disconnected? | Used for |
|---|---|---|
| **Deadline** (`startedAt + limit`) | **YES** — server-computed | Anti-abuse; hard stop |
| **`activeMs`** | No | "you spoke for 18 minutes" |

**This is the anti-abuse mechanism, and it is structural rather than detective.**
HackerRank states it plainly to candidates: *"The timer continues to run while
you are offline."* WeCP says the same. Because the deadline is server-computed
and keeps running, deliberately pulling the network **costs** time instead of
buying thinking time — so no cheating heuristic is needed.

Meanwhile `activeMs` keeps the *reporting* honest, so a power cut doesn't look
like rambling. **Never accept a client-supplied timestamp.**

**Size: S**

---

### Task 5.3 — Two grace periods, sized separately

| | Server-slack | Reconnect |
|---|---|---|
| Absorbs | A slow request | Network loss, crash |
| Size | **~60 s** | **5 min** |
| Precedent | Moodle `graceperiodmin` = 60 s default | ProctorU 5 min; LiveKit's own interview example uses 300 s |

Moodle is candid that the slack window is itself a trade-off: the system
**cannot distinguish a slow server from a candidate stalling**, so every second
you grant to be fair to the honest is also granted to the dishonest. Size it
deliberately.

Behaviour on expiry: if still active → auto-submit the current answer. If they
return *after* expiry → allow **submitting** work in progress, **no new answers**.
(This is Moodle's middle option, and the right line to draw.)

**Size: S**

---

### Task 5.4 — Cumulative disconnection budget

A per-event grace period does not stop *repeated* deliberate drops — disconnect
ten times, collect ten graces. A **budget spent once per session** does.

- Track `cumulativeDisconnectedMs`; default budget **10 minutes**
- On exhaustion: stop granting further submission grace
- **Never auto-terminate.** Surface the total for a human reviewer.

Vendors converge here: one ships an explicit disconnection-duration cap built
because *"test-takers would disconnect on purpose to use unfair means"*; another
allows three disconnections before requiring a reschedule.

**Size: S**

---

### Task 5.5 — Abandoned-session sweeper (lazy **and** eager)

- **Lazy:** whenever a session is loaded, check whether it should have expired
- **Eager:** a cron marking `in_progress` sessions idle > 24 h as `abandoned`

**Both are required, and here's the cautionary example:** Canvas computes its
quiz deadline server-side but fires **auto-submit in the browser** — so
disconnected students' attempts sit unsubmitted forever, and Instructure ships an
instructor tool to manually submit stranded attempts. **A server-authoritative
clock without a sweeper is a real, shipped failure mode.**

Moodle avoids it by checking at both points. Without the cron here, abandoned
sessions also block the one-active-session rule (§2.2).

Retain the partial transcript — never delete it.

**Size: S**

---

## 6 — Local buffering and the recording

### Task 6.1 — IndexedDB store

**New:** `frontend/src/lib/sessionStore.ts`, using `idb`

Three stores:
- `drafts` keyed `[sessionId, seq]` — the in-progress answer
- `chunks` keyed `[sessionId, seq]` with an `uploaded` flag
- `outbox` keyed `clientTurnId` — turns awaiting acknowledgement

Two things to get right:
- **Store recording data as Blobs, not ArrayBuffers** — Blobs can be
  disk-backed rather than held in memory
- **Call `navigator.storage.persist()` at interview start** — default storage
  is best-effort and **evictable under disk pressure**

**Size: S**

---

### Task 6.2 — Write continuously, never at unload ⛔ BLOCKER

- Persist the answer every ~2 s while listening
- Final flush on **`visibilitychange → hidden`** (the last reliably observable moment)
- Clear the draft only once the server accepts the turn

**Why this is the whole design:** in a renderer OOM crash, an OS kill, or a
mobile app-switcher swipe, **no unload event fires at all**. Chrome's Page
Lifecycle guidance is explicit that developers relying on termination events are
likely losing data.

If you flush a pointer at unload, use `fetch(..., {keepalive:true})` — but note
the **64 KiB cap, shared across in-flight keepalive requests**. Never try to
flush media; send only *"session X, answered through seq N, chunks in IDB."*

**Size: S** · 🔬 type an answer → **kill the browser process** → reopen → restored.

---

### Task 6.3 — Chunked recording upload

Fixes the memory problem: today chunks accumulate in a JS array for the whole
session — roughly **590 MB for 30 minutes, ~1.2 GB for an hour** — and all of it
is lost on any crash.

```
recorder.ondataavailable → write chunk to IndexedDB
        (separate loop) → drain pending chunks → POST → mark uploaded
        (on page load)  → scan for pending → resume
```

**Why two decoupled loops:** if the uploader runs inside the recorder callback, a
slow network backs up into MediaRecorder and you drop frames or blow memory.

`recorder.start(8000)`. **Preserve chunk order** — only the first chunk carries
the WebM header.

**Size: M**

---

### Task 6.4 — Server-side remux

`ffmpeg -i in.webm -c copy -cues_to_front 1 out.webm` after upload completes.

Chromium writes duration **only for non-chunked recordings** — and 6.3 uses
chunking — and the seek index is **never** written in any mode. Without a remux,
`video.duration` is `Infinity` and seeking downloads the whole file. Stream copy,
so it's cheap.

**Size: S**

---

### Task 6.5 — Normalise container formats

Safari has **never** recorded WebM (MP4/H.264/AAC only); Firefox records WebM
only. Today the code hardcodes `video/webm;codecs=vp8,opus`. Check
`MediaRecorder.isTypeSupported`, record the real mime type, handle both
server-side. **Size: S**

---

### Task 6.6 — Multi-tab guard

Two tabs on the same interview will both read the same state and both submit.

Simplest sufficient answer: the `(sessionId, clientTurnId)` unique index already
makes double-submits harmless. On top of that, use **BroadcastChannel** to detect
a second tab and show *"This interview is open in another tab"* with a
**Take over here** button.

**Size: S**

---

## 7 — The recording only has half the interview

### 🟠 Task 7.1 — Label it honestly ✅ ALREADY DONE

The report now says *"This recording contains your answers only — the
interviewer's questions are spoken by your browser and cannot be captured."*

### 🟠 Task 7.2 — Actually fix it — **not in this phase**

`MediaRecorder` captures the mic; browser TTS writes straight to the output
device. **There is no API to route `SpeechSynthesis` into a `MediaStream`** — I
verified the W3C request ([web-speech-api#69](https://github.com/WebAudio/web-speech-api/issues/69))
is **still open with no implementation path**.

This is a hard browser limit, not a bug I can patch. It is fixed only by moving
speech synthesis server-side (checklist Stage 9), which is a 2–3 week job of its
own and also fixes §8.

**Do not attempt a workaround.** Until then, the honest label stands.

---

## 8 — Firefox and Opera cannot take an interview

### 🟠 Task 8.1 — Typed answers ⛔ BLOCKER — smallest effort, biggest payoff

Add a text box **always visible** beside the mic — not hidden behind an
accessibility toggle — and make the live transcript box **editable** before
submit. Record `inputMode` on the turn; **never score it.**

This one task fixes four things at once:

1. **Firefox and Opera users can take an interview** — verified: Firefox has
   Speech Recognition **disabled by default**, Opera and Edge **unsupported**.
2. **ADA "screen out"** — DOJ guidance (still published, unlike the EEOC's
   withdrawn companions) warns that voice-analysis tools may exclude people with
   speech impairments. Excluding a qualified person is unlawful **even when
   unintentional**.
3. **STT mishears names and technical terms** — letting candidates correct it
   costs nothing and improves the transcript the score is built on.
4. It is the fallback when the mic fails mid-interview.

**Size: M** · 🔬 complete a full interview in Firefox using only the keyboard.

---

## 9 — Acceptance tests

Each maps to something currently broken. Write these **before** Task 4.4.

| # | Test | Expected |
|---|---|---|
| A1 | F5 mid-interview | Banner → same question → draft restored |
| A2 | Close tab, reopen URL | Same as A1 |
| A3 | **Kill the browser process** | Same as A1 |
| A4 | Airplane mode during submit → reconnect | Answer preserved, accepted **once** |
| A5 | Submit the same turn twice | No duplicate, LLM count unchanged |
| A6 | Resume on a **different device** | Correct question; no local draft (expected) |
| A7 | Two concurrent `POST /session` | Exactly one wins; other gets 409 |
| A8 | Tamper `seq` to 99 in DevTools | 409 `SEQ_MISMATCH` |
| A9 | Full interview in **Firefox, typing only** | Completes |
| A10 | Full interview on **Safari iOS** | Completes; MP4 stored |
| A11 | Disconnect 3 min → reconnect | Deadline advanced 3 min; `activeMs` did not |
| A12 | Submit 30 s after deadline | Accepted (slack window) |
| A13 | Return 3 min after dropping | Can submit; cannot answer anything new |
| A14 | Disconnect 5× for 3 min | Budget exhausted; interview continues; total on report |
| A15 | Abandon → wait for sweeper | `abandoned`; new interview can start |
| A16 | Open in two tabs | Second warns; no duplicate turns |
| A17 | Refresh during the coding round | Code restored |
| A18 | Recording after chunked upload | Plays, shows duration, seekable |

---

## 10 — Order of work

| Step | Tasks | Days | Ships? |
|---|---|---|---|
| 1 | **8.1 typed answers** | 0.5 | ✅ alone |
| 2 | 2.1, 2.2, 3.1, 3.2, 3.3 — server session | 3 | with step 3 |
| 3 | 4.1, 4.2, 4.4, 4.5 — route + reducer | 3 | ✅ |
| 4 | 6.1, 6.2, 5.1 — **resume works** | 2 | ✅ |
| 5 | 5.2–5.5 — clocks, grace, sweeper | 1 | ✅ |
| 6 | 6.3–6.6 — recording | 1.5 | ✅ |

**Total ≈ 11 days.**

**Why typed answers go first:** half a day, ships alone, unblocks two browsers
and closes the biggest legal gap. It would be wrong to leave it behind two weeks
of session work.

Steps 2 and 3 must ship **together** — a server session with no route to use it
is useless, and vice versa.

---

## 11 — Cleanup found while writing this

Small, unrelated to the above, worth doing when convenient:

- **Remove dead dependencies.** `@ricky0123/vad-react`, `@ricky0123/vad-web` and
  `onnxruntime-web` are still in `frontend/package.json` but unused since I
  removed the VAD. `onnxruntime-web` is a large bundle.
- **Backend deps are not installed here** — `career.service.test.js` fails with
  *"Cannot find module 'groq-sdk'"*. Unrelated to my changes, but it means the
  backend has never actually been run in this working copy.

---

## 12 — What is deliberately NOT in this plan

| Item | Why | Where |
|---|---|---|
| Interrupting the AI (barge-in) | Needs server-side voice | checklist Stage 9 |
| Knowing when you stopped speaking | Same | Stage 9 |
| Recording the interviewer's voice | Hard browser limit (§7.2) | Stage 9 |
| Evaluation in a job queue | Independent of resume | Stage 5 |
| Spending limits | **Do before public launch** | Stage 8 |
| Scoring rubric rework | Independent | Stage 7 |

---

## Open questions for you

1. **The CV history purge (§0)** — who has clones, and may I force-push?
2. **Should recording stay opt-in?** It currently costs ~4× more than audio-only
   and adds biometric exposure for no evaluative benefit. I would default video
   to **off**.
3. **Deploy target?** The resume flow works anywhere, but if this is heading to
   Vercel, note the realtime work in Stage 9 cannot run there — functions cap out
   well below a 30-minute session and cannot carry WebRTC media.
