"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, MessageSquare, TrendingUp, Lightbulb, ChevronDown, ChevronUp, BookOpen, UserCheck } from 'lucide-react';

interface TranscriptItem {
  question: string;
  answer: string;
  category: string;
  difficulty: string;
  evaluation: {
    good: string;
    bad: string;
    improved: string;
  };
}

interface InterviewReportProps {
  report: {
    role: string;
    overallScore: number;
    categoryScores: {
      communication: number;
      technicalKnowledge: number;
      problemSolving: number;
      confidence: number;
      resumeKnowledge: number;
      behavioral: number;
      roleReadiness: number;
    };
    strongAreas: string[];
    weakAreas: string[];
    techGaps: string[];
    communicationFeedback: string;
    roadmap: {
      conceptsToRevise: string[];
      practiceTopics: string[];
      suggestedNextSteps: string[];
    };
    transcript: TranscriptItem[];
    createdAt: string;
  };
  onBack: () => void;
}

export const InterviewReport: React.FC<InterviewReportProps> = ({ report, onBack }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleAccordion = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/25';
    if (score >= 60) return 'text-amber-500 bg-amber-500/10 border-amber-500/25';
    return 'text-red-500 bg-red-500/10 border-red-500/25';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const scoreLabels: Record<string, string> = {
    communication: "Communication Skills",
    technicalKnowledge: "Technical Knowledge",
    problemSolving: "Problem Solving",
    confidence: "Confidence & Clarity",
    resumeKnowledge: "Resume & Experience Alignment",
    behavioral: "Behavioral / HR Scenarios",
    roleReadiness: "Overall Role Readiness"
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 relative z-10 space-y-8">
      
      {/* Back Button */}
      <button
        onClick={onBack}
        className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm"
      >
        &larr; Back to Interviews
      </button>

      {/* Hero Performance Banner */}
      <div className="glass rounded-3xl p-6 sm:p-10 border border-slate-200 dark:border-slate-800 shadow-xl bg-white/60 dark:bg-slate-900/60 flex flex-col md:flex-row items-center gap-8">
        <div className="relative shrink-0 flex items-center justify-center">
          {/* Circular Score Visualizer */}
          <div className="w-36 h-36 rounded-full border-8 border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/60 shadow-inner">
            <span className="text-4xl font-extrabold font-heading text-primary-500">{report.overallScore}</span>
            <span className="text-xs font-bold text-slate-400 mt-0.5">/ 100</span>
          </div>
        </div>

        <div className="flex-1 text-center md:text-left space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-primary-500 bg-primary-500/10 px-3 py-1 rounded-full border border-primary-500/20">
            Mock Interview Report
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
            {report.role} Candidate Assessment
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Completed on {new Date(report.createdAt).toLocaleDateString(undefined, {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </p>
        </div>
      </div>

      {/* Category Scores & Communication Feedback */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Category Scores */}
        <div className="glass rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl bg-white/60 dark:bg-slate-900/60">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white font-heading mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-500" />
            Category Evaluations
          </h2>
          
          <div className="space-y-5">
            {Object.entries(report.categoryScores).map(([key, score]) => (
              <div key={key} className="space-y-2">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">{scoreLabels[key] || key}</span>
                  <span className="text-slate-900 dark:text-white">{score}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full rounded-full ${getProgressColor(score)}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Qualitative Communication Feedback */}
        <div className="glass rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl bg-white/60 dark:bg-slate-900/60 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-heading mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary-500" />
              Communication Audit
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
              {report.communicationFeedback}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Key Strengths</h4>
              <ul className="text-xs space-y-1.5 list-disc pl-4 text-slate-700 dark:text-slate-300">
                {report.strongAreas.slice(0, 3).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Key Weaknesses</h4>
              <ul className="text-xs space-y-1.5 list-disc pl-4 text-slate-700 dark:text-slate-300">
                {report.weakAreas.slice(0, 3).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

      </div>

      {/* Question by Question Review */}
      <div className="glass rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl bg-white/60 dark:bg-slate-900/60">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white font-heading mb-6 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary-500" />
          Question-by-Question Coaching
        </h2>

        <div className="space-y-4">
          {report.transcript.map((item, idx) => (
            <div key={idx} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950/40">
              
              {/* Header Toggle */}
              <button
                onClick={() => toggleAccordion(idx)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3 pr-4">
                  <span className="text-xs font-bold text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full shrink-0">
                    Q{idx + 1}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm sm:text-base line-clamp-1">
                    {item.question}
                  </span>
                </div>
                {expandedIndex === idx ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>

              {/* Accordion Content */}
              {expandedIndex === idx && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Your Answer</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                      "{item.answer || "[No response transcripted]"}"
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-0.5">What was good</h5>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{item.evaluation.good}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 flex gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-0.5">What could be improved</h5>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{item.evaluation.bad}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-primary-500/5 border border-primary-500/10 flex gap-2">
                    <Lightbulb className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-bold text-primary-500 uppercase tracking-wider mb-0.5">Better Response Approach</h5>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{item.evaluation.improved}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Improvement Roadmap */}
      <div className="glass rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl bg-white/60 dark:bg-slate-900/60">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white font-heading mb-6 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-primary-500" />
          Personalized Mock Interview Roadmap
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">
              Concepts to Revise
            </h3>
            <ul className="text-sm space-y-2 list-disc pl-4 text-slate-700 dark:text-slate-300">
              {report.roadmap.conceptsToRevise.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">
              Topics to Practice
            </h3>
            <ul className="text-sm space-y-2 list-disc pl-4 text-slate-700 dark:text-slate-300">
              {report.roadmap.practiceTopics.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">
              Next Action Steps
            </h3>
            <ul className="text-sm space-y-2 list-disc pl-4 text-slate-700 dark:text-slate-300">
              {report.roadmap.suggestedNextSteps.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
};
