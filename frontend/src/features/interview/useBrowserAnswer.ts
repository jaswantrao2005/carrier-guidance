"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: { isFinal: boolean; [index: number]: { transcript: string } } };
}
interface Recognition {
  continuous: boolean; interimResults: boolean; lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onstart: (() => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
declare global { interface Window { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition } }
export type SpokenAnswerResult = { kind: 'complete'; text: string } | { kind: 'cancelled' } | { kind: 'unavailable'; text: string };
interface Options {
  onText: (text: string) => void;
  onListening: () => void;
  onFailure: (failure: { code: string; message: string }) => void;
}
const messages: Record<string, string> = {
  'not-allowed': 'Microphone permission was denied. You can allow it and try again, or type your answer.',
  'service-not-allowed': 'This browser cannot use speech input. You can type your answer instead.',
  'audio-capture': 'Your microphone is unavailable. Check its connection, or type your answer.',
  network: 'Speech input could not connect. Try again, or type your answer.',
  'no-speech': 'I didn’t hear an answer. Try Speak answer again, or type instead.',
};
const combine = (first: string, second: string) => `${first} ${second}`.trim().slice(0, 16000);

/** stop+finish retains trailing results; cancel+abort invalidates the entire capture. */
export function useBrowserAnswer(options: Options) {
  const callbacks = useRef(options); callbacks.current = options;
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<'idle' | 'starting' | 'listening' | 'finishing'>('idle');
  const [partial, setPartial] = useState('');
  const mounted = useRef(false);
  const recognition = useRef<Recognition | null>(null);
  const generation = useRef(0);
  const desired = useRef(false);
  const finalText = useRef('');
  const interim = useRef('');
  const language = useRef('en-IN');
  const heardWords = useRef(false);
  const restart = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishRequest = useRef<{ promise: Promise<SpokenAnswerResult>; resolve: (result: SpokenAnswerResult) => void } | null>(null);
  const begin = useRef<(token: number) => boolean>(() => false);

  const snapshot = useCallback(() => combine(finalText.current, interim.current), []);
  const clearRestart = () => { if (restart.current) clearTimeout(restart.current); restart.current = null; };
  const detach = (rec: Recognition) => { rec.onstart = null; rec.onresult = null; rec.onerror = null; rec.onend = null; };
  const settle = (result: SpokenAnswerResult) => {
    if (finishTimer.current) clearTimeout(finishTimer.current); finishTimer.current = null;
    const pending = finishRequest.current; finishRequest.current = null; pending?.resolve(result);
    if (mounted.current) setStatus('idle');
  };

  const cancel = useCallback(() => {
    const wasActive = Boolean(recognition.current || desired.current || finishRequest.current);
    const text = snapshot();
    generation.current += 1; desired.current = false;
    if (restart.current) clearTimeout(restart.current); restart.current = null;
    if (finishTimer.current) clearTimeout(finishTimer.current); finishTimer.current = null;
    const pending = finishRequest.current; finishRequest.current = null; pending?.resolve({ kind: 'cancelled' });
    const rec = recognition.current; recognition.current = null;
    if (rec) { detach(rec); try { rec.abort(); } catch { /* Already ended. */ } }
    finalText.current = text; interim.current = '';
    if (mounted.current) { if (wasActive) callbacks.current.onText(text); setPartial(''); setStatus('idle'); }
    return text;
  }, [snapshot]);

  begin.current = (token: number) => {
    if (!mounted.current || token !== generation.current || !desired.current) return false;
    const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Constructor) return false;
    let rec: Recognition;
    try { rec = new Constructor(); } catch { return false; }
    recognition.current = rec;
    heardWords.current = false;
    rec.continuous = true; rec.interimResults = true; rec.lang = language.current;
    const base = finalText.current;
    const finals = new Map<number, string>(); const pendingWords = new Map<number, string>();
    const current = () => mounted.current && token === generation.current && recognition.current === rec;
    rec.onstart = () => {
      if (!current() || !desired.current) return;
      setStatus('listening'); callbacks.current.onListening();
    };
    rec.onresult = event => {
      if (!current()) return;
      // The browser may withdraw trailing provisional results by shortening this list.
      for (const index of pendingWords.keys()) if (index >= event.results.length) pendingWords.delete(index);
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result[0].transcript.trim()) heardWords.current = true;
        if (result.isFinal) { finals.set(index, result[0].transcript); pendingWords.delete(index); }
        else pendingWords.set(index, result[0].transcript);
      }
      const ordered = (entries: Map<number, string>) => [...entries].sort((a, b) => a[0] - b[0]).map(entry => entry[1]).join(' ');
      finalText.current = combine(base, ordered(finals)); interim.current = ordered(pendingWords).slice(0, 16000);
      callbacks.current.onText(finalText.current); setPartial(interim.current);
    };
    rec.onerror = event => {
      if (!current()) return;
      desired.current = false; clearRestart();
      const text = snapshot(); finalText.current = text; interim.current = ''; callbacks.current.onText(text); setPartial('');
      callbacks.current.onFailure({ code: event.error, message: messages[event.error] || 'Speech input stopped. You can retry or type your answer.' });
      detach(rec); recognition.current = null; try { rec.abort(); } catch { /* Already ended. */ }
      settle({ kind: 'unavailable', text });
    };
    rec.onend = () => {
      if (!current()) return;
      detach(rec); recognition.current = null;
      if (!heardWords.current) {
        desired.current = false; clearRestart();
        callbacks.current.onFailure({ code: 'no-results', message: 'Your browser did not return any words. Try the voice interview input, or type instead.' });
        settle({ kind: 'unavailable', text: snapshot() }); return;
      }
      if (finishRequest.current) {
        const text = snapshot(); finalText.current = text; interim.current = ''; callbacks.current.onText(text); setPartial('');
        settle({ kind: 'complete', text }); return;
      }
      finalText.current = snapshot(); callbacks.current.onText(finalText.current);
      setStatus('idle'); setPartial(''); interim.current = '';
      if (desired.current) restart.current = setTimeout(() => {
        restart.current = null;
        if (!mounted.current || token !== generation.current || !desired.current || finishRequest.current) return;
        setStatus('starting');
        if (!begin.current(token)) {
          desired.current = false; setStatus('idle');
          callbacks.current.onFailure({ code: 'start-failed', message: 'Microphone could not restart. Try Speak answer, or type instead.' });
        }
      }, 300);
    };
    try { rec.start(); return true; }
    catch {
      detach(rec); recognition.current = null; return false;
    }
  };

  const start = useCallback((text: string, lang: string, _request?: { sessionId: string; seq: number }) => {
    cancel(); finalText.current = text.trim().slice(0, 16000); interim.current = ''; language.current = lang; heardWords.current = false;
    if (!mounted.current) return false;
    desired.current = true; setStatus('starting');
    if (begin.current(generation.current)) return true;
    desired.current = false; setStatus('idle');
    callbacks.current.onFailure({ code: 'unavailable', message: 'Speech input is unavailable. You can type every answer instead.' });
    return false;
  }, [cancel]);

  const finish = useCallback((): Promise<SpokenAnswerResult> => {
    if (finishRequest.current) return finishRequest.current.promise;
    desired.current = false;
    if (restart.current) clearTimeout(restart.current); restart.current = null;
    const rec = recognition.current;
    if (!rec) return Promise.resolve({ kind: 'complete', text: snapshot() });
    setStatus('finishing');
    let resolveRequest: (result: SpokenAnswerResult) => void = () => undefined;
    const promise = new Promise<SpokenAnswerResult>(resolve => { resolveRequest = resolve; });
    finishRequest.current = { promise, resolve: resolveRequest };
    finishTimer.current = setTimeout(() => {
      cancel();
      if (mounted.current) callbacks.current.onFailure({ code: 'finish-timeout', message: 'Speech input did not finish. Your words are kept below; retry or submit them as text.' });
    }, 3000);
    try { rec.stop(); }
    catch {
      cancel();
      if (mounted.current) callbacks.current.onFailure({ code: 'finish-failed', message: 'Speech input did not finish. Your words are kept below; retry or submit them as text.' });
    }
    return promise;
  }, [cancel, snapshot]);

  useEffect(() => {
    mounted.current = true; setSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => { mounted.current = false; cancel(); };
  }, [cancel]);

  return { supported, status, partial, start, finish, cancel, snapshot };
}
