const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execute } = require('../src/services/interview/coding.service');

async function withConfiguration(values, run) {
  const names = ['JUDGE0_URL', 'JUDGE0_API_KEY', 'JUDGE0_AUTH_TOKEN'];
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) {
    if (values[name] === undefined) delete process.env[name];
    else process.env[name] = values[name];
  }
  try { await run(); }
  finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
}
const response = value => ({ ok: true, json: async () => value });

test('Judge0 token-only queue responses are polled without submitting a case twice', async () => {
  await withConfiguration({ JUDGE0_URL: 'https://ce.judge0.com', JUDGE0_API_KEY: 'unrelated-rapidapi-key' }, async () => {
    const submissions = new Map();
    const fetcher = async (url, init) => {
      assert.equal(init.headers['X-RapidAPI-Key'], undefined);
      assert.ok(init.signal instanceof AbortSignal);
      if (init.method === 'POST') {
        assert.match(url, /wait=false/);
        const body = JSON.parse(init.body);
        assert.equal(body.enable_network, false);
        assert.equal(body.cpu_time_limit, 2);
        const token = `case-${submissions.size}`;
        submissions.set(token, { expected: body.expected_output, polls: 0 });
        return response({ token });
      }
      const token = new URL(url).pathname.split('/').at(-1);
      const stored = submissions.get(token);
      stored.polls += 1;
      return response(stored.polls === 1 ? { status: { id: 2 } } : {
        status: { id: 3, description: 'Accepted' }, stdout: `${stored.expected}\n`, time: '0.002', memory: 512,
      });
    };
    const result = await execute('javascript', 'synthetic code', 'sum_integers', fetcher);
    assert.equal(result.executed, true);
    assert.equal(result.passed, true);
    assert.equal(result.passedCases, 3);
    assert.equal(submissions.size, 3);
    assert.ok([...submissions.values()].every(value => value.polls === 2));
  });
});

test('Wrong Answer is successful execution with failed correctness', async () => {
  await withConfiguration({ JUDGE0_URL: 'https://judge.test' }, async () => {
    const result = await execute('python', 'print(999)', 'sum_integers', async () => response({
      status: { id: 4, description: 'Wrong Answer' }, stdout: '999\n', time: '0.01', memory: 100,
    }));
    assert.equal(result.executed, true);
    assert.equal(result.passed, false);
    assert.equal(result.testedCases, 3);
    assert.equal(result.passedCases, 0);
  });
});

test('direct Judge0 token authentication uses its native header', async () => {
  await withConfiguration({ JUDGE0_URL: 'http://127.0.0.1:2358', JUDGE0_AUTH_TOKEN: 'test-auth-token' }, async () => {
    const result = await execute('cpp', 'synthetic code', undefined, async (_url, init) => {
      assert.equal(init.headers['X-Auth-Token'], 'test-auth-token');
      assert.equal(init.headers['X-RapidAPI-Key'], undefined);
      return response({ status: { id: 3 }, stdout: 'output', time: '0.01', memory: 100 });
    });
    assert.equal(result.passed, null);
    assert.equal(result.testedCases, 0);
  });
});

test('sandbox authentication, malformed replies and transport failures are actionable safe errors', async () => {
  await withConfiguration({ JUDGE0_URL: 'https://judge.test' }, async () => {
    for (const status of [401, 403]) {
      await assert.rejects(execute('java', 'synthetic code', undefined, async () => ({ ok: false, status })),
        error => error.statusCode === 503 && /authentication/.test(error.message));
    }
    for (const value of [null, [], {}, { status: { id: 13 } }]) {
      await assert.rejects(execute('java', 'synthetic code', undefined, async () => response(value)),
        error => error.statusCode === 502);
    }
    await assert.rejects(execute('java', 'synthetic code', undefined, async () => { throw new Error('private network details'); }),
      error => error.statusCode === 502 && !error.message.includes('private network details'));
  });
});

test('invalid sandbox URLs and unsupported languages fail before contacting a host', async () => {
  await withConfiguration({ JUDGE0_URL: 'file:///local-path' }, async () => {
    const fetcher = async () => { assert.fail('must not contact an invalid host'); };
    await assert.rejects(execute('javascript', 'synthetic code', undefined, fetcher), error => error.statusCode === 503);
    await assert.rejects(execute('unknown', 'synthetic code', undefined, fetcher), error => error.statusCode === 400);
  });
});
