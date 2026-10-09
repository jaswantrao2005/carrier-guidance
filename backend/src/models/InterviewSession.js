const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['active', 'evaluating', 'completed', 'abandoned'], default: 'active' },
  setup: { type: mongoose.Schema.Types.Mixed, required: true },
  topicPlan: { type: [mongoose.Schema.Types.Mixed], default: [] },
  maxQuestions: { type: Number, required: true },
  currentSeq: { type: Number, default: 0 },
  currentQuestion: { type: mongoose.Schema.Types.Mixed, default: null },
  turns: { type: [mongoose.Schema.Types.Mixed], default: [] },
  readyToComplete: { type: Boolean, default: false },
  consent: { type: mongoose.Schema.Types.Mixed, required: true },
  deadlineAt: { type: Date, required: true },
  lastActivityAt: { type: Date, default: Date.now },
  interviewId: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
  evaluationStatus: { type: String, enum: ['pending', 'processing', 'failed', 'completed'], default: 'pending' },
  evaluationError: String,
  leaseToken: { type: String, default: null },
  leaseUntil: { type: Date, default: () => new Date(0) },
  recordingSegments: { type: [mongoose.Schema.Types.Mixed], default: [] },
  recordingBytes: { type: Number, default: 0 },
}, { timestamps: true });

sessionSchema.index({ user: 1 }, {
  unique: true,
  partialFilterExpression: { status: { $in: ['active', 'evaluating'] } },
});
sessionSchema.index({ status: 1, evaluationStatus: 1, leaseUntil: 1 });
sessionSchema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.model('InterviewSession', sessionSchema);
