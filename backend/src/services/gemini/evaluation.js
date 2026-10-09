const DIMENSIONS = ['communication', 'technicalKnowledge', 'problemSolving', 'resumeKnowledge', 'behavioral', 'roleReadiness'];
const strings = value => Array.isArray(value) ? value.filter(v => typeof v === 'string').map(v => v.slice(0, 2000)).slice(0, 30) : [];
function score(value) {
  if (!['string', 'number'].includes(typeof value) || value === '' || !Number.isFinite(Number(value))) throw new Error('AI response has an invalid score.');
  return Math.round(Math.min(100, Math.max(0, Number(value))));
}
function normalizeEvaluation(payload, history) {
  if (!payload || !Array.isArray(payload.transcript) || payload.transcript.length !== history.length) throw new Error('AI response does not evaluate every saved answer.');
  return {
    overallScore: score(payload.overallScore),
    categoryScores: Object.fromEntries(DIMENSIONS.map(key => [key, score(payload.categoryScores?.[key])])),
    transcript: history.map((turn, index) => {
      const feedback = payload.transcript[index]?.evaluation;
      if (!feedback || ['good', 'bad', 'improved'].some(key => typeof feedback[key] !== 'string')) throw new Error('AI response has incomplete answer feedback.');
      // The evaluator may annotate answers, but must never rewrite the actual transcript.
      return { question: turn.question, answer: turn.answer, category: turn.category, difficulty: turn.difficulty,
        evaluation: { good: feedback.good.slice(0, 4000), bad: feedback.bad.slice(0, 4000), improved: feedback.improved.slice(0, 6000) } };
    }),
    strongAreas: strings(payload.strongAreas), weakAreas: strings(payload.weakAreas), techGaps: strings(payload.techGaps),
    communicationFeedback: typeof payload.communicationFeedback === 'string' ? payload.communicationFeedback.slice(0, 4000) : '',
    roadmap: Object.fromEntries(['conceptsToRevise', 'practiceTopics', 'suggestedNextSteps'].map(key => [key, strings(payload.roadmap?.[key])])),
    jobMatchScore: payload.jobMatchScore == null ? 0 : score(payload.jobMatchScore),
    jdMatchBreakdown: Object.fromEntries(['strongMatches', 'needsImprovement', 'notDemonstrated'].map(key => [key, strings(payload.jdMatchBreakdown?.[key])])),
  };
}
module.exports = { normalizeEvaluation, DIMENSIONS };
