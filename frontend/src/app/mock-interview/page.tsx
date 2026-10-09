"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/features/auth/AuthContext';
import apiClient from '@/features/api/client';
import type { ApiResult, InterviewSession } from '@/features/interview/types';
import { deleteLocalSession } from '@/features/interview/storage';
import { errorMessage } from '@/features/api/errors';
import axios from 'axios';
import { Button } from '@/components/ui/Button';
import { Calendar, Play, FileText, ChevronRight, Sparkles, Award, Loader2, UploadCloud, X, HelpCircle, Info, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface ResearchBrief {
  majorDevelopments: string[];
  keyProducts: string[];
  recentStrategy: string;
  focusAreas: string[];
  sources?: string[];
  retrievedAt?: string;
}

const aiProviderName = process.env.NEXT_PUBLIC_AI_PROVIDER === 'groq' ? 'Groq' : 'Gemini';

export default function MockInterviewPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [history, setHistory] = useState<any[]>([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('Software Engineer');
  const [customRole, setCustomRole] = useState<string>('');
  
  // Interview Type state
  const [interviewType, setInterviewType] = useState<string>('Overall Interview');
  const [durationPreset, setDurationPreset] = useState<string>('standard');
  
  // Resume Selection state
  const [resumes, setResumes] = useState<any[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [isUploadingResume, setIsUploadingResume] = useState<boolean>(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  
  // Job Description state
  const [jobDescriptionText, setJobDescriptionText] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: string; text?: string; name: string; size: number; status: 'uploading' | 'success' | 'error'; error?: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Company details state
  const [companyName, setCompanyName] = useState<string>('');
  
  // Research brief state
  const [isResearching, setIsResearching] = useState<boolean>(false);
  const [researchBrief, setResearchBrief] = useState<ResearchBrief | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [showBriefScreen, setShowBriefScreen] = useState<boolean>(false);
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null);
  const [launching, setLaunching] = useState(false);
  const launchInFlight = useRef(false);
  const [setupError, setSetupError] = useState('');
  const [storeTranscript, setStoreTranscript] = useState(false);
  const [recordAudio, setRecordAudio] = useState(false);
  const [recordVideo, setRecordVideo] = useState(false);
  const [analyzeVideo, setAnalyzeVideo] = useState(false);

  // Experience setup state
  const [experienceLevel, setExperienceLevel] = useState<'fresher' | 'experienced'>('fresher');
  const [totalExperienceYears, setTotalExperienceYears] = useState<number | ''>('');
  const [employmentHistory, setEmploymentHistory] = useState<Array<{id: string, companyName: string, position: string, durationYears: number | ''}>>([
    { id: 'initial', companyName: '', position: '', durationYears: '' }
  ]);
  const [experienceWarning, setExperienceWarning] = useState<string | null>(null);

  // Permission states
  const [showPermissionScreen, setShowPermissionScreen] = useState<boolean>(false);

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

  // Interview length is a question BUDGET with an estimated time, not a hard clock --
  // the interviewer follows up on answers, so the exact count varies. Times are
  // deliberately over-quoted: candidates react better to an interview that finishes
  // early than one that overruns.
  const DURATION_OPTIONS = [
    { id: 'quick',    label: 'Quick practice',     time: 'About 10 minutes', detail: '3 topics · warm-up' },
    { id: 'standard', label: 'Standard interview', time: 'About 25 minutes', detail: '5 topics · most realistic' },
    { id: 'full',     label: 'Full interview',     time: 'About 45 minutes', detail: '8 topics · in depth' },
  ];

  const interviewTypes = [
    'Overall Interview',
    'HR Interview',
    'Technical Interview',
    'Personal Interview (PI)',
    'Managerial Interview',
    'Behavioral Interview',
    'Case Interview',
    'Group Interview',
    'Panel Interview',
    'Coding / Programming Interview',
    'Situational Interview',
    'Final Interview'
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
        const response = await apiClient.get('interview/history');
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
    if (user) apiClient.get<ApiResult<InterviewSession | null>>('interview/session/active')
      .then(response => setActiveSession(response.data.data)).catch(e => setSetupError(errorMessage(e)));

    const fetchResumes = async () => {
      if (!user) return;
      try {
        const response = await apiClient.get('resume/history');
        if (response.data.success && response.data.resumes.length > 0) {
          setResumes(response.data.resumes);
          setSelectedResumeId(response.data.resumes[0]._id);
        }
      } catch (err) {
        console.error("Failed to fetch resume history:", err);
      }
    };
    fetchResumes();
  }, [user]);

  // Experience Warning Validation
  useEffect(() => {
    if (experienceLevel === 'experienced') {
      const total = Number(totalExperienceYears) || 0;
      let sumDurations = 0;
      for (const emp of employmentHistory) {
        sumDurations += Number(emp.durationYears) || 0;
      }
      if (sumDurations > total && total > 0) {
        setExperienceWarning(`The total employment duration (${sumDurations} years) exceeds your stated total experience (${total} years). Please review your entries.`);
      } else {
        setExperienceWarning(null);
      }
    } else {
      setExperienceWarning(null);
    }
  }, [totalExperienceYears, employmentHistory, experienceLevel]);

  const savedSessionAction = activeSession?.status === 'evaluating' ? 'View interview progress' : 'Resume interview';

  const openRoom = (id: string) => {
    try { router.push(`/interview/${encodeURIComponent(id)}`); return true; }
    catch (e) { setSetupError(errorMessage(e, 'The interview room could not open. Please retry.')); return false; }
  };

  const resumeSession = () => {
    if (!activeSession || launchInFlight.current) return;
    launchInFlight.current = true; setLaunching(true); setSetupError('');
    if (!openRoom(activeSession.id)) { launchInFlight.current = false; setLaunching(false); }
  };

  const handleStartProcess = async () => {
    if (launchInFlight.current) return;
    if (activeSession) { resumeSession(); return; }
    if (uploadedFiles.some(file => file.status === 'uploading')) { setSetupError('Wait for job description uploads to finish.'); return; }
    // Validation for experienced
    if (experienceLevel === 'experienced') {
      const total = Number(totalExperienceYears);
      if (isNaN(total) || total <= 0) {
        alert("Please enter a valid total experience greater than 0.");
        return;
      }
      for (const emp of employmentHistory) {
        if (!emp.companyName.trim() || !emp.position.trim() || Number(emp.durationYears) <= 0) {
          alert("Please fill out all employment history fields with valid durations greater than 0.");
          return;
        }
      }
    }

    if (companyName.trim()) {
      setIsResearching(true);
      setResearchError(null);
      setResearchBrief(null);
      setShowBriefScreen(true);
      try {
        const response = await apiClient.post('interview/research', { companyName });
        if (response.data.success) {
          setResearchBrief(response.data.data);
        } else {
          setResearchError("Company research is currently unavailable. The interview can still proceed using your role, resume, and job description.");
        }
      } catch (err) {
        console.error("Research failed:", err);
        setResearchError("Company research is currently unavailable. The interview can still proceed using your role, resume, and job description.");
      } finally {
        setIsResearching(false);
      }
    } else {
      setShowPermissionScreen(true);
    }
  };

  const handleStartInterview = () => {
    if (launchInFlight.current) return;
    if (activeSession) { resumeSession(); return; }
    setShowBriefScreen(false);

    setShowPermissionScreen(true);
  };

  const launchSession = async () => {
    if (activeSession) { resumeSession(); return; }
    if (launchInFlight.current) return;
    launchInFlight.current = true;
    setLaunching(true); setSetupError('');
    let openingRoom = false;
    try {
      const response = await apiClient.post<ApiResult<InterviewSession>>('interview/session', {
        role: selectedRole === 'Custom Role' ? customRole : selectedRole,
        interviewType, durationPreset, resumeId: selectedResumeId,
        jobDescriptionText: [jobDescriptionText, ...uploadedFiles.filter(file => file.status === 'success').map(file => file.text || '')].filter(Boolean).join('\n\n'), companyName, experienceLevel,
        totalExperienceYears: experienceLevel === 'fresher' ? 0 : Number(totalExperienceYears),
        employmentHistory: experienceLevel === 'fresher' ? [] : employmentHistory.map(e => ({ companyName: e.companyName, position: e.position, durationYears: Number(e.durationYears) })),
        consent: { storeTranscript, recordAudio, recordVideo, analyzeVideo },
      });
      openingRoom = openRoom(response.data.data.id);
    } catch (e) {
      const payload: unknown = axios.isAxiosError(e) && e.response?.status === 409 ? e.response.data : null;
      if (payload && typeof payload === 'object' && 'error' in payload && payload.error === 'ACTIVE_SESSION_EXISTS') {
        const saved = 'data' in payload ? payload.data : null;
        if (saved && typeof saved === 'object' && 'id' in saved && typeof saved.id === 'string' && /^[a-f0-9]{24}$/i.test(saved.id)) {
          openingRoom = openRoom(saved.id);
        } else setSetupError('An unfinished interview already exists, but its room could not open. Reload this page to resume it.');
      } else setSetupError(errorMessage(e));
    } finally {
      // Successful navigation owns the busy state until this setup page unmounts.
      if (!openingRoom) { launchInFlight.current = false; setLaunching(false); }
    }
  };

  // Handle file uploads for Job Description
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Process files sequentially/parallelly and append their texts
    const newFiles = Array.from(files);
    
    // Check validation errors first
    const validExtensions = ['pdf', 'txt', 'docx'];
    
    for (const file of newFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !validExtensions.includes(ext)) {
        alert(`Unsupported file format for "${file.name}". Please upload PDF, TXT, or DOCX.`);
        continue;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert(`"${file.name}" exceeds the 5MB size limit.`);
        continue;
      }

      const fileObj = { id: crypto.randomUUID(), name: file.name, size: file.size, status: 'uploading' as const };
      setUploadedFiles(prev => [...prev, fileObj]);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await apiClient.post('interview/upload-jd', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (response.data.success) {
          setUploadedFiles(prev => 
            prev.map(f => f.id === fileObj.id ? { ...f, status: 'success', text: response.data.text } : f)
          );
        } else {
          throw new Error(response.data.error || "Failed to parse file");
        }
      } catch (err: any) {
        console.error(err);
        setUploadedFiles(prev => 
          prev.map(f => f.id === fileObj.id ? { ...f, status: 'error', error: err.message || "Failed to parse text" } : f)
        );
      }
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert(`"${file.name}" exceeds the 5MB size limit.`);
      return;
    }

    setIsUploadingResume(true);
    const formData = new FormData();
    formData.append('resume', file);

    try {
      const response = await apiClient.post('resume/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        // Add to list and select it
        setResumes(prev => [response.data.resume, ...prev]);
        setSelectedResumeId(response.data.resume._id);
        alert("Resume successfully uploaded and analyzed!");
      } else {
        throw new Error(response.data.message || "Failed to upload resume");
      }
    } catch (err: any) {
      console.error("Resume upload failed:", err);
      alert(err.response?.data?.error || err.response?.data?.message || err.message || "Failed to upload resume");
    } finally {
      setIsUploadingResume(false);
      if (resumeInputRef.current) resumeInputRef.current.value = '';
    }
  };

  const removeUploadedFile = (indexToRemove: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  if (isLoading || (!isLoading && !user)) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (showPermissionScreen) {
    return <div className="mx-auto max-w-2xl p-6 sm:p-10 space-y-6">
      <h1 className="text-3xl font-bold">Before your interview</h1>
      <p>You can type every answer. Microphone and camera access are optional and start only when you choose them inside the interview.</p>
      <p className="text-sm text-slate-500">Submitted answers and selected resume context are stored in your account and sent to {aiProviderName} for questions and feedback. Microphone answers can be transcribed by Gemini or your browser's speech provider. The app keeps only submitted transcript text; dictation audio is temporary and separate from optional recordings. AI feedback is for practice and can be inaccurate.</p>
      {aiProviderName === 'Gemini' && <p className="text-sm text-slate-500">If this Gemini project uses Google's free tier, Google may use submitted content to improve its products. <a className="underline" href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noopener noreferrer">Read Google's data-use terms</a>.</p>}
      <label className="flex items-start gap-3"><input type="checkbox" checked={storeTranscript} onChange={e => setStoreTranscript(e.target.checked)} className="mt-1" />Save my answers and use AI to generate interview feedback. Required to continue.</label>
      <label className="flex items-start gap-3"><input type="checkbox" checked={recordAudio} onChange={e => { setRecordAudio(e.target.checked); if (!e.target.checked) { setRecordVideo(false); setAnalyzeVideo(false); } }} className="mt-1" />Allow optional recording of my audio responses.</label>
      <label className="flex items-start gap-3"><input type="checkbox" checked={recordVideo} disabled={!recordAudio} onChange={e => { setRecordVideo(e.target.checked); if (!e.target.checked) setAnalyzeVideo(false); }} className="mt-1" />Include my camera in the recording.</label>
      <label className="flex items-start gap-3"><input type="checkbox" checked={analyzeVideo} disabled={!recordVideo} onChange={e => setAnalyzeVideo(e.target.checked)} className="mt-1" />Allow optional face-presence review of my video. This never changes my score.</label>
      <p className="text-sm text-slate-500">Optional recordings capture your microphone and camera; generated interviewer audio is not directly included. You can delete the interview and its recordings from the report.</p>
      {setupError && <p role="alert" className="text-red-600">{setupError}</p>}
      <div className="flex gap-3"><Button variant="outline" onClick={() => setShowPermissionScreen(false)} disabled={launching}>Back</Button><Button onClick={launchSession} disabled={launching || (!activeSession && !storeTranscript)}>{launching ? 'Opening interview...' : activeSession ? savedSessionAction : 'Start Interview'}</Button></div>
    </div>;
  }

  // Intermediate screen for Company Research Brief
  if (showBriefScreen) {
    const roleToUse = selectedRole === 'Custom Role' ? (customRole || 'Software Engineer') : selectedRole;
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 py-10 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass max-w-2xl w-full rounded-3xl p-6 sm:p-10 border border-slate-200 dark:border-slate-800 shadow-2xl bg-white/60 dark:bg-slate-900/60 space-y-6"
        >
          <div className="text-center space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary-500 bg-primary-500/10 px-3 py-1 rounded-full border border-primary-500/20">
              Company Briefing
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading">
              Preparing for your interview at {companyName}
            </h2>
          </div>

          {isResearching ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Researching major developments and milestones for {companyName}...
              </span>
            </div>
          ) : researchError ? (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-amber-600 dark:text-amber-400 shadow-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <span className="text-sm font-medium leading-relaxed">{researchError}</span>
              </div>
              <div className="flex gap-4 justify-end">
                <Button variant="outline" onClick={() => setShowBriefScreen(false)}>Cancel</Button>
                <Button onClick={handleStartInterview} disabled={launching}>{launching ? 'Opening interview...' : activeSession ? savedSessionAction : 'Continue to Interview'}</Button>
              </div>
            </div>
          ) : researchBrief ? (
            <div className="space-y-6">
              {/* Snapshot Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800 pb-2">
                  Company Snapshot
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase">Major Developments (Last Decade)</h4>
                    <ul className="list-disc pl-5 mt-1.5 text-sm text-slate-700 dark:text-slate-300 space-y-1">
                      {researchBrief.majorDevelopments.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase">Key Products & Technologies</h4>
                    <ul className="list-disc pl-5 mt-1.5 text-sm text-slate-700 dark:text-slate-300 space-y-1">
                      {researchBrief.keyProducts.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase">Strategy in available sources</h4>
                    <p className="mt-1.5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {researchBrief.recentStrategy}
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-2">
                <p>This AI brief summarizes retrieved public sources. Background articles may omit recent changes. Review the source dates before using it for interview preparation.</p>
                {researchBrief.sources?.filter(source => source.startsWith('https://')).map(source => <a key={source} href={source} target="_blank" rel="noopener noreferrer" className="block underline break-all">{source}</a>)}
                {researchBrief.retrievedAt && <p>Retrieved {new Date(researchBrief.retrievedAt).toLocaleString()}</p>}
              </div>
              {/* Interview Focus Areas */}
              <div className="p-5 rounded-2xl bg-primary-500/5 border border-primary-500/10 space-y-2">
                <h4 className="text-xs font-bold text-primary-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-4 h-4" />
                  Interview Focus Areas
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                  Based on the company, role, and job description, your interview will focus on:
                </p>
                <ul className="list-disc pl-5 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                  {researchBrief.focusAreas.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-4 justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                <Button variant="outline" onClick={() => setShowBriefScreen(false)}>Cancel</Button>
                <Button onClick={handleStartInterview} disabled={launching}>
                  {launching ? 'Opening interview...' : activeSession ? savedSessionAction : 'Continue to Interview'}
                </Button>
              </div>
            </div>
          ) : null}
        </motion.div>
      </div>
    );
  }


  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {setupError && <p role="alert" className="mb-4 text-red-600">{setupError}</p>}
        {activeSession && <div className="mb-6 rounded-2xl border border-primary-300 p-5 flex flex-wrap items-center gap-4">
          <div className="flex-1"><h2 className="font-bold">You have an unfinished interview</h2><p>{activeSession.setup.role} ? {activeSession.turns.length} answers saved</p></div>
          <Link className={`font-semibold text-primary-600 underline ${launching ? 'pointer-events-none opacity-50' : ''}`} prefetch={false} href={`/interview/${activeSession.id}`} aria-disabled={launching} tabIndex={launching ? -1 : 0} onClick={event => { event.preventDefault(); resumeSession(); }}>{launching ? 'Opening interview...' : savedSessionAction}</Link>
          <button className="text-sm underline disabled:opacity-50" disabled={launching} onClick={async () => {
            if (!window.confirm('Discard this unfinished interview? Submitted answers will not be evaluated.')) return;
            try {
              let localCleanupFailed = false;
              await deleteLocalSession(activeSession.id).catch(() => { localCleanupFailed = true; });
              await apiClient.post(`interview/session/${activeSession.id}/abandon`);
              if (localCleanupFailed) window.alert('Interview discarded from your account. Clear this site\'s browser storage to remove drafts from this device.');
              setActiveSession(null);
            } catch (e) { setSetupError(errorMessage(e)); }
          }}>Discard</button>
        </div>}
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

                {/* Interview Type Selection */}
                <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
                    What type of interview would you like to practice?
                  </label>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {interviewTypes.map(typeOption => (
                      <button
                        key={typeOption}
                        onClick={() => setInterviewType(typeOption)}
                        className={`p-3 rounded-xl border text-xs font-semibold transition-all text-center ${
                          interviewType === typeOption
                            ? 'bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/20'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {typeOption}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interview Length */}
                <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    How long do you have?
                  </label>
                  <p className="text-xs text-slate-400 mb-3">
                    The interviewer will follow up on your answers, so the exact number of
                    questions varies — just like a real interview.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {DURATION_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setDurationPreset(opt.id)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          durationPreset === opt.id
                            ? 'bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/20'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="text-sm font-bold">{opt.label}</div>
                        <div className={`text-xs mt-0.5 ${durationPreset === opt.id ? 'text-white/80' : 'text-slate-400'}`}>
                          {opt.time}
                        </div>
                        <div className={`text-[11px] mt-1.5 ${durationPreset === opt.id ? 'text-white/70' : 'text-slate-400'}`}>
                          {opt.detail}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resume Selection */}
                <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Resume Context
                  </label>
                  <p className="text-xs text-slate-400">
                    Select a resume to provide deep context for your interview, or upload a new one.
                  </p>
                  
                  {resumes.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      {resumes.map(resume => (
                        <div 
                          key={resume._id}
                          onClick={() => setSelectedResumeId(resume._id)}
                          className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                            selectedResumeId === resume._id 
                            ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-500 text-primary-700 dark:text-primary-300 shadow-sm shadow-primary-500/10' 
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selectedResumeId === resume._id ? 'border-primary-500' : 'border-slate-300 dark:border-slate-700'}`}>
                            {selectedResumeId === resume._id && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                          </div>
                          <div className="overflow-hidden flex-1">
                            <p className="text-sm font-semibold truncate" title={resume.originalName}>{resume.originalName}</p>
                            <p className="text-[10px] opacity-70">
                              {new Date(resume.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div 
                    onClick={() => !isUploadingResume && resumeInputRef.current?.click()}
                    className={`border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center transition-colors bg-white/30 dark:bg-slate-950/20 ${isUploadingResume ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary-400 dark:hover:border-primary-600'}`}
                  >
                    {isUploadingResume ? (
                      <Loader2 className="w-6 h-6 text-primary-500 mb-1.5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-6 h-6 text-slate-400 mb-1.5" />
                    )}
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isUploadingResume ? 'Uploading & Analyzing...' : 'Upload New Resume'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Supports PDF (Max 5MB)</span>
                    <input 
                      type="file" 
                      ref={resumeInputRef} 
                      onChange={handleResumeUpload} 
                      accept=".pdf"
                      className="hidden" 
                    />
                  </div>
                </div>

                {/* Optional Job Description Input */}
                <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Optional — Job Description
                  </label>
                  <p className="text-xs text-slate-400">
                    Paste the target job description text below, or upload standard documents to customize your interview.
                  </p>
                  
                  <textarea
                    placeholder="Paste or write the job description here..."
                    rows={4}
                    value={jobDescriptionText}
                    onChange={(e) => setJobDescriptionText(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white resize-y"
                  />

                  {/* Document Uploader */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 dark:hover:border-primary-600 transition-colors bg-white/30 dark:bg-slate-950/20"
                    >
                      <UploadCloud className="w-6 h-6 text-slate-400 mb-1.5" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Upload Job Description</span>
                      <span className="text-[10px] text-slate-400 mt-0.5">Supports PDF, DOCX, TXT (Max 5MB)</span>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        multiple 
                        accept=".pdf,.txt,.docx"
                        className="hidden" 
                      />
                    </div>

                    {/* Upload List */}
                    {uploadedFiles.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uploaded Documents</span>
                        <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                          {uploadedFiles.map((file, idx) => (
                            <div key={file.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/50 text-xs">
                              <div className="flex items-center gap-2 truncate pr-2">
                                <FileText className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{file.name}</span>
                                <span className="text-[10px] text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {file.status === 'uploading' && <Loader2 className="w-3 h-3 text-primary-500 animate-spin" />}
                                {file.status === 'error' && <span className="text-[9px] text-red-500 font-bold" title={file.error}>Failed</span>}
                                <button 
                                  aria-label={`Remove ${file.name}`}
                                  onClick={() => removeUploadedFile(idx)}
                                  className="text-slate-400 hover:text-red-500 transition-colors p-0.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Optional Company Name Input */}
                <div className="space-y-2 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Optional — Company Name
                  </label>
                  <p className="text-xs text-slate-400">
                    If provided, we will perform web research to tailor questions to this company's products and strategic trajectory.
                  </p>
                  <input
                    type="text"
                    placeholder="Enter company name (e.g. Microsoft, Google, Stripe)"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Experience Level */}
                <div className="space-y-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Experience Level
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setExperienceLevel('fresher')}
                      className={`p-3 rounded-xl border text-sm font-semibold transition-all text-center ${
                        experienceLevel === 'fresher'
                          ? 'bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/20'
                          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Fresher
                    </button>
                    <button
                      onClick={() => setExperienceLevel('experienced')}
                      className={`p-3 rounded-xl border text-sm font-semibold transition-all text-center ${
                        experienceLevel === 'experienced'
                          ? 'bg-primary-500 text-white border-primary-500 shadow-md shadow-primary-500/20'
                          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Experienced
                    </button>
                  </div>

                  <AnimatePresence>
                    {experienceLevel === 'experienced' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-6 pt-2 overflow-hidden"
                      >
                        <div className="space-y-2">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Professional Experience
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              placeholder="e.g. 5"
                              value={totalExperienceYears}
                              onChange={(e) => setTotalExperienceYears(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-24 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white"
                            />
                            <span className="text-sm font-semibold text-slate-500">years</span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Previous Employment
                          </label>
                          
                          <div className="space-y-4">
                            {employmentHistory.map((emp, idx) => (
                              <div key={emp.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 space-y-3 relative group">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Company Name</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. ABC Technologies"
                                    value={emp.companyName}
                                    onChange={(e) => {
                                      const newHistory = [...employmentHistory];
                                      newHistory[idx].companyName = e.target.value;
                                      setEmploymentHistory(newHistory);
                                    }}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-slate-900 dark:text-white"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Position / Title</label>
                                    <input
                                      type="text"
                                      placeholder="e.g. Software Engineer"
                                      value={emp.position}
                                      onChange={(e) => {
                                        const newHistory = [...employmentHistory];
                                        newHistory[idx].position = e.target.value;
                                        setEmploymentHistory(newHistory);
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-slate-900 dark:text-white"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Duration (Years)</label>
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      placeholder="e.g. 2.5"
                                      value={emp.durationYears}
                                      onChange={(e) => {
                                        const newHistory = [...employmentHistory];
                                        newHistory[idx].durationYears = e.target.value === '' ? '' : Number(e.target.value);
                                        setEmploymentHistory(newHistory);
                                      }}
                                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 text-slate-900 dark:text-white"
                                    />
                                  </div>
                                </div>
                                
                                {employmentHistory.length > 1 && (
                                  <button
                                    onClick={() => setEmploymentHistory(prev => prev.filter(e => e.id !== emp.id))}
                                    className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={() => setEmploymentHistory(prev => [...prev, { id: Date.now().toString(), companyName: '', position: '', durationYears: '' }])}
                            className="text-sm font-semibold text-primary-500 hover:text-primary-600 flex items-center gap-1 transition-colors"
                          >
                            + Add Previous Position
                          </button>
                        </div>
                        
                        {experienceWarning && (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-2 text-amber-600 dark:text-amber-400 mt-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <p className="text-xs leading-relaxed">{experienceWarning}</p>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="pt-4 flex gap-4">
                  <Button
                    onClick={handleStartProcess}
                    disabled={launching || (!activeSession && selectedRole === 'Custom Role' && !customRole.trim())}
                    className="w-full sm:w-auto h-12 px-8 rounded-xl shadow-lg shadow-primary-500/20"
                  >
                    <Play className="w-4 h-4 mr-2 fill-white" />
                    {launching ? 'Opening interview...' : activeSession ? savedSessionAction : 'Start Interview'}
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
                          {item.companyName && (
                            <div className="text-xs text-slate-400 font-semibold">
                              at {item.companyName}
                            </div>
                          )}
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
                          {item.jobMatchScore > 0 && (
                            <span className="text-xs font-extrabold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20" title="Job Description Match Score">
                              {item.jobMatchScore}%
                            </span>
                          )}
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
