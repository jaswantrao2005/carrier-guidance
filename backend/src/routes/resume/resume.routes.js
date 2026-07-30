const express = require("express");
const router = express.Router();

const upload = require("../../middlewares/upload.middleware");
const authMiddleware = require("../../middlewares/auth.middleware");

const {
  uploadResume,
  getUserResumeHistory,
  getResumeById,
  deleteResume,
} = require("../../controllers/resume/resume.controller");

const handleResumeUpload = (req, res, next) => {
  upload.single("resume")(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          error: "File too large. Maximum size is 5MB.",
        });
      }

      return res.status(400).json({
        success: false,
        error: error.message || "Invalid file upload",
      });
    }

    next();
  });
};

router.post("/upload", authMiddleware, handleResumeUpload, uploadResume);
router.get("/history", authMiddleware, getUserResumeHistory);
router.get("/:id", authMiddleware, getResumeById);
router.delete("/:id", authMiddleware, deleteResume);

module.exports = router;
