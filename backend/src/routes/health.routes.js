const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  const connected = require('mongoose').connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    success: connected,
    app: 'careerai',
    service: 'api',
    message: connected ? 'Server is ready' : 'Database is unavailable',
  });
});

router.get('/health/services', async (req, res, next) => {
  try {
    const fs = require('fs').promises;
    const { resumesDirectory, recordingsDirectory } = require('../config/storage');
    const { selectedProvider } = require('../services/ai/chat.service');
    const provider = selectedProvider();
    const database = require('mongoose').connection.readyState === 1;
    const aiConfigured = provider === 'gemini' ? Boolean(process.env.GEMINI_API_KEY?.trim()) : Boolean(process.env.GROQ_API_KEY?.trim() || process.env.GROQ_API_KEYS?.trim());
    const storage = (await Promise.allSettled([resumesDirectory, recordingsDirectory].map(directory => fs.access(directory, require('fs').constants.W_OK)))).every(result => result.status === 'fulfilled');
    let videoReachable = false;
    if (process.env.INTEGRITY_SERVICE_URL) {
      try {
        const response = await fetch(`${process.env.INTEGRITY_SERVICE_URL.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(2000) });
        videoReachable = response.ok;
      } catch { /* Optional service availability is reported separately. */ }
    }
    res.status(database && aiConfigured && storage ? 200 : 503).json({
      success: database && aiConfigured && storage,
      app: 'careerai', service: 'api',
      services: { database, storage, ai: { provider, configured: aiConfigured },
        coding: { configured: Boolean(process.env.JUDGE0_URL || process.env.JUDGE0_API_KEY) },
        videoReview: { configured: Boolean(process.env.INTEGRITY_SERVICE_URL), reachable: videoReachable } },
    });
  } catch (error) { next(error); }
});

module.exports = router;
