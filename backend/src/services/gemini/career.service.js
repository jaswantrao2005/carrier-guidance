const Groq = require("groq-sdk");

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const GROQ_MODEL = "llama-3.3-70b-versatile";

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
      education: [],
      projects: [],
      workExperience: [],
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
    education: parseArray(payload.education),
    projects: parseArray(payload.projects),
    workExperience: parseArray(payload.workExperience || payload.work_experience || payload.experience),
  };
}

function parseGroqResponse(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```json|```/g, "").trim();
  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch (error) {
    console.warn("Unable to parse Groq response as JSON:", error.message);
  }
  return null;
}

async function analyzeResume(resumeText) {
  try {
    if (!groq) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    const systemPrompt = "You are an expert AI Career Advisor.";
    const prompt = `
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
  "suggestions": ["string"],
  "education": ["string"],
  "projects": ["string"],
  "workExperience": ["string"]
}

Resume:

${resumeText}
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const responseText = chatCompletion.choices[0]?.message?.content;
    const parsedResponse = parseGroqResponse(responseText);

    return normalizeAnalysisPayload(parsedResponse || responseText);
  } catch (error) {
    console.error("analyzeResume Error:", error);
    throw new Error("Failed to analyze resume with Groq");
  }
}

module.exports = {
  analyzeResume,
  normalizeAnalysisPayload,
};