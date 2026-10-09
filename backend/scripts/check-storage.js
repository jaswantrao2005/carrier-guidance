// Read-only metadata/file audit. It never deletes files or modifies database records.
const fs = require('fs');
const path = require('path');

function inside(root, filename) {
  const relative = path.relative(root, filename);
  return Boolean(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function auditStorage(options = {}) {
  const Resume = options.Resume || require('../src/models/Resume');
  const Chunk = options.Chunk || require('../src/models/RecordingChunk');
  const Session = options.Session || require('../src/models/InterviewSession');
  const storage = options.storage || require('../src/config/storage');
  const roots = [storage.uploadsRoot, storage.defaultRoot || path.resolve(__dirname, '../uploads')];
  const physicalRoots = (await Promise.all(roots.map(root => fs.promises.realpath(root).catch(() => null)))).filter(Boolean);
  const summary = {
    mode: 'read-only',
    resumes: { records: 0, missingFiles: 0, unsafePaths: 0, unreadableFiles: 0 },
    recordings: { records: 0, missingFiles: 0, invalidFilenames: 0, unsafeFiles: 0, unreadableFiles: 0,
      orphanFiles: 0, metadataWithoutSession: 0, sessionsWithByteMismatch: 0, ignoredDirectoryEntries: 0 },
    snapshot: 'Run while uploads are idle for consistent counts.',
  };
  const [resumes, chunks, sessions] = await Promise.all([
    Resume.find({}).select('path').lean(),
    Chunk.find({}).select('filename sessionId bytes').lean(),
    Session.find({}).select('recordingBytes').lean(),
  ]);
  const sessionIds = new Set(sessions.map(session => String(session._id)));
  const bytes = new Map();
  const referencedFiles = new Set();
  const filenamePattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.chunk$/i;
  summary.resumes.records = resumes.length;
  summary.recordings.records = chunks.length;

  for (const resume of resumes) {
    if (typeof resume.path !== 'string' || !await storage.isManagedPath(resume.path)) { summary.resumes.unsafePaths++; continue; }
    try {
      const physical = await fs.promises.realpath(resume.path);
      if (!physicalRoots.some(root => inside(root, physical))) { summary.resumes.unsafePaths++; continue; }
      if (!(await fs.promises.stat(physical)).isFile()) summary.resumes.unreadableFiles++;
    } catch (error) {
      if (error.code === 'ENOENT') summary.resumes.missingFiles++;
      else summary.resumes.unreadableFiles++;
    }
  }
  for (const chunk of chunks) {
    const sessionId = String(chunk.sessionId);
    bytes.set(sessionId, (bytes.get(sessionId) || 0) + Number(chunk.bytes || 0));
    if (!sessionIds.has(sessionId)) summary.recordings.metadataWithoutSession++;
    if (typeof chunk.filename !== 'string' || !filenamePattern.test(chunk.filename)) { summary.recordings.invalidFilenames++; continue; }
    referencedFiles.add(chunk.filename);
    const filename = path.join(storage.recordingsDirectory, chunk.filename);
    try {
      const physical = await fs.promises.realpath(filename);
      if (!physicalRoots.some(root => inside(root, physical))) { summary.recordings.unsafeFiles++; continue; }
      if (!(await fs.promises.stat(physical)).isFile()) summary.recordings.unreadableFiles++;
    } catch (error) {
      if (error.code === 'ENOENT') summary.recordings.missingFiles++;
      else summary.recordings.unreadableFiles++;
    }
  }
  for (const session of sessions) {
    if (Number(session.recordingBytes || 0) !== (bytes.get(String(session._id)) || 0)) summary.recordings.sessionsWithByteMismatch++;
  }
  const entries = await fs.promises.readdir(storage.recordingsDirectory, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw Object.assign(new Error('Unable to read the recordings directory.'), { code: 'STORAGE_ACCESS_FAILED' });
  });
  for (const entry of entries) {
    if (!filenamePattern.test(entry.name) || !entry.isFile()) { summary.recordings.ignoredDirectoryEntries++; continue; }
    if (!referencedFiles.has(entry.name)) summary.recordings.orphanFiles++;
  }
  summary.issues = Object.entries(summary.resumes).filter(([key]) => key !== 'records').reduce((total, [, value]) => total + value, 0)
    + Object.entries(summary.recordings).filter(([key]) => !['records', 'ignoredDirectoryEntries'].includes(key)).reduce((total, [, value]) => total + value, 0);
  return summary;
}

if (require.main === module) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
  const mongoose = require('mongoose');
  (async () => {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required in backend/.env.');
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    const summary = await auditStorage();
    console.log(JSON.stringify(summary, null, 2));
    if (summary.issues) process.exitCode = 2;
  })().catch(() => {
    console.error('Storage audit could not finish. Check the backend database configuration and directory access.');
    process.exitCode = 1;
  }).finally(() => mongoose.disconnect());
}

module.exports = { auditStorage };
