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
async function generateNextQuestion(role, interviewType = 'Overall Interview', history = [], resumeContext = null, jobDescriptionText = '', companyResearch = null, experienceLevel = 'fresher', totalExperienceYears = 0, employmentHistory = []) {
  try {
    if (!groq) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    const questionCount = history.length;
    
    // Core prompt strategy based on interview type
    let phaseInstruction = "";
    
    // Group and Panel Interviews simulate multiple interviewers
    const isGroupOrPanel = interviewType === 'Group Interview' || interviewType === 'Panel Interview';
    const speakerPrefix = isGroupOrPanel ? "Start your question with the name of the simulated interviewer, e.g. '[HR Interviewer]: ' or '[Technical Interviewer]: '." : "";

    if (interviewType === 'HR Interview') {
      phaseInstruction = `This is an HR Interview. Focus strictly on communication, personality, career goals, strengths/weaknesses, team fit, and motivation. Do NOT ask hard technical questions.`;
    } else if (interviewType === 'Technical Interview') {
      phaseInstruction = `This is a strict Technical Interview. Focus heavily on CS fundamentals, architecture, databases, frameworks, problem-solving, and role-specific technical deep-dives for a ${role}.`;
    } else if (interviewType === 'Managerial Interview') {
      phaseInstruction = `This is a Managerial Interview. Focus on leadership, conflict resolution, prioritization, handling deadlines, ownership, and strategic decision making.`;
    } else if (interviewType === 'Behavioral Interview') {
      phaseInstruction = `This is a Behavioral Interview. Ask STAR-method (Situation, Task, Action, Result) questions about past experiences, handling pressure, conflicts, and failures.`;
    } else if (interviewType === 'Case Interview') {
      phaseInstruction = `This is a Case Interview. Give the candidate a realistic business/technical scenario or problem to solve. Evaluate their problem decomposition and logical reasoning. Follow up on their previous answer to dig deeper into their case solution.`;
    } else if (interviewType === 'Coding / Programming Interview') {
      phaseInstruction = `This is a Coding/Programming Interview. Ask algorithm, data structure (DSA), or coding logic questions. If this is the first question, give them a problem to code. If they just submitted code, ask them to explain their space/time complexity or why they chose their approach.`;
    } else if (interviewType === 'Situational Interview') {
      phaseInstruction = `This is a Situational Interview. Give the candidate hypothetical workplace emergencies or difficult situations relevant to a ${role}. Ask them what they would do.`;
    } else if (interviewType === 'Final Interview') {
      phaseInstruction = `This is a Final Round Interview with a Senior Hiring Manager. Focus on long-term career alignment, company fit, overall suitability, and behavioral/leadership maturity.`;
    } else if (interviewType === 'Personal Interview (PI)') {
      phaseInstruction = `This is a Personal Interview (PI). Dynamically balance HR, background, and light technical questions. Make it feel like a 1-on-1 getting-to-know-you session.`;
    } else {
      // Overall Interview (Default fallback behavior simulating standard 10-question flow)
      if (questionCount === 0) {
        phaseInstruction = "Phase 1: Welcome the candidate, introduce yourself, and ask them to introduce themselves.";
      } else if (questionCount === 1) {
        if (experienceLevel === 'experienced') {
          phaseInstruction = `Phase 2: Ask about their ${totalExperienceYears} years of experience: \n${employmentHistory.map(e => `- ${e.position} at ${e.companyName}`).join('\n')}`;
        } else {
          phaseInstruction = "Phase 2: Ask about their education, foundational skills, or why they want to pursue this domain.";
        }
      } else if (questionCount >= 2 && questionCount <= 3 && resumeContext) {
        phaseInstruction = `Phase 3: Ask a personalized question about their resume context (technologies used, projects listed, or past experience).\nResume context: \nSummary: ${resumeContext.candidateSummary || "N/A"}\nSkills: ${resumeContext.technicalSkills?.join(", ") || "N/A"}\nEducation: ${resumeContext.education?.join(" | ") || "N/A"}\nProjects: ${resumeContext.projects?.join(" | ") || "N/A"}`;
      } else if (questionCount >= 4 && questionCount <= 5 && jobDescriptionText) {
        phaseInstruction = `Phase 4: Ask a question specifically tailored to the Job Description:\n${jobDescriptionText}`;
      } else if (questionCount >= 6 && questionCount <= 7) {
        phaseInstruction = `Phase 5: Ask a technical question relevant to the domain (${role}). Candidate is ${experienceLevel}. Build up difficulty.`;
      } else if (questionCount === 8 && companyResearch) {
        phaseInstruction = `Phase 6: Ask a company-specific question based on: ${companyResearch.keyProducts?.join(", ")}`;
      } else {
        phaseInstruction = `Phase 7: Ask a behavioral HR question and close the interview.`;
      }
    }

    if (isGroupOrPanel) {
      phaseInstruction += `\n${speakerPrefix}`;
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
  "category": "Introduction | Background | Resume | JobDescription | Technical | CompanySpecific | Behavioral | Closing",
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
async function generateEvaluationReport(role, interviewType = 'Overall Interview', history, jobDescriptionText = '', companyResearch = null, experienceLevel = 'fresher', totalExperienceYears = 0, employmentHistory = [], codingData = null) {
  try {
    if (!groq) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    const systemPrompt = "You are an expert technical interviewer and career coach.";

    let codingContext = "";
    if (interviewType === 'Coding / Programming Interview' && codingData && codingData.codingSubmissions) {
      codingContext = `\nCODING INTERVIEW CONTEXT:\nLanguage: ${codingData.language}\n`;
      codingContext += `Submissions:\n${codingData.codingSubmissions.map(s => `- Code: ${s.code}\n- Passed Sandbox Tests: ${s.passed}\n- Output: ${s.output}`).join('\n\n')}`;
      codingContext += `\nEnsure you evaluate their algorithmic approach, time/space complexity, and code quality in the final evaluation.`;
    }

    const prompt = `
Evaluate the completed mock interview for the role of: "${role}".
Interview Type: ${interviewType}
Candidate Experience Level: ${experienceLevel === 'fresher' ? 'Fresher (Entry-level)' : `Experienced (${totalExperienceYears} years total)`}

Interview Transcript:
${history.map((h, i) => `Q: ${h.question}\nA: ${h.answer || "[No Answer]"}`).join("\n\n")}
${codingContext}
${jobDescriptionText ? `Compare the candidate's responses against the target Job Description:\n${jobDescriptionText}\n` : ''}
${companyResearch ? `Evaluate if the candidate aligned well with the company's profile:\nProducts: ${companyResearch.keyProducts?.join(', ') || ''}\nStrategy: ${companyResearch.recentStrategy || ''}\n` : ''}

Conduct a thorough analysis of the transcript based on the specific Interview Type (${interviewType}).
For example, if this was an HR interview, heavily weight communication and personality over technical knowledge. If it was a Coding Interview, prioritize code logic and DSA.

CRITICAL EVALUATION GUIDELINES:
1. ACCENT & PRONUNCIATION TOLERANCE: The candidate's response may show phonetic transcription quirks characteristic of regional English accents (Indian English, British English, IELTS pronunciation patterns, etc.). Do NOT penalize the candidate's scores (especially Technical Knowledge and Problem Solving) for accents or dialect variations. Accent does NOT equal a lack of communication ability.
2. MULTILINGUAL RESPONSES: The candidate is permitted to respond in supported non-English languages. If you detect non-English text in the candidate's responses, translate it to English under the hood. Evaluate the QUALITY of their answer objectively. Do NOT give them a low score simply because they answered in another language. Reflect language fluency suggestions constructively under the "communicationFeedback" qualitative field.
3. EXHAUSTIVE EVALUATION REQUIRED: You MUST evaluate every single question from the provided Interview Transcript. Do NOT summarize or skip questions. The length of your output "transcript" array must EXACTLY match the number of questions in the transcript.

Return a valid JSON object with the following keys and data types only:
{
  "transcript": [ // MUST contain an entry for EVERY question in the transcript
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
  },
  "jobMatchScore": 0, // integer 0-100 matching Job Description (return 0 if no JD was provided)
  "jdMatchBreakdown": { // return empty arrays if no JD was provided
    "strongMatches": ["string"],
    "needsImprovement": ["string"],
    "notDemonstrated": ["string"]
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
