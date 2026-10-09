const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_FOLLOW_UPS_PER_TOPIC,
  DURATION_PRESETS,
  buildTopicPlan,
  classifyAnswer,
  decideNextMove,
  applyMove,
  extractMentions,
  questionPresentation,
  hasSubmittedCode,
} = require('../src/services/interview/conversation');

// ---------------------------------------------------------------------------
// Topic planning -- the interview is topics, not a fixed question count
// ---------------------------------------------------------------------------

test('duration presets give three distinct lengths', () => {
  assert.ok(DURATION_PRESETS.quick.topics < DURATION_PRESETS.standard.topics);
  assert.ok(DURATION_PRESETS.standard.topics < DURATION_PRESETS.full.topics);
  assert.ok(DURATION_PRESETS.quick.maxQuestions < DURATION_PRESETS.full.maxQuestions);
});

test('plan length follows the chosen duration', () => {
  assert.equal(buildTopicPlan('Technical Interview', 'quick').length, 3);
  assert.equal(buildTopicPlan('Technical Interview', 'standard').length, 5);
  assert.equal(buildTopicPlan('Technical Interview', 'full').length, 8);
});

test('every plan opens with an intro and ends with a close', () => {
  for (const preset of ['quick', 'standard', 'full']) {
    const plan = buildTopicPlan('Technical Interview', preset);
    assert.equal(plan[0].id, 'intro', `${preset} should open with intro`);
    assert.equal(plan[plan.length - 1].id, 'closing', `${preset} should end with closing`);
  }
});

test('a short interview is a shorter real interview, not a truncated one', () => {
  // Regression guard: naive slicing would drop the closing topic and end the
  // interview mid-technical-question.
  const quick = buildTopicPlan('Behavioral Interview', 'quick');
  assert.equal(quick[quick.length - 1].id, 'closing');
});

test('unknown interview type falls back to the mixed pool', () => {
  const plan = buildTopicPlan('Some Unknown Type', 'standard');
  assert.equal(plan.length, 5);
  assert.equal(plan[0].id, 'intro');
});

test('unknown preset falls back to standard', () => {
  assert.equal(buildTopicPlan('Technical Interview', 'nonsense').length, 5);
});

test('resume seeds the project topic but not every topic', () => {
  const resume = { projects: ['Built a payments pipeline'], technicalSkills: ['Go', 'Kafka'] };
  const plan = buildTopicPlan('Technical Interview', 'full', resume);

  const seeded = plan.filter((t) => t.seed);
  assert.ok(seeded.length >= 1, 'at least one topic should be seeded');
  assert.ok(seeded.length <= 2, 'the resume must not drive every topic');
  assert.equal(seeded[0].seed.project, 'Built a payments pipeline');
});

test('no resume is fine', () => {
  const plan = buildTopicPlan('Technical Interview', 'standard', null);
  assert.ok(plan.every((t) => t.seed === null));
});

// ---------------------------------------------------------------------------
// Answer classification -- decides probe vs move on
// ---------------------------------------------------------------------------

test('blank and "I do not know" are no_answer', () => {
  assert.equal(classifyAnswer('').kind, 'no_answer');
  assert.equal(classifyAnswer("I don't know").kind, 'no_answer');
  assert.equal(classifyAnswer('not sure really').kind, 'no_answer');
  assert.equal(classifyAnswer('[No verbal response or code submitted]').kind, 'no_answer');
});

test('a short answer is thin, not suspicious', () => {
  assert.equal(classifyAnswer('I used React and Node for it.').kind, 'thin');
});

test('answers that hide behind "we" are probed for personal contribution', () => {
  const answer =
    'We built a new checkout flow for the team. We decided to use a queue because we ' +
    'had a lot of traffic, and we shipped it after we tested it with our users over ' +
    'several weeks of gradual rollout across our regions.';
  assert.equal(classifyAnswer(answer).kind, 'vague_we');
});

test('a detailed answer with no outcome is probed for the result', () => {
  const answer =
    'I was responsible for redesigning the ingestion service. I rewrote the parser in ' +
    'Go, added a retry layer, and moved the scheduling into a separate worker so the ' +
    'main process stayed responsive during heavy batches for our largest accounts.';
  assert.equal(classifyAnswer(answer).kind, 'no_outcome');
});

test('a complete answer with a result is left alone', () => {
  const answer =
    'I owned the migration. I rewrote the parser in Go and added a retry layer, which ' +
    'reduced failed jobs by 40% and cut the nightly run from six hours to about ninety ' +
    'minutes, so the on-call load dropped noticeably that quarter.';
  assert.equal(classifyAnswer(answer).kind, 'complete');
});

test('a general answer with no concrete detail is probed for an example', () => {
  // The measured failure mode of AI interviewers is UNDER-probing: in one study
  // 88% of the violations of "follow up when an answer is unclear" were the AI's.
  // Without this branch we would only ever probe two narrow patterns.
  const answer =
    'I always try to communicate clearly and make sure everyone on the team stays ' +
    'aligned throughout the whole process from start to finish, which really helps.';
  assert.equal(classifyAnswer(answer).kind, 'unclear');
});

test('a general answer WITH a concrete specific is left alone', () => {
  const answer =
    'I communicate clearly with the team. For example, last month I set up a weekly ' +
    'Slack digest so everyone could see what shipped without attending another meeting.';
  assert.notEqual(classifyAnswer(answer).kind, 'unclear');
});

test('first person plus an outcome is not mistaken for hiding', () => {
  const answer =
    'I led it myself. I designed the schema, I wrote the migration script, and I ran ' +
    'the cutover. We saw error rates improve by 30% afterwards and the team was happy ' +
    'with how smooth the switch turned out to be in the end.';
  assert.equal(classifyAnswer(answer).kind, 'complete');
});

// ---------------------------------------------------------------------------
// Move decisions -- the heart of "acts like a real interviewer"
// ---------------------------------------------------------------------------

const richAnswer =
  'I owned that project end to end. I rebuilt the sync layer and introduced batching, ' +
  'which reduced latency by 60% and let us handle triple the volume without new hardware.';
const weAnswer =
  'We built the service together as a team. We chose Postgres because we needed strong ' +
  'consistency, and we rolled it out over our whole estate after we ran our tests.';

test('a fresh topic opens with a main question', () => {
  const plan = buildTopicPlan('Technical Interview', 'standard');
  const move = decideNextMove(plan, [], 16);
  assert.equal(move.action, 'new_topic');
  assert.equal(move.topicIndex, 0);
});

test('a vague answer triggers a follow-up on the same topic', () => {
  let plan = buildTopicPlan('Technical Interview', 'standard');
  plan[0] = { ...plan[0], covered: true };
  plan = applyMove(plan, decideNextMove(plan, [], 16));

  const move = decideNextMove(plan, [{ question: 'q1', answer: weAnswer }], 16);
  assert.equal(move.action, 'follow_up');
  assert.equal(move.probe, 'vague_we');
  assert.equal(move.topicIndex, 1, 'must stay on the substantive topic');
});

test('a complete answer moves the interview on', () => {
  let plan = buildTopicPlan('Technical Interview', 'standard');
  plan = applyMove(plan, decideNextMove(plan, [], 16));

  const move = decideNextMove(plan, [{ question: 'q1', answer: richAnswer }], 16);
  // Moving on OPENS the next topic in the same step -- 'advance' used to burn a
  // turn without asking anything, which made every topic appear twice.
  assert.equal(move.action, 'new_topic');
  assert.equal(move.topicIndex, 1);
  assert.equal(move.closeTopicIndex, 0, 'the finished topic must be closed');
});

test('a blank answer is never probed', () => {
  // The most important fairness rule in this file: repeatedly asking someone to
  // expand on something they clearly do not know is demoralising and pointless.
  let plan = buildTopicPlan('Technical Interview', 'standard');
  plan = applyMove(plan, decideNextMove(plan, [], 16));

  const move = decideNextMove(plan, [{ question: 'q1', answer: "I don't know" }], 16);
  assert.equal(move.action, 'new_topic', 'must move on, not probe');
  assert.equal(move.previousReason, 'no_answer');
});

test('a thin answer is not probed either', () => {
  let plan = buildTopicPlan('Technical Interview', 'standard');
  plan = applyMove(plan, decideNextMove(plan, [], 16));

  const move = decideNextMove(plan, [{ question: 'q1', answer: 'I used Python.' }], 16);
  assert.equal(move.action, 'new_topic', 'must move on, not probe');
});

test('probing is capped -- it cannot drill one topic forever', () => {
  let plan = buildTopicPlan('Technical Interview', 'standard');
  plan[0] = { ...plan[0], covered: true };
  const history = [];

  plan = applyMove(plan, decideNextMove(plan, history, 16));
  history.push({ question: 'main', answer: weAnswer });

  let followUps = 0;
  for (let i = 0; i < 6; i++) {
    const move = decideNextMove(plan, history, 16);
    if (move.action !== 'follow_up') break;
    followUps++;
    plan = applyMove(plan, move);
    history.push({ question: `probe ${followUps}`, answer: weAnswer });
  }

  assert.equal(followUps, MAX_FOLLOW_UPS_PER_TOPIC);
  assert.equal(decideNextMove(plan, history, 16).action, 'new_topic');
});

test('follow-ups never eat the budget needed to open remaining topics', () => {
  // 5 topics, 5 questions allowed -> every question must open a new topic.
  let plan = buildTopicPlan('Technical Interview', 'standard');
  const history = [];
  plan = applyMove(plan, decideNextMove(plan, history, 5));
  history.push({ question: 'intro', answer: richAnswer });
  plan = applyMove(plan, decideNextMove(plan, history, 5));
  history.push({ question: 'main', answer: weAnswer });

  const move = decideNextMove(plan, history, 5);
  assert.equal(move.action, 'new_topic', 'no room to probe; must move on');
});

test('the interview finishes when every topic is covered', () => {
  let plan = buildTopicPlan('Technical Interview', 'quick');
  const history = [];
  for (let i = 0; i < 20; i++) {
    const move = decideNextMove(plan, history, 8);
    if (move.action === 'finish') {
      assert.equal(move.reason, 'all_topics_covered');
      return;
    }
    plan = applyMove(plan, move);
    history.push({ question: `q${i}`, answer: richAnswer });
  }
  assert.fail('interview never finished');
});

test('the interview finishes at the question cap even if answers keep inviting probes', () => {
  let plan = buildTopicPlan('Technical Interview', 'full');
  const history = [];
  for (let i = 0; i < 60; i++) {
    const move = decideNextMove(plan, history, 10);
    if (move.action === 'finish') {
      assert.ok(history.length <= 10);
      return;
    }
    plan = applyMove(plan, move);
    history.push({ question: `q${i}`, answer: weAnswer });
  }
  assert.fail('interview never finished');
});

test('no topic is ever visited twice', () => {
  // Regression: "advance" used to close a topic without asking anything, so the
  // caller burned a turn and every topic appeared twice in the transcript.
  for (const preset of ['quick', 'standard', 'full']) {
    let plan = buildTopicPlan('Technical Interview', preset);
    const max = DURATION_PRESETS[preset].maxQuestions;
    const history = [];
    const opened = [];
    for (let i = 0; i < 60; i++) {
      const move = decideNextMove(plan, history, max);
      if (move.action === 'finish') break;
      if (move.action === 'new_topic') opened.push(move.topic.id);
      plan = applyMove(plan, move);
      history.push({ question: `q${i}`, answer: richAnswer });
    }
    assert.deepEqual(opened, [...new Set(opened)], `${preset}: a topic was opened twice`);
  }
});

test('the interview always reaches the closing topic, even when probes eat the budget', () => {
  // Regression: a candidate who triggered probes on every topic used to hit the
  // question cap mid-interview and never get a wrap-up.
  let plan = buildTopicPlan('Technical Interview', 'standard');
  const max = DURATION_PRESETS.standard.maxQuestions;
  const history = [];
  const opened = [];
  for (let i = 0; i < 60; i++) {
    const move = decideNextMove(plan, history, max);
    if (move.action === 'finish') break;
    if (move.action === 'new_topic') opened.push(move.topic.id);
    plan = applyMove(plan, move);
    history.push({ question: `q${i}`, answer: weAnswer }); // always invites a probe
  }
  assert.ok(opened.includes('closing'), 'interview must not end without a closing question');
  assert.equal(opened[opened.length - 1], 'closing', 'closing must come last');
});

test('question totals land in the advertised range for each preset', () => {
  for (const [name, preset] of Object.entries(DURATION_PRESETS)) {
    let plan = buildTopicPlan('Technical Interview', name);
    const history = [];
    for (let i = 0; i < 100; i++) {
      const move = decideNextMove(plan, history, preset.maxQuestions);
      if (move.action === 'finish') break;
      plan = applyMove(plan, move);
      // Alternate answer quality so some topics probe and some don't.
      history.push({ question: `q${i}`, answer: i % 2 ? weAnswer : richAnswer });
    }
    assert.ok(history.length >= preset.topics,
      `${name}: expected at least ${preset.topics} questions, got ${history.length}`);
    assert.ok(history.length <= preset.maxQuestions,
      `${name}: exceeded cap of ${preset.maxQuestions} with ${history.length}`);
  }
});

// ---------------------------------------------------------------------------
// Callbacks -- what makes it feel like one conversation
// ---------------------------------------------------------------------------

test('mentions are collected so later questions can call back', () => {
  const history = [
    { question: 'q1', answer: 'I led the payments migration for our biggest client last year.' },
    { question: 'q2', answer: 'Yes.' },
    { question: 'q3', answer: 'I mostly work on backend services, particularly in Go and Kafka.' },
  ];
  const mentions = extractMentions(history);
  assert.equal(mentions.length, 2, 'short answers should be skipped');
  assert.match(mentions[0], /payments migration/);
});

test('mention list stays small enough for the prompt', () => {
  const history = Array.from({ length: 30 }, (_, i) => ({
    question: `q${i}`,
    answer: `I worked on project number ${i} which involved a lot of interesting engineering.`,
  }));
  assert.equal(extractMentions(history).length, 8);
});

test('mentions handle an empty history', () => {
  assert.deepEqual(extractMentions([]), []);
});

test('concise substantive work invites a clarification while filler and uncertainty move on', () => {
  const answer = 'I built a React dashboard with paginated filters and a Node API.';
  assert.equal(classifyAnswer(answer).kind, 'needs_detail');
  assert.equal(classifyAnswer('I built a Redis cache that reduced latency by 40%.').kind, 'complete');
  for (const value of ['I used Python.', 'Okay, yes.', 'I do not know', 'I have no experience with that',
    'Please skip this question', "I'd like to skip", "I’m not sure how to answer"]) {
    assert.ok(['thin', 'no_answer'].includes(classifyAnswer(value).kind), value);
  }
  let plan = buildTopicPlan('Technical Interview', 'quick');
  plan[0] = { ...plan[0], covered: true };
  plan = applyMove(plan, decideNextMove(plan, [], 6));
  const move = decideNextMove(plan, [{ answer }], 6);
  assert.equal(move.action, 'follow_up');
  assert.equal(move.probe, 'needs_detail');
  assert.equal(MAX_FOLLOW_UPS_PER_TOPIC, 1);
});

test('opening background and closing answers never trigger STAR probing', () => {
  let plan = buildTopicPlan('Technical Interview', 'quick');
  plan = applyMove(plan, decideNextMove(plan, [], 6));
  const background = 'I built a React dashboard with paginated filters and a Node API.';
  assert.equal(decideNextMove(plan, [{ answer: background }], 6).action, 'new_topic');
  plan = plan.map((topic, index) => ({ ...topic, covered: index < plan.length - 1,
    questionsAsked: index === plan.length - 1 ? 1 : topic.questionsAsked }));
  assert.equal(decideNextMove(plan, [{ answer: weAnswer }], 6).action, 'finish');
});

test('concept and code probes ask about reasoning rather than business result metrics', () => {
  const conceptual = [{ id: 'fundamentals', questionsAsked: 1, followUpsUsed: 0, covered: false },
    { id: 'closing', questionsAsked: 0, followUpsUsed: 0, covered: false }];
  const answer = 'A database index uses a separate lookup structure to narrow down matching rows. The query planner chooses an index based on estimates for the filters and order, while the database maintains that structure as rows change.';
  assert.equal(decideNextMove(conceptual, [{ answer }], 6).probe, 'reasoning');
  const coding = [{ id: 'problem_1', questionsAsked: 1, followUpsUsed: 0, covered: false }, conceptual[1]];
  assert.equal(decideNextMove(coding, [{ answer: 'const sum = values.reduce((a,b)=>a+b,0);' }], 6).probe, 'reasoning');
  assert.equal(decideNextMove(coding, [{ answer: 'I do not know' }], 6).action, 'new_topic');
});

test('acknowledgements quote only a short actual phrase and keep greetings separate from questions', () => {
  const opening = questionPresentation([], { topicId: 'intro' });
  assert.equal(opening.turnKind, 'opening');
  assert.match(opening.introduction, /Alex, your AI practice interviewer/);
  const answer = 'I built a React dashboard with paginated filters and a Node API.';
  const followUp = questionPresentation([{ answer }], { topicId: 'project_depth', isFollowUp: true });
  assert.equal(followUp.turnKind, 'follow_up');
  assert.equal(followUp.introduction, '');
  assert.match(followUp.acknowledgement, /I built a React dashboard with paginated filters/);
  assert.ok(followUp.acknowledgement.length < 100);
  assert.ok(!/great|excellent|correct|score|impressive/i.test(followUp.acknowledgement));
  assert.equal(questionPresentation([{ answer: 'skip' }], { topicId: 'closing' }).acknowledgement, 'No problem. We can move on.');
  assert.equal(questionPresentation([{ answer: 'const total=0;', codingProblem: { id: 'sum_integers' } }], { isFollowUp: true }).acknowledgement,
    'Thanks for sharing your code.');
  assert.equal(questionPresentation([{ answer: 'I would add each value to a running total.', codingProblem: { id: 'sum_integers' } }], { isFollowUp: true }).acknowledgement,
    'Thanks for walking me through your approach.');
  assert.ok(!questionPresentation([{ answer }], { topicId: 'closing' }).acknowledgement.includes('You mentioned'));
  const wholeClause = 'Our team built the Atlas React dashboard for internal support';
  assert.ok(questionPresentation([{ answer: wholeClause }], { isFollowUp: true }).acknowledgement.includes(`“${wholeClause}”`));
  const longer = `${wholeClause} teams with many complicated workflows and different regional reporting needs across the company`;
  const excerpt = questionPresentation([{ answer: longer }], { isFollowUp: true }).acknowledgement;
  assert.match(excerpt, /…/);
  assert.ok(!/\b(for|the|with|and)…/.test(excerpt));
});

test('submitted-code markers recognize editor language labels even for invalid code', () => {
  for (const marker of ['Submitted code:', 'Submitted code (javascript):', 'Submitted code (java):', 'Submitted code (cpp):']) {
    const answer = `${marker}\nthis is not valid source code`;
    assert.equal(hasSubmittedCode(answer), true);
    assert.equal(questionPresentation([{ answer, codingProblem: { id: 'sum_integers' } }], { isFollowUp: true }).acknowledgement,
      'Thanks for sharing your code.');
  }
  assert.equal(hasSubmittedCode('I would use a running total to add up the values.'), false);
});
