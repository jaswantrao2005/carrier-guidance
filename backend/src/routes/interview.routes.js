const express = require("express");
const router = express.Router();
const { getNextQuestion, completeInterview, getInterviewHistory, getInterviewById } = require("../controllers/interview/interview.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// All routes are protected by authMiddleware
router.use(authMiddleware);

router.post("/next-question", getNextQuestion);
router.post("/complete", completeInterview);
router.get("/history", getInterviewHistory);
router.get("/:id", getInterviewById);

module.exports = router;
