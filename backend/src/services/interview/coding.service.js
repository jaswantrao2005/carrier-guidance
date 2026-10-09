const { fail, text } = require('../../validations/interview.validation');

const PROBLEMS = {
  sum_integers: {
    id: 'sum_integers', title: 'Sum integers',
    statement: 'Write a program that reads one line of space-separated integers from standard input and prints their sum. Print 0 for an empty line. Values can be negative. Explain the time and space complexity.',
    examples: [{ input: '1 2 3', output: '6' }],
    tests: [{ input: '1 2 3\n', expectedOutput: '6' }, { input: '-5 0 2\n', expectedOutput: '-3' }, { input: '\n', expectedOutput: '0' }],
  },
  first_unique: {
    id: 'first_unique', title: 'First unique character',
    statement: 'Read a lowercase ASCII string from standard input. Print the first character that occurs exactly once, or NONE if there is none. Explain your algorithm and complexity.',
    examples: [{ input: 'swiss', output: 'w' }],
    tests: [{ input: 'swiss\n', expectedOutput: 'w' }, { input: 'aabbcc\n', expectedOutput: 'NONE' }, { input: 'aabcc\n', expectedOutput: 'b' }],
  },
};
function publicProblem(topicId) {
  const problem = topicId === 'problem_1' ? PROBLEMS.sum_integers : topicId === 'problem_2' ? PROBLEMS.first_unique : null;
  if (!problem) return null;
  const { tests, ...visible } = problem;
  return visible;
}
async function execute(language, code, problemId, fetcher = fetch) {
  const ids = { javascript: 93, python: 71, java: 62, cpp: 54 };
  if (!Object.hasOwn(ids, language)) fail('Unsupported coding language.');
  text(code, 'Code', 14000, true);
  const base = (process.env.JUDGE0_URL || 'https://judge0-ce.p.rapidapi.com').replace(/\/$/, '');
  if (!process.env.JUDGE0_URL && !process.env.JUDGE0_API_KEY) fail('Code execution is not configured. You can still submit code for AI feedback.', 503);
  let host;
  try {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid URL');
    host = url.host;
  } catch { fail('The code sandbox URL is not configured correctly.', 503); }
  const headers = { 'Content-Type': 'application/json' };
  if (host.endsWith('.p.rapidapi.com') && process.env.JUDGE0_API_KEY) {
    headers['X-RapidAPI-Key'] = process.env.JUDGE0_API_KEY;
    headers['X-RapidAPI-Host'] = host;
  }
  // Direct Judge0 installations use X-Auth-Token, not RapidAPI credentials.
  if (process.env.JUDGE0_AUTH_TOKEN) headers['X-Auth-Token'] = process.env.JUDGE0_AUTH_TOKEN;
  const testCases = PROBLEMS[problemId]?.tests || [];
  const cases = testCases.length ? testCases : [{ input: '' }];
  // Three server-owned cases can run in parallel. One deadline covers submission,
  // queue time and every poll, keeping the request below the client's 60s timeout.
  const deadline = AbortSignal.timeout(45000);
  const request = async (url, init = {}) => {
    try {
      const response = await fetcher(url, { ...init, headers, signal: AbortSignal.any([deadline, AbortSignal.timeout(12000)]) });
      if (!response.ok) {
        if ([401, 403].includes(response.status)) fail('Code sandbox authentication failed. Check the server configuration.', 503);
        if (response.status === 429) fail('Code sandbox is busy. Please retry shortly.', 503);
        fail(`Code sandbox is unavailable (${response.status}). Please retry later.`, 502);
      }
      const result = await response.json();
      if (!result || typeof result !== 'object' || Array.isArray(result)) fail('The code sandbox returned an invalid result.', 502);
      return result;
    } catch (error) {
      if (error.statusCode) throw error;
      if (deadline.aborted || ['AbortError', 'TimeoutError'].includes(error.name)) fail('Code sandbox timed out. Please retry.', 504);
      fail('Could not contact the code sandbox. Please retry later.', 502);
    }
  };
  const results = await Promise.all(cases.map(async test => {
    // Official Judge0 CE disables wait=true. Its response contains only a token.
    let result = await request(`${base}/submissions?base64_encoded=false&wait=false`, {
      method: 'POST',
      body: JSON.stringify({ language_id: ids[language], source_code: code, stdin: test.input,
        expected_output: test.expectedOutput, cpu_time_limit: 2, wall_time_limit: 5, memory_limit: 128000, max_file_size: 1024, enable_network: false }),
    });
    const token = typeof result.token === 'string' && result.token.length <= 200 ? result.token : null;
    for (let i = 0; token && (!result.status || [1, 2].includes(result.status.id)) && i < 40; i++) {
      if (deadline.aborted) fail('Code sandbox timed out. Please retry.', 504);
      await new Promise(resolve => setTimeout(resolve, 250));
      result = await request(`${base}/submissions/${encodeURIComponent(token)}?base64_encoded=false`);
    }
    if (!Number.isInteger(result.status?.id) || result.status.id <= 2 || result.status.id === 13) fail('The code sandbox did not return a completed result. Please retry.', 502);
    // Wrong Answer (4) means the program ran successfully, but failed its test.
    const executed = [3, 4].includes(result.status.id);
    const correct = test.expectedOutput === undefined ? null : result.status.id === 3 && String(result.stdout || '').trim() === test.expectedOutput.trim();
    return { executed, passed: correct, output: String(result.compile_output || result.stderr || result.stdout || result.status.description).slice(0, 8000),
      executionTimeMs: Math.round(Number(result.time || 0) * 1000), memoryBytes: Number(result.memory || 0) * 1024 };
  }));
  return {
    executed: results.every(r => r.executed), passed: testCases.length ? results.every(r => r.passed) : null,
    testedCases: testCases.length, passedCases: results.filter(r => r.passed).length,
    output: testCases.length ? results.map((r, i) => `Case ${i + 1}: ${r.passed ? 'passed' : 'failed'}\n${r.output}`).join('\n\n') : `${results[0].output}\n\nExecution only. No correctness tests are defined for this question.`,
    executionTimeMs: results.reduce((sum, r) => sum + r.executionTimeMs, 0), memoryBytes: Math.max(...results.map(r => r.memoryBytes)),
  };
}
module.exports = { execute, publicProblem, PROBLEMS };
