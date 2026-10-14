const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

// The actual API, conversation engine and persistence run against a generated DB.
// Only the external AI completion is controlled; no real provider keys are loaded.
const dbName = `careerai_dialogue_test_${randomUUID().replaceAll('-', '')}`;
process.env.JWT_SECRET = 'dialogue-regression-only-secret';
process.env.NODE_ENV = 'test';
const chat = require('../src/services/ai/chat.service');
const originalCompletion = chat.completeChat;
let modelCalls = 0;
let forcedQuestion = null;
const prompts = [];
chat.completeChat = async request => {
  modelCalls++;
  const prompt = request.messages.find(item => item.role === 'user').content;
  prompts.push(request);
  await new Promise(resolve => setTimeout(resolve, 20));
  let question = forcedQuestion;
  if (!question) {
    if (prompt.includes('YOUR TASK: ask ONE follow-up')) question = prompt.includes('coding interview') || prompt.includes('console.log')
      ? 'How does your reduction calculate the total from the input?' : 'How did you implement the paginated filters in your React dashboard?';
    else if (prompt.includes('TOPIC: intro')) question = 'What kind of development work have you been doing recently?';
    else if (prompt.includes('TOPIC: project_depth')) question = 'Could you walk me through a project you built?';
    else if (prompt.includes('TOPIC: closing')) question = 'Before we wrap up, is there anything else you would like to share?';
    else question = 'How did you think about the time complexity of your solution?';
  }
  return { choices: [{ message: { content: JSON.stringify({ question, category: 'Technical', difficulty: 'Easy',
    acknowledgement: 'Excellent answer with perfect results.' }) } }] };
};
const app = require('../src/app');
const Session = require('../src/models/InterviewSession');
const User = require('../src/models/User');
const ai = require('../src/services/gemini/interview.service');
const { buildTopicPlan, applyMove, decideNextMove } = require('../src/services/interview/conversation');
let server, base;
const setup = { role: 'Frontend Developer', interviewType: 'Technical Interview', durationPreset: 'quick',
  consent: { storeTranscript: true, recordAudio: false, recordVideo: false, analyzeVideo: false } };
async function account() {
  const user = await User.create({ name: 'Dialogue Fixture', email: `dialogue-${randomUUID()}@test.invalid`, password: 'not-used' });
  return { userId: user._id, token: jwt.sign({ userId: user._id }, process.env.JWT_SECRET) };
}
async function request(owner, method, route, body) {
  const response = await fetch(`${base}/api/${route}`, { method, headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, ...await response.json() };
}
async function start(owner, settings = setup) {
  const result = await request(owner, 'POST', 'interview/session', settings);
  assert.equal(result.status, 201);
  return result.data.id;
}
async function turn(owner, id, seq, answer, clientTurnId = randomUUID()) {
  const body = { seq, answer, clientTurnId };
  const result = await request(owner, 'POST', `interview/session/${id}/turn`, body);
  assert.equal(result.status, 200, JSON.stringify(result));
  return { result: result.data, body };
}
before(async () => {
  await mongoose.connect(process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  await Promise.all([Session.createIndexes(), User.createIndexes()]);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  chat.completeChat = originalCompletion;
  if (mongoose.connection.readyState === 1) {
    assert.equal(mongoose.connection.name, dbName);
    assert.match(dbName, /^careerai_dialogue_test_[a-f0-9]{32}$/);
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
  if (server) await new Promise(resolve => server.close(resolve));
});

test('warm opening and acknowledgement persist once through concurrent reads and lost-response retries', async () => {
  const owner = await account();
  const id = await start(owner);
  const beforeCalls = modelCalls;
  await Promise.all(Array.from({ length: 4 }, () => request(owner, 'GET', `interview/session/${id}/state`)));
  const opened = (await request(owner, 'GET', `interview/session/${id}/state`)).data;
  assert.equal(modelCalls - beforeCalls, 1);
  assert.equal(opened.question.turnKind, 'opening');
  assert.match(opened.question.introduction, /Alex, your AI practice interviewer/);
  assert.ok(!opened.question.question.includes('Alex'));
  assert.equal(opened.question.acknowledgement, '');
  const answer = 'I have been studying frontend development and working on small personal projects.';
  const submitted = await turn(owner, id, 0, answer);
  const afterCalls = modelCalls;
  const replay = await request(owner, 'POST', `interview/session/${id}/turn`, submitted.body);
  assert.equal(replay.status, 200);
  assert.equal(modelCalls, afterCalls);
  assert.equal(replay.data.turns.length, 1);
  assert.equal(replay.data.turns[0].introduction, opened.question.introduction);
  assert.equal(replay.data.turns[0].question, opened.question.question);
  assert.equal(replay.data.question.turnKind, 'topic_transition');
  assert.ok(!/excellent|perfect|score/i.test(replay.data.question.acknowledgement));
  const reloaded = (await request(owner, 'GET', `interview/session/${id}/state`)).data;
  assert.deepEqual(reloaded.question, replay.data.question);
});

test('a concise actual project gets one focused follow-up then reaches a non-probing closing', async () => {
  const owner = await account();
  const id = await start(owner);
  await request(owner, 'GET', `interview/session/${id}/state`);
  await turn(owner, id, 0, 'I am learning frontend development and building projects.');
  const answer = 'I built a React dashboard with paginated filters and a Node API.';
  const follow = (await turn(owner, id, 1, answer)).result;
  assert.equal(follow.question.turnKind, 'follow_up');
  assert.equal(follow.question.isFollowUp, true);
  assert.match(follow.question.question, /paginated filters.*React dashboard/);
  assert.match(follow.question.acknowledgement, /I built a React dashboard with paginated filters/);
  const providerPrompt = prompts.at(-1);
  assert.match(providerPrompt.messages[0].content, /Do not praise, grade, score/);
  assert.match(providerPrompt.messages[1].content, /Only ask them to expand on something they ALREADY said/);
  assert.ok(providerPrompt.messages[1].content.includes(answer));
  const closed = (await turn(owner, id, 2, answer)).result;
  assert.equal(closed.question.turnKind, 'closing');
  assert.equal(closed.question.isFollowUp, false);
  assert.equal(closed.turns.filter(item => item.isFollowUp).length, 1);
  const complete = (await turn(owner, id, 3, 'We built many things as a team and we all helped each other through the project and our team discussed every change together throughout the work.')).result;
  assert.equal(complete.readyToComplete, true);
  assert.equal(complete.question, null);
  assert.ok(complete.seq <= complete.maxQuestions);
});

test('uncertain and explicit skip responses move on kindly instead of repeating a probe', async () => {
  const owner = await account();
  const id = await start(owner);
  await request(owner, 'GET', `interview/session/${id}/state`);
  await turn(owner, id, 0, 'I am new to frontend development.');
  const skipped = (await turn(owner, id, 1, "I'm not sure. Could we skip this question?")).result;
  assert.equal(skipped.question.turnKind, 'closing');
  assert.equal(skipped.question.isFollowUp, false);
  assert.equal(skipped.question.acknowledgement, 'No problem. We can move on.');
});

test('coding opens with a welcome alongside the real problem and retains it on reasoning follow-up', async () => {
  const owner = await account();
  const id = await start(owner, { ...setup, interviewType: 'Coding / Programming Interview' });
  const beforeCalls = modelCalls;
  const opened = (await request(owner, 'GET', `interview/session/${id}/state`)).data;
  assert.equal(modelCalls, beforeCalls, 'fixed testable starter requires no invented model problem');
  assert.equal(opened.question.turnKind, 'opening');
  assert.match(opened.question.introduction, /AI practice interviewer/);
  assert.equal(opened.question.topicId, 'problem_1');
  assert.equal(opened.question.codingProblem.id, 'sum_integers');
  assert.ok(!opened.question.question.includes('Alex'));
  const code = "const values = [1, 2, 3]; console.log(values.reduce((a,b)=>a+b,0));";
  const follow = (await turn(owner, id, 0, code)).result;
  assert.equal(follow.question.turnKind, 'follow_up');
  assert.equal(follow.question.codingProblem.id, 'sum_integers');
  assert.equal(follow.question.acknowledgement, 'Thanks for sharing your code.');
  assert.notEqual(follow.question.question, opened.question.question);
  assert.ok(prompts.at(-1).messages[1].content.includes(code));
});

test('older saved questions remain readable and get additive presentation only on the next generated question', async () => {
  const owner = await account();
  const id = await start(owner);
  const plan = buildTopicPlan('Technical Interview', 'quick');
  const openedPlan = applyMove(plan, decideNextMove(plan, [], 6));
  const legacy = { question: 'Tell me about your background.', category: 'Introduction', difficulty: 'Easy', topicId: 'intro', isFollowUp: false };
  await Session.updateOne({ _id: id }, { $set: { currentQuestion: legacy, topicPlan: openedPlan } });
  assert.deepEqual((await request(owner, 'GET', `interview/session/${id}/state`)).data.question, legacy);
  const next = (await turn(owner, id, 0, 'I am a student learning frontend development.')).result;
  assert.equal(next.turns[0].question, legacy.question);
  assert.equal(next.turns[0].introduction, undefined);
  assert.equal(next.question.turnKind, 'topic_transition');
  assert.equal(typeof next.question.acknowledgement, 'string');
});

test('provider multi-question replies and exact repeats are rejected instead of saved', async () => {
  const originalConsole = console.error;
  console.error = () => {};
  try {
    forcedQuestion = 'What did you build? How did you test it?';
    await assert.rejects(() => ai.generateNextQuestion('Frontend Developer'), error => error.statusCode === 502);
    forcedQuestion = 'Tell me about your background.';
    const plan = buildTopicPlan('Technical Interview', 'quick');
    const openedPlan = applyMove(plan, decideNextMove(plan, [], 6));
    await assert.rejects(() => ai.generateNextQuestion('Frontend Developer', 'Technical Interview',
      [{ question: forcedQuestion, answer: 'I am new to frontend development.' }], null, '', null, 'fresher', 0, [],
      { topicPlan: openedPlan, durationPreset: 'quick' }), error => error.statusCode === 502);
  } finally { forcedQuestion = null; console.error = originalConsole; }
});

test('spoken-answer upload enforces ownership and sequence without saving audio or submitting a turn', async () => {
  const transcription = require('../src/services/interview/transcription.service');
  const original = transcription.transcription; let providerCalls = 0;
  transcription.transcription = transcription.createTranscriptionService({ transcribe: async () => { providerCalls++; return 'I built a React interface with accessible controls.'; } });
  const owner = await account(), other = await account(), id = await start(owner);
  await request(owner, 'GET', `interview/session/${id}/state`);
  const audio = Buffer.alloc(44 + 9600);
  audio.write('RIFF'); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVE', 8);
  audio.write('fmt ', 12); audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22);
  audio.writeUInt32LE(16000, 24); audio.writeUInt32LE(32000, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34);
  audio.write('data', 36); audio.writeUInt32LE(9600, 40); audio.writeInt16LE(8000, 44);
  async function upload(actor, seq = '0', mime = 'audio/wav', bytes = audio) {
    const form = new FormData(); form.set('seq', seq); form.set('language', 'en-IN'); form.set('audio', new Blob([bytes], { type: mime }), 'answer.wav');
    const response = await fetch(`${base}/api/interview/session/${id}/transcribe`, { method: 'POST', headers: actor ? { Authorization: `Bearer ${actor.token}` } : {}, body: form });
    return { status: response.status, cache: response.headers.get('cache-control'), ...await response.json() };
  }
  try {
    assert.equal((await upload(null)).status, 401);
    assert.equal((await upload(other)).status, 404);
    assert.equal((await upload(owner, '0', 'text/plain')).status, 400);
    assert.equal((await upload(owner, '0', 'audio/wav', Buffer.alloc(transcription.MAX_AUDIO_BYTES + 1))).status, 413);
    assert.equal(providerCalls, 0);
    const result = await upload(owner);
    assert.equal(result.status, 200, JSON.stringify(result)); assert.equal(result.cache, 'no-store');
    assert.deepEqual(result.data, { text: 'I built a React interface with accessible controls.', seq: 0 });
    const saved = await Session.findById(id).lean();
    assert.equal(saved.turns.length, 0); assert.equal(saved.currentSeq, 0); assert.equal(saved.recordingSegments.length, 0);
    await turn(owner, id, 0, result.data.text);
    assert.equal((await upload(owner)).status, 409);
    assert.equal(providerCalls, 1);
  } finally { transcription.transcription = original; }
});
