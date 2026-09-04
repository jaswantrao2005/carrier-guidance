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
app.use(cors());
app.use(express.json());
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
