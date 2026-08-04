"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthContext';
import apiClient from '@/features/api/client';
import { InterviewReport } from '@/components/ui/InterviewReport';
import { Loader2 } from 'lucide-react';

export default function MockInterviewReportPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const reportId = params.id;

  const [report, setReport] = useState<any>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Route protection
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    const fetchReport = async () => {
      if (!user || !reportId) return;
      try {
        const response = await apiClient.get(`/interview/${reportId}`);
        if (response.data.success) {
          setReport(response.data.data);
        } else {
          setError("Failed to locate interview report data.");
        }
      } catch (err) {
        console.error("Failed to fetch report:", err);
        setError("Interview performance report not found.");
      } finally {
        setIsFetching(false);
      }
    };
    fetchReport();
  }, [user, reportId]);

  if (isLoading || (isFetching && user)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Loading interview performance analysis...</span>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-950">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Error</h2>
        <p className="text-slate-500 mb-6">{error || 'Something went wrong.'}</p>
        <button
          onClick={() => router.push('/mock-interview')}
          className="px-6 py-2.5 rounded-xl font-semibold bg-primary-500 text-white hover:bg-primary-600 transition-colors shadow-sm"
        >
          Back to Interviews
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 py-10">
      <InterviewReport
        report={report}
        onBack={() => router.push('/mock-interview')}
      />
    </div>
  );
}
