"use client";
import { useState } from 'react';
import apiClient from '@/features/api/client';
import { errorMessage } from '@/features/api/errors';
import type { ApiResult } from './types';
export interface PresenceResult {
  segments: { segmentId: string; suppressed: boolean; quality?: { reason?: string }; signals: { type: string; start_ms: number; end_ms: number; description: string }[] }[];
}
export function PresenceReview({ reportId, initial }: { reportId: string; initial?: PresenceResult }) {
  const [result, setResult] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <section className="border rounded-2xl p-5 space-y-4">
    <h2 className="text-xl font-bold">Optional recording review</h2>
    <p className="text-sm text-slate-500">Checks face presence in the recorded video. These observations can be wrong and never affect your score.</p>
    <button className="border rounded-xl px-4 py-2 disabled:opacity-50" disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      try { const response = await apiClient.post<ApiResult<PresenceResult>>(`interview/${reportId}/presence-review`, {}, { timeout: 150000 }); setResult(response.data.data); }
      catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
    }}>{busy ? 'Reviewing recording...' : 'Review video presence'}</button>
    {error && <p role="alert">{error}</p>}
    {result?.segments.map((segment, index) => <div key={segment.segmentId} className="space-y-2"><h3 className="font-semibold">Segment {index + 1}</h3>{segment.suppressed ? <p>Video quality was insufficient for reliable review. {segment.quality?.reason}</p> : segment.signals.length ? segment.signals.map((signal, i) => <p key={i}>{Math.floor(signal.start_ms / 1000)}–{Math.floor(signal.end_ms / 1000)}s: {signal.description}</p>) : <p>No sustained presence events were detected.</p>}</div>)}
  </section>;
}
