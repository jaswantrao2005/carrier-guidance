"use client";

import { useEffect, useState } from 'react';
import apiClient from '@/features/api/client';
import { errorMessage } from '@/features/api/errors';
import type { ApiResult } from './types';

interface Segment { segmentId: string; mimeType: string; bytes: number }
export function Recordings({ reportId }: { reportId: string }) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selected, setSelected] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    apiClient.get<ApiResult<Segment[]>>(`interview/${reportId}/recordings`).then(res => {
      if (!cancelled) { setSegments(res.data.data); setSelected(res.data.data[0]?.segmentId || ''); }
    }).catch(e => { if (!cancelled) setError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, [reportId]);
  useEffect(() => {
    if (!selected) return;
    let url = ''; let cancelled = false;
    setSource(''); setError('');
    apiClient.get<Blob>(`interview/${reportId}/recordings/${selected}`, { responseType: 'blob' }).then(res => {
      if (cancelled) return;
      url = URL.createObjectURL(res.data); setSource(url);
    }).catch(() => { if (!cancelled) setError('Recording could not be loaded. It may still be uploading.'); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [reportId, selected, attempt]);
  if (!segments.length && !error) return null;
  const audioOnly = segments.find(s => s.segmentId === selected)?.mimeType.startsWith('audio/');
  return <section className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-4">
    <h2 className="text-xl font-bold">Your recordings</h2>
    <p className="text-sm text-slate-500">Each return to the interview starts a separate recording segment. Recordings contain your responses only.</p>
    <select aria-label="Recording segment" className="border rounded-lg p-2 bg-transparent" value={selected} onChange={e => setSelected(e.target.value)}>{segments.map((s, i) => <option value={s.segmentId} key={s.segmentId}>Segment {i + 1} · {(s.bytes / 1024 / 1024).toFixed(1)} MB</option>)}</select>
    {error ? <p role="alert">{error} <button className="underline" onClick={() => setAttempt(n => n + 1)}>Retry</button></p> : source ? audioOnly ? <audio src={source} controls className="w-full" /> : <video src={source} controls className="w-full max-h-96 rounded-xl bg-black" /> : <p>Loading recording...</p>}
  </section>;
}
