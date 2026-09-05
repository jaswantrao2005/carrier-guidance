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

⚠️ **Gotchas, verified from the MongoDB manual:**

- **`$ne` is not an allowed operator** in `partialFilterExpression`. Allowed:
  equality/`$eq`, `$exists: true`, `$gt/$gte/$lt/$lte`, `$type`, `$and`, `$or`,
  `$in`, `$geoWithin`, `$geoIntersects`. So you cannot say *"status is not
  completed"* — you must enumerate the live states positively, which is why the
  index above uses `$in`. **Design the status enum around this.**
- **Cannot combine with `sparse: true`** — index creation fails.
- **The planner only uses the index when the query repeats the filter.**
  `find({user})` will not use it; `find({user, status: 'in_progress'})` will.
  Easy to add the constraint and accidentally regress a query.
- **Set `autoIndex: false` in production** and create indexes from a migration
  step, or every process start races to build them. Avoid `syncIndexes()` on a
  shared database — it *drops* indexes not in the schema.
- **Creating the index fails if duplicates already exist.** Clean up first.

⚠️ **The atomicity gap worth knowing about.** Completing one session and starting
another is two writes, with a window where a concurrent request sees zero active
sessions and creates a second. Handle it with catch-and-refetch — MongoDB's
documented behaviour is that the loser of a concurrent upsert race gets a
duplicate-key error, and the correct response is to re-read the winner:

```js
try {
  return await Session.findOneAndUpdate(
    { user: userId, status: { $in: ['created', 'in_progress'] } },
    { $setOnInsert: { user: userId, status: 'created', startedAt: new Date() } },
    { upsert: true, returnDocument: 'after' }
  );
} catch (err) {
  if (err.code === 11000) return Session.findOne({ user: userId, status: { $in: ['created','in_progress'] } });
  throw err;
}
```

**Detecting duplicate-key errors reliably** (used in several places below):

```js
const isDuplicateKey = (err) =>
  err && (err.code === 11000 || err.code === 11001 ||
          err.writeErrors?.some(e => e.code === 11000 || e.err?.code === 11000));
```

Match on **`err.code`, never `err.name`** (it is `MongoBulkWriteError` for
`insertMany`) and **never regex `errmsg`** — the message format has changed
across server versions. `keyPattern`/`keyValue` are the stable contract, but
guard them with `??` since some driver/server combinations omit `keyPattern`.

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

**⚠️ The obvious approach does not work.** A unique index on the embedded array —
`{ _id: 1, 'turns.clientTurnId': 1 }` — enforces **nothing**. MongoDB's docs are
explicit:

> *"In a unique multikey index, a document may have array elements that result in
> repeating index key values **as long as the index key values for that document
> do not duplicate those of another document**."*

Uniqueness on a multikey index is enforced **across documents, not within one
document's array**. Since `_id` is unique per document, that index is trivially
satisfied and will happily let you push the same `clientTurnId` twice. I had this
wrong in an earlier draft; verified against the MongoDB manual.

**Use a conditional `$push` instead — the guard goes in the query predicate:**

```js
const doc = await Session.findOneAndUpdate(
  {
    _id: sessionId,
    status: 'in_progress',
    currentSeq: seq,                                    // CAS: no double-advance
    'turns.clientTurnId': { $ne: clientTurnId },        // the real idempotency guard
  },
  { $push: { turns: turnDoc },
    $inc:  { currentSeq: 1 },
    $set:  { lastActivityAt: new Date() } },
  { returnDocument: 'after', runValidators: true }
);

if (!doc) {
  // Either a retry we already recorded, or the seq moved on. Both mean:
  // return CURRENT STATE, not an error -- a client that lost the original
  // response gets everything it needs and its retry loop terminates.
  return res.json(await buildState(sessionId));
}
```

This is atomic: filter and update are one `findAndModify` on the server, so two
concurrent identical requests cannot both match. Add a **non-unique** supporting
index `{ _id: 1, 'turns.clientTurnId': 1 }` for the predicate's benefit only.

Two Mongoose defaults that bite here:
- **`findOneAndUpdate` returns the document from *before* the update** unless you
  pass `returnDocument: 'after'`
- **`runValidators` defaults to `false`** on all update operations

> **If `turns` outgrows the document:** a long interview with full transcripts
> will eventually approach MongoDB's 16 MB document limit. At that point move
> turns to their own collection, where a genuine
> `{ sessionId: 1, clientTurnId: 1 }` unique index *does* work. Not needed now,
> but design the accessor functions so this swap is local.

> **Terminology, stated precisely:** you cannot get exactly-once *delivery* over
> an unreliable network. This gives at-least-once delivery with an
> **exactly-once effect** — the client retries until answered, the server
> collapses duplicates so state changes once.

**Size: M** · 🔬 POST the same turn twice → second is a no-op, LLM count unchanged.

---

### Task 3.4 — `POST /session/:id/complete` + `GET /session/:id/evaluation`

`complete` marks the session and creates the `Interview` record. For now it may
stay synchronous; the queue is a separate task in [checklist.md](checklist.md)
Stage 5.

**Poll this endpoint; do not add SSE yet.** If you later stream progress instead,
three things will bite:

- **`compression()` middleware buffers the stream** and must be disabled for the
  route, or events accumulate until the buffer flushes.
- **nginx buffers by default** — send `X-Accel-Buffering: no`, and note nginx
  proxies upstream over HTTP/1.0 unless you set `proxy_http_version 1.1` plus
  `proxy_set_header Connection ''`.
- **Browsers cap HTTP/1.1 at 6 connections per origin**, and a stream holds one
  for its whole life. Two tabs + two streams + uploads and the page hangs with no
  error. Fixed by HTTP/2 *and* by the §6.6 primary-tab pattern.

A 2-second poll avoids all three. **Size: S**

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

**New:** `frontend/src/lib/sessionStore.ts`, using **`idb@8`** (~1.2 kB).

```js
const db = await openDB('interview', 1, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('chunks', { keyPath: ['sessionId', 'seq'] });
      db.createObjectStore('drafts');   // key: `${sessionId}:${seq}`
      db.createObjectStore('outbox');   // key: clientTurnId
    }
  },
  blocked()  { notify('Close the other tab holding this interview.'); },
  blocking() { flushPending().finally(() => { db.close(); location.reload(); }); },
  terminated() { dbPromise = null; connect(); },   // storage evicted / killed
});
```

**Compound key `['sessionId','seq']` does three jobs at once:** array keys sort
element-by-element, so chunks come back **already ordered**; a prefix scan gets
one session's chunks; and using `add()` rather than `put()` makes a replayed
chunk throw `ConstraintError` instead of silently double-writing.

```js
// Prefix scan -- returns sorted by seq
const range = IDBKeyRange.bound([sessionId, -Infinity], [sessionId, Infinity]);
return db.getAll('chunks', range);
```

⚠️ **`IDBKeyRange` is one-dimensional.** `bound([a1,b1],[a2,b2])` is a single
lexicographic span, **not** "a in range AND b in range". That is exactly right
for a single-session prefix scan (a1 === a2) but returns garbage if you try to
range both components.

⚠️ **Never `await` anything non-IDB inside a transaction.** IDB auto-commits as
soon as the microtask queue drains, so an `await fetch(...)` mid-transaction
throws `TransactionInactiveError`. Do the fetch first, then open the transaction:

```js
const tx = db.transaction('chunks', 'readwrite');
await Promise.all([...records.map(r => tx.store.add(r)), tx.done]);
```

⚠️ **Two-tab upgrade deadlock.** If one tab holds v1 and another loads v2, the
new tab's `openDB` **hangs forever** unless the old tab's `blocking` handler calls
`db.close()`. There is no timeout. Hence the handler above. Better: avoid version
bumps during a live interview — IDB records are schemaless, so new optional
fields need no bump; reserve bumps for adding stores.

⚠️ **Argument order:** `db.put(store, value, key)` — value *before* key, the
reverse of most key-value APIs.

**On Blobs:** store `Blob` directly (structured clone handles it, and browsers
keep the payload out-of-line rather than in the record). But there are
long-standing WebKit bugs — blob-in-IDB fails outright in **iOS Private
Browsing**, and there are reports of writes that never settle. So: wrap blob
writes in a timeout race, and keep an `ArrayBuffer` + mime fallback
(`new Blob([buf], {type})` on read), which round-trips everywhere. Never store
`URL.createObjectURL()` strings — they die with the document.

**Size: S**

---

### Task 6.1a — Storage durability: ask, but don't depend on it

```js
if (!(await navigator.storage.persisted())) {   // non-prompting check first
  await navigator.storage.persist();            // may prompt on Firefox
}
```

**Do not treat `persist()` as a precondition — it usually returns `false`.**

| Browser | Behaviour |
|---|---|
| Chrome / Edge | **No prompt.** Auto-decides from engagement heuristics (bookmarked, installed, notification permission). A first-time visitor almost always gets `false`. |
| Firefox | **Prompts** the user. |
| Safari | No prompt; decides from interaction history. |

Call `persisted()` first so you don't fire a gratuitous Firefox dialog on every
load, and time the `persist()` call to the "Start interview" click — it improves
Chrome's odds and makes the Firefox prompt non-surprising.

**Quota is not the constraint you'd guess.** Chrome allows ~60% of disk; Firefox's
binding limit is a **10 GiB group limit per site**, not the headline 10%. The one
that matters for us: **Safari in an embedded WebView** — a candidate opening the
link from LinkedIn's or Gmail's in-app browser on iOS — gets **~15% instead of
60%**, *and a separate storage partition from real Safari*, so anything buffered
there is invisible if they later open the link properly. Worth detecting and
warning about.

**Handling quota exhaustion mid-write:**

```js
catch (err) {
  if (err.name === 'QuotaExceededError') { … }
}
```

- Match on **`err.name`**, not `err.code` (the legacy `22` is deprecated).
- **The whole transaction aborts, not just the failing write.** If you batched 20
  chunks and #17 blew the quota, all 20 roll back. So keep one blob per
  transaction, and put metadata writes in a separate transaction from blob writes.
- Recovery order: drop uploaded chunks of *other* sessions → drop server-acked
  chunks of this one → **stop recording media but keep the answer text** (it's
  tiny and it's what the score is built from) → tell the candidate.

**There is no eviction event.** Nothing fires, and eviction is all-or-nothing per
origin, so you cannot leave a breadcrumb in one store to detect loss in another.
Detect it the way that suits us anyway: **the server knows the highest `seq` it
acked**, so on reconnect the client reports its local max — `local < server` means
local data was lost. That's strictly better than any client-side trick here.

Note Safari's **7-day eviction** for origins with no user interaction: irrelevant
mid-session, fatal for "resume your interview next week." Another reason the
server is the record.

**Size: XS**

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

**Use the Web Locks API, not BroadcastChannel, for the exclusion.** BroadcastChannel
has no atomicity — messages are asynchronous with no ordering guarantee relative
to your own state mutations, so two tabs can both check-then-act in the gap. It's
for *notification*, never exclusion.

Web Locks is Baseline since March 2022 (all four engines) and has the one property
that matters: **the lock is released automatically when the tab closes or
crashes.** No heartbeat, no stale-lock TTL, no cleanup code — unlike a
localStorage-based election, which always needs both.

**Primary-tab election** — acquire and never release:

```js
navigator.locks.request(`interview-primary:${sessionId}`, () => {
  becomePrimary();                 // owns the uploader
  return new Promise(() => {});    // held until this tab dies
});
```

When the primary closes, the browser releases the lock and the next queued tab's
callback fires. Automatic failover, zero code.

**Non-blocking check** for a second tab that should warn rather than queue:

```js
const gotIt = await navigator.locks.request(
  `interview-primary:${sessionId}`, { ifAvailable: true }, lock => lock !== null);
if (!gotIt) showAlreadyOpenInAnotherTab();
```

**Around the submit itself**, with the re-check *inside* the lock — checking
before acquiring is a TOCTOU bug:

```js
await navigator.locks.request(`interview-submit:${sessionId}`, async () => {
  if (turn.seq <= await getLocalAckedSeq(sessionId)) return { skipped: true };
  ...
});
```

Do **not** use `steal: true` — it silently breaks the exclusion the other tab is
relying on, and since crashed tabs release automatically there is no legitimate
stale-lock case.

**None of this is a security boundary.** Locks are per-origin-per-profile, so two
browsers, or normal + incognito, bypass them entirely. §3.3's server-side
idempotency is the actual guarantee; this layer is for the honest candidate with
two tabs open.

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
