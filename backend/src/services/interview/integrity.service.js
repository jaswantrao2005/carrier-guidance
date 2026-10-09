const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const Interview = require('../../models/Interview');
const Chunk = require('../../models/RecordingChunk');
const { listRecordings, directory, removeFile, chunkPath } = require('./recording.service');
const { fail } = require('../../validations/interview.validation');

async function analyzeReport(reportId, user) {
  const { report, segments } = await listRecordings(reportId, user);
  if (!report.consent?.analyzeVideo) fail('Video analysis consent was not granted.', 403);
  if (!process.env.INTEGRITY_SERVICE_URL) fail('Video review service is not configured.', 503);
  const results = [];
  for (const segment of segments.filter(s => s.mimeType.startsWith('video/'))) {
    const chunks = await Chunk.find({ sessionId: report.sessionId, segmentId: segment.segmentId }).sort({ seq: 1 }).lean();
    if (!chunks.length || chunks.some((chunk, i) => chunk.seq !== i)) fail('Recording is incomplete. Retry after uploading all chunks.', 409);
    const filename = `review-${randomUUID()}.${segment.mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
    const handle = await fs.promises.open(path.join(directory, filename), 'wx');
    try {
      for (const chunk of chunks) {
        for await (const data of fs.createReadStream(chunkPath(chunk.filename))) await handle.write(data);
      }
      await handle.close();
      let response;
      try {
        response = await fetch(`${process.env.INTEGRITY_SERVICE_URL.replace(/\/$/, '')}/analyze`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename }), signal: AbortSignal.timeout(120000),
        });
      } catch {
        fail('Recording review could not finish. Please retry shortly. Your interview report is saved.', 502);
      }
      if (!response.ok) fail(`Video review is unavailable (${response.status}). The interview report is unaffected.`, 502);
      let result;
      try { result = await response.json(); }
      catch { fail('Video review returned an invalid response.', 502); }
      if (!result || typeof result.suppressed !== 'boolean' || !Array.isArray(result.signals)
        || (result.suppressed && result.signals.length)
        || result.signals.some(signal => !signal || typeof signal.type !== 'string'
          || typeof signal.description !== 'string' || !Number.isFinite(signal.start_ms)
          || !Number.isFinite(signal.end_ms) || signal.start_ms < 0 || signal.end_ms < signal.start_ms)) {
        fail('Video review returned an invalid response.', 502);
      }
      results.push({ ...result, segmentId: segment.segmentId });
    } finally { await handle.close().catch(() => {}); await removeFile(filename); }
  }
  if (!results.length) fail('No video recording is available to review.', 400);
  await Interview.updateOne({ _id: reportId, user }, { $set: { presenceReview: { analyzedAt: new Date(), segments: results } } });
  return { analyzedAt: new Date(), segments: results };
}
module.exports = { analyzeReport };
