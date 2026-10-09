#!/usr/bin/env node
// Run from any directory. Uses generated media and a disposable local Mongo database.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createRequire } = require('node:module');

const serviceRoot = path.resolve(__dirname, '..');
const backendRoot = path.resolve(serviceRoot, '../backend');
const backendRequire = createRequire(path.join(backendRoot, 'package.json'));
const mongoose = backendRequire('mongoose');
const Interview = backendRequire('./src/models/Interview');
const Session = backendRequire('./src/models/InterviewSession');
const recording = backendRequire('./src/services/interview/recording.service');
const integrity = backendRequire('./src/services/interview/integrity.service');

async function main() {
  const serviceUrl = new URL(process.argv[2] || 'http://127.0.0.1:8001');
  assert.equal(serviceUrl.protocol, 'http:', 'Use a local HTTP service for this check.');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(serviceUrl.hostname), 'The check only calls a local service.');
  const healthResponse = await fetch(new URL('/health', serviceUrl), { signal: AbortSignal.timeout(10000) });
  assert.equal(healthResponse.status, 200);
  const health = await healthResponse.json();
  assert.equal(health.model_present, true, 'Download the BlazeFace model before checking.');
  assert.equal(path.resolve(health.recordings_dir), recording.directory, 'Python RECORDINGS_DIR must match backend/uploads/recordings.');

  const dbName = `careerai_video_test_${randomUUID().replaceAll('-', '')}`;
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'careerai-video-check-'));
  const videoPath = path.join(temporaryDirectory, 'synthetic.mp4');
  const pythonPath = process.platform === 'win32'
    ? path.join(serviceRoot, '.venv/Scripts/python.exe')
    : path.join(serviceRoot, '.venv/bin/python');
  let reportId;
  try {
    // The fixture is drawn with OpenCV. No camera, account, resume, or personal file is used.
    await promisify(execFile)(pythonPath, ['-c', [
      'import sys',
      'from pathlib import Path',
      'from tests.test_detector import Spec, _write_video',
      '_write_video(Path(sys.argv[1]), Spec(6, lambda second: [(320, 240, 1.0)]))',
    ].join('\n'), videoPath], { cwd: serviceRoot, timeout: 30000 });

    await mongoose.connect('mongodb://127.0.0.1:27017', { dbName, serverSelectionTimeoutMS: 10000 });
    const user = new mongoose.Types.ObjectId();
    const session = await Session.create({
      user, status: 'completed', setup: { role: 'Synthetic integration check' }, maxQuestions: 1,
      consent: { transcript: true, recordAudio: true, recordVideo: true, analyzeVideo: true },
      deadlineAt: new Date(Date.now() + 60000),
    });
    reportId = session.interviewId;
    const segmentId = randomUUID();
    const bytes = await fs.readFile(videoPath);
    const split = Math.floor(bytes.length / 2);
    for (const [seq, buffer] of [bytes.subarray(0, split), bytes.subarray(split)].entries()) {
      await recording.uploadChunk(session.id, user, segmentId, seq, { buffer, size: buffer.length }, 'video/mp4');
    }
    await Interview.create({
      _id: reportId, sessionId: session.id, user, role: 'Synthetic integration check',
      consent: session.consent, overallScore: 77,
    });
    process.env.INTEGRITY_SERVICE_URL = serviceUrl.origin;
    const result = await integrity.analyzeReport(reportId, user);
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0].suppressed, false);
    assert.ok(result.segments[0].quality.frames_analysed >= 10);
    assert.deepEqual(result.segments[0].signals, []);
    const persisted = await Interview.findById(reportId).lean();
    assert.equal(persisted.overallScore, 77, 'Video observations must never change the interview score.');
    assert.equal(persisted.presenceReview.segments[0].quality.reliable, true);
    console.log(JSON.stringify({
      passed: true, service: serviceUrl.origin, framesAnalysed: result.segments[0].quality.frames_analysed,
      reliable: result.segments[0].quality.reliable, signals: result.segments[0].signals.length,
      scoreUnchanged: persisted.overallScore === 77, realDetector: true,
    }, null, 2));
    await recording.deleteInterview(reportId, user);
    reportId = undefined;
  } finally {
    if (mongoose.connection.readyState === 1) {
      if (reportId) {
        const report = await Interview.findById(reportId).lean();
        if (report) await recording.deleteInterview(reportId, report.user);
      }
      // Also clean media if an upload failed before the report was created.
      const sessions = await Session.find().lean();
      for (const session of sessions) await recording.deleteSessionRecordings(session._id);
      assert.ok(mongoose.connection.name === dbName && dbName.startsWith('careerai_video_test_'));
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
    assert.equal(path.dirname(path.resolve(temporaryDirectory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temporaryDirectory).startsWith('careerai-video-check-'));
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(`Video connection check failed: ${error.message}`); process.exitCode = 1; });
