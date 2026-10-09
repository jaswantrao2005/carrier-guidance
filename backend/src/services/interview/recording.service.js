const fs = require('fs');
const path = require('path');
const { randomUUID, createHash } = require('crypto');
const { once } = require('events');
const Chunk = require('../../models/RecordingChunk');
const Session = require('../../models/InterviewSession');
const Interview = require('../../models/Interview');
const { owned } = require('./session.service');
const { fail } = require('../../validations/interview.validation');
const { recordingsDirectory: directory } = require('../../config/storage');
const allowedMime = /^(audio|video)\/(webm|mp4)(;codecs=[\w,.-]+)?$/;

async function removeFile(filename) {
  if (!filename) return;
  await fs.promises.unlink(path.join(directory, path.basename(filename))).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
function chunkPath(filename) {
  if (typeof filename !== 'string' || !/^[a-f0-9-]{36}\.chunk$/i.test(filename)) fail('Recording file metadata is invalid.', 409);
  return path.join(directory, filename);
}
async function uploadChunk(id, user, segmentId, rawSeq, file, mimeType) {
  const session = await owned(id, user);
  const seq = Number(rawSeq);
  if (!/^[\w-]{8,80}$/.test(segmentId) || !Number.isInteger(seq) || seq < 0 || seq > 720) fail('Invalid recording sequence.');
  if (!file?.size || !allowedMime.test(mimeType || '')) fail('A supported audio/video chunk is required.');
  if (!session.consent.recordAudio || (mimeType.startsWith('video/') && !session.consent.recordVideo)) fail('Recording consent was not granted.', 403);
  if (session.status === 'abandoned') fail('Session was discarded.', 409);
  const digest = createHash('sha256').update(file.buffer).digest('hex');
  const key = { sessionId: id, segmentId, seq };
  const previous = await Chunk.findOne(key).lean();
  if (previous) {
    if (previous.digest !== digest || previous.mimeType !== mimeType) fail('This recording sequence already contains different data.', 409);
    return;
  }
  const existingSegment = session.recordingSegments.find(s => s.segmentId === segmentId);
  if (existingSegment && existingSegment.mimeType !== mimeType) fail('Recording format changed within a segment.', 409);
  if (!existingSegment && session.recordingSegments.length >= 30) fail('Recording segment limit reached.', 413);
  const reserved = await Session.updateOne({ _id: id, user, status: { $ne: 'abandoned' }, recordingBytes: { $lte: 250 * 1024 * 1024 - file.size } }, { $inc: { recordingBytes: file.size } });
  if (!reserved.modifiedCount) fail('Recording storage limit reached or session removed.', 413);
  const filename = `${randomUUID()}.chunk`;
  let created = false;
  try {
    await fs.promises.mkdir(directory, { recursive: true });
    await fs.promises.writeFile(path.join(directory, filename), file.buffer, { flag: 'wx' });
    await Chunk.create({ ...key, filename, bytes: file.size, mimeType, digest });
    created = true;
    await Session.updateOne({ _id: id, user, status: { $ne: 'abandoned' }, 'recordingSegments.segmentId': { $ne: segmentId },
      $expr: { $lt: [{ $size: '$recordingSegments' }, 30] } }, {
      $push: { recordingSegments: { segmentId, mimeType, bytes: 0, createdAt: new Date() } },
    });
    const committed = await Session.updateOne({ _id: id, user, status: { $ne: 'abandoned' },
      recordingSegments: { $elemMatch: { segmentId, mimeType } } }, { $inc: { 'recordingSegments.$.bytes': file.size } });
    if (!committed.modifiedCount) fail('Session was removed, recording format changed, or the segment limit was reached.', 409);
  } catch (error) {
    if (created) await Chunk.deleteOne({ ...key, filename });
    await removeFile(filename);
    await Session.updateOne({ _id: id, recordingBytes: { $gte: file.size } }, { $inc: { recordingBytes: -file.size } });
    if (error.code === 11000) {
      const winner = await Chunk.findOne(key).lean();
      if (winner?.digest === digest && winner.mimeType === mimeType) return;
      fail('Conflicting recording chunk.', 409);
    }
    throw error;
  }
}
async function listRecordings(reportId, user) {
  const report = await Interview.findOne({ _id: reportId, user }).lean();
  if (!report) fail('Interview not found.', 404);
  const session = report.sessionId ? await Session.findOne({ _id: report.sessionId, user }).lean() : null;
  return { report, segments: session?.recordingSegments || [] };
}
async function streamSegment(reportId, user, segmentId, res) {
  const { report, segments } = await listRecordings(reportId, user);
  const segment = segments.find(s => s.segmentId === segmentId);
  if (!segment) fail('Recording not found.', 404);
  const chunks = await Chunk.find({ sessionId: report.sessionId, segmentId }).sort({ seq: 1 }).lean();
  if (!chunks.length || chunks.some((chunk, i) => chunk.seq !== i)) fail('Recording is still uploading. Please retry shortly.', 409);
  res.setHeader('Content-Type', segment.mimeType);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Length', chunks.reduce((sum, c) => sum + c.bytes, 0));
  for (const chunk of chunks) {
    for await (const data of fs.createReadStream(chunkPath(chunk.filename))) {
      if (res.destroyed) return;
      if (!res.write(data)) await once(res, 'drain');
    }
  }
  res.end();
}
async function deleteSessionRecordings(id) {
  const chunks = await Chunk.find({ sessionId: id }).lean();
  for (const chunk of chunks) await removeFile(chunk.filename);
  await Chunk.deleteMany({ sessionId: id });
}
async function deleteInterview(id, user) {
  const report = await Interview.findOne({ _id: id, user }).lean();
  if (!report) fail('Interview not found.', 404);
  if (report.sessionId) {
    await Session.updateOne({ _id: report.sessionId, user }, { $set: { status: 'abandoned' } });
    await deleteSessionRecordings(report.sessionId);
    await Session.deleteOne({ _id: report.sessionId, user });
  }
  await removeFile(report.recordingUrl);
  await Interview.deleteOne({ _id: id, user });
}
module.exports = { uploadChunk, listRecordings, streamSegment, deleteInterview, deleteSessionRecordings, removeFile, chunkPath, directory };
