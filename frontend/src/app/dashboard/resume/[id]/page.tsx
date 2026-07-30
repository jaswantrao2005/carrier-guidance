"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthContext';
import apiClient from '@/features/api/client';
import { ATSGauge } from '@/components/ui/ATSGauge';
import { SkillTag } from '@/components/ui/SkillTag';
import { RoadmapChatbot } from '@/components/ui/RoadmapChatbot';
import { ArrowLeft, Loader2, Calendar, FileText, ArrowRight } from 'lucide-react';

export default function ResumeDetailPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const resumeId = params.id;

  const [resume, setResume] = useState<any>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login');
    }
  }, [user, isAuthLoading, router]);

  useEffect(() => {
    const fetchResume = async () => {
      if (!user || !resumeId) return;
      try {
        const response = await apiClient.get(`/resume/${resumeId}`);
        if (response.data.success) {
          setResume(response.data.resume);
        } else {
          setError('Failed to load resume details.');
        }
      } catch (err: any) {
        console.error("Failed to fetch resume:", err);
        setError(err.response?.data?.message || 'Resume not found.');
      } finally {
        setIsFetching(false);
      }
    };
    fetchResume();
  }, [user, resumeId]);

  if (isAuthLoading || (isFetching && user)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  if (error || !resume) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Oops!</h2>
        <p className="text-slate-500 mb-6">{error || 'Something went wrong.'}</p>
        <Link href="/dashboard" className="text-primary-600 font-medium hover:underline flex items-center">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 dark:bg-slate-950 py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        <Link 
          href="/dashboard" 
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-heading flex items-center">
            <FileText className="w-8 h-8 text-primary-500 mr-3" />
            {resume.originalName}
          </h1>
          <div className="flex items-center mt-3 text-slate-500 dark:text-slate-400">
            <Calendar className="w-4 h-4 mr-2" />
            Uploaded on {new Date(resume.createdAt).toLocaleDateString(undefined, { 
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </div>
        </div>

        <div className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 mb-8">
              <div className="flex-shrink-0">
                <ATSGauge score={resume.analysis.atsScore} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-heading">
                  Candidate Summary
                </h2>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {resume.analysis.candidateSummary}
                </p>
              </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800 mb-8" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Technical Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {resume.analysis.technicalSkills.map((s: string, i: number) => (
                    <SkillTag key={i} skill={s} type="technical" />
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Soft Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {resume.analysis.softSkills.map((s: string, i: number) => (
                    <SkillTag key={i} skill={s} type="soft" />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Missing Skills (Growth Areas)</h3>
              <div className="flex flex-wrap gap-2">
                {resume.analysis.missingSkills.length > 0 ? (
                  resume.analysis.missingSkills.map((s: string, i: number) => (
                    <SkillTag key={i} skill={s} type="missing" />
                  ))
                ) : (
                  <span className="text-sm text-slate-500">No major missing skills identified for this profile.</span>
                )}
              </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Improvement Suggestions</h3>
              <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300">
                {resume.analysis.suggestions.map((s: string, i: number) => (
                  <li key={i} className="leading-relaxed">{s}</li>
                ))}
              </ul>
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
                {resume.analysis.careerRoles.map((role: string, i: number) => (
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
              <RoadmapChatbot resumeContext={resume.analysis} />
            </motion.div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
