const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');
const mongoose = require('mongoose');

// Every file and database record belongs to this generated fixture only.
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'careerai-storage-test-'));
process.env.UPLOADS_DIR = path.join(fixtureRoot, 'managed');
process.env.NODE_ENV = 'test';
const dbName = `careerai_storage_test_${randomUUID().replaceAll('-', '')}`;
const storage = require('../src/config/storage');
const Session = require('../src/models/InterviewSession');
const Resume = require('../src/models/Resume');
const Chunk = require('../src/models/RecordingChunk');
const recording = require('../src/services/interview/recording.service');
const { deleteResume } = require('../src/controllers/resume/resume.controller');
const { auditStorage } = require('../scripts/check-storage');

before(async () => {
  await fs.promises.mkdir(storage.resumesDirectory, { recursive: true });
  await fs.promises.mkdir(storage.recordingsDirectory, { recursive: true });
  await mongoose.connect(process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 5000 });
  await Promise.all([Session.createIndexes(), Chunk.createIndexes()]);
});
after(async () => {
  if (mongoose.connection.readyState === 1) {
    assert.equal(mongoose.connection.name, dbName);
    assert.match(dbName, /^careerai_storage_test_[a-f0-9]{32}$/);
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
  assert.equal(path.dirname(fixtureRoot), path.resolve(os.tmpdir()));
  assert.match(path.basename(fixtureRoot), /^careerai-storage-test-/);
  await fs.promises.rm(fixtureRoot, { recursive: true, force: true });
});
function reply() {
  return { statusCode: null, payload: null, status(value) { this.statusCode = value; return this; }, json(value) { this.payload = value; return this; } };
}
async function resumeAt(filename) {
  return Resume.create({ user: new mongoose.Types.ObjectId(), filename: path.basename(filename), originalName: 'synthetic.pdf',
    path: filename, mimetype: 'application/pdf', size: 9, resumeText: 'Synthetic fixture only.' });
}
async function session() {
  return Session.create({ user: new mongoose.Types.ObjectId(), setup: { role: 'Storage fixture' }, maxQuestions: 6,
    consent: { storeTranscript: true, recordAudio: true, recordVideo: true }, deadlineAt: new Date(Date.now() + 60000) });
}

test('managed path guard rejects storage roots, siblings and traversal', () => {
  assert.equal(storage.isManagedPath(path.join(storage.resumesDirectory, 'synthetic.pdf')), true);
  assert.equal(storage.isManagedPath(storage.uploadsRoot), false);
  assert.equal(storage.isManagedPath(`${storage.uploadsRoot}-other/synthetic.pdf`), false);
  assert.equal(storage.isManagedPath(path.join(storage.uploadsRoot, '..', 'outside.pdf')), false);
  assert.equal(storage.isManagedPath(path.join(storage.uploadsRoot, 'resumes', '..', '..', 'outside.pdf')), false);
});

test('recording chunk paths reject traversal and cleanup cannot delete an outside file', async () => {
  const name = `${randomUUID()}.chunk`;
  assert.equal(recording.chunkPath(name), path.join(storage.recordingsDirectory, name));
  for (const filename of [`../${name}`, path.join(fixtureRoot, name), 'legacy.webm', undefined]) {
    assert.throws(() => recording.chunkPath(filename), error => error.statusCode === 409);
  }
  const outside = path.join(fixtureRoot, name);
  await fs.promises.writeFile(outside, 'protected fixture chunk');
  await recording.removeFile(outside);
  assert.equal(await fs.promises.readFile(outside, 'utf8'), 'protected fixture chunk');
});

test('resume deletion refuses outside paths and preserves the outside file and record', async () => {
  const filename = path.join(fixtureRoot, 'outside.pdf');
  await fs.promises.writeFile(filename, 'protected fixture');
  const item = await resumeAt(filename);
  let error;
  await deleteResume({ params: { id: item.id }, user: { id: item.user } }, reply(), value => { error = value; });
  assert.equal(error?.statusCode, 409);
  assert.equal(await fs.promises.readFile(filename, 'utf8'), 'protected fixture');
  assert.ok(await Resume.findById(item._id));
  await Resume.deleteOne({ _id: item._id });
});

test('resume deletion refuses a junction that redirects managed storage outside its root', async () => {
  const outside = path.join(fixtureRoot, 'junction-target');
  const junction = path.join(storage.resumesDirectory, 'redirect');
  await fs.promises.mkdir(outside);
  await fs.promises.writeFile(path.join(outside, 'protected.pdf'), 'protected through junction');
  await fs.promises.symlink(outside, junction, process.platform === 'win32' ? 'junction' : 'dir');
  const item = await resumeAt(path.join(junction, 'protected.pdf'));
  let error;
  await deleteResume({ params: { id: item.id }, user: { id: item.user } }, reply(), value => { error = value; });
  assert.equal(error?.statusCode, 409);
  assert.equal(await fs.promises.readFile(path.join(outside, 'protected.pdf'), 'utf8'), 'protected through junction');
  assert.ok(await Resume.findById(item._id));
  await Resume.deleteOne({ _id: item._id });
});

test('deleting a managed resume tolerates an already missing file', async () => {
  const item = await resumeAt(path.join(storage.resumesDirectory, 'missing.pdf'));
  const res = reply();
  let error;
  await deleteResume({ params: { id: item.id }, user: { id: item.user } }, res, value => { error = value; });
  assert.equal(error, undefined);
  assert.equal(res.statusCode, 200);
  assert.equal(await Resume.countDocuments({ _id: item._id }), 0);
});

test('a chunk interrupted after disk write cannot survive session discard', async () => {
  const item = await session();
  const originalWrite = fs.promises.writeFile;
  let signalWritten, release;
  const written = new Promise(resolve => { signalWritten = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  fs.promises.writeFile = async (...args) => {
    const result = await originalWrite(...args);
    if (path.dirname(String(args[0])) === storage.recordingsDirectory && String(args[0]).endsWith('.chunk')) {
      signalWritten(); await blocked;
    }
    return result;
  };
  const pending = recording.uploadChunk(item.id, item.user, randomUUID(), 0, { size: 4, buffer: Buffer.from('head') }, 'video/webm');
  try {
    await written;
    await Session.updateOne({ _id: item._id }, { $set: { status: 'abandoned' } });
    await recording.deleteSessionRecordings(item._id);
    await Session.deleteOne({ _id: item._id });
    release();
    await assert.rejects(pending, error => error.statusCode === 409);
    assert.equal(await Chunk.countDocuments({ sessionId: item._id }), 0);
    assert.deepEqual((await fs.promises.readdir(storage.recordingsDirectory)).filter(name => name.endsWith('.chunk')), []);
  } finally { release(); fs.promises.writeFile = originalWrite; }
});

test('a chunk interrupted after metadata write cannot survive session discard', async () => {
  const item = await session();
  const originalCreate = Chunk.create;
  let signalCreated, release;
  const created = new Promise(resolve => { signalCreated = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  Chunk.create = async function (...args) {
    const result = await originalCreate.apply(this, args);
    signalCreated(); await blocked;
    return result;
  };
  const pending = recording.uploadChunk(item.id, item.user, randomUUID(), 0, { size: 4, buffer: Buffer.from('head') }, 'video/webm');
  try {
    await created;
    await Session.updateOne({ _id: item._id }, { $set: { status: 'abandoned' } });
    await recording.deleteSessionRecordings(item._id);
    await Session.deleteOne({ _id: item._id });
    release();
    await assert.rejects(pending, error => error.statusCode === 409);
    assert.equal(await Chunk.countDocuments({ sessionId: item._id }), 0);
    assert.deepEqual((await fs.promises.readdir(storage.recordingsDirectory)).filter(name => name.endsWith('.chunk')), []);
  } finally { release(); Chunk.create = originalCreate; }
});

test('read-only storage audit finds missing files and owned chunk orphans without modifying data', async () => {
  const item = await session();
  const keptName = `${randomUUID()}.chunk`;
  const missingName = `${randomUUID()}.chunk`;
  const orphanName = `${randomUUID()}.chunk`;
  await fs.promises.writeFile(path.join(storage.recordingsDirectory, keptName), 'head');
  await fs.promises.writeFile(path.join(storage.recordingsDirectory, orphanName), 'orphan');
  await fs.promises.writeFile(path.join(storage.recordingsDirectory, 'operator-notes.txt'), 'do not modify');
  await Chunk.create([
    { sessionId: item._id, segmentId: randomUUID(), seq: 0, filename: keptName, bytes: 4, mimeType: 'video/webm', digest: 'fixture' },
    { sessionId: item._id, segmentId: randomUUID(), seq: 0, filename: missingName, bytes: 2, mimeType: 'video/webm', digest: 'fixture' },
  ]);
  await Session.updateOne({ _id: item._id }, { $set: { recordingBytes: 6 } });
  await resumeAt(path.join(storage.resumesDirectory, 'audit-missing.pdf'));
  const beforeFiles = (await fs.promises.readdir(storage.recordingsDirectory)).sort();
  const beforeRecords = await Chunk.countDocuments();
  const result = await auditStorage();
  assert.equal(result.mode, 'read-only');
  assert.equal(result.resumes.missingFiles, 1);
  assert.equal(result.recordings.missingFiles, 1);
  assert.equal(result.recordings.orphanFiles, 1);
  assert.equal(result.recordings.sessionsWithByteMismatch, 0);
  assert.equal(result.recordings.ignoredDirectoryEntries, 1);
  assert.deepEqual((await fs.promises.readdir(storage.recordingsDirectory)).sort(), beforeFiles);
  assert.equal(await Chunk.countDocuments(), beforeRecords);
  assert.ok(!JSON.stringify(result).includes(item.id));
  assert.ok(!JSON.stringify(result).includes(fixtureRoot));
});
