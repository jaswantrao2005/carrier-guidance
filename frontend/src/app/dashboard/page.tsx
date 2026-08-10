"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import apiClient from '@/features/api/client';
import { ATSGauge } from '@/components/ui/ATSGauge';
import { SkillTag } from '@/components/ui/SkillTag';
import { Button } from '@/components/ui/Button';
import { RoadmapChatbot } from '@/components/ui/RoadmapChatbot';
import { FileText, Calendar, ArrowRight, Loader2, Plus } from 'lucide-react';

export default function DashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [resumes, setResumes] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    }
  }, [user, isAuthLoading, router]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const response = await apiClient.get('resume/history');
        if (response.data.success) {
          setResumes(response.data.resumes);
        }
      } catch (error) {
        console.error("Failed to fetch resume history:", error);
      } finally {
        setIsFetching(false);
      }
    };
    fetchHistory();
  }, [user]);

  if (isAuthLoading || (isFetching && user)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const hasResumes = resumes.length > 0;
  const latestResume = hasResumes ? resumes[0] : null;

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-heading">
              Welcome back, {user.name.split(' ')[0]}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Here is your latest career analysis and history.
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Link href="/resume-upload">
              <Button className="rounded-xl shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Upload New Resume
              </Button>
            </Link>
          </div>
        </div>

        {!hasResumes ? (
          /* Empty State */
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center max-w-2xl mx-auto mt-16"
          >
            <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/30 text-primary-500 rounded-full flex items-center justify-center mb-6">
              <FileText className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">No resumes uploaded yet</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md">
              Upload your first resume to get a comprehensive AI analysis, including your ATS score and personalized career role recommendations.
            </p>
            <Link href="/resume-upload">
              <Button size="lg" className="rounded-xl">
                Upload Resume Now
              </Button>
            </Link>
          </motion.div>
        ) : (
          /* Main Dashboard Content */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Latest Analysis */}
            <div className="lg:col-span-2 space-y-8">
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm"
              >
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-8">
                  <div className="flex-shrink-0">
                    <ATSGauge score={latestResume.analysis.atsScore} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-heading">
                      Candidate Summary
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {latestResume.analysis.candidateSummary}
                    </p>
                  </div>
                </div>

                <hr className="border-slate-200 dark:border-slate-800 mb-8" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Technical Skills */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Technical Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {latestResume.analysis.technicalSkills.map((s: string, i: number) => (
                        <SkillTag key={i} skill={s} type="technical" />
                      ))}
                    </div>
                  </div>
                  
                  {/* Soft Skills */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Soft Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {latestResume.analysis.softSkills.map((s: string, i: number) => (
                        <SkillTag key={i} skill={s} type="soft" />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Missing Skills (Growth Areas)</h3>
                  <div className="flex flex-wrap gap-2">
                    {latestResume.analysis.missingSkills.length > 0 ? (
                      latestResume.analysis.missingSkills.map((s: string, i: number) => (
                        <SkillTag key={i} skill={s} type="missing" />
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">Your profile is highly comprehensive for your target roles!</span>
                    )}
                  </div>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-full"
                >
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 font-heading">
                    AI Recommended Roles
                  </h2>
                  <div className="grid grid-cols-1 gap-4 flex-1">
                    {latestResume.analysis.careerRoles.map((role: string, i: number) => (
                      <div key={i} className="flex items-center p-4 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center mr-4 shrink-0">
                          <ArrowRight className="w-5 h-5" />
                        </div>
                        <span className="font-medium text-slate-800 dark:text-slate-200">{role}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="h-[500px]"
                >
                  <RoadmapChatbot resumeContext={latestResume.analysis} />
                </motion.div>
              </div>
            </div>

            {/* Right Column: History */}
            <div className="lg:col-span-1">
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="glass rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm sticky top-24"
              >
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 font-heading">
                  Analysis History
                </h2>
                <div className="space-y-4">
                  {resumes.map((resume, idx) => (
                    <Link href={`/dashboard/resume/${resume._id}`} key={resume._id}>
                      <div className={`p-4 rounded-2xl border transition-all hover:shadow-md cursor-pointer ${
                        idx === 0 
                          ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10' 
                          : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/30 hover:border-primary-300 dark:hover:border-primary-700'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate pr-2">
                            {resume.originalName}
                          </span>
                          {idx === 0 && (
                            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                              Latest
                            </span>
                          )}
                        </div>
                        <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                          <Calendar className="w-3.5 h-3.5 mr-1" />
                          {new Date(resume.createdAt).toLocaleDateString(undefined, { 
                            year: 'numeric', month: 'short', day: 'numeric' 
                          })}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.div>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}
