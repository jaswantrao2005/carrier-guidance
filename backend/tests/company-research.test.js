const { test } = require('node:test');
const assert = require('node:assert/strict');
const { researchCompany } = require('../src/services/search/research.service');

test('company brief uses fetched source URLs and never model-invented source links', async () => {
  const oldFetch = global.fetch;
  const oldProvider = process.env.AI_PROVIDER;
  const oldKey = process.env.GEMINI_API_KEY;
  process.env.AI_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'fixture-only';
  let prompt;
  global.fetch = async (url, options) => {
    if (String(url).includes('duckduckgo')) return { status: 200, text: async () => '<a href="https://about.google/" class="result__snippet">Google builds search products.</a>' };
    prompt = JSON.parse(options.body);
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
      majorDevelopments: ['Search products'], keyProducts: ['Search'], recentStrategy: 'Not verified in available sources.',
      focusAreas: ['Backend APIs'], sources: ['https://model-invented.invalid/'],
    }) }] } }] }) };
  };
  try {
    const result = await researchCompany('Google');
    assert.equal(result.success, true);
    assert.deepEqual(result.data.sources, ['https://about.google/']);
    assert.ok(Number.isFinite(Date.parse(result.data.retrievedAt)));
    assert.match(prompt.contents[0].parts[0].text, /Do not present these as a comprehensive current-news search/);
  } finally {
    global.fetch = oldFetch;
    if (oldProvider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = oldProvider;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
  }
});

test('unavailable public sources do not fall back to unsupported model memory', async () => {
  const oldFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls++; return { status: 503 }; };
  try {
    const result = await researchCompany('Unknown fictional company');
    assert.equal(result.success, false);
    assert.equal(calls, 2);
  } finally { global.fetch = oldFetch; }
});
