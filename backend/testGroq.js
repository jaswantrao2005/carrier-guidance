require('dotenv').config();
const Groq = require("groq-sdk");

const testGroq = async () => {
  try {
    console.log("Testing Groq...");
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: "user", content: "hello" }],
      model: "llama3-8b-8192",
    });
    console.log("Success:", chatCompletion.choices[0]?.message?.content);
  } catch (error) {
    console.error("Groq Error:", error);
  }
};

testGroq();
