require('dotenv').config();
const Groq = require("groq-sdk");

const listModels = async () => {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const models = await groq.models.list();
    console.log("Available models:");
    models.data.forEach(m => console.log(m.id));
  } catch (error) {
    console.error("Error:", error.message);
  }
};

listModels();
