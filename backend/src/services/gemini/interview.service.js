const Groq = require("groq-sdk");

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const GROQ_MODEL = "llama-3.3-70b-versatile";

function parseJSONResponse(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/```json|```/g, "").trim();
  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
  } catch (error) {
    console.warn("Unable to parse JSON from Groq response:", error.message);
  }
  return null;
}

/**
 * Dynamically generates the next question for the user's mock interview using Groq.
 */
async function generateNextQuestion(role, history = [], resumeContext = null) {
  try {
    if (!groq) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    const questionCount = history.length;
    
    // Prompt structure determining the current phase of the interview
    let phaseInstruction = "";
    if (questionCount === 0) {
      phaseInstruction = "Phase 1: Welcome the candidate, introduce yourself as the interviewer, and ask them to introduce themselves.";
    } else if (questionCount === 1) {
      phaseInstruction = "Phase 2: Ask about their career goals, background, or why they want to pursue this domain.";
    } else if (questionCount >= 2 && questionCount <= 3 && resumeContext) {
      phaseInstruction = `Phase 3: Ask a personalized question about their resume context (technologies used, projects listed, or past experience).
      Resume context: 
      Summary: ${resumeContext.candidateSummary || "N/A"}
      Skills: ${resumeContext.technicalSkills?.join(", ") || "N/A"}
      Recommended Roles: ${resumeContext.careerRoles?.join(", ") || "N/A"}`;
    } else if (questionCount >= 2 && questionCount <= 6) {
      phaseInstruction = "Phase 4: Ask a technical question relevant to the selected domain. Build up difficulty (Easy to Intermediate to Advanced). Add follow-ups if they mentioned something specific in their last answer.";
    } else if (questionCount >= 7 && questionCount <= 8) {
      phaseInstruction = "Phase 5: Ask a behavioral/scenario-based HR question (teamwork, conflict resolution, deadlines, or failures).";
    } else {
      phaseInstruction = "Phase 6: Ask a final concluding question (e.g. why we should hire you or inviting them to ask questions).";
    }

    const systemPrompt = `You are a professional, senior tech interviewer at an elite company.
Your goal is to conduct a realistic mock interview for the role of: "${role}".`;

    const prompt = `
Follow this phase instruction for the next question:
${phaseInstruction}

Conversation History so far:
${history.map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer || "[No Answer]"}`).join("\n\n")}

INSTRUCTIONS:
- Generate ONE clear, concise question at a time.
- Be conversational, realistic, and direct.
- React to the candidate's last answer. If they gave a weak or vague answer, challenge them or ask for clarification.
- Return ONLY a valid JSON object with no markdown syntax wrappers, matching this format:
{
  "question": "The question string",
  "category": "Introduction | Background | Resume | Technical | Behavioral | Closing",
  "difficulty": "Easy | Intermediate | Advanced"
}
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      model: GROQ_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const responseText = chatCompletion.choices[0]?.message?.content;
    const parsed = parseJSONResponse(responseText) || {
      question: "Could you tell me a bit more about your background?",
      category: "Background",
      difficulty: "Intermediate"
    };

    return parsed;
  } catch (error) {
    console.error("generateNextQuestion Error:", error);
    throw new Error("Failed to generate next interview question");
  }
}

/**
 * Evaluates the completed interview conversation history and creates a detailed performance report using Groq.
 */
async function generateEvaluationReport(role, history) {
  try {
    if (!groq) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    const systemPrompt = "You are an expert technical interviewer and career coach.";

    const prompt = `
Evaluate the completed mock interview for the role of: "${role}".

Interview Transcript:
${history.map((h, i) => `Q: ${h.question}\nA: ${h.answer || "[No Answer]"}`).join("\n\n")}

Conduct a thorough analysis of the transcript.
Evaluate communication clarity, technical depth, problem-solving skills, and role readiness. Do not claim to evaluate emotional or psychological states.

Return a valid JSON object with the following keys and data types only:
{
  "transcript": [
    {
      "question": "string",
      "answer": "string",
      "category": "string",
      "difficulty": "string",
      "evaluation": {
        "good": "What the candidate answered well (1-2 sentences)",
        "bad": "What was missing or incorrect (1-2 sentences)",
        "improved": "Coaching on how to structure a better answer (2-3 sentences)"
      }
    }
  ],
  "overallScore": 0, // integer from 0 to 100
  "categoryScores": {
    "communication": 0, // integer 0-100
    "technicalKnowledge": 0, // integer 0-100
    "problemSolving": 0, // integer 0-100
    "confidence": 0, // integer 0-100
    "resumeKnowledge": 0, // integer 0-100
    "behavioral": 0, // integer 0-100
    "roleReadiness": 0 // integer 0-100
  },
  "strongAreas": ["string"],
  "weakAreas": ["string"],
  "techGaps": ["string"],
  "communicationFeedback": "Detailed qualitative feedback on candidate's communication skills, repetition, structural clarity, and voice style (3-4 sentences)",
  "roadmap": {
    "conceptsToRevise": ["string"],
    "practiceTopics": ["string"],
    "suggestedNextSteps": ["string"]
  }
}
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      model: GROQ_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const responseText = chatCompletion.choices[0]?.message?.content;
    const parsed = parseJSONResponse(responseText);

    if (!parsed) {
      throw new Error("Failed to parse Groq evaluation payload");
    }

    return parsed;
  } catch (error) {
    console.error("generateEvaluationReport Error:", error);
    throw new Error("Failed to generate interview performance report");
  }
}

module.exports = {
  generateNextQuestion,
  generateEvaluationReport,
};
