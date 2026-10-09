const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.FRONTEND_ORIGINS = 'https://preview.example';
const app = require('../src/app');

let server;
let base;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise(resolve => server.close(resolve));
});

async function preflight(path, origin) {
  return fetch(`${base}${path}`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
}

test('deployed frontend can preflight login and registration', async () => {
  const origin = 'https://carrier-guidance-two.vercel.app';
  for (const path of ['/api/auth/login', '/api/auth/register']) {
    const response = await preflight(path, origin);
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.match(response.headers.get('access-control-allow-methods'), /POST/);
    assert.match(response.headers.get('access-control-allow-headers'), /content-type/i);
  }
});

test('local and explicitly configured origins work without allowing unknown sites', async () => {
  for (const origin of ['http://localhost:3000', 'https://preview.example']) {
    const response = await preflight('/api/auth/register', origin);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
  }

  const rejected = await preflight('/api/auth/register', 'https://unrelated.example');
  assert.equal(rejected.status, 204);
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
});
