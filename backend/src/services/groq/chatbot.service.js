const Groq = require("groq-sdk");

// Use the versatile model as requested
const GROQ_MODEL = "qwen/qwen3.6-27b";

/**
 * Generates a chatbot response using Groq, giving it context of the user's resume.
 * 
 * @param {Array} history - Array of previous messages {role, content}
 * @param {String} userQuery - The current query from the user (e.g., "AI Engineer")
 * @param {Object} resumeAnalysis - The full analysis object from the user's latest resume
 */
const generateRoadmapResponse = async (history, userQuery, resumeAnalysis) => {
  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured in the environment variables.");
  }

  const systemPrompt = `You are an elite, highly experienced career mentor and tech advisor. 
Your goal is to help the user achieve their desired career role.

You have access to the user's latest parsed resume data:
---
Candidate Summary: ${resumeAnalysis.candidateSummary}
ATS Score: ${resumeAnalysis.atsScore}/100
Technical Skills: ${resumeAnalysis.technicalSkills?.join(", ") || "None"}
Soft Skills: ${resumeAnalysis.softSkills?.join(", ") || "None"}
Missing Skills / Growth Areas: ${resumeAnalysis.missingSkills?.join(", ") || "None"}
Strengths: ${resumeAnalysis.strengths?.join(", ") || "None"}
Weaknesses: ${resumeAnalysis.weaknesses?.join(", ") || "None"}
AI Recommended Roles: ${resumeAnalysis.careerRoles?.join(", ") || "None"}
---

INSTRUCTIONS:
1. When the user states a role they want to pursue, immediately compare their current resume profile to that role.
2. Acknowledge the skills they ALREADY have that are relevant to this role.
3. Clearly state the skills they are MISSING to achieve this role.
4. Provide a structured, step-by-step roadmap including: 
   - Technologies/Concepts to learn
   - Projects they should build
   - Certifications (if valuable)
   - Interview prep topics
5. If the user asks follow-up questions, use the conversation history to answer them in context.
6. Format your output nicely using Markdown (bullet points, bold text). Keep responses engaging but professional.
7. NEVER ask the user to upload their resume, you already have their data above.`;

  // Format history for Groq
  // History should be an array of { role: 'user' | 'assistant', content: string }
  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userQuery }
  ];

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: GROQ_MODEL,
      temperature: 0.7,
      max_tokens: 2048,
    });

    return chatCompletion.choices[0]?.message?.content || "I couldn't generate a response.";
  } catch (error) {
    console.error("Groq API Error:", error);
    throw new Error("Failed to generate response from Groq.");
  }
};

module.exports = {
  generateRoadmapResponse,
};
