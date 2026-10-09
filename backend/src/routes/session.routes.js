const router = require('express').Router();
const Session = require('../models/InterviewSession');
const service = require('../services/interview/session.service');
const { objectId, fail } = require('../validations/interview.validation');
const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
const media = require('../services/interview/recording.service');
const chunkUpload = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 6 * 1024 * 1024, files: 1, fields: 1 } });

router.param('sessionId', (req, res, next, value) => {
  try { objectId(value); next(); } catch (error) { next(error); }
});
router.get('/active', wrap(async (req, res) => {
  const session = await Session.findOne({ user: req.user.id, status: { $in: ['active', 'evaluating'] } }).lean();
  res.json({ success: true, data: session ? service.state(session) : null });
}));
router.post('/', wrap(async (req, res) => {
  const result = await service.create(req.user.id, req.body);
  res.status(result.created ? 201 : 409).json({ success: result.created, error: result.created ? undefined : 'ACTIVE_SESSION_EXISTS', data: result.session });
}));
router.get('/:sessionId/state', wrap(async (req, res) => {
  res.json({ success: true, data: await service.ensureQuestion(req.params.sessionId, req.user.id) });
}));
router.post('/:sessionId/speech', wrap(async (req, res) => {
  const speech = require('../services/interview/speech.service');
  const prepared = await speech.prepare(req.params.sessionId, req.user.id, req.body);
  res.set('Cache-Control', 'no-store');
  res.set('Access-Control-Expose-Headers', 'X-Interviewer-Text, X-Interviewer-Voice, X-Speech-Kind');
  res.set('X-Interviewer-Text', encodeURIComponent(prepared.text));
  res.set('X-Interviewer-Voice', prepared.voice);
  res.set('X-Speech-Kind', prepared.kind);
  const wav = await speech.audio(prepared);
  res.type('audio/wav').send(wav);
}));
const transcription = require('../services/interview/transcription.service');
const answerAudioUpload = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: transcription.MAX_AUDIO_BYTES, files: 1, fields: 2, fieldSize: 40, parts: 3 } });
router.post('/:sessionId/transcribe', (req, res, next) => {
  service.owned(req.params.sessionId, req.user.id).then(() => next(), next);
}, answerAudioUpload.single('audio'), wrap(async (req, res) => {
  const controller = new AbortController();
  const disconnected = () => { if (!res.writableEnded) controller.abort(); };
  res.on('close', disconnected);
  try {
    const data = await transcription.transcription(req.params.sessionId, req.user.id, req.body, req.file, controller.signal);
    if (!res.destroyed) res.set('Cache-Control', 'no-store').json({ success: true, data });
  } finally { res.removeListener('close', disconnected); }
}));
router.post('/:sessionId/turn', wrap(async (req, res) => {
  res.json({ success: true, data: await service.submitTurn(req.params.sessionId, req.user.id, req.body) });
}));
router.post('/:sessionId/complete', wrap(async (req, res) => {
  res.status(202).json({ success: true, data: await service.complete(req.params.sessionId, req.user.id) });
}));
router.post('/:sessionId/retry-evaluation', require('../middlewares/quota.middleware').quota('report retries', 20), wrap(async (req, res) => {
  await service.owned(req.params.sessionId, req.user.id);
  await Session.updateOne({ _id: req.params.sessionId, user: req.user.id, status: 'evaluating', evaluationStatus: 'failed' }, {
    $set: { evaluationStatus: 'pending', evaluationError: '' },
  });
  res.status(202).json({ success: true, data: service.state(await service.owned(req.params.sessionId, req.user.id)) });
}));
router.post('/:sessionId/abandon', wrap(async (req, res) => {
  const session = await service.owned(req.params.sessionId, req.user.id);
  if (session.status === 'evaluating' && session.evaluationStatus !== 'failed') fail('Wait for report generation before discarding this session.', 409);
  if (session.status === 'completed') fail('Delete the completed interview from its report.', 409);
  await Session.updateOne({ _id: session._id, user: req.user.id, status: { $in: ['active', 'evaluating'] } }, { $set: { status: 'abandoned', leaseToken: null } });
  await media.deleteSessionRecordings(session._id);
  await Session.deleteOne({ _id: session._id, user: req.user.id, status: 'abandoned' });
  res.json({ success: true });
}));
router.post('/:sessionId/recordings/:segmentId/:seq', (req, res, next) => {
  service.owned(req.params.sessionId, req.user.id).then(() => next(), next);
}, chunkUpload.single('chunk'), wrap(async (req, res) => {
  await media.uploadChunk(req.params.sessionId, req.user.id, req.params.segmentId, req.params.seq, req.file, req.body.mimeType);
  res.json({ success: true });
}));
module.exports = router;
