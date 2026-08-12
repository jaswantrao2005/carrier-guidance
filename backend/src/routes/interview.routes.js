const express = require("express");
const router = express.Router();
const multer = require("multer");
const { 
  getNextQuestion, 
  completeInterview, 
  getInterviewHistory, 
  getInterviewById,
  getCompanyResearchData,
  parseJobDescriptionFile,
  uploadVideo,
  runCode,
  submitCode
} = require("../controllers/interview/interview.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const videoUpload = require("../middlewares/video.middleware");

// Configure memory storage for job description document parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// All routes are protected by authMiddleware
router.use(authMiddleware);

router.post("/next-question", getNextQuestion);
router.post("/complete", completeInterview);
router.get("/history", getInterviewHistory);
router.post("/research", getCompanyResearchData);
router.post("/upload-jd", upload.single("file"), parseJobDescriptionFile);
router.get("/:id", getInterviewById);
router.post("/:id/recording", videoUpload.single("video"), uploadVideo);
router.post("/code/run", runCode);
router.post("/code/submit", submitCode);

module.exports = router;
