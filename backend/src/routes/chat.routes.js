const express = require("express");
const router = express.Router();
const { getRoadmap } = require("../controllers/chat/chat.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// POST /api/chat/roadmap
router.post("/roadmap", authMiddleware, require('../middlewares/quota.middleware').quota('mentor messages', 100), getRoadmap);

module.exports = router;
