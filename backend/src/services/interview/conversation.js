/**
 * Conversation engine for the mock interview.
 *
 * Replaces "ask 10 questions from a fixed script" with how a real interview
 * actually runs: a handful of TOPICS, each opened by a main question and then
 * PROBED with follow-ups until the interviewer has what they need.
 *
 *     TOPIC: a project you're proud of
 *       - main question
 *       - follow-up: "you said the team struggled -- what was your part?"
 *       - follow-up: "how did you know it was working?"
 *       -> topic covered, move on
 *
 * THE TENSION THIS CODE MANAGES
 * Structured interviews predict job performance roughly twice as well as
 * unstructured ones (.42 vs .19, Sackett et al. 2022) precisely BECAUSE
 * everyone gets the same questions. Unlimited improvisation throws that away.
 * Interviewer training also warns that excessive probing can accidentally
 * reveal the answer you are fishing for, which inflates the score.
 *
 * So: bounded probing.
 *   - Main questions are fixed per (role, interviewType) -> comparable results.
 *   - At most MAX_FOLLOW_UPS_PER_TOPIC follow-ups.
 *   - Follow-ups may only ask the candidate to expand on what they ALREADY said;
 *     never introduce new facts, never hint at the expected answer.
 *
 * Everything here is a pure function so it can be tested without calling an LLM.
 */

// One clarification per primary question keeps the conversation moving and
// prevents a vague or uncertain response from becoming repeated interrogation.
const MAX_FOLLOW_UPS_PER_TOPIC = 1;

/**
 * Candidate-facing duration presets: a question BUDGET with an estimated time,
 * not a hard clock. A timer that cuts someone off mid-answer is the worst
 * failure mode this feature could have.
 *
 * Numbers: the ~20-minute mark is where Micro1, Mercor and HireVue's on-demand
 * interviews all converge. OPM's structured-interview guide says a structured
 * interview "is typically used to assess between four and six competencies",
 * which is the 5-topic standard preset. Times are deliberately OVER-quoted --
 * HireVue's ~30M-applicant study found "better results come from overestimating
 * assessment length" -- and padded for the finding that an AI interviewer ran
 * ~38% longer than a human on the same question guide.
 */
const DURATION_PRESETS = {
  quick:    { label: "Quick practice",     minutes: 10, topics: 3, maxQuestions: 6 },
  standard: { label: "Standard interview", minutes: 25, topics: 5, maxQuestions: 12 },
  full:     { label: "Full interview",     minutes: 45, topics: 8, maxQuestions: 20 },
};
const DEFAULT_PRESET = "standard";

/**
 * Topic pools per interview type. The FIRST entry always opens the interview and
 * the LAST always closes it -- a real interview is bookended, and ending abruptly
 * mid-technical-question feels wrong.
 *
 * `goal` is what the interviewer is trying to learn. It is given to the model so
 * it can judge whether the topic is actually covered, instead of just counting.
 */
const TOPIC_POOLS = {
  "HR Interview": [
    { id: "intro", goal: "who they are, and why this role interests them" },
    { id: "motivation", goal: "what drives them and what they want next in their career" },
    { id: "strengths", goal: "a strength they can evidence, and a weakness they are working on" },
    { id: "teamwork", goal: "how they work with others and handle disagreement" },
    { id: "fit", goal: "what kind of environment they do their best work in" },
    { id: "closing", goal: "their questions, and a warm close" },
  ],
  "Technical Interview": [
    { id: "intro", goal: "their technical background and what they work with day to day" },
    { id: "project_depth", goal: "genuine depth on one system they built or owned" },
    { id: "fundamentals", goal: "core concepts for this role, and whether they understand the why" },
    { id: "tradeoffs", goal: "how they choose between options and justify a decision" },
    { id: "debugging", goal: "how they approach a problem they cannot immediately solve" },
    { id: "scale", goal: "how their thinking changes as load or complexity grows" },
    { id: "learning", goal: "how they pick up something unfamiliar" },
    { id: "closing", goal: "their questions, and a warm close" },
  ],
  "Behavioral Interview": [
    { id: "intro", goal: "background and a sense of how they describe their work" },
    { id: "ownership", goal: "a time they owned something end to end, with a real outcome" },
    { id: "conflict", goal: "how they handled disagreement with a colleague" },
    { id: "failure", goal: "something that went wrong and what they took from it" },
    { id: "pressure", goal: "how they behave under a deadline or competing priorities" },
    { id: "influence", goal: "a time they changed someone's mind without authority" },
    { id: "closing", goal: "their questions, and a warm close" },
  ],
  "Managerial Interview": [
    { id: "intro", goal: "their leadership background" },
    { id: "leading", goal: "how they get work done through other people" },
    { id: "difficult_conversation", goal: "how they handle underperformance or conflict" },
    { id: "prioritisation", goal: "how they choose what not to do" },
    { id: "growing_people", goal: "how they develop the people who report to them" },
    { id: "closing", goal: "their questions, and a warm close" },
  ],
  "Coding / Programming Interview": [
    { id: "problem_1", goal: "a working solution to a concrete coding problem" },
    { id: "complexity", goal: "whether they can reason about time and space cost" },
    { id: "edge_cases", goal: "whether they think about what breaks their solution" },
    { id: "problem_2", goal: "a second problem, harder, building on how they did" },
    { id: "closing", goal: "their questions, and a warm close" },
  ],
};

/** Everything else -- a realistic mixed interview. */
const DEFAULT_POOL = [
  { id: "intro", goal: "who they are and why this role" },
  { id: "experience", goal: "depth on their most relevant experience" },
  { id: "project_depth", goal: "genuine detail on something they personally built or owned" },
  { id: "role_skills", goal: "the core skills this specific role needs" },
  { id: "behavioural", goal: "how they work with others and handle difficulty" },
  { id: "problem_solving", goal: "how they approach an unfamiliar problem" },
  { id: "motivation", goal: "what they want next and why here" },
  { id: "closing", goal: "their questions, and a warm close" },
];

function getPreset(name) {
  return DURATION_PRESETS[name] || DURATION_PRESETS[DEFAULT_PRESET];
}

/**
 * Build the topic plan for one interview.
 *
 * Always keeps the opening and closing topics and samples the middle to fit the
 * requested length, so a 10-minute interview is a shorter real interview rather
 * than a truncated one that stops mid-flow.
 */
function buildTopicPlan(interviewType, durationPreset = DEFAULT_PRESET, resumeContext = null) {
  const pool = TOPIC_POOLS[interviewType] || DEFAULT_POOL;
  const { topics: wanted } = getPreset(durationPreset);

  let chosen;
  if (wanted >= pool.length) {
    chosen = [...pool];
  } else if (wanted <= 2) {
    chosen = [pool[0], pool[pool.length - 1]].slice(0, Math.max(1, wanted));
  } else {
    const first = pool[0];
    const last = pool[pool.length - 1];
    const middle = pool.slice(1, -1);
    const take = wanted - 2;
    // Even spread across the middle so we don't always pick the same few.
    const step = middle.length / take;
    const picked = [];
    for (let i = 0; i < take; i++) picked.push(middle[Math.floor(i * step)]);
    chosen = [first, ...picked, last];
  }

  // The resume decides WHICH project we dig into -- it does not become the
  // content of every question. (Previously questions 3-4 were just "ask about
  // the resume", which made the whole interview feel like a CV read-back.)
  const seed = resumeSeed(resumeContext);

  return chosen.map((t) => ({
    id: t.id,
    goal: t.goal,
    seed: t.id === "project_depth" || t.id === "experience" ? seed : null,
    questionsAsked: 0,
    followUpsUsed: 0,
    covered: false,
  }));
}

function resumeSeed(resumeContext) {
  if (!resumeContext) return null;
  const projects = Array.isArray(resumeContext.projects) ? resumeContext.projects : [];
  const skills = Array.isArray(resumeContext.technicalSkills) ? resumeContext.technicalSkills : [];
  if (!projects.length && !skills.length) return null;
  return {
    project: projects[0] || null,
    skills: skills.slice(0, 5),
  };
}

const NON_ANSWERS = [
  "i don't know", "i dont know", "i do not know", "no idea", "i have no idea", "not sure", "i'm not sure",
  "im not sure", "i am not sure", "i'm unsure", "i am unsure", "no answer", "[no verbal response",
  "can't answer", "cant answer", "i can't answer", "i cannot answer", "i have no experience", "no experience",
  "i haven't done", "i have not done", "i haven't worked", "i have not worked", "please skip", "let's skip",
  "can we skip", "could we skip", "i'd like to skip", "i would like to skip",
];

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Did the candidate say how it turned out?
 *
 * Verb stems rather than exact words, because "improve/improved/improvement" all
 * count. Numbers and percentages are strong outcome markers on their own -- and
 * note "%" cannot use a word boundary, which is the kind of detail that quietly
 * breaks a naive regex.
 */
function hasOutcome(lower) {
  const stems = /\b(result|outcome|impact|reduc|increas|improv|sav|ship|launch|grew|grow|drop|cut|boost|deliver|achiev|success|fail)/;
  const numbers = /\d+\s*(%|percent|x|times)|\bby \d+|\bfrom \d+.*\bto \d+/;
  return stems.test(lower) || numbers.test(lower);
}

/**
 * Is there anything concrete here -- a number, a named tool, a specific artefact?
 * An answer full of generalities ("I always try to communicate well and work
 * hard with the team") is the classic case where a real interviewer says
 * "can you give me an example?".
 */
function hasSpecifics(lower) {
  const numbers = /\d/;
  const concrete = /\b(for example|for instance|specifically|such as|one time|once|last (year|month|week)|we used|i used|called|named)\b/;
  const properNoun = /\b[a-z]+(js|sql|db|api)\b|\b(python|java|react|node|aws|docker|kubernetes|postgres|mongo|redis|kafka|git|linux|azure|gcp)\b/;
  return numbers.test(lower) || concrete.test(lower) || properNoun.test(lower);
}

function hasSubmittedCode(answer) {
  const value = String(answer || '');
  return /\b(?:const|let|var)\s+\w+\s*=|\bfunction\s*(?:\w+\s*)?\(|\bdef\s+\w+\s*\(|\bclass\s+\w+\s*[{(:]|\bpublic\s+static\b|\b(?:console\.log|print)\s*\(|\w+\.reduce\s*\(|#include|=>/.test(value)
    || /submitted code(?:\s*\([\w+#.-]+\))?\s*:\s*[\s\S]{10}/i.test(value);
}

/**
 * Classify the candidate's last answer to decide what to do next.
 *
 * Returns one of:
 *   no_answer  -> move on gently. NEVER probe a blank; repeatedly asking someone
 *                 to expand on something they plainly don't know is the most
 *                 demoralising thing a practice interview can do.
 *   thin       -> move on. A short answer is usually "I have nothing here",
 *                 not "I'm hiding something".
 *   vague_we   -> probe for their personal contribution ("we" throughout).
 *   no_outcome -> probe for the result (classic incomplete STAR: situation and
 *                 action, no result).
 *   complete   -> move on.
 */
function classifyAnswer(answer) {
  const text = String(answer || "").trim();
  const lower = text.toLowerCase().replace(/[’‘]/g, "'");
  const words = wordCount(text);

  if (!text || /^(?:pass|skip)(?:\s+(?:this|it|please|question))*[.!?\s]*$/.test(lower)
    || NON_ANSWERS.some(p => lower === p || lower.startsWith(`${p} `) || lower.startsWith(`${p}.`) || lower.startsWith(`${p},`))) {
    return { kind: "no_answer", words };
  }

  if (words < 25) {
    const action = /\b(built|implemented|designed|developed|debugged|migrated|optimized|optimised|wrote|led|created)\b/.test(lower);
    const concrete = /\b(dashboard|service|api|pipeline|application|app|cache|database|deployment|migration|project|system|checkout|authentication|pagination)\b/.test(lower)
      || hasSpecifics(lower);
    if (words >= 8 && action && concrete) return { kind: hasOutcome(lower) ? "complete" : "needs_detail", words };
    return { kind: "thin", words };
  }

  const we = (lower.match(/\b(we|our|us)\b/g) || []).length;
  const i = (lower.match(/\b(i|my|me|myself)\b/g) || []).length;
  if (we >= 3 && we > i * 2) return { kind: "vague_we", words };

  if (words >= 35 && !hasOutcome(lower)) return { kind: "no_outcome", words };

  // A medium-length answer with no concrete detail -- no numbers, no named
  // tools, no specifics. Worth one "can you give me an example?".
  //
  // This case exists because the measured failure mode of AI interviewers is
  // UNDER-probing, not over-drilling: in one study 88% of the violations of
  // "ask a follow-up when an answer is unclear" were the AI's. Without this
  // branch we would only ever probe two narrow patterns and otherwise march on.
  if (words >= 25 && words < 60 && !hasSpecifics(lower)) {
    return { kind: "unclear", words };
  }

  return { kind: "complete", words };
}

/**
 * Decide the next move: follow up on the current topic, or open the next one.
 *
 * This is deliberately CODE, not left to the model. Asked to "follow up when
 * appropriate", an LLM will either drill one topic forever or ignore the
 * instruction entirely -- which is exactly what the old prompt did.
 */
function decideNextMove(plan, history, maxQuestions) {
  const asked = history.length;
  if (asked >= maxQuestions) return { action: "finish", reason: "max_questions" };

  let idx = plan.findIndex((t) => !t.covered);
  if (idx === -1) return { action: "finish", reason: "all_topics_covered" };

  // Always leave room to close properly. If we are one question from the cap and
  // haven't reached the closing topic, jump to it -- an interview that stops
  // mid-technical-question because it ran out of budget feels broken, and a real
  // interview is always bookended.
  const lastIdx = plan.length - 1;
  if (idx < lastIdx && maxQuestions - asked <= 1 && !plan[lastIdx].covered) {
    idx = lastIdx;
  }

  const topic = plan[idx];
  const isLast = idx === plan.length - 1;

  // Opening a topic for the first time.
  if (topic.questionsAsked === 0) {
    return { action: "new_topic", topic, topicIndex: idx, isLast };
  }

  const last = history[history.length - 1];
  const cls = classifyAnswer(last && last.answer);

  const codeSubmitted = ['problem_1', 'problem_2'].includes(topic.id) && cls.kind !== 'no_answer' && hasSubmittedCode(last?.answer);
  const canProbe =
    !['intro', 'closing'].includes(topic.id) && topic.followUpsUsed < MAX_FOLLOW_UPS_PER_TOPIC &&
    (codeSubmitted || ['vague_we', 'no_outcome', 'unclear', 'needs_detail'].includes(cls.kind));

  // Reserve enough questions to still open every remaining topic.
  const topicsLeft = plan.length - idx - 1;
  const roomToProbe = maxQuestions - asked > topicsLeft;

  if (canProbe && roomToProbe) {
    const conceptual = ['fundamentals', 'role_skills', 'complexity', 'edge_cases'].includes(topic.id);
    const probe = codeSubmitted || (conceptual && cls.kind === 'no_outcome') ? 'reasoning' : cls.kind;
    return { action: "follow_up", topic, topicIndex: idx, isLast, probe };
  }

  // Done with this topic. Close it AND open the next one in a single move --
  // otherwise "advance" would consume a turn without producing a question, and
  // every topic would be visited twice.
  const nextIdx = plan.findIndex((t, i) => i > idx && !t.covered);
  if (nextIdx === -1) return { action: "finish", reason: "all_topics_covered", closeTopicIndex: idx };

  return {
    action: "new_topic",
    topic: plan[nextIdx],
    topicIndex: nextIdx,
    isLast: nextIdx === plan.length - 1,
    closeTopicIndex: idx,          // mark the topic we just left as covered
    previousReason: cls.kind,
  };
}

/** Apply a decision to the plan (returns a new plan; never mutates). */
function applyMove(plan, move) {
  return plan.map((t, i) => {
    // A move can close the topic we're leaving and open the next one at once.
    if (i === move.closeTopicIndex && i !== move.topicIndex) {
      return { ...t, covered: true };
    }
    if (i !== move.topicIndex) return t;
    if (move.action === "new_topic") return { ...t, questionsAsked: t.questionsAsked + 1 };
    if (move.action === "follow_up") {
      return { ...t, questionsAsked: t.questionsAsked + 1, followUpsUsed: t.followUpsUsed + 1 };
    }
    return { ...t, covered: true };
  });
}

/**
 * Short running memory of concrete things the candidate mentioned, so later
 * questions can call back to them ("earlier you mentioned the payments
 * migration..."). This is the single biggest contributor to an interview
 * feeling like it is with someone who was actually listening.
 *
 * Kept small on purpose -- this goes into every prompt.
 */
function extractMentions(history, limit = 8) {
  const out = [];
  for (const turn of history) {
    const a = String(turn.answer || "").trim();
    // 8 words is about the shortest spoken sentence carrying a real claim
    // ("I led the payments migration last year"). Anything shorter is filler
    // like "Yes" or "Not really" and is useless as a callback.
    if (!a || wordCount(a) < 8) continue;
    // First clause is usually the claim itself; enough to reference later.
    const clause = a.split(/[.!?\n]/)[0].trim();
    if (clause.length > 20) out.push(clause.slice(0, 120));
  }
  return out.slice(-limit);
}

// Presentation is server-owned and saved with the actual question. It is never
// generated from model memory, and is not part of the question evaluated later.
function questionPresentation(history, question) {
  if (!history.length) {
    return { introduction: "Hi, I'm Alex, your AI practice interviewer. Welcome. Take your time, and feel free to skip if you get stuck. Let's get started.",
      acknowledgement: '', turnKind: 'opening' };
  }
  const previous = history[history.length - 1];
  const kind = classifyAnswer(previous.answer).kind;
  let acknowledgement;
  if (kind === 'no_answer') acknowledgement = "No problem. We can move on.";
  else if (previous.codingProblem) acknowledgement = hasSubmittedCode(previous.answer)
    ? 'Thanks for sharing your code.' : 'Thanks for walking me through your approach.';
  else if (question.isFollowUp) {
    const firstClause = String(previous.answer || '').trim().split(/[.!?\n]/)[0].trim();
    let focus = firstClause;
    if (focus.length > 100) {
      focus = focus.slice(0, 80).replace(/\s+\S*$/, '');
      while (/\b(?:a|an|the|and|or|for|to|with|of|in|on|at|by|from|into|as|because)$/i.test(focus)) {
        focus = focus.replace(/\s+\S+$/, '');
      }
      focus += '…';
    }
    acknowledgement = focus.length >= 12 ? `Thanks. You mentioned “${focus}”.` : 'Thanks for sharing that.';
  } else acknowledgement = ['Thanks for sharing that.', "Thanks, I've noted that.", 'Thank you for that context.'][history.length % 3];
  return { introduction: '', acknowledgement,
    turnKind: question.isFollowUp ? 'follow_up' : question.topicId === 'closing' ? 'closing' : 'topic_transition' };
}

module.exports = {
  MAX_FOLLOW_UPS_PER_TOPIC,
  DURATION_PRESETS,
  DEFAULT_PRESET,
  TOPIC_POOLS,
  DEFAULT_POOL,
  getPreset,
  buildTopicPlan,
  classifyAnswer,
  decideNextMove,
  applyMove,
  extractMentions,
  questionPresentation,
  hasSubmittedCode,
  wordCount,
};
