const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    resumeText: {
      type: String,
      default: '',
    },
    analysis: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Supports GET /resume/history: find({user}).sort({createdAt:-1})
resumeSchema.index({ user: 1, createdAt: -1 });

const Resume = mongoose.model('Resume', resumeSchema);

module.exports = Resume;
