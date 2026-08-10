const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    transcript: [
      {
        question: {
          type: String,
          required: true,
        },
        answer: {
          type: String,
          default: '',
        },
        category: {
          type: String,
          default: 'General',
        },
        difficulty: {
          type: String,
          default: 'Intermediate',
        },
        evaluation: {
          good: String,
          bad: String,
          improved: String,
        },
      },
    ],
    overallScore: {
      type: Number,
      default: 0,
    },
    categoryScores: {
      communication: { type: Number, default: 0 },
      technicalKnowledge: { type: Number, default: 0 },
      problemSolving: { type: Number, default: 0 },
      confidence: { type: Number, default: 0 },
      resumeKnowledge: { type: Number, default: 0 },
      behavioral: { type: Number, default: 0 },
      roleReadiness: { type: Number, default: 0 },
    },
    strongAreas: [String],
    weakAreas: [String],
    techGaps: [String],
    communicationFeedback: String,
    roadmap: {
      conceptsToRevise: [String],
      practiceTopics: [String],
      suggestedNextSteps: [String],
    },
    // Optional Company & Job Description details
    companyName: {
      type: String,
      default: '',
    },
    jobDescriptionText: {
      type: String,
      default: '',
    },
    companyResearch: {
      majorDevelopments: [String],
      keyProducts: [String],
      recentStrategy: { type: String, default: '' },
      focusAreas: [String],
    },
    jobMatchScore: {
      type: Number,
      default: 0,
    },
    jdMatchBreakdown: {
      strongMatches: [String],
      needsImprovement: [String],
      notDemonstrated: [String],
    },
  },
  {
    timestamps: true,
  }
);

const Interview = mongoose.model('Interview', interviewSchema);

module.exports = Interview;
