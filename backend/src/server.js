require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const { startEvaluationWorker } = require('./services/interview/session.service');
const Session = require('./models/InterviewSession');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required. Configure backend/.env.');
  await connectDB();
  await Session.createIndexes();
  await require('./models/RecordingChunk').createIndexes();
  await require('fs').promises.mkdir(require('./config/storage').recordingsDirectory, { recursive: true });
  startEvaluationWorker();

  app.listen(PORT, () => {
    console.log(`Server started successfully on port ${PORT}`);
  });
};

startServer().catch(error => {
  console.error('Server startup failed:', error.message);
  process.exitCode = 1;
});
