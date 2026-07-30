const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

function normalizeAnalysisPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return {
      candidateSummary: "",
      technicalSkills: [],
      softSkills: [],
      missingSkills: [],
      strengths: [],
      weaknesses: [],
      careerRoles: [],
      atsScore: 0,
      suggestions: [],
    };
  }

  const parseArray = (value) => {
    if (Array.isArray(value)) {
      return value.filter(Boolean);
    }

    if (typeof value === "string") {
      return value
        .split(/\n|,/) 
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  };

  return {
    candidateSummary:
      payload.candidateSummary || payload.candidate_summary || payload.summary || "",
    technicalSkills: parseArray(payload.technicalSkills || payload.technical_skills),
    softSkills: parseArray(payload.softSkills || payload.soft_skills),
    missingSkills: parseArray(payload.missingSkills || payload.missing_skills),
    strengths: parseArray(payload.strengths),
    weaknesses: parseArray(payload.weaknesses),
    careerRoles: parseArray(payload.careerRoles || payload.career_roles),
    atsScore:
      typeof payload.atsScore === "number"
        ? payload.atsScore
        : Number(payload.atsScore || 0),
    suggestions: parseArray(payload.suggestions),
  };
}

function parseGeminiResponse(text) {
  if (!text) {
    return null;
  }

  const cleaned = String(text).replace(/```json|```/g, "").trim();

  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch (error) {
    console.warn("Unable to parse Gemini response as JSON:", error.message);
  }

  return null;
}

async function analyzeResume(resumeText) {
  try {
    if (!genAI) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    const prompt = `
You are an expert AI Career Advisor.

Analyze the following resume and return valid JSON only with these exact keys:
{
  "candidateSummary": "string",
  "technicalSkills": ["string"],
  "softSkills": ["string"],
  "missingSkills": ["string"],
  "strengths": ["string"],
  "weaknesses": ["string"],
  "careerRoles": ["string"],
  "atsScore": 0,
  "suggestions": ["string"]
}

Resume:

${resumeText}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsedResponse = parseGeminiResponse(responseText);

    return normalizeAnalysisPayload(parsedResponse || responseText);
  } catch (error) {
    console.error(error);
    throw new Error("Failed to analyze resume with Gemini");
  }
}

module.exports = {
  analyzeResume,
  normalizeAnalysisPayload,
};