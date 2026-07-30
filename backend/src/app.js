const express = require('express');
const cors = require('cors');
require('dotenv').config();

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const resumeRoutes = require('./routes/resume/resume.routes');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Root route
app.get('/', (req, res) => {
  res.send('Backend is running');
});

// Health route
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/resume', resumeRoutes);

// Error handling middleware
app.use(errorHandler);

module.exports = app;
