const { searchWeb } = require('./search.service');
const Groq = require('groq-sdk');

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const GROQ_MODEL = "openai/gpt-oss-120b";

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
    if (!groq) {
      throw new Error("GROQ_API_KEY is not configured");
    }

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

Use ONLY the verified web search snippets provided below to compile your analysis.
Do NOT invent, assume, or extrapolate any milestones, product names, or strategies. If the snippets do not contain enough information, state that company research is currently unavailable.

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

    const chatCompletion = await callGroqWithRotation(async (groqInstance) => {
      return await groqInstance.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" }
      });
    });

    const responseText = chatCompletion.choices[0]?.message?.content;
    const parsed = parseJSONResponse(responseText);

    if (!parsed || (!parsed.majorDevelopments && !parsed.recentStrategy)) {
      throw new Error("Failed to compile research from search results");
    }

    return {
      success: true,
      data: parsed
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
