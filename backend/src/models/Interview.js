const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', index: true },
    consent: mongoose.Schema.Types.Mixed,
    presenceReview: mongoose.Schema.Types.Mixed,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    interviewType: {
      type: String,
      enum: [
        'HR Interview', 'Technical Interview', 'Personal Interview (PI)',
        'Managerial Interview', 'Behavioral Interview', 'Case Interview',
        'Group Interview', 'Panel Interview', 'Coding / Programming Interview',
        'Situational Interview', 'Final Interview', 'Overall Interview'
      ],
      default: 'Overall Interview'
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resume'
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
    // Recording & Integrity Fields
    recordingConsent: {
      type: Boolean,
      default: false,
    },
    recordingUrl: {
      type: String,
      default: null,
    },
    recordingDuration: {
      type: Number,
      default: 0,
    },
    integrityStatus: {
      type: String,
      enum: ['Clean', 'Warnings', 'Terminated'],
    },
    integrityWarningsCount: {
      type: Number,
      default: 0,
    },
    integrityEvents: [
      {
        type: { type: String, required: true },
        timestamp: { type: Number, required: true },
        description: { type: String },
        severity: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
      }
    ],
    // Experience Fields
    experienceLevel: {
      type: String,
      enum: ['fresher', 'experienced'],
      default: 'fresher'
    },
    totalExperienceYears: {
      type: Number,
      default: 0
    },
    employmentHistory: [
      {
        companyName: String,
        position: String,
        durationYears: Number
      }
    ],
    // Coding Interview Fields
    codingData: {
      language: { type: String, default: 'javascript' },
      codingQuestions: [
        {
          questionText: String,
          testCases: [
            { input: String, expectedOutput: String }
          ]
        }
      ],
      codingSubmissions: [
        {
          code: String,
          timestamp: Number,
          passed: Boolean,
          output: String
        }
      ]
    }
  },
  {
    timestamps: true,
  }
);

// Supports GET /interview/history: find({user}).sort({createdAt:-1})
interviewSchema.index({ user: 1, createdAt: -1 });

const Interview = mongoose.model('Interview', interviewSchema);

module.exports = Interview;
