const { searchWeb } = require('./search.service');
const { completeChat } = require('../ai/chat.service');

function parseJSONResponse(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```json|```/g, "").trim();
  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch (error) {
    console.warn("Unable to parse JSON from research response:", error.message);
  }
  return null;
}

/**
 * Conducts automated research on a company by fetching search results
 * and compiling a verified snapshot without making up information.
 */
async function researchCompany(companyName) {
  try {
    if (!companyName) return null;

    // Query for company development history over the last 10 years
    const query = `${companyName} company history developments milestones recent years`;
    const snippets = await searchWeb(query);

    if (snippets.length === 0) {
      return {
        success: false,
        message: "No search results found to verify company information."
      };
    }

    const systemPrompt = "You are an expert market analyst and research assistant.";
    const prompt = `
Research major developments, key products, and recent business direction over the last decade (10 years) for the company: "${companyName}".

Use ONLY the fetched source snippets provided below to compile your analysis.
Do NOT invent, assume, or extrapolate any milestones, product names, or strategies. If the snippets do not contain enough information, state that company research is currently unavailable.
Some sources are encyclopedia background articles. Do not present these as a comprehensive current-news search. If recent strategy is not supported, say it is not verified in the available sources. Return only relevant company facts, not similarly named companies.

Search Snippets:
${snippets.map((s, idx) => `[Snippet ${idx + 1}]: ${s}`).join("\n\n")}

Return ONLY a valid JSON object matching the following structure:
{
  "majorDevelopments": ["List of 3-4 major company developments from the last 10 years"],
  "keyProducts": ["List of 2-3 important products/services/technologies"],
  "recentStrategy": "Recent business strategy or direction (1-2 sentences)",
  "focusAreas": ["List of 2-3 areas that an interviewee for this company should focus on based on their recent business direction"]
}
`;

    const chatCompletion = await completeChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const responseText = chatCompletion.choices[0]?.message?.content;
    const parsed = parseJSONResponse(responseText);

    if (!parsed || (!parsed.majorDevelopments && !parsed.recentStrategy)) {
      throw new Error("Failed to compile research from search results");
    }

    return {
      success: true,
      data: {
        majorDevelopments: Array.isArray(parsed.majorDevelopments) ? parsed.majorDevelopments.filter(v => typeof v === 'string').slice(0, 6) : [],
        keyProducts: Array.isArray(parsed.keyProducts) ? parsed.keyProducts.filter(v => typeof v === 'string').slice(0, 6) : [],
        recentStrategy: typeof parsed.recentStrategy === 'string' ? parsed.recentStrategy : '',
        focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.filter(v => typeof v === 'string').slice(0, 6) : [],
        sources: [...new Set(snippets.flatMap(snippet => [...snippet.matchAll(/\[Source: (https:\/\/[^\s\]]+)\]/g)].map(match => match[1])))].slice(0, 6),
        retrievedAt: new Date().toISOString(),
      }
    };
  } catch (error) {
    console.error("researchCompany Error:", error);
    return {
      success: false,
      message: "Company research is currently unavailable."
    };
  }
}

module.exports = {
  researchCompany
};
