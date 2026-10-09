const { randomUUID } = require('crypto');
const Session = require('../../models/InterviewSession');
const Interview = require('../../models/Interview');
const Resume = require('../../models/Resume');
const ai = require('../gemini/interview.service');
const { getPreset, buildTopicPlan, questionPresentation } = require('./conversation');
const { fail, validateSetup, text } = require('../../validations/interview.validation');

const LEASE_MS = 5 * 60 * 1000;
const availableLease = () => ({ $or: [{ leaseToken: null }, { leaseUntil: { $lt: new Date() } }] });

async function owned(id, user) {
  const session = await Session.findOne({ _id: id, user }).lean();
  if (!session) fail('Interview session not found.', 404);
  return session;
}

function state(session) {
  const { resumeAnalysisSnapshot, ...setup } = session.setup;
  return {
    id: String(session._id), status: session.status, setup, consent: session.consent,
    seq: session.currentSeq, question: session.currentQuestion, turns: session.turns,
    maxQuestions: session.maxQuestions, readyToComplete: session.readyToComplete,
    deadlineAt: session.deadlineAt, startedAt: session.createdAt,
    evaluationStatus: session.evaluationStatus, evaluationError: session.evaluationError,
    interviewId: session.status === 'completed' ? String(session.interviewId) : null,
    recordingSegments: session.recordingSegments.map(({ segmentId, mimeType, bytes }) => ({ segmentId, mimeType, bytes })),
  };
}

async function create(user, body) {
  const setup = validateSetup(body);
  const active = await Session.findOne({ user, status: { $in: ['active', 'evaluating'] } });
  if (active) return { created: false, session: state(active.toObject()) };
  let resume = null;
  if (setup.resumeId) {
    resume = await Resume.findOne({ _id: setup.resumeId, user }).lean();
    if (!resume) fail('Resume not found.', 404);
  }
  setup.resumeAnalysisSnapshot = resume?.analysis || null;
  const research = setup.companyName ? await require('../../models/CompanyResearch').findOne({
    user, companyName: setup.companyName.toLowerCase(), expiresAt: { $gt: new Date() },
  }).lean() : null;
  setup.companyResearch = research?.data || null;
  const preset = getPreset(setup.durationPreset);
  await require('../../middlewares/quota.middleware').consumeQuota(user, 'interviews', 20);
  try {
    const session = await Session.create({
      user, setup, topicPlan: buildTopicPlan(setup.interviewType, setup.durationPreset, setup.resumeAnalysisSnapshot),
      maxQuestions: preset.maxQuestions,
      deadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      consent: {
        storeTranscript: true, recordAudio: body.consent.recordAudio, recordVideo: body.consent.recordVideo,
        analyzeVideo: body.consent.analyzeVideo, disclosureVersion: '2026-10-08', grantedAt: new Date(),
      },
    });
    return { created: true, session: state(session.toObject()) };
  } catch (error) {
    if (error.code !== 11000) throw error;
    const winner = await Session.findOne({ user, status: { $in: ['active', 'evaluating'] } }).lean();
    if (!winner) throw error;
    return { created: false, session: state(winner) };
  }
}

async function ensureQuestion(id, user) {
  const session = await owned(id, user);
  if (session.status !== 'active') return state(session);
  if (new Date(session.deadlineAt) <= new Date() || session.currentSeq >= session.maxQuestions) {
    const updated = await Session.findOneAndUpdate({ _id: id, user, status: 'active' }, { $set: { readyToComplete: true, currentQuestion: null } }, { returnDocument: 'after' }).lean();
    return state(updated || await owned(id, user));
  }
  if (session.currentQuestion || session.readyToComplete) return state(session);
  const leaseToken = randomUUID();
  const locked = await Session.findOneAndUpdate({ _id: id, user, status: 'active', currentQuestion: null, readyToComplete: false, ...availableLease() }, {
    $set: { leaseToken, leaseUntil: new Date(Date.now() + LEASE_MS) },
  }, { returnDocument: 'after' }).lean();
  if (!locked) return state(await owned(id, user));
  try {
    const s = locked.setup;
    const question = await ai.generateNextQuestion(s.role, s.interviewType, locked.turns,
      s.resumeAnalysisSnapshot, s.jobDescriptionText, s.companyResearch,
      s.experienceLevel, s.totalExperienceYears, s.employmentHistory,
      { durationPreset: s.durationPreset, topicPlan: locked.topicPlan, maxQuestions: locked.maxQuestions });
    if (s.interviewType === 'Coding / Programming Interview' && !question.done) {
      const problem = require('./coding.service').publicProblem(question.topicId);
      if (problem) { if (!question.isFollowUp) question.question = problem.statement; question.codingProblem = problem; }
    }
    if (!question.done) Object.assign(question, questionPresentation(locked.turns, question));
    const { topicPlan, ...visibleQuestion } = question;
    await Session.updateOne({ _id: id, leaseToken, status: 'active', readyToComplete: false, deadlineAt: { $gt: new Date() } }, {
      $set: { currentQuestion: question.done ? null : visibleQuestion, readyToComplete: Boolean(question.done), topicPlan: topicPlan || locked.topicPlan, lastActivityAt: new Date() },
    });
  } finally {
    await Session.updateOne({ _id: id, leaseToken }, { $set: { leaseToken: null, leaseUntil: new Date(0) } });
  }
  return state(await owned(id, user));
}

async function submitTurn(id, user, body) {
  const session = await owned(id, user);
  const { seq, clientTurnId, inputMode = 'text' } = body;
  if (!Number.isInteger(seq) || seq < 0) fail('Invalid turn sequence.');
  if (typeof clientTurnId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(clientTurnId)) fail('Invalid turn ID.');
  if (!['text', 'speech'].includes(inputMode)) fail('Invalid answer input mode.');
  const answer = text(body.answer, 'Answer', 20000, true);
  const previous = session.turns.find(turn => turn.clientTurnId === clientTurnId);
  if (previous) {
    if (previous.seq !== seq || previous.answer !== answer) fail('This turn ID was already used for a different answer.', 409);
    return ensureQuestion(id, user);
  }
  if (session.status !== 'active' || session.readyToComplete) fail('This session is no longer accepting answers.', 409);
  if (new Date(session.deadlineAt) <= new Date()) fail('Session expired. Finish it to evaluate saved answers.', 409);
  if (session.currentSeq !== seq || !session.currentQuestion) fail('Question changed. Reload the saved session before answering.', 409);
  const updated = await Session.findOneAndUpdate({
    _id: id, user, status: 'active', currentSeq: seq, 'turns.clientTurnId': { $ne: clientTurnId },
    'currentQuestion.question': session.currentQuestion.question,
  }, {
    $push: { turns: { ...session.currentQuestion, seq, clientTurnId, answer, inputMode, answeredAt: new Date() } },
    $set: { currentQuestion: null, lastActivityAt: new Date() }, $inc: { currentSeq: 1 },
  }, { returnDocument: 'after', runValidators: true }).lean();
  if (!updated) {
    const current = await owned(id, user);
    if (!current.turns.some(t => t.clientTurnId === clientTurnId && t.seq === seq && t.answer === answer)) fail('Another tab already answered this question. Reload the session.', 409);
  }
  return ensureQuestion(id, user);
}

async function complete(id, user) {
  const session = await owned(id, user);
  if (session.status === 'completed' || session.status === 'evaluating') return state(session);
  if (session.status !== 'active') fail('Session is not active.', 409);
  if (!session.turns.length) fail('Answer at least one question before finishing.');
  if (session.leaseToken && new Date(session.leaseUntil) > new Date()) fail('A question is still being saved. Please retry shortly.', 409);
  const updated = await Session.findOneAndUpdate({ _id: id, user, status: 'active', ...availableLease() }, {
    $set: { status: 'evaluating', evaluationStatus: 'pending', evaluationError: '', currentQuestion: null },
  }, { returnDocument: 'after' }).lean();
  return state(updated || await owned(id, user));
}

async function evaluateOne() {
  const leaseToken = randomUUID();
  const session = await Session.findOneAndUpdate({ status: 'evaluating', evaluationStatus: { $in: ['pending', 'processing'] }, ...availableLease() }, {
    $set: { leaseToken, leaseUntil: new Date(Date.now() + LEASE_MS), evaluationStatus: 'processing' },
  }, { returnDocument: 'after', sort: { createdAt: 1 } }).lean();
  if (!session) return false;
  try {
    let report = await Interview.findById(session.interviewId);
    if (!report) {
      const s = session.setup;
      const evaluation = await ai.generateEvaluationReport(s.role, s.interviewType, session.turns,
        s.jobDescriptionText, s.companyResearch, s.experienceLevel, s.totalExperienceYears, s.employmentHistory);
      const stillOwned = await Session.exists({ _id: session._id, leaseToken, status: 'evaluating' });
      if (!stillOwned) return true;
      report = await Interview.findOneAndUpdate({ _id: session.interviewId }, { $setOnInsert: {
        ...s, ...evaluation, user: session.user, sessionId: session._id,
        recordingConsent: session.consent.recordAudio, consent: session.consent,
        recordingDuration: Math.round((new Date(session.updatedAt) - new Date(session.createdAt)) / 1000),
      } }, { upsert: true, returnDocument: 'after', runValidators: true });
    }
    await Session.updateOne({ _id: session._id, leaseToken }, { $set: { status: 'completed', evaluationStatus: 'completed', evaluationError: '' } });
  } catch (error) {
    console.error('Interview evaluation failed', { sessionId: String(session._id), message: error.message });
    await Session.updateOne({ _id: session._id, leaseToken }, { $set: { evaluationStatus: 'failed', evaluationError: 'Report generation failed. Your answers are saved. Retry when the AI service is available.' } });
  } finally {
    await Session.updateOne({ _id: session._id, leaseToken }, { $set: { leaseToken: null, leaseUntil: new Date(0) } });
  }
  return true;
}

function startEvaluationWorker() {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await evaluateOne(); } catch (error) { console.error('Evaluation worker error:', error.message); }
    finally { busy = false; }
  }, 2000);
  timer.unref();
  return () => clearInterval(timer);
}
module.exports = { owned, state, create, ensureQuestion, submitTurn, complete, evaluateOne, startEvaluationWorker };
