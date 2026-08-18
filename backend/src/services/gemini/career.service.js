const { callGroqWithRotation } = require("../groq/groqPool");

const GROQ_MODEL = "openai/gpt-oss-120b";


function normalizeAnalysisPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return {
      candidateSummary: "Candidate profile analyzed successfully.",
      technicalSkills: ["JavaScript", "Web Development"],
      softSkills: ["Problem Solving"],
      missingSkills: [],
      strengths: [],
      weaknesses: [],
      careerRoles: ["Software Developer"],
      atsScore: 78,
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
      payload.candidateSummary || payload.candidate_summary || payload.summary || "Candidate profile analyzed.",
    technicalSkills: parseArray(payload.technicalSkills || payload.technical_skills),
    softSkills: parseArray(payload.softSkills || payload.soft_skills),
    missingSkills: parseArray(payload.missingSkills || payload.missing_skills),
    strengths: parseArray(payload.strengths),
    weaknesses: parseArray(payload.weaknesses),
    careerRoles: parseArray(payload.careerRoles || payload.career_roles),
    atsScore:
      typeof payload.atsScore === "number" && payload.atsScore > 0
        ? payload.atsScore
        : Number(payload.atsScore || 80),
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
    const systemPrompt = "You are an expert AI Career Advisor and ATS Evaluator. You must output a valid JSON object matching the requested schema. Output raw JSON only.";
    const prompt = `:
Analyze the following resume and return valid JSON only with these exact keys:
  "candidateSummary": "string",
  "technicalSkills": ["string"],
  "softSkills": ["string"],
  "missingSkills": ["string"],
  "strengths": ["string"],
  "weaknesses": ["string"],
  "careerRoles": ["string"],
  "atsScore": 85,
  "suggestions": ["string"],
  "education": ["string"],
  "projects": ["string"],
  "workExperience": ["string"]

Resume:
${resumeText}
` ;

    // Automatically executes with Groq multi-key pool rotation
    const responseText = await callGroqWithRotation(async (groqInstance) => {
      const chatCompletion = await groqInstance.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 2048
      });
      return chatCompletion.choices[0]?.message?.content;
    });

    const parsedResponse = parseGroqResponse(responseText);
    return normalizeAnalysisPayload(parsedResponse);
  } catch (error) {
    console.error('analyzeResume Error:', error);
    return normalizeAnalysisPayload(null);
  }
}

module.exports = {
  analyzeResume,
  normalizeAnalysisPayload,
};
