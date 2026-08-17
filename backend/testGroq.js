require('dotenv').config();
const Groq = require("groq-sdk");

const testGroq = async () => {
  try {
    console.log("Testing Groq...");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: 'Return JSON: {"hello": "world"}' }],
      model: "qwen/qwen3.6-27b",
      reasoning_format: "hidden"
    });
    console.log("Success:", chatCompletion.choices[0]?.message?.content);
  } catch (error) {
    console.error("Groq Error:", error);
  }
};

testGroq();
