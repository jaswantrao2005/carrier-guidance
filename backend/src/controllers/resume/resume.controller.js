const fs = require("fs");
const Resume = require("../../models/Resume");
const { extractResumeText } = require("../../services/resume/resume.service");
const { analyzeResume } = require("../../services/gemini/career.service");

const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No resume uploaded",
      });
    }

    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated user information is missing",
      });
    }

    let resumeText = "";

    try {
      resumeText = await extractResumeText(req.file.path);
    } catch (error) {
      console.error("PDF Parsing Error Details:", error);
      const invalidPdfError = new Error("Unable to read the uploaded PDF. Please ensure it is a valid PDF file.");
      invalidPdfError.statusCode = 400;
      throw invalidPdfError;
    }

    if (!resumeText || resumeText.trim().length < 20) {
      const emptyPdfError = new Error("The uploaded PDF appears to be empty or unreadable.");
      emptyPdfError.statusCode = 400;
      throw emptyPdfError;
    }

    let analysis = {};

    try {
      analysis = await analyzeResume(resumeText);
    } catch (error) {
      const aiError = new Error("Resume analysis failed. Please try again later.");
      aiError.statusCode = 502;
      throw aiError;
    }

    const resume = await Resume.create({
      user: userId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      resumeText,
      analysis,
    });

    res.status(201).json({
      success: true,
      message: "Resume uploaded and analyzed successfully",
      resume: {
        ...resume.toObject(),
        analysis,
      },
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    next(error);
  }
};

const getUserResumeHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;

    const resumes = await Resume.find({ user: userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: resumes.length,
      resumes,
    });
  } catch (error) {
    next(error);
  }
};

const getResumeById = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const resume = await Resume.findOne({ _id: req.params.id, user: userId });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    res.status(200).json({
      success: true,
      resume,
    });
  } catch (error) {
    next(error);
  }
};

const deleteResume = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const resume = await Resume.findOneAndDelete({ _id: req.params.id, user: userId });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    if (resume.path && fs.existsSync(resume.path)) {
      fs.unlinkSync(resume.path);
    }

    res.status(200).json({
      success: true,
      message: "Resume deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadResume,
  getUserResumeHistory,
  getResumeById,
  deleteResume,
};