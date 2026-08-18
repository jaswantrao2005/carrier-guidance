const dotenv = require("dotenv");
dotenv.config();

const Groq = require("groq-sdk");
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

async function testGroqAnalysis() {
  console.log("---------------------------------------------------");
  console.log("🚀 Testing Groq Resume Analysis with openai/gpt-oss-120b...");
  console.log("---------------------------------------------------");

  if (!groq) {
    console.error("❌ GROQ_API_KEY is not set in .env!");
    return;
  }

  const sampleResume = `
    Jaswant Rao
    Full Stack Developer | Node.js, React, Express, MongoDB, Python
    Skills: JavaScript, TypeScript, React, Node.js, Python, PostgreSQL, MongoDB, Git.
    Soft Skills: Problem Solving, Team Leadership, Technical Writing.
  `;

  try {
    const prompt = `Analyze this resume and output valid JSON matching this schema:
{
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
}

Resume:
${sampleResume}`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are an expert AI Career Advisor. Output valid JSON only." },
        { role: "user", content: prompt }
      ],
      model: "openai/gpt-oss-120b",
      response_format: { type: "json_object" },
      temperature: 0.2
    });

    const output = completion.choices[0]?.message?.content;
    const parsed = JSON.parse(output);

    console.log("✅ SUCCESS! Analysis Output:");
    console.log("📊 ATS Score:", parsed.atsScore);
    console.log("📝 Summary:", parsed.candidateSummary);
    console.log("💻 Technical Skills:", parsed.technicalSkills);
    console.log("---------------------------------------------------");
  } catch (err) {
    console.error("❌ Error calling Groq:", err.message);
  }
}

testGroqAnalysis();

