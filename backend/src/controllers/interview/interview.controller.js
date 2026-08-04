const { generateNextQuestion, generateEvaluationReport } = require("../../services/gemini/interview.service");
const Interview = require("../../models/Interview");
const Resume = require("../../models/Resume");

/**
 * Controller to fetch the next interview question adaptively.
 */
const getNextQuestion = async (req, res, next) => {
  try {
    const { role, history } = req.body;

    if (!role) {
      return res.status(400).json({ success: false, error: "Role is required." });
    }

    // Try fetching the latest resume analysis for the user to provide context
    let resumeContext = null;
    try {
      const latestResume = await Resume.findOne({ user: req.user.id }).sort({ createdAt: -1 });
      if (latestResume && latestResume.analysis) {
        resumeContext = latestResume.analysis;
      }
    } catch (err) {
      console.warn("Could not retrieve resume context for interview:", err.message);
    }

    const nextQuestionData = await generateNextQuestion(role, history || [], resumeContext);

    res.status(200).json({
      success: true,
      data: nextQuestionData,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to finalize and save a completed interview session.
 */
const completeInterview = async (req, res, next) => {
  try {
    const { role, history } = req.body;

    if (!role || !history || !Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ success: false, error: "Role and valid history are required." });
    }

    // Generate comprehensive evaluation report using Gemini
    const evaluationData = await generateEvaluationReport(role, history);

    // Save mock interview session to the database
    const newInterview = await Interview.create({
      user: req.user.id,
      role,
      transcript: evaluationData.transcript,
      overallScore: evaluationData.overallScore,
      categoryScores: evaluationData.categoryScores,
      strongAreas: evaluationData.strongAreas,
      weakAreas: evaluationData.weakAreas,
      techGaps: evaluationData.techGaps,
      communicationFeedback: evaluationData.communicationFeedback,
      roadmap: evaluationData.roadmap,
    });

    res.status(201).json({
      success: true,
      message: "Interview evaluated and saved successfully.",
      data: newInterview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to fetch all past interview sessions for the logged-in user.
 */
const getInterviewHistory = async (req, res, next) => {
  try {
    const history = await Interview.find({ user: req.user.id })
      .select("role overallScore categoryScores createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to fetch a specific interview performance report.
 */
const getInterviewById = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user.id });

    if (!interview) {
      return res.status(404).json({ success: false, error: "Interview session not found." });
    }

    res.status(200).json({
      success: true,
      data: interview,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNextQuestion,
  completeInterview,
  getInterviewHistory,
  getInterviewById,
};
