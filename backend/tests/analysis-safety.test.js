const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAnalysisPayload } = require('../src/services/gemini/career.service');
const { normalizeEvaluation, DIMENSIONS } = require('../src/services/gemini/evaluation');
const { execute } = require('../src/services/interview/coding.service');

test('resume errors never fabricate skills or a passing ATS score', () => {
  for (const input of [null, {}, { atsScore: 'not a number' }, { atsScore: '' }]) assert.throws(() => normalizeAnalysisPayload(input));
  assert.equal(normalizeAnalysisPayload({ atsScore: 0 }).atsScore, 0);
  assert.equal(normalizeAnalysisPayload({ atsScore: 200 }).atsScore, 100);
  assert.deepEqual(normalizeAnalysisPayload({ atsScore: 10, technicalSkills: [42, 'JS', {}] }).technicalSkills, ['JS']);
});
test('evaluation keeps actual transcript and ignores unsupported confidence estimates', () => {
  const history = [{ question: 'Actual question', answer: 'Actual answer', category: 'Technical', difficulty: 'Easy' }];
  const payload = { overallScore: 90, categoryScores: Object.fromEntries([...DIMENSIONS, 'confidence'].map(key => [key, 90])), transcript: [{ question: 'fake', answer: 'fake', evaluation: { good: 'good', bad: 'bad', improved: 'improved' } }] };
  const report = normalizeEvaluation(payload, history);
  assert.equal(report.transcript[0].answer, history[0].answer);
  assert.equal(report.categoryScores.confidence, undefined);
  assert.throws(() => normalizeEvaluation({ ...payload, transcript: [] }, history));
});
test('coding correctness compares outputs and distinguishes execution from tests', async () => {
  const original = process.env.JUDGE0_URL;
  process.env.JUDGE0_URL = 'http://judge.test';
  try {
    const requests = [];
    const fake = async (url, init) => {
      const payload = JSON.parse(init.body); requests.push(payload);
      return { ok: true, json: async () => ({ status: { id: 3 }, stdout: 'wrong\n', time: '0.01', memory: 100 }) };
    };
    const tested = await execute('javascript', 'console.log("wrong")', 'sum_integers', fake);
    assert.equal(tested.passed, false); assert.equal(tested.testedCases, 3);
    assert.equal(requests[0].expected_output, '6'); assert.equal(requests[0].enable_network, false);
    const run = await execute('javascript', 'console.log("wrong")', undefined, fake);
    assert.equal(run.executed, true); assert.equal(run.passed, null); assert.equal(run.testedCases, 0);
    await assert.rejects(() => execute('unknown', 'code', undefined, fake));
  } finally { if (original === undefined) delete process.env.JUDGE0_URL; else process.env.JUDGE0_URL = original; }
});
