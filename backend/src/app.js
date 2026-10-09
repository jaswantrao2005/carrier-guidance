const express = require('express');
const cors = require('cors');
require('dotenv').config();

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const resumeRoutes = require('./routes/resume/resume.routes');
const chatRoutes = require('./routes/chat.routes');
const interviewRoutes = require('./routes/interview.routes');
const errorHandler = require('./middlewares/error.middleware');
const requestLogger = require('./middlewares/logger.middleware');

const path = require('path');

const app = express();

// Middleware
app.disable('x-powered-by');
const origins = (process.env.FRONTEND_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(value => value.trim());
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '512kb' }));
app.use((req, res, next) => {
  if (req.body == null) req.body = {};
  if (typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ success: false, error: 'Request body must be an object.' });
  next();
});
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  next();
});
const { rateLimit } = require('express-rate-limit');
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { success: false, error: 'Too many authentication requests. Please try again later.' } }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 150, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please wait a minute.' } }));
app.use(requestLogger);

// SECURITY: the unauthenticated static /uploads route was REMOVED.
// It exposed every candidate's resume PDF and interview video to anyone who could
// guess a filename -- no auth, no ownership check, permanently and publicly.
// Media is now served only through ownership-checked endpoints:
//   GET /api/interview/:id/recording  (see interview.controller.js)

// Root route
app.get('/', (req, res) => {
  res.send('Backend is running');
});

// Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/interview', interviewRoutes);

// Error handling middleware
app.use(errorHandler);

module.exports = app;
