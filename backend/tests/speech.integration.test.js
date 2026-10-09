const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const dbName = `careerai_speech_test_${randomUUID().replaceAll('-', '')}`;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'synthetic-speech-regression-secret';
process.env.GEMINI_API_KEY = 'synthetic-speech-provider-key';
const originalFetch = global.fetch;
let providerCalls = 0, providerStatus = 200, lastTranscript;
const wav = Buffer.alloc(44 + 480);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(480, 40);
global.fetch = async (url, options) => {
  if (url !== 'https://generativelanguage.googleapis.com/v1beta/interactions') return originalFetch(url, options);
  providerCalls++;
  lastTranscript = JSON.parse(options.body).input[0].content[0].text;
  if (providerStatus !== 200) return new Response('private provider diagnostic must not leak', { status: providerStatus });
  return new Response(JSON.stringify({ steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/wav', data: wav.toString('base64') }] }] }), { headers: { 'Content-Type': 'application/json' } });
};
const app = require('../src/app');
const Session = require('../src/models/InterviewSession');
const User = require('../src/models/User');
let server, base;
async function account() {
  const user = await User.create({ name: 'Aarav Demo', email: `speech-${randomUUID()}@example.invalid`, password: 'synthetic-not-used' });
  return { userId: user._id, token: jwt.sign({ userId: user._id }, process.env.JWT_SECRET) };
}
async function createSession(owner) {
  return Session.create({ user: owner.userId, setup: { role: 'Frontend Developer', interviewType: 'Technical Interview', durationPreset: 'quick', experienceLevel: 'fresher' },
    consent: { storeTranscript: true, recordAudio: false, recordVideo: false, analyzeVideo: false }, deadlineAt: new Date(Date.now() + 60000), maxQuestions: 6,
    currentQuestion: { question: 'How did you build your React dashboard?', acknowledgement: 'Thanks for sharing that.', introduction: 'This introduction must never be part of question audio.' } });
}
async function speech(owner, id, body) {
  return originalFetch(`${base}/api/interview/session/${id}/speech`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(owner ? { Authorization: 'Bearer ' + owner.token } : {}) }, body: JSON.stringify(body) });
}
before(async () => {
  await mongoose.connect(process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  await Promise.all([Session.createIndexes(), User.createIndexes()]);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  global.fetch = originalFetch;
  if (mongoose.connection.readyState === 1) {
    assert.equal(mongoose.connection.name, dbName); assert.match(dbName, /^careerai_speech_test_[a-f0-9]{32}$/);
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
  if (server) await new Promise(resolve => server.close(resolve));
});
test('real session speech route returns WAV and matching safe captions only to the owner, without altering scored turns', async () => {
  const owner = await account(), outsider = await account(), session = await createSession(owner);
  const initialCalls = providerCalls;
  assert.equal((await speech(null, session.id, { seq: 0, kind: 'greeting' })).status, 401);
  assert.equal((await speech(outsider, session.id, { seq: 0, kind: 'greeting' })).status, 404);
  assert.equal(providerCalls, initialCalls);
  const welcome = await speech(owner, session.id, { seq: 0, kind: 'greeting', text: 'Do not read this arbitrary caller text.', name: 'Other Person' });
  assert.equal(welcome.status, 200); assert.match(welcome.headers.get('content-type'), /^audio\/wav/);
  assert(Buffer.from(await welcome.arrayBuffer()).equals(wav));
  assert.equal(welcome.headers.get('cache-control'), 'no-store');
  assert.match(welcome.headers.get('access-control-expose-headers'), /X-Interviewer-Text/);
  assert.equal(decodeURIComponent(welcome.headers.get('x-interviewer-text')), lastTranscript);
  assert.match(lastTranscript, /^Hi, Aarav\./); assert.match(lastTranscript, /Frontend Developer interview/); assert.match(lastTranscript, /how are you feeling today\?/);
  assert.ok(!lastTranscript.includes('Other Person')); assert.ok(!lastTranscript.includes('arbitrary caller'));
  await speech(owner, session.id, { seq: 0, kind: 'greeting' }); assert.equal(providerCalls, initialCalls + 1);
  const question = await speech(owner, session.id, { seq: 0, kind: 'question' });
  assert.equal(question.status, 200);
  assert.equal(decodeURIComponent(question.headers.get('x-interviewer-text')), 'Thanks for sharing that. How did you build your React dashboard?');
  assert.ok(!lastTranscript.includes('introduction'));
  const fresh = await Session.findById(session.id).lean();
  assert.equal(fresh.currentSeq, 0); assert.equal(fresh.turns.length, 0); assert.equal(fresh.currentQuestion.question, session.currentQuestion.question);
  await Session.updateOne({ _id: session.id }, { $set: { currentSeq: 1 } });
  const beforeStale = providerCalls;
  assert.equal((await speech(owner, session.id, { seq: 0, kind: 'question' })).status, 409);
  assert.equal((await speech(owner, session.id, { seq: 1, kind: 'warm_up_ready' })).status, 409);
  assert.equal(providerCalls, beforeStale);
});
test('provider failure returns safe JSON while preserving server caption headers for browser-voice fallback', async () => {
  const owner = await account(), session = await createSession(owner);
  providerStatus = 429;
  const response = await speech(owner, session.id, { seq: 0, kind: 'warm_up_nervous' });
  assert.equal(response.status, 503); assert.match(response.headers.get('content-type'), /application\/json/);
  assert.match(decodeURIComponent(response.headers.get('x-interviewer-text')), /okay to feel nervous/);
  const error = await response.json(); assert.equal(error.success, false); assert.match(error.error, /usage limit reached/);
  assert.ok(!JSON.stringify(error).includes('private provider diagnostic'));
  providerStatus = 200;
});
