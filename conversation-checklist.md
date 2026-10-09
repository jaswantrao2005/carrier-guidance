# Making the Interview an Actual Conversation

**Goal:** stop the interview being a fixed list of 10 questions read out in order, and make
it behave like a real interviewer — one who listens to your answer, digs into what you
just said, and runs for as long as you chose.

Four things change:

| # | Today | After |
|---|---|---|
| 1 | Always exactly 10 questions | Candidate picks: Quick / Standard / Full |
| 2 | Marches through a fixed script | Follows up on what you just said |
| 3 | Questions come from the resume | Questions come from **the conversation**, resume is only a starting point |
| 4 | Every question is a fresh topic | Threads connect — "you mentioned X earlier…" |

---

## The core idea: main questions vs follow-ups

A real interview is not N questions. It is a handful of **topics**, each opened by a main
question and then **probed** until the interviewer has what they need.

```
TOPIC: "Tell me about a project you're proud of"
  ├─ main question
  ├─ follow-up  "You said the team struggled — what was your part in that?"
  ├─ follow-up  "How did you know the approach was working?"
  └─ (topic exhausted → move on)

TOPIC: "How do you handle disagreement with a senior engineer?"
  ├─ main question
  └─ follow-up  "What if they still disagreed after that?"
```

That structure is what makes it feel human. It is also how professional interviewer
training describes it: ask the main question, then probe every missing piece until you
have a complete picture or conclude the candidate doesn't have one.

**The honest tension:** structured interviews are more accurate *because* everyone gets
the same questions. Unlimited improvisation destroys that. Published guidance warns that
**excessive probing can accidentally reveal the answer you're looking for**, which makes
the interview easier and the score meaningless.

**So: bounded probing.** Same main questions for a given role and type; at most 2–3
follow-ups per topic; follow-ups may ask the candidate to *expand on what they said*, but
never introduce new information or hint at the desired answer.

---

# STAGE A — Let the candidate choose the length

### A1 — Add a duration choice to the setup screen
- [ ] Three presets on `/mock-interview`, shown before starting:

| Preset | Time | Topics | Total questions incl. follow-ups |
|---|---|---|---|
| **Quick practice** | ~10 min | 3 | 5–8 |
| **Standard** (default) | ~25 min | 5 | 10–16 |
| **Full interview** | ~45 min | 8 | 16–26 |

- [ ] Show the estimate in plain words: *"About 25 minutes · roughly 5 topics"*
- [ ] Remember the last choice for next time
- **Why not a raw question count:** candidates think in *time available*, not question
  count — and with follow-ups the count is no longer fixed anyway.
- **File:** `frontend/src/app/mock-interview/page.tsx`
- **Size: S**

### A2 — Send the plan to the server
- [ ] Add `plannedTopics` and `maxQuestions` to the `next-question` request
- [ ] Delete the two hardcoded `updatedHistory.length >= 10` checks
- **File:** `InterviewRoom.tsx` lines 570, 644 · `interview.controller.js`
- **Size: XS**

### A3 — The server decides when it's over
- [ ] Server returns `done: true` when topics are covered OR `maxQuestions` is hit
- [ ] Client stops when told to, never on its own count
- **Why:** a browser-side counter can be edited. Also, with variable follow-ups the
  client genuinely cannot know how many questions remain.
- **Size: S**

### A4 — Show honest progress
- [ ] Replace *"Question 4 / 10 (Estimated)"* with *"Topic 2 of 5"* + elapsed time
- **Why:** the current number is a lie the moment follow-ups exist.
- **Size: XS**

---

# STAGE B — Make it follow up properly

### B1 — Track topics, not just a question count ⛔ the key change
- [ ] Build a **topic plan** server-side at the start of the interview:
  ```
  [ {id: 'intro',      goal: 'background and motivation'},
    {id: 'project',    goal: 'depth on a real project they owned'},
    {id: 'technical',  goal: 'core skills for this role'},
    {id: 'behavioural',goal: 'how they handle conflict/pressure'},
    {id: 'closing',    goal: 'questions for us, wrap up'} ]
  ```
- [ ] Track per topic: `questionsAsked`, `followUpsUsed`, `covered`
- [ ] The plan length comes from the candidate's duration choice (A1)
- **Why:** the model currently only knows "this is question 5". It needs to know
  *which topic we're in and what we still need from it*.
- **File:** `backend/src/services/gemini/interview.service.js`
- **Size: M**

### B2 — Decide follow-up vs move on, in code not vibes
- [ ] Before generating, classify the last answer:
  - **too short / vague** (< ~25 words, or "I don't know") → move on, don't punish
  - **used "we" throughout** → follow up: *"what was your specific part?"*
  - **claim with no outcome** → follow up: *"how did it turn out?"*
  - **substantial and complete** → move on
- [ ] Hard cap: **max 2 follow-ups per topic**
- [ ] Never follow up on a "no answer" — move to the next topic gently
- **Why the cap:** without it the model drills one topic forever. Real interviewers
  probe 1–2 times then move.
- **Why never probe a blank:** repeatedly asking someone to expand on something they
  clearly don't know is the single most demoralising thing a mock interview can do.
- **Size: M**

### B3 — Rewrite the question prompt around the conversation
- [ ] Current prompt buries `React to the candidate's last answer` as one line among
      stronger instructions, so the phase script wins and it marches on regardless
- [ ] New structure, in priority order:
  1. **The last answer, verbatim** — the most important input
  2. What we still need from the current topic
  3. Whether this should be a follow-up or a new topic (from B2)
  4. Role / type / resume as *background*, not as the driver
- [ ] Require the follow-up to **quote or paraphrase** what the candidate said
- **Size: M**

### B4 — Rules that keep probing fair
- [ ] Follow-ups may only ask the candidate to **expand on what they already said**
- [ ] Follow-ups must **never introduce new facts or hint at the expected answer**
- [ ] Same main questions for the same role + type (so results stay comparable)
- **Why:** this is exactly what interviewer training warns about — over-probing leaks
  the answer and inflates the score.
- **Size: S**

---

# STAGE C — Make it feel like one conversation

### C1 — Reference earlier answers across topics
- [ ] Maintain a short running list of things the candidate mentioned:
      `["led a payments migration", "team of 4", "prefers backend work"]`
- [ ] Feed it in so later questions can callback:
      *"Earlier you mentioned leading the payments migration — how did you handle the
      rollback plan?"*
- [ ] Cap at ~8 items so the prompt stays small
- **Why:** this is the single thing that makes an interview feel like it's with a person
  who was listening.
- **Size: M**

### C2 — Stop repeating questions
- [ ] Pass the list of topics/questions already asked
- [ ] Explicit instruction: do not ask anything materially similar to these
- **Size: XS**

### C3 — Natural transitions between topics
- [ ] When moving on, open with a short bridge — *"That's helpful, thank you. I'd like to
      switch to something different…"*
- [ ] Not on follow-ups; those should flow straight on
- **Size: XS**

### C4 — Resume becomes background, not the script
- [ ] Today: questions 3–4 are *"ask about their resume"*
- [ ] After: the resume seeds the **topic plan** (which project to open with), then the
      conversation drives everything
- **Why:** you asked for this specifically. The resume should be *why* a topic is chosen,
  not the content of every question.
- **Size: S**

### C5 — Proper opening and closing
- [ ] First question always a real greeting + "tell me about yourself"
- [ ] Last question always *"do you have any questions for me?"* then a wrap-up
- **Why:** real interviews bookend this way; ending mid-technical-question feels abrupt.
- **Size: XS**

---

# STAGE D — Verify it actually works

### D1 — Follow-up quality check
- [ ] Run 5 interviews with deliberately vague answers → follow-ups must ask for
      specifics, not move on
- [ ] Run 5 with rich answers → must move on, not over-drill
- **Size: S**

### D2 — Length check
- [ ] Quick ≈ 5–8 questions, Standard ≈ 10–16, Full ≈ 16–26
- [ ] None runs forever; none stops after 3
- **Size: S**

### D3 — No-answer path
- [ ] Say "I don't know" 3 times → interview stays kind and keeps moving
- **Size: XS**

### D4 — Coherence check
- [ ] Read a full transcript — does it read like one conversation, or like a quiz?
- [ ] At least one genuine callback to an earlier answer
- **Size: S**

---

## Order of work

1. **A1–A4** — duration choice (half a day). Visible immediately.
2. **B1–B4** — follow-ups (1–1.5 days). The heart of it.
3. **C1–C5** — conversational feel (half a day).
4. **D** — verification (half a day).

**Total: ~3 days.**

---

## Deliberately NOT doing yet

- **Interrupting the AI mid-sentence** (barge-in) — needs server-side voice, weeks away
- **Knowing when you've stopped speaking** without clicking Submit — same
- **Adapting difficulty to performance** — worth doing, but only once follow-ups work

These stay on the main [checklist.md](checklist.md).
