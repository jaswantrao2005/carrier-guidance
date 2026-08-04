"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, Loader2, Play, Square, CheckCircle, AlertTriangle } from 'lucide-react';
import apiClient from '@/features/api/client';

interface InterviewRoomProps {
  role: string;
  onFinish: (reportId: string) => void;
  onCancel: () => void;
}

interface QARecord {
  question: string;
  answer: string;
}

export const InterviewRoom: React.FC<InterviewRoomProps> = ({ role, onFinish, onCancel }) => {
  const [qaHistory, setQaHistory] = useState<QARecord[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [category, setCategory] = useState<string>('Introduction');
  const [difficulty, setDifficulty] = useState<string>('Easy');
  const [status, setStatus] = useState<'idle' | 'speaking' | 'listening' | 'processing' | 'finishing'>('idle');
  
  const [transcript, setTranscript] = useState<string>('');
  const [timer, setTimer] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);

  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    synthesisRef.current = window.speechSynthesis;
    
    // Initialize Web Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setTranscript(prev => (prev + ' ' + finalTranscript).trim());
      };

      rec.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error === 'not-allowed') {
          setMicError("Microphone permission denied. Please check your browser settings.");
        } else if (event.error === 'no-speech') {
          // Keep recognition alive on silent timeouts
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
    try {
      const response = await apiClient.post('/interview/next-question', {
        role,
        history,
      });

      if (response.data.success) {
        const { question, category: cat, difficulty: diff } = response.data.data;
        setCurrentQuestion(question);
        setCategory(cat);
        setDifficulty(diff);
        setTranscript('');
        
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
    };

    utterance.onend = () => {
      // Auto switch to listening once AI finishes speaking
      startListening();
    };

    utterance.onerror = (e) => {
      console.error("Speech Synthesis Error:", e);
      // Fallback: trigger listening manually if voice fails
      startListening();
    };

    synthesisRef.current.speak(utterance);
  };

  const startListening = () => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
    }
    setStatus('listening');
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
    
    // Save response to history and get next
    const updatedHistory = [...qaHistory, { question: currentQuestion, answer: transcript.trim() || "[No verbal response]" }];
    setQaHistory(updatedHistory);

    if (updatedHistory.length >= 10) {
      // End interview and generate final report
      finalizeInterview(updatedHistory);
    } else {
      fetchNextQuestion(updatedHistory);
    }
  };

  const finalizeInterview = async (history: QARecord[]) => {
    setStatus('finishing');
    try {
      const response = await apiClient.post('/interview/complete', {
        role,
        history,
      });

      if (response.data.success) {
        onFinish(response.data.data._id);
      } else {
        throw new Error("Failed to save interview");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit interview results. Redirecting to mock interview setup.");
      onCancel();
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 relative z-10">
      
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

          <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-500 shadow-inner ${
            status === 'speaking' ? 'border-primary-500 bg-primary-950/20 text-primary-500 shadow-primary-500/20' :
            status === 'listening' ? 'border-emerald-500 bg-emerald-950/20 text-emerald-500 shadow-emerald-500/20 animate-pulse' :
            status === 'processing' || status === 'finishing' ? 'border-violet-500 bg-violet-950/20 text-violet-500 animate-spin border-t-transparent' :
            'border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-slate-400'
          }`}>
            {status === 'speaking' && <Volume2 className="w-12 h-12" />}
            {status === 'listening' && <Mic className="w-12 h-12" />}
            {(status === 'processing' || status === 'finishing') && <Loader2 className="w-12 h-12" />}
            {status === 'idle' && <Play className="w-12 h-12" />}
          </div>
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
                Live Transcription
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                Timer: {formatTime(timer)}
              </span>
            </div>
            
            <div className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 min-h-[100px] text-slate-800 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-wrap shadow-inner">
              {transcript.trim() ? transcript : <span className="text-slate-400 italic">Start speaking to transcribe your response...</span>}
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

        {/* Action Controls */}
        <div className="flex items-center gap-4 mt-8 w-full justify-center">
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
  );
};
