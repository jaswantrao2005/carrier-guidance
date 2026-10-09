const { test } = require('node:test');
const assert = require('node:assert/strict');
const { completeChat, selectedProvider } = require('../src/services/ai/chat.service');

test('Gemini adapter sends bounded prompts and reads JSON text', async () => {
  const previous = { provider: process.env.AI_PROVIDER, key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL };
  process.env.AI_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'synthetic-test-key';
  process.env.GEMINI_MODEL = 'gemini-test-model';
  try {
    const completion = await completeChat({
      messages: [{ role: 'system', content: 'Return JSON.' }, { role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi' }],
      temperature: 0, max_tokens: 128, response_format: { type: 'json_object' },
    }, async (url, init) => {
      assert.match(url, /gemini-test-model:generateContent$/);
      assert.equal(init.headers['x-goog-api-key'], 'synthetic-test-key');
      const body = JSON.parse(init.body);
      assert.equal(body.systemInstruction.parts[0].text, 'Return JSON.');
      assert.deepEqual(body.contents.map(item => item.role), ['user', 'model']);
      assert.equal(body.generationConfig.responseMimeType, 'application/json');
      assert.equal(body.generationConfig.maxOutputTokens, 128);
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }) };
    });
    assert.equal(completion.choices[0].message.content, '{"ok":true}');
    assert.equal(selectedProvider(), 'gemini');
  } finally {
    for (const [name, value] of [['AI_PROVIDER', previous.provider], ['GEMINI_API_KEY', previous.key], ['GEMINI_MODEL', previous.model]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('Gemini adapter reports quota/key failures without provider response details', async () => {
  const previous = { provider: process.env.AI_PROVIDER, key: process.env.GEMINI_API_KEY };
  process.env.AI_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'synthetic-test-key';
  try {
    for (const status of [403, 429]) {
      await assert.rejects(() => completeChat({ messages: [{ role: 'user', content: 'Hello' }] },
        async () => ({ ok: false, status, json: async () => ({ error: { message: 'provider-secret-detail' } }) })),
      error => error.statusCode === 503 && !error.message.includes('provider-secret-detail'));
    }
  } finally {
    if (previous.provider === undefined) delete process.env.AI_PROVIDER; else process.env.AI_PROVIDER = previous.provider;
    if (previous.key === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous.key;
  }
});
