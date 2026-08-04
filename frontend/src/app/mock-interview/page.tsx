"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/features/auth/AuthContext';
import apiClient from '@/features/api/client';
import { InterviewRoom } from '@/components/ui/InterviewRoom';
import { Button } from '@/components/ui/Button';
import { Calendar, Play, FileText, ChevronRight, Sparkles, Award, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function MockInterviewPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [history, setHistory] = useState<any[]>([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('Software Engineer');
  const [customRole, setCustomRole] = useState<string>('');
  const [isInterviewing, setIsInterviewing] = useState<boolean>(false);

  const roles = [
    'Software Engineer',
    'Frontend Developer',
    'Backend Developer',
    'Full-Stack Developer',
    'AI/ML Engineer',
    'Data Scientist',
    'Data Analyst',
    'Cybersecurity',
    'DevOps / Cloud',
    'Product Management',
    'Custom Role'
  ];

  // Route protection
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const response = await apiClient.get('/interview/history');
        if (response.data.success) {
          setHistory(response.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch interview history:", err);
      } finally {
        setIsFetchingHistory(false);
      }
    };
    fetchHistory();
  }, [user]);

  const handleStartInterview = () => {
    setIsInterviewing(true);
  };

  const handleFinishInterview = (reportId: string) => {
    setIsInterviewing(false);
    router.push(`/mock-interview/report/${reportId}`);
  };

  if (isLoading || (!isLoading && !user)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  // Active Interview Session Overlay
  if (isInterviewing) {
    const roleToUse = selectedRole === 'Custom Role' ? (customRole || 'Software Engineer') : selectedRole;
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 py-10">
        <InterviewRoom
          role={roleToUse}
          onFinish={handleFinishInterview}
          onCancel={() => setIsInterviewing(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="mb-10 text-center lg:text-left">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
            Practice Interviews. Improve. Get Job-Ready.
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Practice mock interviews with our interactive AI voice interviewer and receive detailed evaluation feedback.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Columns: Selection and Setup */}
          <div className="lg:col-span-2 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl bg-white/60 dark:bg-slate-900/60"
            >
              <h2 className="text-xl font-bold text-slate-900 dark:text-white font-heading mb-6 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-500" />
                Configure Your Mock Interview
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                    Which role/domain would you like to interview for?
                  </label>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {roles.map(roleOption => (
                      <button
                        key={roleOption}
                        onClick={() => setSelectedRole(roleOption)}
                        className={`p-3 rounded-xl border text-sm font-semibold transition-all text-center ${
                          selectedRole === roleOption
                            ? 'bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/20'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {roleOption}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedRole === 'Custom Role' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Specify Custom Dream Role
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Solution Architect, Analytics Manager"
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
                    />
                  </motion.div>
                )}

                <div className="pt-4">
                  <Button
                    onClick={handleStartInterview}
                    disabled={selectedRole === 'Custom Role' && !customRole.trim()}
                    className="w-full sm:w-auto h-12 px-8 rounded-xl shadow-lg shadow-primary-500/20"
                  >
                    <Play className="w-4 h-4 mr-2 fill-white" />
                    Start Interview
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Past History */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="glass rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl sticky top-24 bg-white/60 dark:bg-slate-900/60"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 font-heading flex items-center gap-2">
                <Award className="w-5 h-5 text-primary-500" />
                Interview History
              </h2>

              {isFetchingHistory ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium">No previous interviews found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map(item => (
                    <Link href={`/mock-interview/report/${item._id}`} key={item._id}>
                      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 hover:border-primary-400 dark:hover:border-primary-600 transition-all cursor-pointer group flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors">
                            {item.role}
                          </span>
                          <div className="flex items-center text-[10px] text-slate-500 dark:text-slate-400">
                            <Calendar className="w-3 h-3 mr-1" />
                            {new Date(item.createdAt).toLocaleDateString(undefined, { 
                              year: 'numeric', month: 'short', day: 'numeric' 
                            })}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded border border-primary-500/20">
                            {item.overallScore}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

        </div>

      </div>
    </div>
  );
}
