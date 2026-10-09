"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, Check, Code2, Mic, MicOff, Pause, Send, Square, Video, Volume2, VolumeX, Captions, Keyboard } from 'lucide-react';
import apiClient from '@/features/api/client';
import { errorMessage } from '@/features/api/errors';
import type { ApiResult, InterviewSession } from '@/features/interview/types';
import { deleteChunk, deleteDraft, readChunks, readDraft, saveChunk, saveDraft } from '@/features/interview/storage';
import { usePersonVoice, type InterviewSpeechKind } from '@/features/interview/usePersonVoice';
import { personalizeGreeting } from '@/features/interview/personalizeGreeting';
import { useSpokenAnswer } from '@/features/interview/useSpokenAnswer';
import { useBrowserAnswer } from '@/features/interview/useBrowserAnswer';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
const InterviewerAvatar = dynamic(() => import('@/features/interview/InterviewerAvatar'), { ssr: false });
type RoomPhase = 'lobby' | 'greeting' | 'readiness' | 'interview';

const languages = [['en-IN', 'English'], ['hi-IN', 'Hindi'], ['or-IN', 'Odia'], ['bn-IN', 'Bengali'], ['mr-IN', 'Marathi'], ['ta-IN', 'Tamil'], ['te-IN', 'Telugu'], ['kn-IN', 'Kannada'], ['ml-IN', 'Malayalam'], ['gu-IN', 'Gujarati'], ['pa-IN', 'Punjabi']];
const button = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2';
const primaryButton = `${button} border-primary-600 bg-primary-600 text-white hover:bg-primary-700 dark:hover:bg-primary-700`;

export function InterviewRoom({ sessionId, userId, candidateName, onFinish, onLeave }: {
  sessionId: string; userId: string; candidateName?: string; onFinish: (id: string) => void; onLeave: () => void;
}) {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<'answer' | 'code' | 'finish' | 'pause' | null>(null);
  const [roomPhase, setRoomPhase] = useState<RoomPhase>('lobby');
  const [avatarReady, setAvatarReady] = useState(false);
  const [audioActivated, setAudioActivated] = useState(false);
  const [warmUpCaption, setWarmUpCaption] = useState('');
  const [warmUpReply, setWarmUpReply] = useState<'ready' | 'nervous' | null>(null);
  const [arrivalLoaded, setArrivalLoaded] = useState(false);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [draftSeq, setDraftSeq] = useState<number | null>(null);
  const [draftState, setDraftState] = useState<'loading' | 'saving' | 'saved' | 'unavailable'>('loading');
  const [showCaptions, setShowCaptions] = useState(false);
  const [showText, setShowText] = useState(false);
  const [answerMode, setAnswerMode] = useState<'voice' | 'text'>('voice');
  const [speechSource, setSpeechSource] = useState<'gemini' | 'browser'>('gemini');
  const [autoListen, setAutoListen] = useState(true);
  const [autoPreferencesLoaded, setAutoPreferencesLoaded] = useState(false);
  const [speechNotice, setSpeechNotice] = useState('');
  const [finishingAnswer, setFinishingAnswer] = useState(false);
  const [spokenLanguage, setSpokenLanguage] = useState('en-IN');
  const [recording, setRecording] = useState(false);
  const [pendingChunks, setPendingChunks] = useState(0);
  const [mediaBusy, setMediaBusy] = useState(false);
  const microphoneActivated = useRef(false);
  const conversationGeneration = useRef(0);
  const spokenSubmission = useRef(false);
  const answerRef = useRef(''); answerRef.current = answer;
  const sessionRef = useRef(session); sessionRef.current = session;
  const autoListenRef = useRef(autoListen); autoListenRef.current = autoListen;
  const answerModeRef = useRef(answerMode); answerModeRef.current = answerMode;
  const speechSourceRef = useRef(speechSource); speechSourceRef.current = speechSource;
  const spokenLanguageRef = useRef(spokenLanguage); spokenLanguageRef.current = spokenLanguage;
  const mounted = useRef(false);
  const recordingRequest = useRef(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const answerInput = useRef<HTMLTextAreaElement | null>(null);
  const history = useRef<HTMLDivElement | null>(null);
  const firstLoad = useRef(true);
  const actionInFlight = useRef(false);
  const lastSpokenKey = useRef('');
  const turnId = useRef<string>(crypto.randomUUID());
  const draftWrites = useRef<Promise<unknown>>(Promise.resolve());
  const draftWriteVersion = useRef(0);
  const restoredDraftSeq = useRef<number | null>(null);
  const chunkWrites = useRef<Promise<unknown>>(Promise.resolve());
  const flushQueue = useRef<Promise<void>>(Promise.resolve());
  const finishing = useRef(false);
  const warmUpRequest = useRef(0);
  const finishCallback = useRef(onFinish);
  finishCallback.current = onFinish;
  const draftKey = `${userId}:${sessionId}:${session?.seq ?? 0}`;
  const coding = session?.setup.interviewType === 'Coding / Programming Interview';
  const voice = usePersonVoice(userId);
  const stopVoice = voice.stop;
  const onSpeechFailure = (failure: { code: string; message: string }) => {
    conversationGeneration.current += 1; setSpeechNotice(failure.message);
    if (failure.code !== 'limit') { setShowText(true); setShowCaptions(true); }
    if (!['limit', 'transcription-failed'].includes(failure.code)) {
      microphoneActivated.current = false; setAnswerMode('text'); setShowCaptions(true);
    }
  };
  const geminiCapture = useSpokenAnswer({
    onText: text => { if (speechSourceRef.current === 'gemini') { answerRef.current = text; setAnswer(text); } },
    onListening: () => { if (speechSourceRef.current === 'gemini') { microphoneActivated.current = true; setSpeechNotice(''); } },
    onFailure: onSpeechFailure,
  });
  const browserCapture = useBrowserAnswer({
    onText: text => { if (speechSourceRef.current === 'browser') { answerRef.current = text; setAnswer(text); } },
    onListening: () => { if (speechSourceRef.current === 'browser') { microphoneActivated.current = true; setSpeechNotice(''); } },
    onFailure: onSpeechFailure,
  });
  const capture = speechSource === 'gemini' ? geminiCapture : browserCapture;
  const speechSupported = capture.supported;
  const listening = capture.status === 'listening';
  const dictationRequested = listening || capture.status === 'starting';
  const interim = capture.partial;
  const hasSpokenAudio = speechSource === 'gemini' ? geminiCapture.hasCapture : Boolean(answer.trim() || interim);
  const captureBusy = capture.status === 'finishing' || capture.status === 'transcribing';
  const cancelCapture = useCallback(() => { geminiCapture.cancel(); browserCapture.cancel(); }, [geminiCapture.cancel, browserCapture.cancel]);
  const firstName = candidateName?.trim().split(/\s+/)[0]?.slice(0, 40);
  const arrivalKey = `careerai:person-room:v1:${userId}:${sessionId}`;
  const voiceSessionKey = `${arrivalKey}:spoken`;
  const hasBegun = roomPhase === 'interview' || Boolean(session?.turns.length) || Boolean(session?.readyToComplete);
  const rawIntroduction = `Hi. I'm Alex, your AI practice interviewer. It's nice to meet you. We'll practice for your ${session?.setup.role || 'upcoming'} interview together, one question at a time. Before we begin, how are you feeling today?`;
  const introduction = personalizeGreeting(rawIntroduction, firstName);

  useEffect(() => {
    setAudioActivated(false); setWarmUpCaption(''); setWarmUpReply(null);
    microphoneActivated.current = false; conversationGeneration.current += 1; cancelCapture(); stopVoice();
    try {
      setRoomPhase(localStorage.getItem(arrivalKey) === 'interview' ? 'interview' : 'lobby');
      lastSpokenKey.current = sessionStorage.getItem(voiceSessionKey) || '';
    } catch { /* Blocked storage never prevents starting an interview. */ }
    setArrivalLoaded(true);
  }, [arrivalKey, voiceSessionKey, stopVoice, cancelCapture]);

  useEffect(() => {
    try { const saved = localStorage.getItem(`careerai:auto-listen:v1:${userId}`); if (saved === 'false' || saved === 'true') setAutoListen(saved === 'true'); } catch { /* Optional preference. */ }
    setAutoPreferencesLoaded(true);
  }, [userId]);
  useEffect(() => {
    if (!autoPreferencesLoaded) return;
    try { localStorage.setItem(`careerai:auto-listen:v1:${userId}`, String(autoListen)); } catch { /* Choice still works now. */ }
  }, [autoListen, userId, autoPreferencesLoaded]);
  useEffect(() => {
    if (voice.error || (voice.preferencesLoaded && !voice.supported)) { setShowCaptions(true); setShowText(true); }
  }, [voice.error, voice.preferencesLoaded, voice.supported]);
  useEffect(() => {
    if (arrivalLoaded && hasBegun && !speechSupported) {
      setShowCaptions(true); setShowText(true); setAnswerMode('text');
      setSpeechNotice(previous => previous || 'Voice input is unavailable in this browser. You can type your answer below.');
    }
  }, [arrivalLoaded, hasBegun, speechSupported]);

  const load = useCallback(async () => {
    const response = await apiClient.get<ApiResult<InterviewSession>>(`interview/session/${sessionId}/state`);
    if (firstLoad.current) {
      firstLoad.current = false;
      setWelcomeBack(response.data.data.turns.length > 0);
      if (response.data.data.turns.length > 0) setRoomPhase('interview');
    }
    setSession(response.data.data);
    return response.data.data;
  }, [sessionId]);

  useEffect(() => { load().catch(e => setError(errorMessage(e))); }, [load]);
  useEffect(() => {
    if (!session || session.status === 'abandoned') return;
    if (session.status === 'completed' && session.interviewId) {
      finishCallback.current(session.interviewId);
      return;
    }
    if (session.status === 'evaluating' || (!session.question && !session.readyToComplete)) {
      const timer = setTimeout(() => load().catch(e => setError(errorMessage(e))), 2000);
      return () => clearTimeout(timer);
    }
  }, [session, load]);

  useEffect(() => {
    if (session?.seq === undefined) return;
    let cancelled = false;
    setDraftSeq(null);
    setDraftState('loading');
    conversationGeneration.current += 1; cancelCapture(); setAnswer(''); answerRef.current = ''; setCode('');
    readDraft(draftKey).then(draft => {
      if (cancelled) return;
      setAnswer(draft?.answer || ''); setCode(draft?.code || ''); setLanguage(draft?.language || 'javascript');
      turnId.current = draft?.clientTurnId || crypto.randomUUID();
      setDraftSeq(session.seq);
      setDraftState(draft ? 'saved' : 'saving');
      if (draft?.answer || draft?.code) {
        setShowText(true);
        restoredDraftSeq.current = session.seq;
        setNotice('Your unfinished answer was restored from this browser.');
      }
    }).catch(() => {
      if (cancelled) return;
      setDraftSeq(session.seq);
      setDraftState('unavailable');
      setNotice('Local recovery storage is unavailable. Submitted answers still save to your account.');
    });
    return () => { cancelled = true; };
  }, [draftKey, session?.seq, cancelCapture]);

  useEffect(() => {
    if (restoredDraftSeq.current !== null && (restoredDraftSeq.current !== session?.seq || session?.status !== 'active')) {
      restoredDraftSeq.current = null;
      setNotice(previous => previous === 'Your unfinished answer was restored from this browser.' ? '' : previous);
    }
  }, [session?.seq, session?.status]);

  useEffect(() => {
    if (!session || draftSeq !== session.seq || session.status !== 'active') return;
    const draft = { key: draftKey, sessionId, seq: session.seq, answer, code, language, clientTurnId: turnId.current };
    const version = ++draftWriteVersion.current;
    setDraftState('saving');
    draftWrites.current = draftWrites.current.then(() => saveDraft(draft)).then(() => {
      if (version === draftWriteVersion.current) setDraftState('saved');
    }).catch(() => {
      if (version === draftWriteVersion.current) setDraftState('unavailable');
      setNotice('Draft could not be saved on this device. Keep this tab open until you submit.');
    });
  }, [answer, code, language, draftKey, draftSeq, session?.seq, session?.status, sessionId]);

  const flushChunks = useCallback(() => {
    // Each caller waits for its own pass, including chunks saved during an earlier upload.
    const task = flushQueue.current.then(async () => {
      try {
        const chunks = (await readChunks(sessionId)).sort((a, b) => a.seq - b.seq);
        setPendingChunks(chunks.length);
        for (const chunk of chunks) {
          const form = new FormData();
          form.append('chunk', chunk.blob, 'chunk');
          form.append('mimeType', chunk.mimeType);
          await apiClient.post(`interview/session/${sessionId}/recordings/${chunk.segmentId}/${chunk.seq}`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
          await deleteChunk(chunk.key);
          setPendingChunks(n => Math.max(0, n - 1));
        }
      } catch (e) { setNotice(`Recording upload paused. Saved chunks will retry when connected. ${errorMessage(e)}`); }
    });
    flushQueue.current = task;
    return task;
  }, [sessionId]);

  useEffect(() => {
    void flushChunks();
    const timer = setInterval(() => void flushChunks(), 10000);
    const online = () => void flushChunks();
    window.addEventListener('online', online);
    return () => { clearInterval(timer); window.removeEventListener('online', online); };
  }, [flushChunks]);

  const pauseForInterviewer = useCallback(() => {
    conversationGeneration.current += 1; cancelCapture(); stopVoice();
  }, [cancelCapture, stopVoice]);
  const stopSpeech = useCallback(() => {
    microphoneActivated.current = false; pauseForInterviewer();
  }, [pauseForInterviewer]);

  useEffect(() => {
    mounted.current = true;
    const beforeUnload = (event: BeforeUnloadEvent) => { if (!finishing.current) event.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      mounted.current = false;
      warmUpRequest.current += 1;
      conversationGeneration.current += 1; microphoneActivated.current = false;
      recordingRequest.current += 1;
      window.removeEventListener('beforeunload', beforeUnload);
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, [sessionId]);

  const startRecording = async () => {
    if (!mounted.current || !session || !session.consent.recordAudio || recording || mediaBusy) return;
    const request = ++recordingRequest.current;
    let acquiredMedia: MediaStream | null = null;
    setMediaBusy(true);
    try {
      if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('Recording is unavailable in this browser. You can continue with typed answers.');
      const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: session.consent.recordVideo });
      acquiredMedia = media;
      if (!mounted.current || recordingRequest.current !== request) {
        media.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current = media;
      const choices = session.consent.recordVideo ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'] : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType = choices.find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('No compatible recording format is available. Typed and spoken answers still work.');
      const rec = new MediaRecorder(media, { mimeType, videoBitsPerSecond: 500000, audioBitsPerSecond: 48000 });
      const segmentId = crypto.randomUUID(); let seq = 0;
      rec.ondataavailable = event => {
        if (!event.data.size) return;
        const chunkSeq = seq++;
        const chunk = { key: `${sessionId}:${segmentId}:${chunkSeq}`, sessionId, segmentId, seq: chunkSeq, mimeType, blob: event.data };
        chunkWrites.current = chunkWrites.current.then(async () => {
          await saveChunk(chunk); setPendingChunks(n => n + 1);
        }).catch(() => {
          if (rec.state === 'recording') rec.stop();
          media.getTracks().forEach(track => track.stop()); setRecording(false);
          setNotice('Recording stopped because local storage is full or unavailable. Submitted answers remain saved.');
        });
      };
      rec.onerror = () => setNotice('Recording encountered an error. Your saved transcript is unaffected.');
      recorder.current = rec; rec.start(5000); setRecording(true);
      if (video.current) video.current.srcObject = media;
    } catch (e) {
      acquiredMedia?.getTracks().forEach(track => track.stop());
      if (mounted.current && recordingRequest.current === request) setNotice(errorMessage(e));
    } finally {
      if (mounted.current && recordingRequest.current === request) setMediaBusy(false);
    }
  };

  const stopRecording = async () => {
    const rec = recorder.current;
    if (rec && rec.state !== 'inactive') await new Promise<void>(resolve => { rec.addEventListener('stop', () => resolve(), { once: true }); rec.stop(); });
    stream.current?.getTracks().forEach(track => track.stop());
    setRecording(false);
    await chunkWrites.current;
    await flushChunks();
  };

  const submit = async (skip = false, spoken?: { text: string; inputMode: 'speech' }) => {
    if (!session?.question || actionInFlight.current || draftSeq !== session.seq) return;
    const responseText = spoken?.text ?? `${answerRef.current} ${capture.partial}`.trim();
    if (skip && (responseText || code.trim() || hasSpokenAudio || dictationRequested) && !window.confirm('Skip this question? Your unfinished answer, audio and code will not be submitted.')) return;
    const combined = skip ? '[Skipped question]' : coding && code.trim() ? `${responseText}\n\nSubmitted code (${language}):\n${code}`.trim() : responseText;
    if (!combined) { setSpeechNotice('I didn’t hear an answer. Try Speak answer again, type, or choose Skip question.'); return; }
    actionInFlight.current = true;
    const inputMode = spoken?.inputMode || 'text';
    setBusy(true); setBusyAction('answer'); setError(''); pauseForInterviewer();
    try {
      await draftWrites.current;
      const response = await apiClient.post<ApiResult<InterviewSession>>(`interview/session/${sessionId}/turn`, {
        seq: session.seq, clientTurnId: turnId.current, answer: combined, inputMode,
      });
      await deleteDraft(draftKey);
      setSession(response.data.data); setOutput(''); setSpeechNotice('');
      setWelcomeBack(false);
      setNotice(previous => previous === 'Your unfinished answer was restored from this browser.' ? '' : previous);
    } catch (e) {
      setError(errorMessage(e));
      // The answer may have committed before next-question generation failed.
      try {
        const saved = await load();
        if (saved.seq > session.seq) setNotice(previous => previous === 'Your unfinished answer was restored from this browser.' ? '' : previous);
      } catch { /* Retry remains available; the draft stays local. */ }
    } finally { actionInFlight.current = false; setBusy(false); setBusyAction(null); }
  };

  const finish = async () => {
    if (!session || actionInFlight.current) return;
    if ((answer.trim() || code.trim() || capture.partial.trim() || hasSpokenAudio || dictationRequested) && !session.readyToComplete && !window.confirm('Finish using submitted answers? Your current unfinished draft and audio will not be scored.')) return;
    actionInFlight.current = true; setBusy(true); setBusyAction('finish'); setError(''); stopSpeech();
    try {
      await stopRecording();
      const remaining = session.consent.recordAudio ? await readChunks(sessionId) : [];
      if (remaining.length) throw new Error('Some recording chunks have not uploaded. Retry uploads before finishing, or pause and return later.');
      const response = await apiClient.post<ApiResult<InterviewSession>>(`interview/session/${sessionId}/complete`);
      finishing.current = true; setSession(response.data.data);
    } catch (e) { setError(errorMessage(e)); }
    finally { actionInFlight.current = false; setBusy(false); setBusyAction(null); }
  };

  const runCode = async () => {
    if (!session || actionInFlight.current) return;
    actionInFlight.current = true; setBusy(true); setBusyAction('code'); setOutput('Running in the code sandbox...');
    try {
      const response = await apiClient.post<ApiResult<{ output: string }>>('interview/code/run', { sessionId, seq: session.seq, language, code });
      setOutput(response.data.data.output);
    } catch (e) { setOutput(errorMessage(e)); }
    finally { actionInFlight.current = false; setBusy(false); setBusyAction(null); }
  };

  const readQuestion = useCallback(async () => {
    if (!session?.question || actionInFlight.current || spokenSubmission.current) return;
    if (geminiCapture.hasCapture && !window.confirm('Replay Alex? Your unsent microphone audio will be discarded. Your text draft will stay.')) return;
    pauseForInterviewer();
    const token = conversationGeneration.current; const seq = session.seq;
    voice.prime(); setAudioActivated(true);
    const prefix = session.question.acknowledgement || '';
    lastSpokenKey.current = `${sessionId}:${session.seq}`;
    try { sessionStorage.setItem(voiceSessionKey, lastSpokenKey.current); } catch { /* Replay still works without storage. */ }
    let recovered = false;
    const result = await voice.speak(`${prefix} ${session.question.question}`.trim(), { sessionId, seq, kind: 'question', onEnded: fallback => { recovered = fallback; } });
    if (!mounted.current || token !== conversationGeneration.current || sessionRef.current?.seq !== seq) return;
    if (result === 'failed' || recovered) { microphoneActivated.current = false; setShowCaptions(true); setShowText(true); return; }
    if (result === 'ended' && autoListenRef.current && microphoneActivated.current && answerModeRef.current === 'voice'
      && sessionRef.current?.status === 'active' && sessionRef.current.question && !sessionRef.current.readyToComplete) {
      const selected = speechSourceRef.current === 'gemini' ? geminiCapture : browserCapture;
      await selected.start(answerRef.current, spokenLanguageRef.current, { sessionId, seq });
    }
  }, [session?.question, session?.seq, sessionId, pauseForInterviewer, voice.speak, voice.prime, voiceSessionKey,
    geminiCapture.hasCapture, geminiCapture.start, browserCapture.start]);

  useEffect(() => {
    if (!session || session.status !== 'active') { stopVoice(); return; }
    if (!hasBegun || !arrivalLoaded || !avatarReady || !audioActivated || !voice.preferencesLoaded || !voice.enabled || !voice.supported
      || listening || dictationRequested || busy || finishingAnswer || draftSeq !== session.seq || !session.question || session.readyToComplete) return;
    const key = `${sessionId}:${session.seq}`;
    if (lastSpokenKey.current === key) return;
    void readQuestion();
  }, [session?.status, session?.seq, session?.question, session?.readyToComplete, hasBegun, arrivalLoaded, avatarReady, audioActivated,
    voice.preferencesLoaded, voice.enabled, voice.supported, listening, dictationRequested, busy, finishingAnswer, draftSeq, sessionId, readQuestion, stopVoice]);

  useEffect(() => {
    if (history.current) history.current.scrollTop = history.current.scrollHeight;
  }, [session?.turns.length]);

  const startQuestions = () => {
    warmUpRequest.current += 1;
    stopSpeech(); setRoomPhase('interview');
    try { localStorage.setItem(arrivalKey, 'interview'); }
    catch { setNotice('This browser cannot remember the welcome. Your submitted answers still save to your account.'); }
  };

  const speakWelcome = (kind: InterviewSpeechKind, text: string) => {
    voice.prime();
    return voice.speak(text, { sessionId, seq: 0, kind, onCaption: setWarmUpCaption });
  };

  const join = (withAudio: boolean) => {
    if (!avatarReady || !session?.question) return;
    warmUpRequest.current += 1; stopSpeech();
    voice.setEnabled(withAudio); setAudioActivated(withAudio);
    if (!withAudio) { setShowCaptions(true); setShowText(true); setAnswerMode('text'); }
    setRoomPhase('greeting'); setWarmUpReply(null); setWarmUpCaption(introduction);
    if (withAudio && voice.supported) void speakWelcome('greeting', introduction);
  };

  const replyToWelcome = async (reply: 'ready' | 'nervous') => {
    const token = ++warmUpRequest.current;
    const text = reply === 'ready'
      ? "I'm glad you're ready. Take your time, and we'll work through this together. Let's begin."
      : "It's okay to feel nervous. This is a practice conversation, and you can take your time or skip a question. We'll go one step at a time. Let's begin.";
    stopSpeech(); setWarmUpReply(reply); setWarmUpCaption(text); setRoomPhase('readiness');
    if (!voice.enabled || !voice.supported) return;
    const result = await speakWelcome(reply === 'ready' ? 'warm_up_ready' : 'warm_up_nervous', text);
    if (mounted.current && warmUpRequest.current === token && result === 'ended') startQuestions();
  };

  const replayWelcome = () => {
    voice.setEnabled(true); setAudioActivated(true);
    const kind = roomPhase === 'readiness' ? warmUpReply === 'nervous' ? 'warm_up_nervous' : 'warm_up_ready' : 'greeting';
    void speakWelcome(kind, warmUpCaption || introduction);
  };

  const changeAudio = () => {
    const enabled = !voice.enabled;
    if (!enabled && geminiCapture.hasCapture && !window.confirm('Turn voice off? Your unsent microphone audio will be discarded. Your text draft will stay.')) return;
    if (!enabled) { stopSpeech(); setShowCaptions(true); }
    voice.setEnabled(enabled);
    if (enabled && roomPhase !== 'lobby') { voice.prime(); setAudioActivated(true); }
  };

  const startTalking = () => {
    if (busy || spokenSubmission.current || !session?.question || draftSeq !== session.seq) return;
    if (geminiCapture.hasCapture && !window.confirm('Start a new spoken answer? The audio kept for this question will be discarded.')) return;
    pauseForInterviewer(); setAnswerMode('voice'); answerModeRef.current = 'voice'; setShowText(false); setSpeechNotice('');
    void capture.start(answerRef.current, spokenLanguage, { sessionId, seq: session.seq });
  };

  const muteMicrophone = async () => {
    microphoneActivated.current = false; conversationGeneration.current += 1;
    if (capture.status === 'starting') { cancelCapture(); return; }
    if (speechSource === 'gemini') await geminiCapture.pause();
    else await browserCapture.finish();
  };

  const finishSpokenAnswer = async () => {
    if (busy || spokenSubmission.current || !session?.question || draftSeq !== session.seq) return;
    spokenSubmission.current = true; setFinishingAnswer(true); setSpeechNotice('');
    const token = ++conversationGeneration.current; const seq = session.seq; stopVoice();
    try {
      const result = await capture.finish();
      if (!mounted.current || token !== conversationGeneration.current || sessionRef.current?.seq !== seq) return;
      if (result.kind === 'complete' && result.text.trim()) await submit(false, { text: result.text, inputMode: 'speech' });
      else if (result.kind === 'complete') { microphoneActivated.current = false; setSpeechNotice('I didn’t hear an answer. Try Speak answer again.'); }
    } finally { spokenSubmission.current = false; if (mounted.current) setFinishingAnswer(false); }
  };

  const typeInstead = () => {
    if (geminiCapture.hasCapture && !window.confirm('Switch to typing? Your unsent microphone audio will be discarded. Any transcribed or typed draft will stay.')) return;
    stopSpeech(); setAnswerMode('text'); answerModeRef.current = 'text'; setShowText(true); setShowCaptions(true);
    requestAnimationFrame(() => answerInput.current?.focus());
  };

  const cancelSpokenAnswer = () => {
    if (geminiCapture.hasCapture && !window.confirm('Discard the microphone audio for this answer? Your text draft will stay.')) return;
    stopSpeech(); setSpeechNotice('Microphone stopped. Choose Speak answer when you’re ready.');
  };

  const leave = async () => {
    if (actionInFlight.current || mediaBusy) return;
    if (geminiCapture.hasCapture && !window.confirm('Pause and leave? Unsent microphone audio will be discarded. Your saved answers and text draft will stay.')) return;
    warmUpRequest.current += 1;
    actionInFlight.current = true; setBusy(true); setBusyAction('pause'); stopSpeech();
    try { await draftWrites.current; await stopRecording(); onLeave(); }
    catch (e) { setError(errorMessage(e)); }
    finally { actionInFlight.current = false; setBusy(false); setBusyAction(null); }
  };

  const isActive = session?.status === 'active';
  const followUp = session?.question?.turnKind === 'follow_up' || session?.question?.isFollowUp;
  const speakerStatus = voice.speaking ? 'Alex is speaking' : voice.loading ? 'Preparing Alex’s voice' : listening ? 'Listening to your answer'
    : capture.status === 'transcribing' ? 'Transcribing your answer' : capture.status === 'finishing' ? 'Finishing microphone capture'
    : dictationRequested ? 'Starting your microphone' : busyAction === 'answer' ? 'Saving your answer'
      : session?.status === 'evaluating' ? 'Preparing your feedback' : hasBegun ? 'Ready when you are' : roomPhase === 'lobby' ? 'Ready to meet you' : 'How are you feeling?';
  const deadlinePassed = session ? new Date(session.deadlineAt).getTime() <= Date.now() : false;

  const controlsDisabled = busy || finishingAnswer || !session?.question || draftSeq !== session?.seq;
  return <div data-room-phase={hasBegun ? 'interview' : roomPhase} className="min-h-screen bg-[#f6f5f2] text-slate-900 dark:bg-slate-950 dark:text-slate-100 [overflow-wrap:anywhere]">
    <div className="mx-auto w-full min-w-0 max-w-5xl px-4 py-4 sm:px-7 sm:py-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">Your practice room</p><h1 className="mt-1 text-lg font-semibold leading-tight sm:text-xl">{session?.setup.role || 'Getting your room ready'}</h1><p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{session?.setup.interviewType || 'Loading your saved interview...'}</p></div>
        <div className="flex items-center gap-3">{session && <span className="text-xs text-slate-600 dark:text-slate-300">{session.turns.length} {session.turns.length === 1 ? 'answer' : 'answers'} saved</span>}<button className={`${button} px-3 py-2 text-xs`} disabled={busy || mediaBusy} onClick={() => void leave()}><Pause className="h-3.5 w-3.5" />{busyAction === 'pause' ? 'Pausing...' : 'Pause and leave'}</button></div>
      </header>
      {error && <div role="alert" className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error} <button className="ml-2 underline" onClick={() => { setError(''); load().catch(e => setError(errorMessage(e))); }}>Retry loading saved session</button></div>}
      {notice && <p role="status" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{notice}</p>}
      <main className="min-w-0 space-y-4">
        <section aria-label="AI interviewer video stage" data-avatar-ready={avatarReady} data-voice-mode={voice.mode} data-voice-status={voice.speaking ? 'speaking' : voice.loading ? 'loading' : 'idle'} data-microphone-status={capture.status} className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="relative aspect-[4/3] w-full max-h-[420px] overflow-hidden bg-[#e7e3dd] sm:aspect-auto sm:h-[420px]">
            <InterviewerAvatar amplitude={voice.amplitude} speaking={voice.speaking} browserSpeech={voice.mode === 'browser'} onReady={() => setAvatarReady(true)} />
            <span className="absolute left-3 top-3 rounded-md border border-white/80 bg-white/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-700 sm:left-5 sm:top-4">AI practice interviewer</span>
            <div className="absolute bottom-3 left-3 rounded-lg bg-slate-950/75 px-3 py-2 text-white sm:bottom-4 sm:left-5"><h2 className="text-lg font-semibold leading-none">Alex</h2><p aria-live="polite" className="mt-1.5 flex items-center gap-2 text-xs"><span className={`h-1.5 w-1.5 rounded-full ${listening ? 'bg-emerald-400 motion-safe:animate-pulse' : voice.speaking ? 'bg-violet-300 motion-safe:animate-pulse' : 'bg-slate-300'}`} />{avatarReady ? speakerStatus : 'Getting Alex ready'}</p></div>
            {recording && <span role="status" className="absolute right-3 top-3 rounded-md bg-red-950/85 px-2 py-1 text-xs font-medium text-white">Recording on</span>}
          </div>
          {isActive && session && hasBegun && !session.readyToComplete && <div className="border-t border-slate-200 px-3 py-3 sm:px-5 dark:border-slate-700">
            <div aria-label="Conversation controls" className="flex flex-wrap items-center justify-center gap-2">
              {dictationRequested ? <button className={button} disabled={busy || finishingAnswer} onClick={() => void muteMicrophone()}><MicOff className="h-4 w-4" />{listening ? 'Mute microphone' : 'Cancel microphone'}</button> : <button className={answerMode === 'voice' ? primaryButton : button} disabled={controlsDisabled || !speechSupported} onClick={startTalking}><Mic className="h-4 w-4" />Speak answer</button>}
              <button className={listening || hasSpokenAudio ? primaryButton : button} disabled={busy || finishingAnswer || !session.question || draftSeq !== session.seq || (!listening && !hasSpokenAudio)} onClick={() => void finishSpokenAnswer()}><Check className="h-4 w-4" />{capture.status === 'transcribing' ? 'Transcribing...' : capture.status === 'finishing' ? 'Finishing...' : busyAction === 'answer' ? 'Saving...' : speechNotice && hasSpokenAudio ? 'Retry answer' : 'Finish answer'}</button>
              <button className={button} disabled={controlsDisabled || !avatarReady || !voice.supported || captureBusy} onClick={() => void readQuestion()}><Volume2 className="h-4 w-4" />{audioActivated ? 'Replay question' : 'Hear question'}</button>
              <button className={`${button} px-3`} aria-pressed={showCaptions} aria-label="Question captions" onClick={() => setShowCaptions(value => !value)}><Captions className="h-4 w-4" /><span className="text-xs">Captions</span></button>
              <button className={`${button} px-3`} disabled={busy} onClick={typeInstead}><Keyboard className="h-4 w-4" />Type instead</button>
            </div>
            {(voice.speaking || voice.loading) && <div className="mt-2 text-center"><button className="text-xs font-semibold text-primary-700 underline dark:text-primary-300" aria-label="Stop speaking" onClick={stopSpeech}>{voice.loading ? 'Cancel voice' : 'Stop speaking'}</button></div>}
            {captureBusy && <div className="mt-2 text-center"><button className="text-xs font-semibold text-primary-700 underline dark:text-primary-300" onClick={cancelSpokenAnswer}>Cancel spoken answer</button></div>}
            {listening && <p role="status" className="mt-2 text-center text-xs text-emerald-800 dark:text-emerald-300">Microphone on{speechSource === 'gemini' ? ` | ${geminiCapture.seconds}s / 120s` : ''}. Speak naturally, then choose Finish answer.</p>}
            {!dictationRequested && hasSpokenAudio && !captureBusy && !finishingAnswer && <p className="mt-2 text-center text-xs text-slate-600 dark:text-slate-400">{speechSource === 'gemini' ? 'Audio kept for this question. Finish answer transcribes and sends it.' : 'Your transcript is ready. Finish answer sends it.'}</p>}
            {!microphoneActivated.current && !hasSpokenAudio && !finishingAnswer && <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] leading-5 text-slate-500 dark:text-slate-400">Speak answer enables your microphone. Audio is processed by Gemini for transcription; browser dictation is optional. Only submitted text is saved as your answer. Optional recordings are separate.</p>}
          </div>}
        </section>
        {speechNotice && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{speechNotice}</p>}
        {voice.error && <p role="status" className="text-sm text-amber-800 dark:text-amber-300">{voice.error} You can replay, read captions, or type.</p>}
        {!session && <p role="status" className="py-3 text-sm text-slate-600 dark:text-slate-400">Loading your saved interview and unfinished draft...</p>}
        {session?.status === 'abandoned' && <section className="py-4"><h2 className="text-xl font-semibold">This session was discarded.</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Return to setup to begin another practice interview.</p></section>}
        {session?.status === 'evaluating' && <section aria-live="polite" className="py-4"><h2 className="text-xl font-semibold">{session.evaluationStatus === 'failed' ? 'Your answers are safe. Try your report again.' : 'Thanks for the conversation. Your feedback is on its way.'}</h2><p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{session.turns.length} answers are saved. You can pause and return from interview setup.</p>{session.evaluationStatus === 'failed' && <button className={`${primaryButton} mt-4`} onClick={async () => { try { await apiClient.post(`interview/session/${sessionId}/retry-evaluation`); await load(); } catch (e) { setError(errorMessage(e)); } }}>Retry report generation<ArrowRight className="h-4 w-4" /></button>}</section>}
        {isActive && session && !hasBegun && arrivalLoaded && roomPhase === 'lobby' && <section className="mx-auto max-w-2xl pb-2 text-center"><h2 className="text-xl font-semibold">Your interview starts with a hello.</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">Settle in{firstName ? `, ${firstName}` : ''}. Alex will greet you before the first question.</p><div className="mt-4 flex flex-wrap justify-center gap-3"><button className={primaryButton} disabled={!session.question || !avatarReady || !voice.supported || !voice.preferencesLoaded || busy} onClick={() => join(true)}><Volume2 className="h-4 w-4" />Join with voice<ArrowRight className="h-4 w-4" /></button><button className={button} disabled={!session.question || !avatarReady || busy} onClick={() => join(false)}>Join without audio</button></div><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Microphone and camera stay off until you choose to use them.</p>{!avatarReady && <p role="status" className="mt-2 text-xs text-slate-500">Getting Alex ready before we say hello...</p>}</section>}
        {isActive && session && !hasBegun && arrivalLoaded && (roomPhase === 'greeting' || roomPhase === 'readiness') && <section aria-label="Unscored welcome" className="mx-auto max-w-2xl pb-2 text-center">
          {(showCaptions || !voice.enabled) && <p data-testid="welcome-caption" aria-live="polite" className="text-sm leading-7 text-slate-700 dark:text-slate-200">{warmUpCaption || introduction}</p>}
          {roomPhase === 'greeting' && <><h2 className="text-lg font-semibold">How are you feeling today?</h2><div className="mt-3 flex flex-wrap justify-center gap-3"><button className={primaryButton} onClick={() => void replyToWelcome('ready')}>Ready to begin<ArrowRight className="h-4 w-4" /></button><button className={button} onClick={() => void replyToWelcome('nervous')}>A little nervous</button></div></>}
          <div className="mt-3 flex flex-wrap justify-center gap-3">{voice.supported && <button className={`${button} px-3 text-xs`} disabled={voice.loading} onClick={replayWelcome}><Volume2 className="h-3.5 w-3.5" />{roomPhase === 'greeting' ? 'Replay greeting' : 'Replay reassurance'}</button>}<button className={`${roomPhase === 'readiness' ? primaryButton : button} text-xs`} onClick={startQuestions}>Start questions<ArrowRight className="h-4 w-4" /></button><button className={`${button} text-xs`} aria-pressed={showCaptions} aria-label="Welcome captions" onClick={() => setShowCaptions(value => !value)}><Captions className="h-4 w-4" />Captions</button>{(voice.speaking || voice.loading) && <button className={`${button} text-xs`} aria-label="Stop speaking" onClick={stopSpeech}><VolumeX className="h-4 w-4" />Stop speaking</button>}</div><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">This welcome is not scored or saved as an answer.</p>
        </section>}
        {isActive && session && hasBegun && <>
          {welcomeBack && <p className="text-xs text-slate-600 dark:text-slate-400">Welcome back{firstName ? `, ${firstName}` : ''}. We will continue from your saved answer.</p>}
          {session.readyToComplete ? <section className="py-4"><h2 className="text-2xl font-semibold">{deadlinePassed ? 'Your saved answers are ready for feedback.' : 'Thanks for sharing your thoughts.'}</h2><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{session.turns.length ? 'Your report will highlight strengths, areas to improve, and what to work on next.' : 'This session expired before an answer was submitted. Return to setup to discard it and begin again.'}</p><button className={`${primaryButton} mt-4`} disabled={busy || mediaBusy || !session.turns.length} onClick={() => void finish()}>Finish and view report<ArrowRight className="h-4 w-4" /></button></section> : <>
            {(showCaptions || coding || !voice.enabled) && <section aria-label="Question captions" className="rounded-xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900"><p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300">{followUp ? 'Follow-up' : `Question ${session.seq + 1}`} | {session.question?.category}</p>{session.question?.acknowledgement && <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">{session.question.acknowledgement}</p>}<h3 data-testid="current-question" className="whitespace-pre-wrap text-base font-medium leading-7">{session.question?.question || 'Alex is preparing your next question...'}</h3></section>}
            {coding && <section aria-label="Coding workspace" className="min-w-0 overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700"><div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 dark:bg-slate-900"><h4 className="flex items-center gap-2 text-sm font-semibold"><Code2 className="h-4 w-4" />Your code</h4><div className="flex items-center gap-2"><label htmlFor="coding-language" className="text-xs text-slate-500">Code language</label><select id="coding-language" className="rounded border border-slate-300 bg-white p-1.5 text-sm dark:border-slate-700 dark:bg-slate-900" value={language} disabled={busy || finishingAnswer} onChange={e => setLanguage(e.target.value)}><option value="javascript">JavaScript</option><option value="python">Python</option><option value="java">Java</option><option value="cpp">C++</option></select></div></div><Editor height="280px" language={language} theme="vs-dark" value={code} onChange={value => setCode(value || '')} options={{ minimap: { enabled: false }, readOnly: busy || finishingAnswer || !session.question || draftSeq !== session.seq, fontSize: 14, automaticLayout: true, scrollBeyondLastLine: false, wordWrap: 'on' }} /><div className="space-y-3 bg-white p-4 dark:bg-slate-900"><button className={button} disabled={busy || finishingAnswer || !session.question || !code.trim()} onClick={() => void runCode()}>{busyAction === 'code' ? 'Running code...' : 'Run code'}</button><pre role="status" className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">{output || 'Run your solution to check the output.'}</pre><details className="text-xs leading-5 text-slate-500"><summary className="cursor-pointer">Code runner details</summary><p className="mt-2">Run code sends your solution to the configured public Judge0 service. Defined tasks read standard input and compare expected output. Java uses class Main. Your code is submitted with your explanation when you send your answer.</p></details></div></section>}
            {showText && <section aria-label="Optional typed answer" className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><label htmlFor="interview-answer" className="mb-2 block text-sm font-semibold">Your answer</label><textarea ref={answerInput} id="interview-answer" rows={3} className="min-h-[104px] w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm leading-6 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950" maxLength={16000} value={answer} onChange={e => { answerRef.current = e.target.value; setAnswer(e.target.value); }} disabled={busy || finishingAnswer || dictationRequested || geminiCapture.hasCapture || !session.question || draftSeq !== session.seq} placeholder={coding ? 'Explain your approach, or submit your code with a short explanation.' : 'Share your answer in your own words...'} />{geminiCapture.hasCapture && <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">Audio is kept for retry. Choose Type instead to discard it and edit or send a text answer.</p>}<div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500 dark:text-slate-400">{draftState === 'saved' ? 'Draft kept on this device' : draftState === 'saving' ? 'Saving your draft...' : draftState === 'unavailable' ? 'Local draft storage unavailable' : 'Restoring your draft...'}</p><button className={primaryButton} disabled={controlsDisabled || dictationRequested || geminiCapture.hasCapture} onClick={() => void submit()}>{busyAction === 'answer' ? 'Saving...' : 'Submit answer'}<Send className="h-4 w-4" /></button></div></section>}
            {interim && <p aria-live="polite" className="text-sm text-slate-600 dark:text-slate-400">{interim}</p>}
            <div className="flex justify-end"><button className="text-xs font-semibold text-slate-600 underline dark:text-slate-300" disabled={busy || finishingAnswer || !session.question || draftSeq !== session.seq} onClick={() => void submit(true)}>Skip question</button></div>
          </>}
        </>}
        {session?.consent.recordAudio && isActive && hasBegun && recording && !settingsOpen && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 px-3 py-2 dark:border-red-900"><span className="text-xs">Optional recording on | {pendingChunks} chunks queued</span><button className={`${button} py-1.5 text-xs`} disabled={busy || mediaBusy} onClick={async () => { setMediaBusy(true); try { await stopRecording(); } finally { setMediaBusy(false); } }}><Square className="h-3.5 w-3.5" />Stop recording</button></div>}
        <section aria-label="Interviewer and session controls" className="border-t border-slate-200 pt-3 dark:border-slate-800">
          <button type="button" aria-expanded={settingsOpen} aria-controls="interview-settings" className="flex w-full items-center justify-between py-1 text-xs font-semibold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-300" onClick={() => setSettingsOpen(value => !value)}>Interview settings<span aria-hidden="true">{settingsOpen ? '-' : '+'}</span></button>
          <div id="interview-settings" className={settingsOpen ? 'mt-3 space-y-4 pb-3' : 'hidden'}>
            <div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" role="switch" aria-label="Interviewer voice" checked={voice.enabled && voice.supported} disabled={!voice.supported} onChange={changeAudio} className="h-4 w-4 accent-violet-600" />Interviewer voice</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" role="switch" aria-label="Automatic listening" checked={autoListen} onChange={e => { setAutoListen(e.target.checked); if (!e.target.checked) microphoneActivated.current = false; }} className="h-4 w-4 accent-violet-600" />Automatic listening</label></div><p className="text-xs leading-5 text-slate-500 dark:text-slate-400">After you enable the microphone, automatic listening starts your next answer only when Alex finishes speaking. Mute or Type instead turns it off for this conversation until you choose Speak answer again.</p>
            <div className="flex flex-wrap gap-4"><div><label htmlFor="speech-language" className="mb-1 block text-xs font-medium">Answer language</label><select id="speech-language" className="max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" value={spokenLanguage} disabled={dictationRequested || captureBusy || finishingAnswer || hasSpokenAudio} onChange={e => setSpokenLanguage(e.target.value)}>{languages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><label htmlFor="transcription-provider" className="mb-1 block text-xs font-medium">Transcription</label><select id="transcription-provider" className="max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" value={speechSource} disabled={dictationRequested || captureBusy || finishingAnswer || hasSpokenAudio} onChange={e => { stopSpeech(); setSpeechSource(e.target.value === 'browser' ? 'browser' : 'gemini'); }}><option value="gemini">Gemini speech transcription</option><option value="browser">Browser dictation (optional)</option></select></div></div>
            {voice.browserSupported && <div><label htmlFor="interviewer-voice" className="mb-1 block text-xs font-medium">Voice choice</label><select id="interviewer-voice" className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" value={voice.voiceId} onChange={e => { if (geminiCapture.hasCapture && !window.confirm('Change voice? Your unsent microphone audio will be discarded. Your text draft will stay.')) return; stopSpeech(); voice.setVoiceId(e.target.value); }}><option value="">Browser default (English)</option>{voice.voices.map(item => <option key={item.voiceURI} value={item.voiceURI}>{item.name} ({item.lang})</option>)}</select><p className="mt-1 text-xs text-slate-500">Used only when natural Gemini interviewer audio is unavailable.</p></div>}
            {session?.consent.recordAudio && isActive && hasBegun && <section aria-label="Optional recording" className="space-y-2"><h3 className="flex items-center gap-2 text-sm font-semibold">{session.consent.recordVideo ? <Video className="h-4 w-4" /> : <Mic className="h-4 w-4" />}Your optional recording</h3>{session.consent.recordVideo && <div className="relative max-w-xs aspect-video overflow-hidden rounded-lg bg-slate-950"><video ref={video} autoPlay playsInline muted aria-label="Your camera preview" className="h-full w-full object-cover" />{!recording && <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-300">Camera is off</div>}</div>}<button className={button} disabled={busy || mediaBusy} onClick={async () => { if (recording) { setMediaBusy(true); try { await stopRecording(); } finally { setMediaBusy(false); } } else await startRecording(); }}>{recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}{mediaBusy ? 'Updating recording...' : recording ? 'Stop recording' : 'Start recording'}</button><p className="text-xs text-slate-500 dark:text-slate-400">{recording ? 'Recording is on' : 'Recording is off'} | {pendingChunks} chunks waiting to upload</p>{pendingChunks > 0 && <button className="text-xs font-semibold text-primary-700 underline dark:text-primary-300" onClick={() => void flushChunks()}>Retry uploads</button>}</section>}
            {isActive && hasBegun && Boolean(session?.turns.length) && !session?.readyToComplete && <button className={button} disabled={busy || mediaBusy || finishingAnswer} onClick={() => void finish()}>Finish and view report<ArrowRight className="h-4 w-4" /></button>}
            <details className="text-xs leading-5 text-slate-500 dark:text-slate-400"><summary className="cursor-pointer font-medium">Voice and privacy details</summary><p className="mt-2">Alex is an animated AI person. English interview audio is generated by Gemini, with browser voice fallback and approximate mouth animation. Your microphone answers can be processed by Gemini or your browser speech provider. Dictation audio is kept temporarily in memory for the current question and is not stored by the app; only submitted transcript text is saved and evaluated by {process.env.NEXT_PUBLIC_AI_PROVIDER === 'groq' ? 'Groq' : 'Gemini'}. Separately consented recordings capture your microphone and camera and are uploaded to your account. Generated interviewer audio is not directly included in recordings.</p></details>
          </div>
        </section>
        {session && session.turns.length > 0 && <details className="border-t border-slate-200 py-3 dark:border-slate-800"><summary className="cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300">Saved conversation ({session.turns.length})</summary><div ref={history} role="region" aria-label="Saved conversation" tabIndex={0} className="mt-3 max-h-52 space-y-4 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{session.turns.map(turn => <article key={turn.seq} className="space-y-2 border-b border-slate-200 pb-4 dark:border-slate-800"><p className="text-[11px] font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300">Alex | question {turn.seq + 1}</p><p className="whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-400">{turn.question}</p><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">You | saved</p><p className="whitespace-pre-wrap text-sm leading-6">{turn.answer === '[Skipped question]' ? 'Question skipped' : turn.answer}</p></article>)}</div></details>}
      </main>
    </div>
  </div>;
}
