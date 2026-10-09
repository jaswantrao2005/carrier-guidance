const express = require("express");
const router = express.Router();
const multer = require("multer");
const { 
  getInterviewHistory, 
  getInterviewById,
  getCompanyResearchData,
  parseJobDescriptionFile,
  getRecording,
  runCode
} = require("../controllers/interview/interview.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Configure memory storage for job description document parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// All routes are protected by authMiddleware
router.use(authMiddleware);
const { quota } = require('../middlewares/quota.middleware');
const media = require('../services/interview/recording.service');
const { objectId } = require('../validations/interview.validation');
const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
router.param('id', (req, res, next, value) => { try { objectId(value); next(); } catch (error) { next(error); } });
router.use('/session', require('./session.routes'));

// Session endpoints replace browser-owned history and non-idempotent completion.
router.post(['/next-question', '/complete'], (req, res) => res.status(410).json({ success: false, error: 'Use the saved interview session endpoints.' }));
router.get("/history", getInterviewHistory);
router.get('/:id/recordings', wrap(async (req, res) => {
  const { segments } = await media.listRecordings(req.params.id, req.user.id);
  res.json({ success: true, data: segments });
}));
router.get('/:id/recordings/:segmentId', wrap(async (req, res) => {
  await media.streamSegment(req.params.id, req.user.id, req.params.segmentId, res);
}));
router.delete('/:id', wrap(async (req, res) => {
  await media.deleteInterview(req.params.id, req.user.id);
  res.json({ success: true });
}));
router.post('/:id/presence-review', quota('video reviews', 10), wrap(async (req, res) => {
  const data = await require('../services/interview/integrity.service').analyzeReport(req.params.id, req.user.id);
  res.json({ success: true, data });
}));
router.post("/research", quota('company research', 30), getCompanyResearchData);
router.post("/upload-jd", upload.single("file"), parseJobDescriptionFile);
router.get("/:id", getInterviewById);
router.post("/:id/recording", wrap(async (req, res) => {
  res.status(410).json({ success: false, error: 'Use session recording chunks.' });
}));
router.get("/:id/recording", getRecording);
router.post("/code/run", quota('code executions', 50), runCode);
router.post("/code/submit", quota('code executions', 50), runCode);

module.exports = router;
