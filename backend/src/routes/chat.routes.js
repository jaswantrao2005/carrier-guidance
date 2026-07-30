const express = require("express");
const router = express.Router();
const { getRoadmap } = require("../controllers/chat/chat.controller");
const { protect } = require("../middlewares/auth.middleware");

// POST /api/chat/roadmap
router.post("/roadmap", protect, getRoadmap);

module.exports = router;
