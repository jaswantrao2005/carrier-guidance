const mongoose = require('mongoose');
const Interview = require('../models/Interview');
const { DURATION_PRESETS } = require('../services/interview/conversation');

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}
function text(value, name, max, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    fail(`${name} must be ${required ? 'a non-empty' : 'a'} string of at most ${max} characters.`);
  }
  return value.trim();
}
function objectId(value) {
  if (!mongoose.isObjectIdOrHexString(value)) fail('Invalid resource ID.');
  return value;
}
function validateSetup(body) {
  const role = text(body.role, 'Role', 120, true);
  const interviewType = body.interviewType || 'Overall Interview';
  if (!Interview.schema.path('interviewType').enumValues.includes(interviewType)) fail('Invalid interview type.');
  const durationPreset = body.durationPreset || 'standard';
  if (!Object.hasOwn(DURATION_PRESETS, durationPreset)) fail('Invalid duration preset.');
  const experienceLevel = body.experienceLevel || 'fresher';
  if (!['fresher', 'experienced'].includes(experienceLevel)) fail('Invalid experience level.');
  const totalExperienceYears = experienceLevel === 'fresher' ? 0 : body.totalExperienceYears;
  if (!Number.isFinite(totalExperienceYears) || totalExperienceYears < 0 || totalExperienceYears > 70 ||
      (experienceLevel === 'experienced' && totalExperienceYears === 0)) fail('Invalid total experience.');
  const employmentHistory = body.employmentHistory || [];
  if (!Array.isArray(employmentHistory) || employmentHistory.length > 20) fail('Invalid employment history.');
  const employment = employmentHistory.map(entry => {
    if (!entry || !Number.isFinite(entry.durationYears) || entry.durationYears <= 0 || entry.durationYears > 70) fail('Invalid employment duration.');
    return { companyName: text(entry.companyName, 'Company', 150, true), position: text(entry.position, 'Position', 150, true), durationYears: entry.durationYears };
  });
  if (!body.consent || body.consent.storeTranscript !== true) fail('Consent to store and evaluate your answers is required.');
  for (const key of ['recordAudio', 'recordVideo', 'analyzeVideo']) {
    if (typeof body.consent[key] !== 'boolean') fail(`Choose ${key} consent.`);
  }
  if (body.consent.recordVideo && !body.consent.recordAudio) fail('Video recording requires audio recording consent.');
  if (body.consent.analyzeVideo && !body.consent.recordVideo) fail('Video review requires video recording consent.');
  return {
    role, interviewType, durationPreset, experienceLevel, totalExperienceYears,
    employmentHistory: experienceLevel === 'fresher' ? [] : employment,
    resumeId: body.resumeId ? objectId(body.resumeId) : null,
    jobDescriptionText: text(body.jobDescriptionText, 'Job description', 20000),
    companyName: text(body.companyName, 'Company name', 150),
  };
}
module.exports = { fail, text, objectId, validateSetup };
