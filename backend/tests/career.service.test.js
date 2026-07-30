const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeAnalysisPayload } = require('../src/services/gemini/career.service');

test('normalizeAnalysisPayload converts Gemini output into a consistent analysis object', () => {
  const payload = {
    candidateSummary: 'Strong full-stack candidate',
    technicalSkills: ['Node.js', 'React'],
    softSkills: ['Communication'],
    missingSkills: ['Docker'],
    strengths: ['Problem solving'],
    weaknesses: ['Testing coverage'],
    careerRoles: ['Backend Engineer'],
    atsScore: 87,
    suggestions: ['Add DevOps experience']
  };

  const normalized = normalizeAnalysisPayload(payload);

  assert.equal(normalized.candidateSummary, 'Strong full-stack candidate');
  assert.deepEqual(normalized.technicalSkills, ['Node.js', 'React']);
  assert.equal(normalized.atsScore, 87);
  assert.deepEqual(normalized.suggestions, ['Add DevOps experience']);
});
