/**
 * DuckDuckGo Keyless Search Scraper Service
 */
async function searchWeb(query) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodedQuery}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo response error: ${response.status}`);
    }

    const html = await response.text();
    const snippets = [];
    const regex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;

    while ((match = regex.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      snippets.push(text);
    }

    return snippets;
  } catch (error) {
    console.error('searchWeb Error:', error);
    return [];
  }
}

module.exports = {
  searchWeb
};
