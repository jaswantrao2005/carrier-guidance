# Implementation Specification — The Interview Session

**Companion to [document.md](document.md) (Part 1) and [interview-platform-analysis.md](interview-platform-analysis.md) (Part 2).**
**This is Part 3: the build spec.** Part 2 said *what is wrong and why*. This says *exactly what to build*, screen by screen and state by state.
**Paired with [checklist.md](checklist.md)** — the sequenced, tickable task list. Read this document to understand the design; work from the checklist.

**Scope note.** This spec describes **Phase 0 + Phase 1** from Part 2 §7 — fixing the session so it is correct, recoverable, and honest, *without* yet moving to a WebRTC SFU. Everything here works with the existing Next.js + Express + MongoDB stack. Phase 2 (LiveKit agent) is sketched in §12 so nothing built now has to be thrown away.

---

## Table of contents

1. [The model: what an interview *is*](#1-the-model-what-an-interview-is)
2. [End-to-end user journey](#2-end-to-end-user-journey)
3. [How the interview opens (route, tab, fullscreen)](#3-how-the-interview-opens)
4. [The first question](#4-the-first-question)
5. [The turn loop](#5-the-turn-loop)
6. [Reload, crash, and disconnect](#6-reload-crash-and-disconnect)
7. [Server API contract](#7-server-api-contract)
8. [Data model changes](#8-data-model-changes)
9. [Client state machine](#9-client-state-machine)
10. [Integrity, honestly](#10-integrity-honestly)
11. [Ending the interview](#11-ending-the-interview)
12. [Forward compatibility with Phase 2](#12-forward-compatibility-with-phase-2)

---

## 1. The model: what an interview *is*

### 1.1 The single most important change

Today an interview is **a React component that is mounted**. It exists only in browser memory. The server first learns about it when `/complete` arrives with the whole history attached.

After this work, an interview is **a server-side record with a lifecycle**. The browser becomes a *view* of it.

```
BEFORE                                 AFTER
──────                                 ─────
Browser owns:                          Server owns:
  qaHistory                              session document (status, turns, seq)
  currentQuestion                        the authoritative next question
  transcript                             the authoritative transcript
  integrity verdict                      the integrity record
  recording chunks                       recording chunk manifest

Server owns:                           Browser owns:
  nothing until /complete                current UI state only
                                         (+ IndexedDB write-behind buffer)
```

Everything else in this document follows mechanically from that inversion.

### 1.2 Session lifecycle

```
                  POST /session
                       │
                       ▼
                 ┌───────────┐
                 │  created  │  room booked, no question asked yet
                 └─────┬─────┘
                       │ first GET /state (or POST /turn with seq 0)
                       ▼
                 ┌───────────┐
      ┌─────────►│in_progress│◄────────┐
      │          └─────┬─────┘         │
      │                │               │ resume (GET /state)
      │                │               │
      │      ┌─────────┼─────────┐     │
      │      │         │         │     │
      ▼      ▼         ▼         ▼     │
  abandoned  │    completed  terminated │
  (TTL swept)│         ▲         ▲     │
             └─────────┘         │     │
                  POST /complete │     │
                                 │     │
                 admin/integrity ┘     │
                                       │
              page reload ─────────────┘
```

**States:**

| State | Meaning | Can resume? |
|---|---|---|
| `created` | Session exists; consent recorded; no question issued | Yes |
| `in_progress` | At least one question issued | Yes |
| `completed` | Candidate finished; evaluation queued or done | No |
| `abandoned` | No activity past the resume window; swept by a job | No |
| `terminated` | Ended early by candidate or (rarely) by policy | No |

**Rule: a user may have at most one non-terminal session at a time.** Starting a new one while `created`/`in_progress` exists must either resume it or explicitly abandon it — the UI asks. This prevents the "open five tabs, pick the best score" abuse and is one unique index.

### 1.3 Turns

A **turn** is one question/answer pair with a monotonic `seq` starting at 0.

```
turn {
  seq         0,1,2,…      assigned by SERVER, never trusted from client
  question    string       generated server-side, stored before it is shown
  category    string
  difficulty  string
  askedAt     Date
  answer      string|null  filled when the candidate submits
  answeredAt  Date|null
  clientTurnId uuid        client-generated, for idempotency
  audioMs     number|null  Phase 1: real speaking duration
}
```

**The server decides when the interview ends**, not the client. Today `>= 10` is hardcoded in two places in the browser (`InterviewRoom.tsx:549` and `:623`); a user can edit it. Move the plan server-side (§4.2).

---

## 2. End-to-end user journey

The complete path, with the decision points that matter.

```
 1. Dashboard
      │  "Start Mock Interview"
      ▼
 2. /mock-interview          ← SETUP (existing page, stays a normal page)
      │  role · type · resume · JD · company · experience
      │
      ├─ (optional) company research brief screen
      │
      ▼
 3. Pre-flight check         ← NEW, replaces the current permission screen
      │  device test + consent + what-is-recorded disclosure
      │  ── POST /api/interview/session ──► server creates session
      │
      ▼
 4. /interview/[sessionId]   ← NEW DEDICATED ROUTE (not a modal)
      │  ┌──────────────────────────────────────┐
      │  │ Q1 asked ──► answer ──► submit       │
      │  │      ▲                      │        │
      │  │      └──── seq+1 ◄──────────┘        │
      │  │           (server decides)           │
      │  └──────────────────────────────────────┘
      │  reload / crash ──► resume banner ──► continue at server seq
      │
      ▼
 5. Finishing screen         ← evaluation is queued, not blocking
      │  "Analysing your interview…" with progress
      │
      ▼
 6. /mock-interview/report/[id]
```

### 2.1 What changes vs today

| Step | Today | After |
|---|---|---|
| 3 | Permission screen inside setup page; consent is one boolean | Pre-flight route; itemised consent (§10.4); **session created here** |
| 4 | `isInterviewing` boolean swaps the component | Real route with a real URL you can return to |
| 4 | Client counts to 10 | Server owns the plan and the seq |
| 4 | Reload = total loss | Reload = resume |
| 5 | `/complete` blocks on a long LLM call | Returns immediately; evaluation is a job |

---

## 3. How the interview opens

The user asked specifically about this, and it is worth being precise, because the obvious answer (`window.open`) is the wrong one.

### 3.1 Decision: a dedicated route, not a new tab

**Do NOT use `window.open()`.** Reasons, in order of severity:

1. **Popup blockers.** A window opened outside a direct user-gesture call stack is blocked. Even inside one it is fragile, and the failure is silent-ish and confusing.
2. **The opener relationship is a liability.** If the parent tab closes, state coordination breaks.
3. **`getUserMedia` permission is per-origin but the *prompt* is per-tab context** — you would risk asking twice.
4. **Mobile browsers largely ignore popups.** An India-first product cannot ship a desktop-only launch path.
5. **You cannot deep-link back into it.** A resumed session needs a URL.

**Instead: a dedicated Next.js route** — `/interview/[sessionId]`.

```
frontend/src/app/interview/[sessionId]/page.tsx
frontend/src/app/interview/[sessionId]/layout.tsx    ← no Navbar, no Sidebar
```

This gives you, for free:
- A **real URL** — so resume is just "load the page again."
- A **clean chrome-less layout** — the root layout's `<Navbar />` must not appear; that's what the nested `layout.tsx` is for.
- Normal browser back/forward semantics you can then guard deliberately.
- Works identically on mobile.

### 3.2 The launch sequence (exact order matters)

All three of these APIs require a **user gesture**, so they must happen synchronously in the click handler of the "I'm ready — Begin Interview" button:

```
onClick (user gesture — do these in this order, in the same call stack)
  1. await navigator.mediaDevices.getUserMedia(...)   ← may prompt
  2. await el.requestFullscreen()                     ← REQUIRES transient activation
  3. await navigator.wakeLock.request('screen')       ← prevents screen sleep
  4. router.push(`/interview/${sessionId}`)
```

**Verified constraints:**

- **`requestFullscreen()` requires transient user activation** and **rejects with a `TypeError`** without it. Handle the rejection — do not let a failed fullscreen abort the interview.
- **Fullscreen can never be forced.** The user can always press Esc, and browsers guarantee an exit path even under keyboard lock. So fullscreen is a *focus aid, not a control.* Treat exiting it as a UI event to gently re-offer, never as a violation.
- **Screen Wake Lock is Baseline 2025** — safe to use, but it is **automatically released when the document becomes hidden**, so you must re-acquire on `visibilitychange`. Without it, a candidate who pauses to think can watch their laptop sleep mid-interview.

```js
// Wake lock with re-acquisition — the release-on-hide behaviour is by design
let wakeLock = null;
async function acquireWakeLock() {
  try { wakeLock = await navigator.wakeLock.request('screen'); }
  catch (err) { /* power-save/low-battery can refuse; non-fatal */ }
}
document.addEventListener('visibilitychange', () => {
  if (wakeLock !== null && document.visibilityState === 'visible') acquireWakeLock();
});
```

### 3.3 Guarding accidental navigation

Attach `beforeunload` **only while a session is live**, and remove it on completion.

**Verified browser behaviour:**
- The dialog requires **sticky activation** — if the user has never interacted with the page, no dialog appears. In practice they have (they clicked Begin), so this is satisfied.
- **Custom messages are ignored.** Browsers show a generic string. Do not waste effort writing copy for it.
- **It is not reliably fired**, especially on mobile — MDN explicitly recommends `visibilitychange` as the reliable signal for saving state.
- It **breaks bfcache** in Firefox, so attach it narrowly and remove it when done.

**Therefore: `beforeunload` is a courtesy prompt, never a persistence mechanism.** All actual durability comes from §6.

```js
useEffect(() => {
  if (status === 'completed' || status === 'idle') return;
  const handler = (e) => { e.preventDefault(); };   // message is ignored by browsers
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [status]);
```

### 3.4 Blocking in-app navigation (`beforeunload` does not cover this)

`beforeunload` fires for reload, tab-close and typed URLs. It does **not** fire for Next.js client-side navigation — clicking the Navbar logo would silently abandon the interview. These are complements, not alternatives.

Next.js 15.3+ provides `onNavigate` on `<Link>` for exactly this:

```jsx
<Link href="/dashboard" onNavigate={(e) => {
  if (interviewIsLive && !window.confirm('Leave the interview? Your session stays open and you can return.')) {
    e.preventDefault();
  }
}}>
```

Three caveats that decide the implementation:

- `onNavigate` fires **only** for same-origin client-side navigation — not modifier-clicks, external URLs, or `download` links.
- It does **not** cover `router.push()` calls or the browser **back button**. For back, push a history entry and handle `popstate`. There is no App Router equivalent of the Pages Router's cancellable `routeChangeStart`.
- Therefore: **route all programmatic navigation through one guarded helper**, and don't scatter `router.push` calls through the interview code.

The chrome-less layout (§3.1) already removes the main offenders by not rendering the Navbar at all — this guard is for what remains.

### 3.5 Route protection

`/interview/[sessionId]` must:
- 401 → redirect to `/login`
- session not owned by the user → 404 (never 403 — don't confirm existence)
- session `completed`/`abandoned`/`terminated` → redirect to the report or setup with an explanation
- **not be prefetched** — `prefetch={false}` on any `<Link>` pointing at it, so hovering the button doesn't trigger work
- **not be cached across candidates** — `export const dynamic = 'force-dynamic'`

---

## 4. The first question

### 4.1 The problem with how it works today

`InterviewRoom.tsx:401` calls `fetchNextQuestion([])` inside a mount `useEffect`. Three consequences:

1. **It fires on every mount** — including a remount from a hot reload or a Strict Mode double-invoke in dev, producing two questions and two LLM charges.
2. **It fires before the user is ready.** The candidate lands and the AI immediately starts talking, with no "are you set?" beat.
3. **Autoplay policy risk.** `speechSynthesis.speak()` immediately after navigation can be blocked; and `getVoices()` is async and commonly returns `[]` on first call, so even when it speaks it may use the wrong voice (D5/D6).

### 4.2 The design

**Question generation moves server-side and becomes idempotent per `seq`.**

```
Client                                  Server
──────                                  ──────
GET /session/:id/state ───────────────► load session
                                        if status=created:
                                          generate turn seq=0
                                          persist BEFORE responding
                                        return { status, seq, question, … }
◄───────────────────────────────────────
render question text on screen
show "Ready? [Begin]" ← user gesture
      │
      ├─ Begin clicked
      ▼
speak(question)  ← now inside a gesture, autoplay-safe
listen…
```

**Key properties:**

- **The question is persisted before it is returned.** If the response is lost in flight, the next `GET /state` returns *the same* question for the same `seq` — never a fresh one. This is the whole idempotency story for question generation.
- **The question text is rendered before it is spoken.** This is an accessibility requirement (§5.4 of Part 2), not a nicety: a deaf or hard-of-hearing candidate must be able to read it, and everyone benefits when TTS fails.
- **The first spoken audio is behind an explicit "Begin" gesture**, which resolves the autoplay problem and gives the candidate a moment to settle.

### 4.3 First-question content

Keep the existing phase strategy (Part 1 §6.4) but move the plan server-side. For `Overall Interview`, `seq=0` remains the welcome + self-introduction; for `Coding / Programming Interview` it remains a full problem statement.

**One change:** the current prompt returns `{question, category, difficulty}` as one JSON object, which cannot be streamed. For Phase 1 keep it — it is acceptable for a turn-based UI. Note in code that Phase 2 requires splitting the spoken text from the metadata (Part 2 §6.3).

### 4.4 TTS correctness (fixes D5 + D6)

```js
// Voices load asynchronously — getVoices() commonly returns [] on first call
function loadVoices() {
  return new Promise((resolve) => {
    const v = speechSynthesis.getVoices();
    if (v.length) return resolve(v);
    speechSynthesis.addEventListener('voiceschanged', () => resolve(speechSynthesis.getVoices()), { once: true });
  });
}

async function speak(text, langCode) {
  const voices = await loadVoices();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = langCode;                                    // ← D5: never set today
  u.voice = voices.find(v => v.lang === langCode)
         ?? voices.find(v => v.lang.startsWith(langCode.split('-')[0]))
         ?? null;                                       // null = browser default
  u.rate = 1.0;
  // …onstart / onend / onerror
  speechSynthesis.speak(u);
}
```

**If no voice exists for the selected language, say so.** A candidate who picked Hindi and gets an English voice should see a one-line notice, not silently wonder. This is honest degradation, and it is the correct interim behaviour until Phase 1 moves TTS server-side.

---

## 5. The turn loop

### 5.1 Sequence per turn

```
┌─ SERVER ────────────────────────────────────────────────┐
│ turn seq=N persisted with question text                  │
└──────────────────────┬───────────────────────────────────┘
                       │ GET /state  (or response to previous POST /turn)
                       ▼
┌─ CLIENT ────────────────────────────────────────────────┐
│ 1. render question text          (immediately visible)   │
│ 2. speak(question)               status → speaking       │
│ 3. on utterance end              status → listening      │
│ 4. SpeechRecognition accumulates transcript              │
│    └─ every 2s: write draft to IndexedDB (write-behind)  │
│ 5. user clicks "Submit Response" │                       │
│    └─ or types the answer instead (accessibility)        │
│ 6. POST /turn { seq:N, clientTurnId, answer }            │
└──────────────────────┬───────────────────────────────────┘
                       ▼
┌─ SERVER ────────────────────────────────────────────────┐
│ if turn N already answered → return stored next turn     │
│    (idempotent replay — no new LLM call, no double bill) │
│ else: save answer, decide continue-or-finish,            │
│       generate + persist turn N+1, return it             │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Idempotency (the part that must not be got wrong)

**The failure this prevents:** candidate submits an answer on a flaky connection; the request succeeds server-side but the response never arrives; the client retries; without protection you now have a duplicate turn, a second LLM charge, and a corrupted transcript.

**Terminology, stated precisely:** you cannot achieve exactly-once *delivery* over an unreliable network — only at-most-once or at-least-once. What this pattern buys is at-least-once delivery with an **exactly-once effect**: the client retries until it gets an answer, and the server collapses duplicates so the observable state changes once.

Three layers, all required:

1. **`clientTurnId`** — a UUIDv4 generated on the client *once per turn* (not per attempt) and reused across every retry. Send it as the standard `Idempotency-Key` header as well as in the body; the IETF draft specifies an RFC 8941 Structured Header String, and it's what clients already expect from payment APIs.
2. **Two unique compound indexes** — the database is the final arbiter, and each guards a different failure:
   - `(sessionId, clientTurnId)` unique → **dedupes retries**
   - `(sessionId, seq)` unique → **prevents two turns at the same position**
3. **Server logic keyed on `seq`:**

**Let the index catch duplicates — do not pre-check with a read.** A read-then-write has a race window; the unique index does not:

```js
try {
  await recordTurn({ sessionId, seq, clientTurnId, answer });
} catch (e) {
  if (e.code === 11000) {              // Mongo duplicate key
    return res.status(200).json(await buildSessionState(sessionId));  // self-healing replay
  }
  throw e;
}
```

Returning **the current session state** on a duplicate (rather than a bare 200) is what makes the retry self-healing: a client that lost the original response gets everything it needs to continue.

**Keep the turn write and the seq increment atomic.** Use a compare-and-set so they can never diverge:

```js
await Session.updateOne(
  { _id: sessionId, currentSeq: seq },                    // CAS guard
  { $push: { turns: turnDoc }, $inc: { currentSeq: 1 } }
);
// matchedCount === 0 → someone already advanced → treat as duplicate/out-of-order
```

**Status codes to follow** (from the IETF idempotency draft):

| Situation | Response |
|---|---|
| Key never seen | Process normally |
| Key seen, completed | Replay the stored status + body |
| Key seen, still in flight | **409 Conflict** |
| Same key, **different payload** | **422 Unprocessable Content** |

```js
// Pseudocode — the shape that matters
const turn = session.turns.find(t => t.seq === body.seq);
if (!turn) return 409;                       // client is ahead of the server
if (turn.answer !== null) {
  // Already answered — this is a retry. Return the SAME next turn.
  return { ...session.turns.find(t => t.seq === body.seq + 1), replayed: true };
}
turn.answer = body.answer;
turn.answeredAt = new Date();
// …then generate next turn, persist, return
```

**Rule: never let a retry cause a second LLM call.** At the cost figures in Part 2 §8 this is real money, and it is also what keeps the transcript trustworthy.

### 5.3 Client retry policy

```
attempt 1  immediate
attempt 2  +1s   ± jitter
attempt 3  +2s   ± jitter
attempt 4  +4s   ± jitter
attempt 5  +8s   ± jitter
then       show "Connection problem — retrying" with a manual Retry button
```

Use **full jitter** (`delay * (0.5 + random()*0.5)`), not fixed backoff. The answer stays in IndexedDB throughout, so even a closed tab does not lose it.

### 5.4 Answer input — not only speech

Add a **text input alternative for every question**, always visible, not hidden behind an accessibility toggle.

This is required by §5.4 of Part 2 (ADA screen-out: a tool must measure the skill, not the disability) and it also fixes the Firefox/Opera exclusion in the interim before Phase 1 — a browser without `SpeechRecognition` degrades to typing rather than a dead end.

```
┌────────────────────────────────────────────┐
│ [🎤 Listening…]        Timer 1:24          │
│ ┌────────────────────────────────────────┐ │
│ │ live transcript appears here…          │ │
│ │                                        │ │
│ └────────────────────────────────────────┘ │
│ ✏️ Or type your answer instead              │
│ ┌────────────────────────────────────────┐ │
│ │                                        │ │
│ └────────────────────────────────────────┘ │
│              [ Submit Response ]            │
└────────────────────────────────────────────┘
```

The transcript box must be **editable**. STT will mishear names and technical terms; letting the candidate correct it before submitting improves both fairness and data quality, and costs nothing.

### 5.5 Fixing the state machine (D1, D2, D3)

Replace the 23 `useState` + 15 `useRef` with **one reducer**. This is not cosmetic — D1, D2 and D3 are all closure/sync bugs caused directly by that sprawl.

```ts
type Status = 'loading' | 'ready' | 'speaking' | 'listening' | 'submitting' | 'finishing' | 'completed' | 'error';

type State = {
  status: Status;
  sessionId: string;
  seq: number;
  question: string;
  category: string;
  difficulty: string;
  transcript: string;
  interim: string;
  answerDraft: string;      // the editable/typed answer
  turnsAnswered: number;
  plannedTurns: number;     // from server — no more hardcoded 10
  events: IntegrityEvent[];
  error?: string;
};
```

Then a single `useSyncExternalStore`-style read or a plain `useReducer` with a ref mirror **created in exactly one place**, so it can never drift the way `status`/`statusRef` does today.

**Delete the 500 ms `SpeechRecognition` watchdog** (`InterviewRoom.tsx:390`). Replace it with explicit `onstart`/`onend` bookkeeping and restart only when `onend` fires while status is `listening`. The current version swallows an exception twice a second for the whole interview.

---

## 6. Reload, crash, and disconnect

This is the question the user asked most directly, so here is the full matrix.

### 6.1 What actually survives what

| Event | Do unload events fire? | JS memory | IndexedDB | Server state |
|---|---|---|---|---|
| **F5 / reload** | ✓ yes | ✗ lost | ✓ survives | ✓ survives |
| **Tab closed by user** | ✓ yes | ✗ lost | ✓ survives | ✓ survives |
| **Tab crash (renderer OOM)** | **✗ NONE** | ✗ lost | ✓ survives | ✓ survives |
| **Browser force-quit / OS kill** | **✗ NONE** | ✗ lost | ✓ survives | ✓ survives |
| **Mobile: swiped away in app switcher** | **✗ NONE** | ✗ lost | ✓ survives | ✓ survives |
| **Laptop battery dies** | **✗ NONE** | ✗ lost | ⚠️ see below | ✓ survives |
| **Different device** | — | ✗ | ✗ | ✓ survives |
| **Network drop (page open)** | — | ✓ intact | ✓ | ✓ |

**Two conclusions, both load-bearing:**

1. **The server is the only thing that survives everything, so the server must hold the truth.** IndexedDB is a write-behind buffer for the current unsubmitted turn and recording chunks — not the system of record.
2. **In the crash cases that matter most, no unload event fires at all.** Chrome's Page Lifecycle guidance is explicit that developers who depend on termination events are likely losing data, and that closing from the mobile app switcher fires nothing. **Therefore: write continuously as the candidate types, never at unload.** `visibilitychange → hidden` is the last reliably observable moment and is where a final flush belongs; `beforeunload` is a courtesy dialog only.

**Two IndexedDB details that bite:**

- **Durability.** IndexedDB commits are `"relaxed"` by default in some engines — `complete` fires once the OS has been told to write, potentially before the data reaches disk, so a **power loss** (not a tab crash) can lose the last transaction. Use `{durability: 'strict'}` for the few writes where that matters; it costs performance, so don't blanket-apply it.
- **Eviction.** Default storage is best-effort and evictable under disk pressure. Call `navigator.storage.persist()` at interview start. Note also that Safari clears script-writable storage for origins with no interaction in 7 days — irrelevant within one sitting, relevant if you allow multi-day resume, and another reason the server is the record.

```js
if (navigator.storage?.persist) await navigator.storage.persist();
```

**Unload-time flush limits — both are 64 KiB.** `navigator.sendBeacon()` and `fetch(..., {keepalive: true})` share the same 64 KiB cap (claims that `keepalive` avoids it are wrong), and the budget is shared across in-flight keepalive requests. Prefer `keepalive` because it allows custom headers — so you can send `Authorization` and `Idempotency-Key`. **Never attempt to flush audio or video at unload**; send only a small JSON pointer: *"session X, answered through seq N, chunks are in IndexedDB."*

### 6.2 Reload behaviour, step by step

```
User presses F5 mid-interview
  │
  ├─ beforeunload fires (if they interacted) → generic browser dialog
  │  └─ they confirm
  │
  ▼
Page loads at /interview/[sessionId]
  │
  ├─ 1. GET /api/interview/session/:id/state
  │      → { status:'in_progress', seq:4, question:'…', turnsAnswered:4, plannedTurns:10 }
  │
  ├─ 2. Open IndexedDB, look for an unsubmitted draft for (sessionId, seq=4)
  │      → found: "I worked on a project where…"
  │
  ├─ 3. Show the RESUME BANNER (§6.3)
  │
  └─ 4. On "Continue": restore draft into the answer box,
        re-render question 5 of 10, re-request mic permission,
        DO NOT re-speak the question automatically
        (offer a 🔊 Replay button instead — it needs a gesture anyway)
```

**Important: do not auto-speak on resume.** It requires a gesture to be reliable, and a candidate returning from a crash wants to read and orient, not be talked at.

### 6.3 The resume banner

```
┌──────────────────────────────────────────────────────────┐
│  ↻  Welcome back                                          │
│                                                            │
│  Your interview is still in progress.                      │
│  You're on question 5 of 10 · 12 minutes elapsed           │
│                                                            │
│  We saved a draft of your answer.                          │
│                                                            │
│           [ Continue Interview ]   [ End & Score ]         │
└──────────────────────────────────────────────────────────┘
```

Deliberate choices:
- **No blame.** "Welcome back," not "you left the interview."
- **Show progress and elapsed time** so they can orient.
- **Offer an exit** — someone whose laptop died may not want to continue; forcing them onward produces a worse interview and a worse score.
- **Never silently discard the draft.** Restoring it is the whole point.

### 6.4 Recording chunks across a reload

Fixes D7 (memory buffering) and partially D12.

```
recorder.ondataavailable
  └─► IndexedDB: put({ sessionId, seq: n++, blob, status:'pending' })

separate uploader loop (decoupled — a network stall must not stall the recorder)
  └─► POST /session/:id/recording/chunk  (multipart, one chunk)
        on 200 → mark 'uploaded', delete blob from IndexedDB

on page load
  └─► scan IndexedDB for status='pending' → resume uploading
```

**Why decoupled:** if the uploader is in the recorder's callback, a slow network backs up into the MediaRecorder and you drop frames or blow memory. Two independent loops with a queue between them is the standard shape.

Chunk size: `recorder.start(8000)` — 8 s is a reasonable balance between request overhead and loss window. **Only the first chunk carries the WebM header**, so chunks must be stored and reassembled *in order*; the `seq` field is not optional.

### 6.5 Session expiry and abandonment

| Window | Behaviour |
|---|---|
| 0 – 30 min since last activity | Fully resumable, no warning |
| 30 min – 24 h | Resumable, banner notes the gap |
| > 24 h | Auto-`abandoned` by a sweeper job; partial transcript retained; candidate may score what exists or discard |

**A server-authoritative clock is necessary but not sufficient — you also need a sweeper.** This is a real, shipped failure mode worth learning from rather than rediscovering: Canvas computes its quiz deadline server-side, but the **auto-submit fires in the browser**. So a student who disconnects has their attempt sit unsubmitted indefinitely, and Instructure ships an instructor tool specifically to manually submit stranded attempts.

Moodle avoids this by checking state at **two** points — lazily whenever an attempt is loaded, *and* eagerly via a scheduled task that closes off overdue attempts "when no-one is looking at them." Both are required: the lazy check handles anyone who returns; the cron handles the candidate who **never** returns, which is exactly the case where no client event will ever fire. That is the checklist's Stage 2.8.

**Do not run the answer timer while disconnected.** The elapsed clock should count *interview time*, not wall-clock since start, or a candidate whose power cut for an hour is penalised for it.

**On deliberate abuse — solve it structurally, not with heuristics.** Someone could disconnect to buy thinking time. The established answer from assessment platforms is that **the deadline is computed server-side at session start and wall-clock time keeps running while disconnected.** HackerRank states it plainly: *"The timer continues to run while you are offline, and the test ends at the scheduled time even if you are disconnected."* WeCP says the same.

That makes disconnection *cost* time rather than buy it, so no detection heuristic is needed. Record `disconnectedAt`/`resumedAt` and surface gaps in the report as *context for a human reviewer* — never as an automatic penalty (the §10 principle).

**Reconcile the two clocks deliberately.** There are two different things you might measure, and they serve different purposes:

| Clock | Runs while disconnected? | Used for |
|---|---|---|
| **Session deadline** (`startedAt + limit`) | **Yes** — server-computed | Anti-abuse; when the session hard-stops |
| **`activeMs`** (interview time) | No | Reporting "you spoke for 18 minutes"; per-answer pacing |

Do not use `activeMs` as the deadline, or a candidate can pause indefinitely. Do not report the wall-clock as their speaking time, or a power cut looks like rambling.

**Where a grace period legitimately belongs is the *submission* window, not thinking time.** Moodle's quiz model draws exactly this line and is worth copying. Its three "when time expires" options are:

1. *"Open attempts are submitted automatically"* (their default)
2. *"There is a grace period when open attempts can be submitted, but no more questions answered"* ← **use this**
3. *"Attempts must be submitted before time expires, or they are not counted"*

Option 2 is right here: a candidate who crashes at minute 44 of 45 can reconnect and save their work, but cannot answer anything new.

### 6.5a Two grace periods, doing two different jobs

Do not conflate these — they have different sizes and different risks.

| | **Server-slack window** | **Reconnect window** |
|---|---|---|
| Absorbs | Latency, a slow request | Network loss, a crash, a walk away |
| Typical size | **~60 s** | **5 min** |
| Reference | Moodle `graceperiodmin`, **60 s by default** | ProctorU 5 min; LiveKit recommends `departure_timeout=300` |
| Risk | **It is itself a cheat surface** | Abuse handled by the running clock (above) |

Moodle is unusually candid that the first one is a trade-off rather than free: the system **cannot distinguish a slow server from a candidate stalling**, so every second of slack you grant to be fair to the honest is also a second granted to the dishonest. Size it deliberately; 60 s is a reasonable starting point.

For the reconnect window, LiveKit's own guidance uses an interview as its worked example — *"for an interview agent where a candidate might lose Wi-Fi or step away, you may want minutes"* — and their sample config uses **300 s**. Note their default is only 20 s, which is far too short for this use case; Phase 2 must override it.

**An important correction for Phase 2:** a deliberate "leave" and a network drop arrive at the agent as **the same disconnect reason** and are *not* reliably distinguishable. So do not build logic that depends on telling them apart — rely on the running clock and the cumulative budget below.

### 6.5b Prefer a cumulative disconnection budget over per-event grace

A per-event grace period does not defeat *repeated* deliberate drops — someone can disconnect ten times and collect ten grace periods.

The pattern that does work is a **budget spent once per session**: allow, say, 10 minutes of cumulative disconnection across the whole interview. Vendors converge on this — one platform ships an explicit "test stop on disconnection duration" setting built precisely because *"test-takers would disconnect from the test on purpose to use unfair means"*, and another caps it at three disconnections before requiring a reschedule.

Store `cumulativeDisconnectedMs` on the session. When it is exhausted, **do not auto-terminate** (§10) — surface it on the report for a human reviewer, and stop granting further submission grace.

> No primary source publishes a "correct" grace length; vendors range from 5 to 30 minutes and Moodle exposes its own as configurable without recommending a value. These are product decisions, not industry standards.

### 6.6 Network drop without a reload

The page is still open; only the fetch fails.

```
POST /turn fails
  → keep the answer in state AND IndexedDB
  → show a non-blocking banner: "Reconnecting… your answer is saved"
  → retry with backoff (§5.3)
  → on success, continue normally; banner disappears
  → after 5 failures, offer a manual Retry
```

**Never lose the answer to a failed request, and never silently drop the candidate back to the start of the turn.**

---

## 7. Server API contract

New endpoints under the existing `/api/interview`, all behind `authMiddleware`.

### 7.1 `POST /api/interview/session`

Creates a session. Called from the pre-flight screen, **before** navigating to the interview route.

```jsonc
// Request
{
  "role": "Backend Developer",
  "interviewType": "Technical Interview",
  "resumeId": "…",                  // optional
  "jobDescriptionText": "…",        // optional
  "companyName": "…",               // optional
  "companyResearch": { … },         // optional
  "experienceLevel": "fresher",
  "totalExperienceYears": 0,
  "employmentHistory": [],
  "consent": {                       // itemised — see §10.4
    "recordAudio": true,
    "recordVideo": false,
    "storeTranscript": true,
    "processingDisclosureVersion": "2026-09-04"
  }
}

// 201
{ "success": true, "sessionId": "…", "status": "created" }

// 409 — an active session already exists
{ "success": false, "error": "ACTIVE_SESSION_EXISTS", "sessionId": "…" }
```

The 409 is what powers the "you already have an interview in progress — resume or discard?" prompt.

### 7.2 `GET /api/interview/session/:id/state`

The resume primitive. Safe to call any number of times.

```jsonc
{
  "success": true,
  "status": "in_progress",
  "seq": 4,
  "question": "Tell me about a time you…",
  "category": "Behavioral",
  "difficulty": "Intermediate",
  "turnsAnswered": 4,
  "plannedTurns": 10,
  "elapsedMs": 743000,
  "recordingConsent": true,
  "interviewType": "Technical Interview",
  "role": "Backend Developer"
}
```

If `status === 'created'`, this call **generates and persists turn 0** before responding.

### 7.3 `POST /api/interview/session/:id/turn`

```jsonc
// Request
{
  "seq": 4,
  "clientTurnId": "8f3c…",     // stable across retries
  "answer": "I worked on…",
  "inputMode": "speech",        // "speech" | "text" — recorded, not scored
  "codeSubmission": { … }       // optional, coding mode
}

// 200 — next turn
{
  "success": true,
  "done": false,
  "seq": 5,
  "question": "…",
  "category": "Technical",
  "difficulty": "Advanced",
  "turnsAnswered": 5,
  "plannedTurns": 10,
  "replayed": false             // true if this was an idempotent retry
}

// 200 — interview over
{ "success": true, "done": true, "interviewId": "…" }

// 409 — seq mismatch (client behind or ahead)
{ "success": false, "error": "SEQ_MISMATCH", "expectedSeq": 5 }
```

On `409 SEQ_MISMATCH` the client re-syncs via `GET /state` rather than guessing.

### 7.4 `POST /api/interview/session/:id/complete`

Marks the session complete and **enqueues** evaluation. Returns immediately.

```jsonc
{ "success": true, "interviewId": "…", "evaluationStatus": "queued" }
```

### 7.5 `GET /api/interview/session/:id/evaluation`

Polled (or SSE) while the report is generated.

```jsonc
{ "status": "processing" }                          // keep polling
{ "status": "ready", "interviewId": "…" }           // redirect to report
{ "status": "failed", "retryable": true }           // offer a retry
```

### 7.6 `POST /api/interview/session/:id/recording/chunk`

One chunk per request, multipart, with `seq` and `sessionId`. Server appends to the session's chunk manifest. Returns `{ received: seq }`.

### 7.7 `POST /api/interview/session/:id/events`

Client integrity hints, batched. **Stored as `unverified`, never used to terminate** (§10).

```jsonc
{ "events": [ { "type": "tab_blur", "atMs": 84000 } ] }
```

---

## 8. Data model changes

### 8.1 New `InterviewSession` collection

Keep `Interview` as the **completed, scored artefact**. Add a separate collection for in-flight state. Mixing them would mean partial junk in the reports collection.

```js
const interviewSessionSchema = new mongoose.Schema({
  user:   { type: ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['created','in_progress','completed','abandoned','terminated'],
            default: 'created', index: true },

  // setup snapshot (frozen at creation — the interview must not change under the candidate)
  role: String,
  interviewType: String,
  resumeId: { type: ObjectId, ref: 'Resume' },
  resumeAnalysisSnapshot: Object,   // ← snapshot, so re-uploading a resume mid-interview can't alter it
  jobDescriptionText: String,
  companyName: String,
  companyResearch: Object,
  experienceLevel: String,
  totalExperienceYears: Number,
  employmentHistory: Array,

  plannedTurns: { type: Number, default: 10 },

  turns: [{
    seq:          { type: Number, required: true },
    question:     { type: String, required: true },
    category:     String,
    difficulty:   String,
    askedAt:      Date,
    answer:       { type: String, default: null },
    answeredAt:   Date,
    clientTurnId: String,
    inputMode:    { type: String, enum: ['speech','text'], default: 'speech' },
  }],

  consent: {
    recordAudio: Boolean,
    recordVideo: Boolean,
    storeTranscript: Boolean,
    processingDisclosureVersion: String,
    grantedAt: Date,
  },

  recordingChunks: [{ seq: Number, key: String, bytes: Number, uploadedAt: Date }],

  clientEvents: [{ type: String, atMs: Number, verified: { type: Boolean, default: false } }],

  startedAt: Date,
  lastActivityAt: { type: Date, index: true },
  activeMs: { type: Number, default: 0 },   // interview time, excluding disconnected gaps
  completedAt: Date,
  interviewId: { type: ObjectId, ref: 'Interview' },
}, { timestamps: true });
```

### 8.2 Indexes (required, not optional)

```js
// one active session per user — this is what makes the 409 in §7.1 reliable
interviewSessionSchema.index(
  { user: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['created','in_progress'] } } }
);

// turn uniqueness — the DB is the final arbiter for idempotency
interviewSessionSchema.index({ _id: 1, 'turns.seq': 1 }, { unique: true, sparse: true });

// sweeper for abandoned sessions
interviewSessionSchema.index({ lastActivityAt: 1 });

// carried over from Part 2 — these are missing today
interviewSchema.index({ user: 1, createdAt: -1 });
resumeSchema.index({ user: 1, createdAt: -1 });
```

> **Note on the partial unique index:** it enforces "at most one non-terminal session per user" at the database level, which is stronger than an application check and survives concurrent requests. Verify behaviour on your MongoDB version before relying on it, and keep the application-level check as well.

### 8.3 Snapshot, don't reference

`resumeAnalysisSnapshot` copies the analysis into the session at creation. If the candidate uploads a new resume in another tab mid-interview, the questions must not silently start referring to a different document. Freeze the inputs.

---

## 9. Client state machine

```
                    ┌─────────┐
                    │ loading │  GET /state
                    └────┬────┘
                         │
            ┌────────────┴────────────┐
            │                         │
     status=created/in_progress   completed/abandoned
            │                         │
            ▼                         ▼
       ┌─────────┐              redirect out
       │  ready  │  question rendered, "Begin"/"Continue" shown
       └────┬────┘
            │ user gesture
            ▼
      ┌──────────┐   utterance.onend / skip
      │ speaking │──────────────┐
      └────┬─────┘              │
           │ user clicks skip   ▼
           │              ┌───────────┐
           └─────────────►│ listening │◄──── retry succeeds
                          └─────┬─────┘
                                │ submit
                                ▼
                         ┌────────────┐  409 → back to loading (re-sync)
                         │ submitting │  network fail → stay, retry
                         └─────┬──────┘
                               │ 200
                    ┌──────────┴──────────┐
                 done=false            done=true
                    │                     │
                    ▼                     ▼
                 speaking            ┌───────────┐
                                     │ finishing │ poll evaluation
                                     └─────┬─────┘
                                           ▼
                                     ┌───────────┐
                                     │ completed │ → report
                                     └───────────┘
```

**Every transition sets exactly one state object.** No parallel refs to drift.

---

## 10. Integrity, honestly

This section implements Part 2 §4 and §6.4. The guiding rule: **client signals are hints for a human, never verdicts.**

### 10.1 Removals (do these first — they are deletions)

| Remove | Why | Ref |
|---|---|---|
| **Auto-termination on 2 tab-switches** | An OS notification or second monitor destroys a legitimate interview | Part 2 §4.3 |
| **Auto-termination entirely (3 face / 5 voice)** | Trivially bypassed by real cheaters; only catches the honest | Part 2 §4.3 |
| **"Background Human Voice" signal** | Flags the candidate for *interrupting the AI* — normal conversation | Part 2 §4.4 |
| **FaceDetector monitor + its UI claim** | Never ran (D1); the signal it would produce is measurably biased | Part 2 §4.2b |
| **Copy/paste blocking inside the Monaco editor** | Breaks legitimate coding; bypassable anyway | Part 2 §4.5 |

**On D1 specifically: remove the claim, do not fix the closure.** Published measurement shows "missing from frame" firing ~4.79×/assessment for darker-skinned candidates vs 0.83× with *no* difference in actual behaviour. Repairing the bug while auto-termination still exists would switch on a discriminatory outcome that the bug has been accidentally suppressing.

### 10.2 What to keep, downgraded

Keep collecting `tab_blur`, `visibility_hidden`, `fullscreen_exit`, and `paste_burst` — but:
- POST them to `/events` as **timestamped hints** with `verified: false`
- **Never** act on them client-side
- Surface them on the report as a neutral timeline, worded factually ("Switched away from the tab at 04:12"), not accusingly

### 10.3 What the candidate is told

A short, plain panel on the pre-flight screen, always visible — not buried in a modal:

```
During this practice interview we record:
  • Your microphone audio                      [ ✓ required ]
  • Your camera video                          [ ○ optional ]
  • A transcript of your answers               [ ✓ required ]
  • When you switch away from this tab         [ ✓ ]

We do NOT: score your face, your appearance, or your emotions.
Nothing here automatically rejects you.
Your answers are processed by <named providers> to generate feedback.
You can delete this interview and its recording at any time.
```

Naming the processors is a DPDP consent requirement (Part 2 §5.2), and "we do not score your face" is worth stating explicitly given §10.1.

### 10.4 Itemised consent

Replace the single `recordingConsent` boolean with independent toggles, each stored with a timestamp and a disclosure version. Bundling consents is invalid under DPDP §6(1) to the extent of the overreach, and §6(10) puts the burden of proving valid consent on you — so the record must be per-purpose and immutable.

**Video must default to off.** It costs 4× more to record (Part 2 §8), adds biometric exposure, and adds nothing to a voice interview's evaluation.

---

## 11. Ending the interview

### 11.1 Three ways an interview ends

| Path | Trigger | Result |
|---|---|---|
| **Natural** | `turnsAnswered === plannedTurns` | `completed`, evaluation queued |
| **Early exit** | Candidate clicks "End Interview" | `completed` with a partial transcript, scored with a visible caveat |
| **Abandoned** | No activity > 24 h | `abandoned`; candidate may score what exists or discard |

**Auto-termination for integrity is deliberately absent.** See §10.1.

### 11.2 Early exit must be graceful

Today "End Interview" calls `onCancel` and simply unmounts — the work is discarded. Instead:

```
┌──────────────────────────────────────────────────┐
│  End this interview?                              │
│                                                   │
│  You've answered 6 of 10 questions.               │
│  We can still score what you've completed.        │
│                                                   │
│  [ Keep going ]  [ End & score 6 answers ]        │
│                  [ Discard this interview ]       │
└──────────────────────────────────────────────────┘
```

A partial interview is still useful feedback. Discarding six answers because the candidate ran out of time is a poor default.

### 11.3 Evaluation as a job

`POST /complete` currently makes a long LLM call inline. On a slow evaluation the client times out, the user retries, and you pay twice.

```
POST /complete
  → set status='completed'
  → enqueue { sessionId, transcriptHash } with jobId = `eval:${sessionId}:${transcriptHash}`
  → return 202 immediately

Worker
  → generate report → write Interview doc → set evaluationStatus='ready'

Client
  → poll GET /evaluation (2 s) or subscribe by SSE
  → on ready → router.replace(`/mock-interview/report/${interviewId}`)
```

**The deterministic `jobId` is the idempotency guarantee** — a queue that refuses a duplicate id collapses double-submits, user retries, and at-least-once redelivery into a single paid evaluation.

Scoring calls must use **temperature 0** (Part 2 §6.5).

### 11.4 The finishing screen

Never a bare spinner for a multi-second LLM call:

```
        Analysing your interview…

    ✓ Transcript processed
    ✓ Answers evaluated
    ⟳ Generating your feedback report
    ○ Finalising

        This usually takes 20–40 seconds.
```

If the job fails: show the error, keep the transcript safe, and offer **Retry** — never dead-end a completed interview.

---

## 12. Forward compatibility with Phase 2

Nothing above should need rewriting when the LiveKit agent lands. The seams that make that true:

| Built now | Phase 2 swap |
|---|---|
| `GET /state`, `POST /turn` | Agent drives turns; endpoints remain for resume + history |
| Server owns questions | Unchanged — the agent calls the same generator |
| Server owns `plannedTurns` | Unchanged |
| Session record with `seq` | Unchanged; add `roomName`, `egressId` |
| Chunked recording upload | Replaced by SFU egress; the manifest shape stays |
| Client STT/TTS behind a small adapter | Adapter swapped for server-side streaming |
| Itemised consent | Unchanged |
| Client events as unverified hints | Joined by server-derived Tier-2 signals |

**Design instruction:** put all browser speech access behind a single module — `lib/speech.ts` exposing `speak()`, `startListening()`, `stopListening()` — and let nothing else in the codebase touch `SpeechSynthesis` or `SpeechRecognition`. In Phase 1 that module wraps the Web Speech API; later it wraps a WebSocket to server-side STT/TTS. One file changes instead of the whole component.

**Keep D12 in view.** Browser TTS output cannot be captured into a `MediaStream` — the W3C request for it is still open with no implementation path — so recordings made in Phase 1 will contain the candidate only, with silent gaps where questions were. **Until server-side TTS lands, do not present recordings as a complete record of the interview.** Label them "your answers" in the UI, and fix the substance in Phase 1 rather than papering over it.

---

## Appendix A — files touched

| File | Change |
|---|---|
| `frontend/src/app/interview/[sessionId]/page.tsx` | **new** — interview route |
| `frontend/src/app/interview/[sessionId]/layout.tsx` | **new** — chrome-less layout |
| `frontend/src/app/mock-interview/page.tsx` | setup only; creates session, then navigates |
| `frontend/src/components/ui/InterviewRoom.tsx` | rewritten around the reducer; split into hooks |
| `frontend/src/lib/speech.ts` | **new** — the only place touching Web Speech |
| `frontend/src/lib/sessionStore.ts` | **new** — IndexedDB drafts + chunks |
| `frontend/src/components/ui/InterviewReport.tsx` | fix hardcoded `localhost:5000` (D9) |
| `backend/src/models/InterviewSession.js` | **new** |
| `backend/src/controllers/interview/session.controller.js` | **new** |
| `backend/src/routes/interview.routes.js` | mount session routes |
| `backend/src/services/gemini/interview.service.js` | temperature 0 for scoring; plan moves server-side |
| `backend/src/services/search/research.service.js` | add the missing `callGroqWithRotation` import |
| `backend/src/app.js` | remove unauthenticated `/uploads` static route |

## Appendix B — decisions and their rationale

| Decision | Rationale |
|---|---|
| Dedicated route, not `window.open` | Popup blockers, mobile, and resume needs a URL (§3.1) |
| Fullscreen is optional and advisory | Cannot be forced; user can always Esc (verified) |
| Server assigns `seq` | Client-side counters are editable |
| Question persisted before returning | Makes generation idempotent under lost responses |
| Text input always available | ADA screen-out; also covers Firefox/Opera |
| No auto-termination | Harsh on the honest, useless against the dishonest |
| Video consent defaults off | 4× cost, biometric exposure, no evaluative value |
| Evaluation in a queue | Avoids timeouts and double-billing |
| Snapshot resume analysis | The interview must not mutate under the candidate |
| IndexedDB is a buffer, not a source of truth | Only the server survives a device change |
