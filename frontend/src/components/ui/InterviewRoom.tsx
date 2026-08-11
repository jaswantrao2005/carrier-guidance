"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, Loader2, Play, Square, CheckCircle, AlertTriangle, Globe } from 'lucide-react';
import apiClient from '@/features/api/client';

interface InterviewRoomProps {
  role: string;
  jobDescriptionText?: string;
  companyName?: string;
  companyResearch?: any;
  preCreatedStream?: MediaStream | null;
  recordingConsent?: boolean;
  experienceLevel?: 'fresher' | 'experienced';
  totalExperienceYears?: number;
  employmentHistory?: Array<{companyName: string, position: string, durationYears: number}>;
  onFinish: (reportId: string) => void;
  onCancel: () => void;
}

interface QARecord {
  question: string;
  answer: string;
}

const AIAvatar: React.FC<{ status: string }> = ({ status }) => {
  return (
    <div className="relative w-36 h-36 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 flex items-center justify-center shadow-lg transition-all duration-300">
      <svg className="w-full h-full text-slate-400" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="avatarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <style>{`
            .mouth-speak {
              animation: speak 0.6s infinite ease-in-out alternate;
              transform-origin: 50px 52px;
            }
            .head-bob {
              animation: bob 3.5s infinite ease-in-out;
              transform-origin: 50px 75px;
            }
            @keyframes speak {
              0% { transform: scaleY(0.3) translateY(1.5px); }
              100% { transform: scaleY(1.3) translateY(-0.5px); }
            }
            @keyframes bob {
              0%, 100% { transform: translateY(0) rotate(0deg); }
              50% { transform: translateY(-3px) rotate(0.8deg); }
            }
          `}</style>
        </defs>

        {/* Ambient background inside the circle */}
        <circle cx="50" cy="50" r="50" fill="url(#avatarGrad)" opacity="0.15" />

        {/* Human AI Interviewer Vector */}
        <g className={status === 'speaking' ? 'head-bob' : ''}>
          {/* Shoulders / Suit */}
          <path d="M20 90 C 20 70, 35 68, 50 68 C 65 68, 80 70, 80 90" fill="#1e293b" />
          {/* Shirt / Tie */}
          <path d="M43 68 L50 82 L57 68 Z" fill="#ffffff" />
          <path d="M48 70 L52 70 L50 90 Z" fill="#3b82f6" />

          {/* Neck */}
          <rect x="44" y="58" width="12" height="12" rx="2" fill="#fbd5c0" />

          {/* Head / Face */}
          <circle cx="50" cy="40" r="20" fill="#fbd5c0" />

          {/* Hair (Professional, Styled) */}
          <path d="M28 35 C 28 20, 50 14, 72 35 C 70 20, 30 20, 28 35" fill="#334155" />
          
          {/* Eyes */}
          <circle cx="43" cy="38" r="2" fill="#1e293b" />
          <circle cx="57" cy="38" r="2" fill="#1e293b" />

          {/* Glasses Frame (Modern/Professional) */}
          <circle cx="43" cy="38" r="4.5" stroke="#475569" strokeWidth="1.5" />
          <circle cx="57" cy="38" r="4.5" stroke="#475569" strokeWidth="1.5" />
          <line x1="47.5" y1="38" x2="52.5" y2="38" stroke="#475569" strokeWidth="1.5" />

          {/* Mouth */}
          {status === 'speaking' ? (
            /* Animated Mouth */
            <ellipse cx="50" cy="51" rx="3.5" ry="2.5" fill="#991b1b" className="mouth-speak" />
          ) : (
            /* Smiling Mouth (Listening / Idle) */
            <path d="M45 50 Q 50 53, 55 50" stroke="#991b1b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          )}
        </g>
      </svg>
    </div>
  );
};

export const InterviewRoom: React.FC<InterviewRoomProps> = ({ 
  role, 
  jobDescriptionText = '', 
  companyName = '', 
  companyResearch = null, 
  preCreatedStream = null,
  recordingConsent = false,
  experienceLevel = 'fresher',
  totalExperienceYears = 0,
  employmentHistory = [],
  onFinish, 
  onCancel 
}) => {
  const [qaHistory, setQaHistory] = useState<QARecord[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [category, setCategory] = useState<string>('Introduction');
  const [difficulty, setDifficulty] = useState<string>('Easy');
  const [status, setStatus] = useState<'idle' | 'speaking' | 'listening' | 'processing' | 'finishing'>('idle');
  const statusRef = useRef<'idle' | 'speaking' | 'listening' | 'processing' | 'finishing'>('idle');
  
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [timer, setTimer] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);
  
  // Integrity & Recording States
  const [warningsCount, setWarningsCount] = useState<number>(0);
  const [recentWarning, setRecentWarning] = useState<string | null>(null);
  const integrityEventsRef = useRef<any[]>([]);
  const lastEventTimeRef = useRef<{ [key: string]: number }>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const interviewStartTimeRef = useRef<number>(Date.now());
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const integrityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Multilingual Speech support
  const [spokenLanguage, setSpokenLanguage] = useState<string>('en-IN'); // defaults to Indian English / Multilingual understanding

  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const interimTranscriptRef = useRef<string>('');
  
  // Video preview refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Sync preCreatedStream to user video preview frame and initialize recording/integrity
  useEffect(() => {
    if (preCreatedStream) {
      const videoTracks = preCreatedStream.getVideoTracks();
      if (videoTracks.length > 0) {
        setCameraStream(preCreatedStream);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = preCreatedStream;
          }
        }, 150);
      }

      // Initialize Recording
      if (recordingConsent) {
        try {
          const recorder = new MediaRecorder(preCreatedStream, { mimeType: 'video/webm;codecs=vp8,opus' });
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              recordedChunksRef.current.push(e.data);
            }
          };
          recorder.start(1000); // chunk every 1 second
          mediaRecorderRef.current = recorder;
          setIsRecording(true);
        } catch (e) {
          console.error("MediaRecorder initialization failed:", e);
        }
      }

      // Initialize FaceDetector Integrity Monitor
      if ('FaceDetector' in window) {
        try {
          const faceDetector = new (window as any).FaceDetector({ maxDetectedFaces: 5, fastMode: true });
          integrityIntervalRef.current = setInterval(async () => {
            if (videoRef.current && status !== 'idle' && status !== 'finishing') {
              try {
                const faces = await faceDetector.detect(videoRef.current);
                handleIntegrityCheck(faces.length);
              } catch (e) {}
            }
          }, 3000);
        } catch (e) {
          console.warn("FaceDetector failed to initialize:", e);
        }
      }
    }
    
    return () => {
      if (integrityIntervalRef.current) clearInterval(integrityIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [preCreatedStream, recordingConsent]);

  const addIntegrityEvent = (type: string, description: string, severity: 'Low' | 'Medium' | 'High') => {
    const now = Date.now();
    const lastTime = lastEventTimeRef.current[type] || 0;
    
    // Debounce similar events by 10 seconds
    if (now - lastTime < 10000) return;
    lastEventTimeRef.current[type] = now;
    
    const timestamp = Math.floor((now - interviewStartTimeRef.current) / 1000);
    integrityEventsRef.current.push({ type, description, severity, timestamp });
    
    setWarningsCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 7 && status !== 'finishing') {
        forceTerminateInterview();
      }
      return newCount;
    });

    setRecentWarning(description);
    setTimeout(() => setRecentWarning(null), 5000);
  };

  const handleIntegrityCheck = (facesCount: number) => {
    if (facesCount === 0) {
      addIntegrityEvent('Candidate Left Frame', 'No face detected in the camera frame.', 'High');
    } else if (facesCount > 1) {
      addIntegrityEvent('Multiple Persons', 'Secondary person detected in the frame.', 'High');
    }
  };

  const forceTerminateInterview = () => {
    try { recognitionRef.current?.stop(); } catch (e) {}
    try { synthesisRef.current?.cancel(); } catch (e) {}
    setStatus('finishing');
    statusRef.current = 'finishing';
    const warningMsg = "Interview terminated automatically due to repeated integrity warnings.";
    setRecentWarning(warningMsg);
    // Proceed to finalize with whatever history exists
    finalizeInterview(qaHistory, 'Terminated');
  };

  // Sync spoken language changes directly to the speech recognition instance
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = spokenLanguage;
    }
  }, [spokenLanguage]);

  useEffect(() => {
    synthesisRef.current = window.speechSynthesis;
    
    // Initialize Web Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = spokenLanguage;

      rec.onresult = (event: any) => {
        let finalTranscript = '';
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          setTranscript(prev => (prev + ' ' + finalTranscript).trim());
        }
        setInterimTranscript(currentInterim);
        interimTranscriptRef.current = currentInterim;
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error === 'not-allowed') {
          setMicError("Microphone permission denied. Please check your browser settings.");
        }
      };

      rec.onend = () => {
        // Commit any lingering interim text that never fired 'isFinal' before the engine stopped
        if (interimTranscriptRef.current) {
          setTranscript(prev => (prev + ' ' + interimTranscriptRef.current).trim());
          setInterimTranscript('');
          interimTranscriptRef.current = '';
        }

        // Automatically restart listening if we are still in listening mode (e.g., after a pause)
        if (statusRef.current === 'listening') {
          try {
            rec.start();
          } catch (e) {}
        }
      };

      recognitionRef.current = rec;
    } else {
      setMicError("Speech Recognition is not supported by your current browser. Please use Chrome or Safari.");
    }

    // Start with the first question
    fetchNextQuestion([]);

    return () => {
      // Cleanup audio synthesis and mic recognition
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      stopTimer();
    };
  }, []);

  // Answer Timer effect
  useEffect(() => {
    if (status === 'listening') {
      startTimer();
    } else {
      stopTimer();
    }
  }, [status]);

  const startTimer = () => {
    stopTimer();
    setTimer(0);
    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const fetchNextQuestion = async (history: QARecord[]) => {
    setStatus('processing');
    statusRef.current = 'processing';
    try {
      const response = await apiClient.post('interview/next-question', {
        role,
        history,
        jobDescriptionText,
        companyResearch,
        experienceLevel,
        totalExperienceYears,
        employmentHistory
      });

      if (response.data.success) {
        const { question, category: cat, difficulty: diff } = response.data.data;
        setCurrentQuestion(question);
        setCategory(cat);
        setDifficulty(diff);
        setTranscript('');
        setInterimTranscript('');
        interimTranscriptRef.current = '';
        
        // Let the AI speak the question
        speakQuestion(question);
      } else {
        throw new Error("Failed response from server");
      }
    } catch (err) {
      console.error(err);
      setStatus('idle');
    }
  };

  const speakQuestion = (text: string) => {
    if (!synthesisRef.current) return;
    
    // Ensure mic is off when speaking
    try {
      recognitionRef.current?.stop();
    } catch (e) {}

    synthesisRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    
    utterance.onstart = () => {
      setStatus('speaking');
      statusRef.current = 'speaking';
    };

    utterance.onend = () => {
      startListening();
    };

    utterance.onerror = (e) => {
      console.error("Speech Synthesis Error:", e);
      startListening();
    };

    synthesisRef.current.speak(utterance);
  };

  const startListening = () => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
    }
    setStatus('listening');
    statusRef.current = 'listening';
    setMicError(null);
    try {
      recognitionRef.current?.start();
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
    }
  };

  const handleStopAnswer = () => {
    try {
      recognitionRef.current?.stop();
    } catch (e) {}
    
    // Capture any lingering interim text that wasn't finalized
    const finalAnswer = (transcript + ' ' + interimTranscriptRef.current).trim() || "[No verbal response]";
    
    const updatedHistory = [...qaHistory, { question: currentQuestion, answer: finalAnswer }];
    setQaHistory(updatedHistory);

    if (updatedHistory.length >= 10) {
      finalizeInterview(updatedHistory);
    } else {
      fetchNextQuestion(updatedHistory);
    }
  };

  const uploadRecording = async (interviewId: string) => {
    if (!mediaRecorderRef.current || recordedChunksRef.current.length === 0) return;
    
    try {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      // Give a tiny buffer for the last chunk to push
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const formData = new FormData();
      formData.append('video', blob, 'recording.webm');
      
      await apiClient.post(`interview/${interviewId}/recording`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000, // Large timeout for video uploads
      });
    } catch (e) {
      console.error("Failed to upload recording:", e);
    }
  };

  const finalizeInterview = async (history: QARecord[], forcedStatus?: string) => {
    setStatus('finishing');
    statusRef.current = 'finishing';
    
    const finalDuration = Math.floor((Date.now() - interviewStartTimeRef.current) / 1000);
    const finalIntegrityStatus = forcedStatus || (warningsCount > 0 ? 'Warnings' : 'Clean');

    try {
      const response = await apiClient.post('interview/complete', {
        role,
        history,
        jobDescriptionText,
        companyName,
        companyResearch,
        recordingConsent,
        recordingDuration: finalDuration,
        integrityStatus: finalIntegrityStatus,
        integrityWarningsCount: warningsCount,
        integrityEvents: integrityEventsRef.current,
        experienceLevel,
        totalExperienceYears,
        employmentHistory
      });

      if (response.data.success) {
        const interviewId = response.data.data._id;
        
        // If recording consent given, upload the video blob now
        if (recordingConsent) {
          await uploadRecording(interviewId);
        }

        onFinish(interviewId);
      } else {
        throw new Error("Failed to save interview");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit interview results. Redirecting to mock interview setup.");
      onCancel();
    }
  };

  // Supported languages list
  const languageOptions = [
    { code: 'en-IN', label: 'English (Indian / British / US / All Accents)' },
    { code: 'hi-IN', label: 'Hindi (हिंदी)' },
    { code: 'or-IN', label: 'Odia (ଓଡ଼ିଆ)' },
    { code: 'bn-IN', label: 'Bengali (বাংলা)' },
    { code: 'mr-IN', label: 'Marathi (मराठी)' },
    { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
    { code: 'te-IN', label: 'Telugu (తెలుగు)' },
    { code: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)' },
    { code: 'ml-IN', label: 'Malayalam (മലയാളം)' },
    { code: 'gu-IN', label: 'Gujarati (ગુજરાતી)' },
    { code: 'pa-IN', label: 'Punjabi (ਪੰਜਾਬੀ)' }
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
      
      {/* Live Floating Camera Window */}
      {cameraStream && (
        <div className="fixed bottom-6 right-6 w-36 sm:w-48 aspect-video rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 bg-slate-950 shadow-2xl z-50 transition-all duration-300">
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover scale-x-[-1]" 
          />
          {isRecording && (
            <span className="absolute top-2 right-2 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-1 shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-white block"></span>
              REC
            </span>
          )}
          <span className="absolute bottom-2 left-2 bg-slate-900/80 text-[8px] text-white font-bold px-1.5 py-0.5 rounded backdrop-blur">
            Candidate Camera
          </span>
        </div>
      )}

      {/* Warnings Overlay Toast */}
      <AnimatePresence>
        {recentWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-amber-500/90 text-white px-4 py-2 rounded-xl shadow-xl shadow-amber-500/20 backdrop-blur-md flex items-center gap-3 border border-amber-400"
          >
            <AlertTriangle className="w-5 h-5" />
            <div className="flex flex-col">
              <span className="text-xs font-extrabold uppercase tracking-widest opacity-80">Integrity Alert</span>
              <span className="text-sm font-semibold">{recentWarning}</span>
            </div>
            {warningsCount > 0 && (
              <span className="ml-3 bg-amber-600 px-2 py-0.5 rounded text-xs font-bold">
                {warningsCount}/7
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Info Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary-500 bg-primary-500/10 px-3 py-1 rounded-full border border-primary-500/20">
            {category}
          </span>
          <span className="ml-2 text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-500/10 px-3 py-1 rounded-full">
            {difficulty}
          </span>
        </div>
        <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Question {qaHistory.length + 1} / 10 (Estimated)
        </div>
      </div>

      {/* Main Panel */}
      <div className="glass rounded-3xl p-6 sm:p-10 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col items-center bg-white/60 dark:bg-slate-900/60 relative overflow-hidden">
        
        {/* Animated AI Avatar Orb */}
        <div className="relative w-44 h-44 mb-10 flex items-center justify-center">
          <AnimatePresence>
            {status === 'speaking' && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full bg-primary-500/20 blur-xl pointer-events-none"
              />
            )}
            {status === 'listening' && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.8, 0.5] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl pointer-events-none"
              />
            )}
          </AnimatePresence>

          <AIAvatar status={status} />
        </div>

        {/* AI Question Box */}
        <div className="w-full text-center mb-8">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Interviewer</h3>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-relaxed max-w-2xl mx-auto">
            {status === 'processing' ? (
              <span className="text-slate-400 font-medium text-lg italic">Formulating the next question...</span>
            ) : status === 'finishing' ? (
              <span className="text-slate-400 font-medium text-lg italic">Analyzing responses and compiling report...</span>
            ) : (
              currentQuestion
            )}
          </div>
        </div>

        {/* Answer Transcript Display */}
        {status === 'listening' && (
          <div className="w-full border-t border-slate-200 dark:border-slate-800 pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2 animate-ping" />
                Listening to your answer...
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                Timer: {formatTime(timer)}
              </span>
            </div>
            
            <div className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 min-h-[100px] text-slate-800 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-wrap shadow-inner">
              {transcript.trim() || interimTranscript.trim() ? (
                <>
                  <span>{transcript}</span>
                  <span className="text-slate-400 italic"> {interimTranscript}</span>
                </>
              ) : (
                <span className="text-slate-400 italic">Start speaking to transcribe your response...</span>
              )}
            </div>
          </div>
        )}

        {/* Error Handling */}
        {micError && (
          <div className="w-full flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 mt-6 shadow-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{micError}</span>
          </div>
        )}

        {/* Action Controls & Language Selector */}
        <div className="flex flex-col items-center gap-4 mt-8 w-full">
          
          {/* Spoken Response Language selector dropdown */}
          {status === 'listening' && (
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-slate-400" />
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Spoken Response Language:</label>
              <select
                value={spokenLanguage}
                onChange={(e) => setSpokenLanguage(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none text-slate-700 dark:text-slate-300 font-medium"
              >
                {languageOptions.map(opt => (
                  <option key={opt.code} value={opt.code}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-4 w-full justify-center">
            {status === 'listening' && (
              <button
                onClick={handleStopAnswer}
                className="px-8 py-3.5 rounded-xl font-bold bg-primary-500 text-white hover:bg-primary-600 transition-all flex items-center gap-2 shadow-lg shadow-primary-500/25"
              >
                <Square className="w-4 h-4 fill-white" />
                Submit Response
              </button>
            )}

            <button
              onClick={onCancel}
              disabled={status === 'finishing'}
              className="px-6 py-3.5 rounded-xl font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80 transition-colors disabled:opacity-50"
            >
              End Interview
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
