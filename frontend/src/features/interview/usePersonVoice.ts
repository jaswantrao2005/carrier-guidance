"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import apiClient from '@/features/api/client';

export type InterviewSpeechKind = 'greeting' | 'question' | 'warm_up_ready' | 'warm_up_nervous';
type PlaybackResult = 'ended' | 'stopped' | 'failed';
interface SpeechRequest {
  sessionId: string; seq: number; kind: InterviewSpeechKind;
  onCaption?: (text: string) => void;
  onEnded?: (recovered: boolean) => void;
}

/** Stopping invalidates the network request, playback and completion callback together. */
export function usePersonVoice(userId: string) {
  const [supported, setSupported] = useState(false);
  const [browserSupported, setBrowserSupported] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceId, setVoiceId] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'natural' | 'browser' | 'text'>('natural');
  const [error, setError] = useState('');
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const amplitude = useRef(0);
  const frame = useRef<number | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const controller = useRef<AbortController | null>(null);
  const settle = useRef<((result: PlaybackResult) => void) | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const preferenceKey = `careerai:person-voice:v1:${userId}`;

  const stop = useCallback(() => {
    generation.current += 1;
    controller.current?.abort(); controller.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null; amplitude.current = 0;
    if (source.current) {
      source.current.onended = null;
      try { source.current.stop(); } catch { /* Finished sources cannot stop twice. */ }
      source.current.disconnect(); source.current = null;
    }
    analyser.current?.disconnect(); analyser.current = null;
    if (utterance.current) {
      utterance.current.onstart = null; utterance.current.onend = null; utterance.current.onerror = null;
      utterance.current = null;
    }
    window.speechSynthesis?.cancel();
    const resolve = settle.current; settle.current = null; resolve?.('stopped');
    if (mounted.current) { setSpeaking(false); setLoading(false); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const browser = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
    setBrowserSupported(browser);
    setSupported(typeof window.AudioContext !== 'undefined' || browser);
    const update = () => setVoices(browser ? window.speechSynthesis.getVoices().filter(item => item.lang.toLowerCase().startsWith('en')) : []);
    update();
    if (browser) window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => {
      mounted.current = false; stop();
      if (browser) window.speechSynthesis.removeEventListener('voiceschanged', update);
      const old = context.current; context.current = null;
      if (old && old.state !== 'closed') void old.close();
    };
  }, [stop]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(preferenceKey);
      const value: unknown = stored ? JSON.parse(stored) : null;
      if (value && typeof value === 'object') {
        if ('enabled' in value && typeof value.enabled === 'boolean') setEnabled(value.enabled);
        if ('voiceId' in value && typeof value.voiceId === 'string') setVoiceId(value.voiceId);
      }
    } catch { /* Joining never depends on local preferences. */ }
    setPreferencesLoaded(true);
  }, [preferenceKey]);
  useEffect(() => {
    if (!preferencesLoaded) return;
    try { localStorage.setItem(preferenceKey, JSON.stringify({ enabled, voiceId })); } catch { /* Keep the choice for this visit. */ }
  }, [enabled, voiceId, preferenceKey, preferencesLoaded]);
  useEffect(() => { if (!enabled) stop(); }, [enabled, stop]);

  // Join/Replay call this synchronously to give Web Audio a real user gesture.
  const prime = useCallback(() => {
    if (typeof window.AudioContext === 'undefined') return;
    try {
      if (!context.current || context.current.state === 'closed') context.current = new AudioContext();
      if (context.current.state === 'suspended') void context.current.resume().catch(() => undefined);
    } catch { if (mounted.current) setError('Audio is unavailable. You can continue with the captions.'); }
  }, []);

  const speak = useCallback(async (fallbackText: string, request?: SpeechRequest): Promise<PlaybackResult> => {
    stop();
    if (!supported || !fallbackText.trim() || !mounted.current) return 'failed';
    const token = generation.current;
    let text = fallbackText;
    let recovered = false;
    setError(''); setLoading(true);
    const current = () => mounted.current && token === generation.current;
    const caption = (header: unknown) => {
      if (typeof header !== 'string' || !current()) return;
      try { text = decodeURIComponent(header); request?.onCaption?.(text); } catch { /* Keep the readable caption. */ }
    };
    if (request && typeof window.AudioContext !== 'undefined') {
      const abort = new AbortController(); controller.current = abort;
      try {
        prime();
        const response = await apiClient.post<ArrayBuffer>(`interview/session/${request.sessionId}/speech`, { seq: request.seq, kind: request.kind }, {
          responseType: 'arraybuffer', signal: abort.signal, timeout: 45000,
        });
        if (!current()) return 'stopped';
        caption(response.headers['x-interviewer-text']);
        const audio = context.current;
        if (!audio || audio.state === 'closed') throw new Error('Audio is unavailable.');
        const buffer = await audio.decodeAudioData(response.data.slice(0));
        if (!current()) return 'stopped';
        await audio.resume();
        if (!current()) return 'stopped';
        if (audio.state !== 'running') throw new Error('Audio needs a playback gesture.');
        const next = audio.createBufferSource(); next.buffer = buffer;
        const meter = audio.createAnalyser(); meter.fftSize = 256; meter.smoothingTimeConstant = 0.45;
        next.connect(meter); meter.connect(audio.destination);
        source.current = next; analyser.current = meter; controller.current = null;
        const samples = new Float32Array(meter.fftSize);
        const update = () => {
          if (!current() || source.current !== next) return;
          meter.getFloatTimeDomainData(samples);
          let sum = 0; for (const sample of samples) sum += sample * sample;
          const target = Math.min(1, Math.sqrt(sum / samples.length) * 7);
          amplitude.current += (target - amplitude.current) * 0.45;
          frame.current = requestAnimationFrame(update);
        };
        return await new Promise<PlaybackResult>(resolve => {
          settle.current = resolve;
          next.onended = () => {
            if (!current()) return;
            if (frame.current !== null) cancelAnimationFrame(frame.current);
            frame.current = null; amplitude.current = 0;
            next.disconnect(); meter.disconnect(); source.current = null; analyser.current = null;
            settle.current = null; setSpeaking(false); setLoading(false); request?.onEnded?.(false); resolve('ended');
          };
          setMode('natural'); setLoading(false); next.start(); setSpeaking(true); update();
        });
      } catch (failure) {
        if (!current() || abort.signal.aborted) return 'stopped';
        if (axios.isAxiosError(failure)) {
          const status = failure.response?.status;
          if (status && [400, 401, 403, 404, 409].includes(status)) {
            controller.current = null; setLoading(false); setMode('text');
            setError('This saved session changed or is unavailable. Reload it before playing audio.');
            return 'failed';
          }
          caption(failure.response?.headers?.['x-interviewer-text']);
        }
        controller.current = null;
        recovered = true;
        setError(browserSupported ? 'Natural voice is unavailable. Alex is using the browser voice.' : 'Voice could not play. You can read the captions and continue.');
      }
    }
    if (!current()) return 'stopped';
    if (!browserSupported) { setMode('text'); setLoading(false); return 'failed'; }
    return await new Promise<PlaybackResult>(resolve => {
      const next = new SpeechSynthesisUtterance(text);
      const chosen = voices.find(item => item.voiceURI === voiceId) || voices.find(item => item.lang.toLowerCase() === 'en-in') || voices.find(item => item.default) || voices[0];
      next.lang = chosen?.lang || 'en-IN'; if (chosen) next.voice = chosen;
      next.rate = 0.95; utterance.current = next; settle.current = resolve;
      const finish = (result: PlaybackResult) => {
        if (!current() || utterance.current !== next) return;
        if (timer.current) clearTimeout(timer.current); timer.current = null;
        next.onstart = null; next.onend = null; next.onerror = null;
        utterance.current = null; settle.current = null;
        setSpeaking(false); setLoading(false); resolve(result);
      };
      next.onstart = () => {
        if (!current()) return;
        if (timer.current) clearTimeout(timer.current); timer.current = null;
        setMode('browser'); setLoading(false); setSpeaking(true);
      };
      next.onend = () => { if (current()) request?.onEnded?.(recovered); finish('ended'); };
      next.onerror = () => { if (current()) setError('Voice could not play. Replay, or continue with the captions.'); finish('failed'); };
      timer.current = setTimeout(() => { if (current()) { setError('Voice has not started. Replay, or continue with the captions.'); window.speechSynthesis.cancel(); finish('failed'); } }, 6000);
      try { window.speechSynthesis.speak(next); } catch { setError('Voice could not play. Continue with the captions.'); finish('failed'); }
    });
  }, [supported, stop, prime, browserSupported, voices, voiceId]);

  return { supported, browserSupported, enabled, setEnabled, voices, voiceId, setVoiceId, speaking, loading, mode, amplitude, error, speak, stop, prime, preferencesLoaded };
}
