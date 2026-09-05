const { callGroqWithRotation } = require("../groq/groqPool");
const {
  DEFAULT_PRESET,
  getPreset,
  buildTopicPlan,
  decideNextMove,
  applyMove,
  extractMentions,
} = require("../interview/conversation");



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
    console.warn("Unable to parse JSON from Groq response:", error.message);
  }
  return null;
}

/**
 * Dynamically generates the next question for the user's mock interview using Groq.
 */
/**
 * Generates the next interview question.
 *
 * This used to be a fixed 7-phase script driven purely by `history.length`
 * ("question 3 -> ask about their resume"), which produced a questionnaire
 * rather than an interview: it never dug into an answer, and every question was
 * a fresh topic sourced from the CV.
 *
 * Now the conversation engine (services/interview/conversation.js) decides
 * whether to open a new topic or probe the answer just given, and this function
 * only turns that decision into a natural-sounding question.
 *
 * Returns { question, category, difficulty, topicPlan, done, ... } -- the caller
 * must pass `topicPlan` back on the next call so the interview keeps its state.
 */
async function generateNextQuestion(
  role,
  interviewType = 'Overall Interview',
  history = [],
  resumeContext = null,
  jobDescriptionText = '',
  companyResearch = null,
  experienceLevel = 'fresher',
  totalExperienceYears = 0,
  employmentHistory = [],
  options = {}
) {
  const {
    durationPreset = DEFAULT_PRESET,
    topicPlan: incomingPlan = null,
  } = options;

  const preset = getPreset(durationPreset);
  const maxQuestions = options.maxQuestions || preset.maxQuestions;

  // Build the plan on the first call; thereafter the caller round-trips it.
  const plan = incomingPlan && incomingPlan.length
    ? incomingPlan
    : buildTopicPlan(interviewType, durationPreset, resumeContext);

  const move = decideNextMove(plan, history, maxQuestions);

  if (move.action === 'finish') {
    return { done: true, reason: move.reason, topicPlan: plan };
  }

  const isCoding = interviewType === 'Coding / Programming Interview';
  const isGroupOrPanel = interviewType === 'Group Interview' || interviewType === 'Panel Interview';
  const lastTurn = history[history.length - 1];
  const mentions = extractMentions(history);

  const systemPrompt = buildSystemPrompt({ role, interviewType, isCoding, isGroupOrPanel });
  const userPrompt = buildQuestionPrompt({
    move, plan, history, lastTurn, mentions, role, interviewType,
    resumeContext, jobDescriptionText, companyResearch,
    experienceLevel, totalExperienceYears, employmentHistory, isCoding,
  });

  try {
    const chatCompletion = await callGroqWithRotation(async (groqInstance) =>
      groqInstance.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: GROQ_MODEL,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      })
    );

    const parsed = parseJSONResponse(chatCompletion.choices[0]?.message?.content) || {};
    const question = String(parsed.question || '').trim() || fallbackQuestion(move);

    return {
      question,
      category: parsed.category || categoryFor(move),
      difficulty: parsed.difficulty || 'Intermediate',
      isFollowUp: move.action === 'follow_up',
      topicId: move.topic.id,
      topicIndex: move.topicIndex,
      totalTopics: plan.length,
      topicPlan: applyMove(plan, move),
      done: false,
    };
  } catch (error) {
    console.error('generateNextQuestion Error:', error);
    throw new Error('Failed to generate next interview question');
  }
}

function categoryFor(move) {
  if (move.action === 'follow_up') return 'FollowUp';
  const map = {
    intro: 'Introduction', closing: 'Closing', project_depth: 'Resume',
    experience: 'Background', behavioural: 'Behavioral', conflict: 'Behavioral',
    failure: 'Behavioral', ownership: 'Behavioral', problem_1: 'Coding',
    problem_2: 'Coding', complexity: 'Coding', edge_cases: 'Coding',
  };
  return map[move.topic.id] || 'Technical';
}

function fallbackQuestion(move) {
  if (move.action === 'follow_up') {
    return move.probe === 'vague_we'
      ? 'You described that as a team effort — what was your own part in it specifically?'
      : 'How did that turn out in the end?';
  }
  if (move.topic.id === 'intro') return 'To start — tell me a little about yourself and your background.';
  if (move.topic.id === 'closing') return 'That covers what I wanted to ask. Is there anything you would like to ask me?';
  return 'Could you tell me more about your experience in this area?';
}

function buildSystemPrompt({ role, interviewType, isCoding, isGroupOrPanel }) {
  if (isCoding) {
    return `You are a senior engineer running a coding interview for a "${role}" role.
You ask concrete DSA and practical coding problems and probe the candidate's reasoning.
You speak like a real interviewer in a live call: brief, direct, human. Never narrate
what you are doing. Never use headings, bullet points, or markdown -- your words are
read aloud to the candidate.`;
  }

  return `You are an experienced interviewer conducting a "${interviewType}" for a "${role}" role.

You sound like a real person in a live conversation, not a form being read out:
- Brief. One question at a time. Usually one or two sentences.
- You LISTEN. You react to what the candidate actually just said.
- No headings, bullets, or markdown -- your words are spoken aloud.
- Never explain your process ("Now I'll ask about..."). Just ask.
${isGroupOrPanel ? '- Prefix each question with the speaking interviewer, e.g. "[Technical Interviewer]: ".' : ''}

You are practising WITH this person, not judging them. If they are struggling, move on
kindly rather than pressing.`;
}

function buildQuestionPrompt(ctx) {
  const {
    move, plan, history, lastTurn, mentions, role, interviewType,
    resumeContext, jobDescriptionText, companyResearch,
    experienceLevel, totalExperienceYears, employmentHistory, isCoding,
  } = ctx;

  const parts = [];

  // 1. THE LAST ANSWER FIRST. The old prompt buried "react to the last answer"
  // as one line among stronger instructions, so the script always won and the
  // interview marched on regardless of what the candidate said.
  if (lastTurn) {
    parts.push(`The candidate has just answered your previous question.

YOUR PREVIOUS QUESTION:
${lastTurn.question}

THEIR ANSWER (this is the most important input -- read it closely):
"""
${String(lastTurn.answer || '[no answer given]').slice(0, 2000)}
"""`);
  }

  // 2. What to do next -- decided in code, not left to the model's judgement.
  if (move.action === 'follow_up') {
    const PROBES = {
      // Probe intent is fixed per case; only the wording varies. This follows the
      // OPM structured-interview rule that probes may be tailored to the answer
      // but 'the general meaning of the probes should not change' -- which is what
      // keeps a conversational interview comparable between candidates.
      vague_we:
        'They described this as a team effort ("we", "our team"). Ask what THEY ' +
        'personally did. Quote or paraphrase their own words so it clearly responds ' +
        'to them. Intent: "What was your specific role in that?"',
      no_outcome:
        'They described what they did but not how it turned out. Ask about the result ' +
        'or impact of the specific thing they described. Intent: "What was the outcome?"',
      unclear:
        'Their answer stayed general — no concrete example, number, or specific. Ask ' +
        'for one, about the thing they just mentioned. ' +
        'Intent: "Can you give me an example that illustrates that?"',
    };
    const probeGuidance = PROBES[move.probe] || PROBES.unclear;

    parts.push(`YOUR TASK: ask ONE follow-up question about the answer above.
${probeGuidance}

FOLLOW-UP RULES (these keep the interview fair and comparable between candidates):
- Only ask them to expand on something they ALREADY said.
- Do NOT introduce new facts, new scenarios, or a new topic.
- Do NOT hint at the answer you are hoping for -- that makes the interview
  easier for some candidates than others and invalidates the result.
- Keep it short and conversational, as if you were genuinely curious.`);
  } else {
    const topic = move.topic;
    parts.push(`YOUR TASK: move on to a NEW topic and ask ONE opening question about it.

TOPIC: ${topic.id}
WHAT YOU WANT TO LEARN: ${topic.goal}`);

    if (lastTurn) {
      parts.push(`Begin with a brief, natural transition acknowledging their last answer
before you change subject (e.g. "That's helpful, thank you. I'd like to switch to
something different..."). Keep it to a few words -- do not summarise what they said.`);
    }

    if (topic.seed && topic.seed.project) {
      parts.push(`Use this from their CV to choose WHICH thing to ask about -- it is a
starting point, not the content of the question. Ask about the work itself, do not
read their CV back to them:
  Project: ${topic.seed.project}
  Skills: ${(topic.seed.skills || []).join(', ')}`);
    }

    if (topic.id === 'closing') {
      parts.push(`This is the final question. Invite any questions they have for you, and
close the interview warmly.`);
    }
  }

  // 3. Callbacks -- what makes it feel like one conversation with someone who
  // was actually listening, rather than a series of unrelated questions.
  if (mentions.length && move.action !== 'follow_up') {
    parts.push(`THINGS THEY MENTIONED EARLIER (you may naturally refer back to one of
these if it fits, e.g. "earlier you mentioned X..."; do not force it):
${mentions.map((m) => `- ${m}`).join('\n')}`);
  }

  // 4. Don't repeat yourself.
  if (history.length) {
    parts.push(`ALREADY ASKED -- do not ask anything materially similar:
${history.map((h, i) => `${i + 1}. ${h.question}`).join('\n')}`);
  }

  // 5. Background context, deliberately last and framed as background.
  const bg = [];
  if (experienceLevel === 'experienced' && totalExperienceYears) {
    bg.push(`Experience: ${totalExperienceYears} years${
      employmentHistory && employmentHistory.length
        ? ` (${employmentHistory.map((e) => `${e.position} at ${e.companyName}`).join('; ')})`
        : ''
    }`);
  } else {
    bg.push('Experience: entry level / fresher — pitch questions accordingly');
  }
  if (resumeContext && resumeContext.technicalSkills && resumeContext.technicalSkills.length) {
    bg.push(`Their skills: ${resumeContext.technicalSkills.slice(0, 10).join(', ')}`);
  }
  if (jobDescriptionText) {
    bg.push(`Target job description (for relevance only):\n${String(jobDescriptionText).slice(0, 800)}`);
  }
  if (companyResearch && companyResearch.keyProducts) {
    bg.push(`Company products: ${(companyResearch.keyProducts || []).join(', ')}`);
  }
  if (bg.length) parts.push(`BACKGROUND (context only — do not quiz them on this):\n${bg.join('\n')}`);

  parts.push(`Return ONLY a JSON object:
{
  "question": "${isCoding ? 'the question or full coding problem statement' : 'the question, as you would say it out loud'}",
  "category": "Introduction | Background | Resume | Technical | Coding | Behavioral | JobDescription | CompanySpecific | FollowUp | Closing",
  "difficulty": "Easy | Intermediate | Advanced"
}`);

  return parts.join('\n\n');
}

/**
 * Evaluates the completed interview conversation history and creates a detailed performance report using Groq.
 */
async function generateEvaluationReport(role, interviewType = 'Overall Interview', history, jobDescriptionText = '', companyResearch = null, experienceLevel = 'fresher', totalExperienceYears = 0, employmentHistory = [], codingData = null) {
  try {
    

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

    const chatCompletion = await callGroqWithRotation(async (groqInstance) => {
      return await groqInstance.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      model: GROQ_MODEL,
      temperature: 0, // scoring must be reproducible; 0.7 made the same interview score differently on re-run
      response_format: { type: "json_object" }
      });
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
