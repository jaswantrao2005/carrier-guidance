# Where the Project Stands — Plain English

*No technical jargon. If you want the technical version, see [checklist.md](checklist.md).*

**Last updated:** 4 September 2026

---

## The one-line summary

The app had some things that were quietly broken and a few that were unfair to
candidates. I've fixed the urgent ones. The biggest remaining job is making the
interview survive a page refresh.

---

## Where we are

```
  Done          ████████░░░░░░░░░░░░░░░░░░░░░░░░   about 20%
  Remaining     the bigger features (see below)
```

Three chunks of work are finished and saved. Nothing is half-done or left in a
broken state — you can run the app right now.

---

# ✅ PART 1 — What's fixed and working

## 🛡️ Things that were unfair to candidates

**1. Interviews no longer get cancelled automatically**
Before: if you switched tabs twice, your interview was ended and permanently
marked *"Terminated for Integrity Violations."* A notification popping up, or
having a second monitor, was enough to trigger it.
Now: it just notes it and carries on. Nothing ends your interview but you.

**2. You're no longer flagged for interrupting the AI**
Before: if you started talking while the AI was still speaking, the system
recorded it as suspicious behaviour. Five of those and your interview ended.
Now: removed entirely. Talking over someone is normal conversation, not cheating.

**3. The report no longer accuses people**
Before: the results page said things like *"Terminated for Integrity Violations."*
Now: it says *"activity notes"* and states clearly these don't affect your score.

**4. Copy and paste works in the coding test again**
Before: candidates literally could not copy or paste inside the code editor —
during a *coding* interview.
Now: fixed. Still blocked on the rest of the page.

---

## 🔒 A serious privacy problem — closed

**5. Anyone on the internet could download people's resumes and interview videos**

This was the most serious thing I found. Files were stored in a way that meant
anyone who guessed a filename could download any candidate's CV or video — no
login needed.

Now: you have to be logged in *and* be the owner of that interview.

**6. Real people's CVs were sitting in the project's public code**

23 actual resumes — real names, phone numbers, email addresses — were uploaded
to GitHub with the code.

Now: removed going forward, and blocked from ever being added again.
⚠️ **See "Needs your decision" below — one step is still pending.**

---

## 🔧 Things that were broken and nobody noticed

**7. The "company research" feature never worked — not once**
It looked like it worked. It always showed *"research unavailable"* because of a
one-line mistake. Fixed — it now genuinely researches the company.

**8. The 11 Indian languages were only half connected**
Before: pick Hindi, and the AI would *listen* in Hindi but still *ask* every
question in an American accent.
Now: it asks in the language you picked. If your device doesn't have that voice
installed, it tells you honestly instead of silently switching to English.

**9. Interview recordings were broken everywhere except the developer's laptop**
Fixed — they now play properly wherever the app is hosted.

**10. Scores were slightly different every time**
Feeding the exact same interview in twice gave different scores. Now it's
consistent.

**11. The app was reading the whole database on every page load**
Made it fast. (Nobody would notice today; it would have become a problem.)

---

## 📹 The camera monitoring — rebuilt properly

This one needs explaining, because I removed a feature and then rebuilt it.

**What I found:** the "is the candidate still on camera" check had *never run
once*. A programming bug meant it silently did nothing from day one.

**Why I didn't just fix the bug:** there's published university research showing
this kind of check wrongly flags **darker-skinned candidates about 6× more often**
— and when researchers watched the actual videos, those people **hadn't done
anything wrong**. The camera just struggled to see them. So simply "fixing" it
would have switched on something that treats people unfairly.

**What I built instead** — a separate program that checks the recording *after*
the interview, on our server rather than on the candidate's laptop. Three
important differences:

| | Old approach | New approach |
|---|---|---|
| Where it runs | Candidate's browser (could be faked) | Our server (trustworthy) |
| What it does | Cancelled the interview automatically | Just flags moments for a person to look at |
| Bad lighting | Blamed the candidate | Says *"the video quality is poor"* and reports nothing |

That last row is the important one. **It can tell the difference between "this
person left the room" and "our camera couldn't see this person properly."** If
it's the second, it stays quiet and blames the video, not the person.

It also **never identifies anyone** — it only counts how many faces are visible.
No facial recognition.

*Tested with 17 automated tests. Runs about 20× faster than real time — a
45-minute interview is checked in about two minutes.*

---

# 📋 PART 2 — What's still to do

Ordered by what I'd do next. Times assume one person working on it.

---

## 🔴 Needs your decision first — not a technical task

### Clean the old CVs out of the project's history
**About half a day**

I stopped new files being added, but the 23 real CVs are still in the project's
saved history on GitHub. Removing them properly rewrites that history, which
affects anyone else who has a copy of the code.

**I need you to tell me:** who else has a copy, and is it OK to do this?
Until then, those people's CVs are still downloadable from GitHub.

---

## 🟠 The big one — the feature you asked about

### If you refresh the page, you lose everything
**About 1.5–2 weeks**

Right now, the entire interview lives inside the browser tab. Refresh, crash,
laptop dies, phone call — the whole interview is gone. There's no way back in.

**What it will do afterwards:** you reopen the page and it says *"Welcome back —
you're on question 5 of 10"*, with your half-finished answer still there. It'll
work even if you switch to a different laptop.

This is three pieces of work that need to ship together:
- Move the interview's memory from the browser onto the server
- Give the interview its own web page address, so you can return to it
- Save your answers as you go, and offer to restore them

**Related things this also fixes:**
- The interview will keep your screen from going to sleep while you think
- It'll warn you before you accidentally close the tab
- The number of questions will be decided by the server, so it can't be tampered with

---

## 🟡 Fairness and legal — small effort, big protection

### Let people type their answers instead of speaking
**About half a day**

Right now the interview is speech-only. That shuts out anyone who is deaf or
hard of hearing, anyone with a stammer or speech difference, and anyone whose
browser doesn't support it (Firefox users currently can't take an interview at
all).

This is also a legal requirement in several countries — you can't have a hiring
tool that measures someone's disability instead of their ability.

### Tell people clearly what's being recorded
**About half a day**

The consent screen currently says the camera is used "to simulate a realistic
interview experience." It doesn't mention that the voice recording is sent to
Google, or that answers are sent to another AI company for scoring.

Indian data protection law requires naming these. It also requires asking
separately for each thing rather than one all-or-nothing checkbox.

### Let people delete their interview and recording
**About half a day**

There's currently no way to do this, and no limit on how long recordings are
kept. Both are legal requirements.

### Stop scoring "confidence"
**About an hour**

The AI currently gives a "confidence" score based on reading a text transcript —
which contains no tone of voice, so it's essentially guesswork dressed up as a
number. It's also **banned in the EU** as of February 2025 for hiring tools.

---

## 🟡 Cost protection — do before anyone else can use it

### Limit how many interviews one person can start
**About half a day**

Each interview costs roughly **₹90–₹120** in AI fees. There is currently **no
limit at all**. One person with a script and free signups could run up a very
large bill overnight.

### Stop a slow AI response from breaking the results page
**About half a day**

At the end of an interview, the app waits for the AI to write the whole report
while you stare at a spinner. If it takes too long, it fails — and if you retry,
you get charged twice.

Fix: show a progress screen and generate the report in the background.

---

## 🟢 Making the scores trustworthy

### Rewrite how scoring works
**About 3 days**

The current 0–100 score looks more precise than it really is. Research on AI
scoring shows a few problems:
- AI scorers cluster on round numbers — 70, 75, 80 — so 100 possible scores is
  false precision
- Longer answers score higher regardless of quality
- One AI scoring alone can't be checked for consistency

**Changes:** a 1–5 scale with a written description of what each level means;
the AI must quote your actual answer as evidence before scoring it; score each
skill separately; and use several AI models and take the middle score.

### Check how much the scores wobble
**About half a day**

Score the same interview 20 times and see how much the number moves. If it
swings between 71 and 79, then telling someone they got 74 rather than 77 is
meaningless — and we shouldn't show it that precisely.

### Compare against real human scoring
**About a week**

Have people score ~50 real interviews, and check whether the AI agrees with them.
Without this, there's no evidence the scores mean anything.

---

## 🟢 The coding test

### It doesn't actually test the code
**About 2 days**

Right now, "Submission Accepted ✅" only means **the code didn't crash.** It
doesn't check whether the answer is *correct* — there are no test cases at all.
Worse, that fake "passed" is then handed to the AI as if it were a real result.

### Connect the camera checker to the app
**About half a day**

The camera-checking program is built and tested but not yet plugged in. It needs
to run automatically after each interview and show its findings on the report.

---

## 🔵 The long-term rebuild

### Move the voice handling onto the server
**About 2–3 weeks**

Currently the browser does the listening and speaking. This causes several
problems at once:
- Firefox and Opera users can't take an interview at all
- Voice is sent to Google without telling the candidate
- **Recordings are missing the interviewer's voice entirely** — you hear the
  candidate answering questions that are silent gaps

That last one can't be fixed any other way. It's a hard limit of how browsers
work. For now the report honestly labels recordings as *"your answers only."*

### A proper live conversation
**About 1–2 months**

Today the interview is walkie-talkie style: the AI talks, you talk, you press
*Submit*. A real conversation would let you interrupt, and the AI would know when
you'd finished speaking without you clicking anything.

This is where the product could genuinely beat what's already out there — none
of the well-known interview practice tools do this properly today.

---

# 📊 Quick summary

| | Item | Time |
|---|---|---|
| 🔴 | Clean old CVs from history — **needs your answer** | half a day |
| 🟠 | **Survive page refresh** (the big one) | 1.5–2 weeks |
| 🟡 | Typed answers, clear consent, delete option, drop "confidence" | ~2 days total |
| 🟡 | Spending limit + background report generation | ~1 day total |
| 🟢 | Trustworthy scoring + checking it | ~1 week |
| 🟢 | Coding test actually tests code + connect camera checker | ~2.5 days |
| 🔵 | Server-side voice, then live conversation | 1.5–2 months |

---

# 🎯 If you only do three things

1. **Answer the CV question** (half a day) — real people's personal details are
   still public.
2. **Add typed answers and honest consent wording** (1 day) — smallest effort,
   biggest legal protection.
3. **Make interviews survive a refresh** (2 weeks) — the thing users will notice
   and appreciate most.

---

# ❓ Answers to things you might wonder

**Is the app usable right now?**
Yes. Everything finished is tested and working. Nothing is half-built.

**Did removing the auto-cancelling make it easier to cheat?**
No — it never stopped anyone determined. It ran in the candidate's browser, which
they control, so it could be switched off. It only ever caught honest people who
switched tabs by accident.

**Why rebuild the camera check instead of just fixing it?**
Fixing the bug alone would have switched on something that flags darker-skinned
candidates far more often for reasons that aren't their fault. The rebuilt version
can tell the difference between "they left" and "we couldn't see them."

**How much does this cost to run?**
About **₹90–₹120 per 30-minute interview** in AI fees. At 1,000 interviews a month
that's roughly ₹1.2 lakh. Video recording is the single biggest part — making it
audio-only cuts it by about a third.

**Can it be launched publicly as-is?**
Not yet. The spending limit and the consent wording should be done first —
without a spending limit, one bad actor could run up a serious bill.
