"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FileUpload } from '@/components/ui/FileUpload';
import { useAuth } from '@/features/auth/AuthContext';
import apiClient from '@/features/api/client';
import { Sparkles, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ResumeUploadPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Route protection
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setGlobalError(null);

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const response = await apiClient.post('resume/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        // Upload and analysis complete!
        // We'll redirect to the dashboard to view the results (Step 4)
        router.push('/dashboard');
      } else {
        setGlobalError('Upload succeeded, but the response indicated an error.');
        setIsUploading(false);
      }
    } catch (error: any) {
      console.error('Upload Error:', error);
      setGlobalError(
        error.response?.data?.message || 'Failed to upload and analyze the resume. Please try again.'
      );
      setIsUploading(false);
    }
  };

  // Show a loading state while checking authentication
  if (isLoading || (!isLoading && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Aesthetic Background Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] right-[5%] w-[40%] h-[40%] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-[20%] left-[5%] w-[30%] h-[30%] rounded-full bg-primary-500/10 blur-[100px]" />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 relative z-10">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors mb-12"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-medium text-sm mb-6 border border-primary-200 dark:border-primary-800/50 shadow-sm">
            <Sparkles className="w-4 h-4 mr-2" />
            AI-Powered Analysis
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-4">
            Unlock your career potential
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Upload your resume to receive an instant ATS score, missing skills gap analysis, and tailored career role recommendations powered by Gemini.
          </p>
        </motion.div>

        {globalError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto mb-8 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-900/50 text-center font-medium shadow-sm"
          >
            {globalError}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative"
        >
          {/* A soft glow behind the uploader */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-violet-600 rounded-3xl blur opacity-20 dark:opacity-30"></div>
          
          <div className="relative glass rounded-3xl p-6 md:p-10 shadow-xl">
            <FileUpload 
              onUpload={handleFileUpload} 
              isLoading={isUploading} 
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
