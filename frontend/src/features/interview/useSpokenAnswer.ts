"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import apiClient from '@/features/api/client';
import { encodeSpeechWav } from './encodeSpeechWav';
import type { SpokenAnswerResult } from './useBrowserAnswer';

interface Options {
  onText: (text: string) => void; onListening: () => void;
  onFailure: (failure: { code: string; message: string }) => void;
}
interface Capture {
  context: AudioContext; stream: MediaStream | null; input: MediaStreamAudioSourceNode | null;
  node: AudioWorkletNode | null; muted: GainNode | null; chunks: Float32Array[];
  frames: number; energy: number; base: string; language: string; sessionId: string; seq: number;
  clip: Blob | null; flushed: ((success: boolean) => void) | null;
  stopTask: Promise<boolean> | null;
}
function release(capture: Capture) {
  capture.stream?.getTracks().forEach(track => track.stop()); capture.stream = null;
  capture.input?.disconnect(); capture.input = null;
  capture.node?.disconnect(); capture.node = null;
  capture.muted?.disconnect(); capture.muted = null;
  if (capture.context.state !== 'closed') void capture.context.close().catch(() => undefined);
}

/** Audio is kept only in memory for this turn, including an explicit transcription retry. */
export function useSpokenAnswer(options: Options) {
  const callbacks = useRef(options); callbacks.current = options;
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<'idle' | 'starting' | 'listening' | 'finishing' | 'transcribing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [hasCapture, setHasCapture] = useState(false);
  const mounted = useRef(false); const generation = useRef(0);
  const current = useRef<Capture | null>(null);
  const request = useRef<AbortController | null>(null);
  const resultText = useRef('');
  const finishPromise = useRef<Promise<SpokenAnswerResult> | null>(null);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    generation.current += 1; request.current?.abort(); request.current = null;
    if (flushTimer.current) clearTimeout(flushTimer.current); flushTimer.current = null;
    const capture = current.current; current.current = null;
    if (capture) { capture.flushed?.(false); capture.flushed = null; release(capture); capture.chunks = []; capture.clip = null; }
    finishPromise.current = null;
    if (mounted.current) { setStatus('idle'); setHasCapture(false); setSeconds(0); }
    return resultText.current;
  }, []);

  const start = useCallback(async (text: string, language: string, details: { sessionId: string; seq: number }) => {
    cancel(); resultText.current = text;
    const token = generation.current;
    if (!mounted.current) return false;
    setStatus('starting');
    let capture: Capture | null = null;
    try {
      const context = new AudioContext({ sampleRate: 16000 });
      void context.resume().catch(() => undefined);
      capture = { context, stream: null, input: null, node: null, muted: null, chunks: [], frames: 0, energy: 0, base: text.trim(), language, ...details, clip: null, flushed: null, stopTask: null };
      current.current = capture;
      const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!mounted.current || token !== generation.current) { media.getTracks().forEach(track => track.stop()); release(capture); return false; }
      capture.stream = media;
      await context.audioWorklet.addModule('/audio/interview-capture.js');
      if (!mounted.current || token !== generation.current) { release(capture); return false; }
      await context.resume();
      if (!mounted.current || token !== generation.current) { release(capture); return false; }
      if (context.state !== 'running') throw new Error('Microphone audio could not start.');
      const node = new AudioWorkletNode(context, 'interview-capture'); capture.node = node;
      const input = context.createMediaStreamSource(media); const muted = context.createGain(); muted.gain.value = 0;
      capture.input = input; capture.muted = muted;
      node.port.onmessage = event => {
        if (!mounted.current || token !== generation.current || current.current !== capture) return;
        const value: unknown = event.data;
        if (!value || typeof value !== 'object' || !('type' in value)) return;
        if (value.type === 'samples' && 'samples' in value && value.samples instanceof Float32Array) {
          capture.chunks.push(value.samples); capture.frames += value.samples.length;
          for (const sample of value.samples) capture.energy += sample * sample;
          setSeconds(Math.floor(capture.frames / context.sampleRate)); setHasCapture(true);
        } else if (value.type === 'flushed') { capture.flushed?.(true); capture.flushed = null; }
        else if (value.type === 'limit') {
          release(capture); setStatus('idle'); setHasCapture(true);
          callbacks.current.onFailure({ code: 'limit', message: 'Two minutes captured. Choose Finish answer to continue.' });
        }
      };
      input.connect(node); node.connect(muted); muted.connect(context.destination);
      setStatus('listening'); callbacks.current.onListening(); return true;
    } catch (failure) {
      if (capture) release(capture);
      if (!mounted.current || token !== generation.current) return false;
      current.current = null; setStatus('idle'); setHasCapture(false);
      const denied = failure instanceof DOMException && failure.name === 'NotAllowedError';
      callbacks.current.onFailure({ code: denied ? 'not-allowed' : 'unavailable', message: denied ? 'Microphone permission was denied. Allow it and try again, or type your answer.' : 'Your microphone could not start. Check its connection, or type your answer.' });
      return false;
    }
  }, [cancel]);

  const pause = useCallback(async () => {
    const capture = current.current; const token = generation.current;
    if (!capture) return true;
    if (capture.stopTask) return capture.stopTask;
    capture.stream?.getTracks().forEach(track => track.stop());
    setStatus('finishing');
    const task = (async () => {
      let flushed = true;
      if (capture.node && capture.context.state !== 'closed') {
        flushed = await new Promise<boolean>(resolve => {
          capture.flushed = resolve;
          flushTimer.current = setTimeout(() => { capture.flushed = null; resolve(false); }, 2500);
          capture.node!.port.postMessage('flush');
        });
        if (token === generation.current) { if (flushTimer.current) clearTimeout(flushTimer.current); flushTimer.current = null; }
      }
      release(capture);
      if (!mounted.current || token !== generation.current) return false;
      setStatus('idle');
      return flushed;
    })();
    capture.stopTask = task;
    return task;
  }, []);

  const finish = useCallback((): Promise<SpokenAnswerResult> => {
    if (finishPromise.current) return finishPromise.current;
    const capture = current.current; const token = generation.current;
    const task = (async (): Promise<SpokenAnswerResult> => {
      if (!capture) return { kind: 'complete', text: resultText.current };
      try {
        if (!capture.clip) {
          const flushed = await pause();
          if (!mounted.current || token !== generation.current) return { kind: 'cancelled' };
          if (!flushed) throw new Error('Microphone audio did not finish.');
          if (!capture.frames || Math.sqrt(capture.energy / capture.frames) < 0.002) {
            current.current = null; capture.chunks = []; setHasCapture(false); setStatus('idle');
            callbacks.current.onFailure({ code: 'no-speech', message: 'I didn’t hear an answer. Try Speak answer again, or type instead.' });
            return { kind: 'unavailable', text: resultText.current };
          }
          capture.clip = encodeSpeechWav(capture.chunks, capture.context.sampleRate); capture.chunks = [];
        }
        if (!mounted.current || token !== generation.current) return { kind: 'cancelled' };
        setStatus('transcribing');
        const abort = new AbortController(); request.current = abort;
        const form = new FormData(); form.append('audio', capture.clip, 'answer.wav'); form.append('seq', String(capture.seq)); form.append('language', capture.language);
        const response = await apiClient.post<unknown>(`interview/session/${capture.sessionId}/transcribe`, form, { signal: abort.signal, timeout: 55000, headers: { 'Content-Type': 'multipart/form-data' } });
        if (!mounted.current || token !== generation.current) return { kind: 'cancelled' };
        const payload = response.data;
        if (!payload || typeof payload !== 'object' || !('data' in payload) || !payload.data || typeof payload.data !== 'object'
          || !('seq' in payload.data) || payload.data.seq !== capture.seq || !('text' in payload.data) || typeof payload.data.text !== 'string' || !payload.data.text.trim()) throw new Error('No words were returned.');
        const text = `${capture.base} ${payload.data.text}`.trim().slice(0, 16000);
        resultText.current = text; callbacks.current.onText(text); current.current = null; capture.clip = null;
        setStatus('idle'); setHasCapture(false); request.current = null;
        return { kind: 'complete', text };
      } catch (failure) {
        if (!mounted.current || token !== generation.current) return { kind: 'cancelled' };
        request.current = null; release(capture); setStatus('idle');
        const status = axios.isAxiosError(failure) ? failure.response?.status : undefined;
        if (status === 422 || !capture.clip) { current.current = null; capture.clip = null; capture.chunks = []; setHasCapture(false); }
        callbacks.current.onFailure({ code: status === 422 ? 'no-speech' : 'transcription-failed', message: status === 422 ? 'I couldn’t hear a clear answer. Speak again, or type instead.' : capture.clip ? 'Your spoken answer could not be transcribed. Retry the saved audio, or speak again.' : 'Audio capture did not finish. Please speak again, or type your answer.' });
        return { kind: 'unavailable', text: resultText.current };
      }
    })();
    finishPromise.current = task;
    void task.finally(() => { if (finishPromise.current === task) finishPromise.current = null; });
    return task;
  }, [pause]);

  useEffect(() => {
    mounted.current = true;
    setSupported(Boolean(navigator.mediaDevices?.getUserMedia && window.AudioContext && window.AudioWorkletNode));
    return () => { mounted.current = false; cancel(); };
  }, [cancel]);

  const snapshot = useCallback(() => resultText.current, []);
  return { supported, status, partial: '', seconds, hasCapture, start, finish, pause, cancel, snapshot };
}
