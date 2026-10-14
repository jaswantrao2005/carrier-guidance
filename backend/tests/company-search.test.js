const { test } = require('node:test');
const assert = require('node:assert/strict');
const { searchWeb } = require('../src/services/search/search.service');

const query = company => `${company} company history developments milestones recent years`;
const background = title => ({ title, index: 1, extract: `${title} is a technology company. It provides cloud computing products and software services to business customers.`,
  canonicalurl: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}` });

test('DuckDuckGo snippets keep fetched source URLs and decode visible text', async () => {
  let calls = 0;
  const results = await searchWeb(query('Google'), async (_url, init) => {
    calls++;
    assert.ok(init.signal instanceof AbortSignal);
    return { status: 200, text: async () => '<a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fabout.google%2Fcompany-info%2Four-story%2F" class="result__snippet"><b>Google</b> provides search &amp; cloud products.</a>' };
  });
  assert.equal(calls, 1);
  assert.deepEqual(results, ['[Source: https://about.google/company-info/our-story/] Google provides search & cloud products.']);
});

test('202 bot challenges fall back to a matching Wikipedia company article', async () => {
  const urls = [];
  const results = await searchWeb(query('Stripe'), async (rawUrl, init) => {
    urls.push(rawUrl);
    assert.ok(init.signal instanceof AbortSignal);
    if (urls.length === 1) return { status: 202, text: async () => { assert.fail('challenge pages are not evidence'); } };
    const url = new URL(rawUrl);
    assert.equal(url.hostname, 'en.wikipedia.org');
    assert.equal(url.searchParams.get('gsrsearch'), '"Stripe" company');
    assert.equal(url.searchParams.get('explaintext'), '1');
    return { status: 200, json: async () => ({ query: { pages: [
      { ...background('Stripe'), pageprops: { disambiguation: '' } }, background('Striped hyena'), background('Stripe, Inc.'),
    ] } }) };
  });
  assert.equal(urls.length, 2);
  assert.equal(results.length, 1);
  assert.match(results[0], /^\[Source: https:\/\/en\.wikipedia\.org\/wiki\/Stripe%2C_Inc\.\]/);
  assert.match(results[0], /Background summary; this source may not cover current developments/);
});

test('empty or failed search can recover from a fetched company article without fabricating current news', async () => {
  let calls = 0;
  const results = await searchWeb(query('Microsoft'), async () => {
    calls++;
    if (calls === 1) throw Object.assign(new Error('network details are private'), { name: 'TimeoutError' });
    return { status: 200, json: async () => ({ query: { pages: [background('Microsoft')] } }) };
  });
  assert.equal(results.length, 1);
  assert.match(results[0], /\[Source: https:\/\/en\.wikipedia\.org\/wiki\/Microsoft\]/);
  assert.ok(!results[0].includes('network details are private'));
});

test('unrelated articles, unsafe source URLs and unavailable providers return no evidence', async () => {
  for (const pages of [[background('Unrelated company')], [{ ...background('Google'), canonicalurl: 'javascript:alert(1)' }],
    [{ ...background('Google'), canonicalurl: 'https://en.wikipedia.org.evil.test/wiki/Google' }], []]) {
    let calls = 0;
    const results = await searchWeb(query('Google'), async () => ++calls === 1 ? { status: 202 }
      : { status: 200, json: async () => ({ query: { pages } }) });
    assert.deepEqual(results, []);
  }
  assert.deepEqual(await searchWeb(query('Google'), async () => { throw new Error('unavailable'); }), []);
});

test('search evidence and query length are bounded and links cannot invent a source', async () => {
  const results = await searchWeb(query('Google'), async () => ({ status: 200, text: async () =>
    '<a class="result__snippet" href="javascript:alert(1)">Unsafe link</a>'
    + Array.from({ length: 12 }, (_, i) => `<a class="result__snippet" href="https://source.example/${i}">${'x'.repeat(2000)}</a>`).join('') }));
  assert.equal(results.length, 6);
  assert.ok(results.every(value => value.length < 1600));
  assert.ok(results.every(value => !value.includes('Unsafe link')));
  let calls = 0;
  const longArticle = await searchWeb(query('Google'), async () => ++calls === 1 ? { status: 202 } : {
    status: 200, json: async () => ({ query: { pages: [{ ...background('Google'), extract: `Google is a company. ${'Background '.repeat(1000)}` }] } }),
  });
  assert.equal(longArticle.length, 1);
  assert.ok(longArticle[0].length < 5500);
  const forbiddenFetch = async () => { assert.fail('invalid queries must not request a provider'); };
  for (const value of ['', undefined, {}, 'x'.repeat(501)]) assert.deepEqual(await searchWeb(value, forbiddenFetch), []);
});
