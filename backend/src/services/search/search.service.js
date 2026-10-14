// Public-source lookup. A challenge page or unavailable provider never becomes evidence.
const RESEARCH_SUFFIX = /\s+company history developments milestones recent years\s*$/i;
const MAX_SNIPPETS = 6;
const USER_AGENT = 'CareerGuidanceDemo/1.0 (https://github.com/jaswantrao2005/carrier-guidance; educational company lookup)';

function plainText(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g,
    entity => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' })[entity])
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_match, number) => {
      const code = number.toLowerCase().startsWith('x') ? parseInt(number.slice(1), 16) : Number(number);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }).replace(/\s+/g, ' ').trim();
}
function sourceUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) return null;
  try {
    const url = new URL(plainText(value), 'https://duckduckgo.com');
    const destination = url.searchParams.get('uddg');
    const resolved = destination ? new URL(destination) : url;
    return resolved.protocol === 'https:' && !resolved.username && !resolved.password && resolved.href.length <= 2000 ? resolved.href : null;
  } catch { return null; }
}
function duckDuckGoSnippets(html) {
  const snippets = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    if (!/\bclass\s*=\s*["'][^"']*\bresult__snippet\b/i.test(match[1])) continue;
    const text = plainText(match[2]).slice(0, 1500);
    if (!text) continue;
    const href = match[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    const source = sourceUrl(href);
    if (!source) continue;
    snippets.push(`[Source: ${source}] ${text}`);
    if (snippets.length === MAX_SNIPPETS) break;
  }
  return snippets;
}
function companyTitle(value) {
  return plainText(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
    .replace(/\s+(?:inc|incorporated|llc|ltd|limited|corp|corporation|company|plc)$/, '');
}

async function wikipediaBackground(query, fetcher, deadline) {
  const company = query.replace(RESEARCH_SUFFIX, '').trim();
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', generator: 'search',
    gsrsearch: `"${company.replaceAll('"', '')}" company`, gsrlimit: '3', gsrnamespace: '0',
    prop: 'extracts|info|pageprops', exintro: '1', explaintext: '1', exlimit: '3', inprop: 'url' });
  const response = await fetcher(url.href, { headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.any([deadline, AbortSignal.timeout(5000)]) });
  if (response.status !== 200) return [];
  const data = await response.json();
  const expectedTitle = companyTitle(company);
  const pages = Array.isArray(data?.query?.pages) ? data.query.pages : [];
  const page = pages.sort((a, b) => (a.index || 0) - (b.index || 0)).find(item =>
    typeof item.title === 'string' && typeof item.extract === 'string' && !Object.hasOwn(item.pageprops || {}, 'disambiguation')
    && companyTitle(item.title) === expectedTitle
    && /\b(company|corporation|firm|business|enterprise|bank|startup|organization|multinational)\b/i.test(item.extract));
  if (!page) return [];
  const source = sourceUrl(page.canonicalurl || page.fullurl);
  if (!source || new URL(source).host !== 'en.wikipedia.org' || !new URL(source).pathname.startsWith('/wiki/')) return [];
  const extract = plainText(page.extract).slice(0, 5000);
  if (extract.length < 60) return [];
  return [`[Source: ${source}] Wikipedia article: ${plainText(page.title)}. Background summary; this source may not cover current developments: ${extract}`];
}

async function searchWeb(query, fetcher = fetch) {
  if (typeof query !== 'string' || !query.trim() || query.length > 500) return [];
  const deadline = AbortSignal.timeout(8000);
  try {
    const response = await fetcher(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      signal: AbortSignal.any([deadline, AbortSignal.timeout(3000)]), headers: { 'User-Agent': USER_AGENT },
    });
    // DuckDuckGo returns 202 for bot challenges. Its HTML is not a search result.
    if (response.status === 200) {
      const html = await response.text();
      const snippets = html.length <= 300000 ? duckDuckGoSnippets(html) : [];
      if (snippets.length) return snippets;
    }
  } catch { /* A blocked or unavailable search provider can still use a public article. */ }
  try { return await wikipediaBackground(query, fetcher, deadline); }
  catch { return []; }
}

module.exports = { searchWeb };
