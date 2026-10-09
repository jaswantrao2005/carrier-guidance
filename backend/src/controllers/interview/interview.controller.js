const { researchCompany } = require("../../services/search/research.service");
const Interview = require("../../models/Interview");
const pdfParse = require("pdf-parse-new");
const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");

/**
 * Controller to fetch all past interview sessions for the logged-in user.
 */
const getInterviewHistory = async (req, res, next) => {
  try {
    const history = await Interview.find({ user: req.user.id })
      .select("role companyName overallScore jobMatchScore categoryScores interviewType createdAt")
      .sort({ createdAt: -1 }).limit(100);

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
    if (typeof companyName !== 'string' || !companyName.trim() || companyName.length > 150) {
      return res.status(400).json({ success: false, error: "Company name is required." });
    }

    const researchResult = await researchCompany(companyName);
    if (researchResult.success) {
      await require('../../models/CompanyResearch').findOneAndUpdate({ user: req.user.id, companyName: companyName.trim().toLowerCase() }, {
        $set: { data: researchResult.data, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      }, { upsert: true, runValidators: true });
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

    if (!extractedText.trim()) return res.status(400).json({ success: false, error: 'This document has no readable text.' });
    if (extractedText.length > 20000) return res.status(400).json({ success: false, error: 'Job description must be at most 20,000 characters.' });
    res.status(200).json({ success: true, text: extractedText.trim() });
  } catch (error) {
    next(error);
  }
};

/**
 * Stream an interview recording to its OWNER only.
 * Replaces the removed unauthenticated `/uploads` static route.
 * Returns 404 (not 403) for someone else's interview so existence is not confirmed.
 */
const getRecording = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user.id });
    if (!interview || !interview.recordingUrl) {
      return res.status(404).json({ success: false, error: "Recording not found." });
    }

    // recordingUrl is stored as "/uploads/recordings/<file>". Resolve it inside the
    // recordings directory and refuse anything that escapes it (path traversal).
    const recordingsDir = path.resolve(__dirname, "../../../uploads/recordings");
    const filePath = path.resolve(recordingsDir, path.basename(interview.recordingUrl));
    if (!filePath.startsWith(recordingsDir + path.sep) || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: "Recording not found." });
    }

    res.setHeader("Cache-Control", "private, no-store");
    return res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};

const runCode = async (req, res, next) => {
  try {
    const { sessionId, seq, language, code } = req.body;
    require('../../validations/interview.validation').objectId(sessionId);
    const session = await require('../../services/interview/session.service').owned(sessionId, req.user.id);
    if (session.status !== 'active' || session.currentSeq !== seq || !session.currentQuestion) {
      return res.status(409).json({ success: false, error: 'Question changed. Reload your interview.' });
    }
    const result = await require('../../services/interview/coding.service').execute(language, code, session.currentQuestion.codingProblem?.id);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
};
module.exports = { runCode, getInterviewHistory, getInterviewById, getCompanyResearchData, parseJobDescriptionFile, getRecording };
