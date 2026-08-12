const { generateNextQuestion, generateEvaluationReport } = require("../../services/gemini/interview.service");
const { researchCompany } = require("../../services/search/research.service");
const Interview = require("../../models/Interview");
const Resume = require("../../models/Resume");
const pdfParse = require("pdf-parse-new");
const mammoth = require("mammoth");

/**
 * Controller to fetch the next interview question adaptively.
 */
const getNextQuestion = async (req, res, next) => {
  try {
    const { role, interviewType, history, jobDescriptionText, companyResearch, experienceLevel, totalExperienceYears, employmentHistory, resumeId } = req.body;

    if (!role) {
      return res.status(400).json({ success: false, error: "Role is required." });
    }

    // Try fetching the specific resume analysis for the user to provide context
    let resumeContext = null;
    try {
      const query = resumeId ? { _id: resumeId, user: req.user.id } : { user: req.user.id };
      const resume = await Resume.findOne(query).sort({ createdAt: -1 });
      if (resume && resume.analysis) {
        resumeContext = resume.analysis;
      }
    } catch (err) {
      console.warn("Could not retrieve resume context for interview:", err.message);
    }

    const nextQuestionData = await generateNextQuestion(
      role,
      interviewType || 'Overall Interview',
      history || [],
      resumeContext,
      jobDescriptionText || '',
      companyResearch || null,
      experienceLevel || 'fresher',
      totalExperienceYears || 0,
      employmentHistory || []
    );

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
    const { 
      role, interviewType, history, jobDescriptionText, companyName, companyResearch,
      recordingConsent, integrityStatus, integrityWarningsCount, integrityEvents, recordingDuration,
      experienceLevel, totalExperienceYears, employmentHistory, resumeId, codingData
    } = req.body;

    if (!role || !history || !Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ success: false, error: "Role and valid history are required." });
    }

    const evaluationData = await generateEvaluationReport(
      role,
      interviewType || 'Overall Interview',
      history,
      jobDescriptionText || '',
      companyResearch || null,
      experienceLevel || 'fresher',
      totalExperienceYears || 0,
      employmentHistory || [],
      codingData || null
    );

    // Save mock interview session to the database
    const newInterview = await Interview.create({
      user: req.user.id,
      role,
      resumeId: resumeId || null,
      transcript: evaluationData.transcript,
      overallScore: evaluationData.overallScore,
      categoryScores: evaluationData.categoryScores,
      strongAreas: evaluationData.strongAreas,
      weakAreas: evaluationData.weakAreas,
      techGaps: evaluationData.techGaps,
      communicationFeedback: evaluationData.communicationFeedback,
      roadmap: evaluationData.roadmap,
      companyName: companyName || '',
      jobDescriptionText: jobDescriptionText || '',
      companyResearch: companyResearch || null,
      jobMatchScore: evaluationData.jobMatchScore || 0,
      jdMatchBreakdown: evaluationData.jdMatchBreakdown || { strongMatches: [], needsImprovement: [], notDemonstrated: [] },
      recordingConsent: recordingConsent || false,
      recordingDuration: recordingDuration || 0,
      integrityStatus: integrityStatus || 'Clean',
      integrityWarningsCount: integrityWarningsCount || 0,
      integrityEvents: integrityEvents || [],
      experienceLevel: experienceLevel || 'fresher',
      totalExperienceYears: totalExperienceYears || 0,
      employmentHistory: employmentHistory || [],
      interviewType: interviewType || 'Overall Interview',
      codingData: codingData || null
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
      .select("role companyName jobDescriptionText overallScore jobMatchScore categoryScores createdAt")
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

/**
 * Controller to perform company web research.
 */
const getCompanyResearchData = async (req, res, next) => {
  try {
    const { companyName } = req.body;
    if (!companyName) {
      return res.status(400).json({ success: false, error: "Company name is required." });
    }

    const researchResult = await researchCompany(companyName);
    if (researchResult.success) {
      res.status(200).json({
        success: true,
        data: researchResult.data
      });
    } else {
      res.status(200).json({
        success: false,
        error: researchResult.message || "Company research is currently unavailable."
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to parse Job Description files (PDF, TXT, DOCX).
 */
const parseJobDescriptionFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No document file was uploaded." });
    }

    const ext = req.file.originalname.split('.').pop().toLowerCase();
    let extractedText = '';

    if (ext === 'pdf') {
      const pdfData = await pdfParse(req.file.buffer);
      extractedText = pdfData.text;
    } else if (ext === 'txt') {
      extractedText = req.file.buffer.toString('utf-8');
    } else if (ext === 'docx') {
      const docData = await mammoth.extractRawText({ buffer: req.file.buffer });
      extractedText = docData.value;
    } else {
      return res.status(400).json({ success: false, error: "Unsupported file format. Please upload PDF, TXT, or DOCX." });
    }

    res.status(200).json({
      success: true,
      text: extractedText.trim()
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to upload the final video recording blob.
 */
const uploadVideo = async (req, res, next) => {
  try {
    const interviewId = req.params.id;
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No video file was uploaded." });
    }

    const interview = await Interview.findOne({ _id: interviewId, user: req.user.id });
    if (!interview) {
      return res.status(404).json({ success: false, error: "Interview not found." });
    }

    // In a real production app with S3, this would be an S3 URL.
    // For local S3-like storage, we just map it to our static route
    const recordingUrl = `/uploads/recordings/${req.file.filename}`;
    
    interview.recordingUrl = recordingUrl;
    await interview.save();

    res.status(200).json({
      success: true,
      recordingUrl
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to securely execute code in an isolated environment (Stub)
 */
const runCode = async (req, res, next) => {
  try {
    const { language, code, questionText } = req.body;
    
    // Stub implementation
    const passed = Math.random() > 0.3; // 70% pass rate stub
    
    res.status(200).json({
      success: true,
      data: {
        passed,
        output: passed ? "All test cases passed successfully." : "Test Case 3 Failed: expected [1, 2] but got [0, 1].",
        executionTimeMs: Math.floor(Math.random() * 50) + 10,
        memoryBytes: 1024 * 1024 * 5 // 5MB
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to submit the final coding solution (Stub)
 */
const submitCode = async (req, res, next) => {
  try {
    const { language, code, questionText } = req.body;
    
    // Execute final suite
    const passed = true; // Assume success for submission stub
    
    res.status(200).json({
      success: true,
      data: {
        passed,
        output: "Submission accepted. All hidden test cases passed.",
        executionTimeMs: 12,
        memoryBytes: 1024 * 1024 * 4
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNextQuestion,
  completeInterview,
  runCode,
  submitCode,
  getInterviewHistory,
  getInterviewById,
  getCompanyResearchData,
  parseJobDescriptionFile,
  uploadVideo
};
