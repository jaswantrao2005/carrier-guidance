const { generateRoadmapResponse } = require("../../services/groq/chatbot.service");

const getRoadmap = async (req, res, next) => {
  try {
    const { query, history, resumeContext } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Query is required.",
      });
    }

    if (!resumeContext) {
      return res.status(400).json({
        success: false,
        message: "Resume context is required to generate a personalized roadmap.",
      });
    }

    const responseText = await generateRoadmapResponse(history || [], query, resumeContext);

    res.status(200).json({
      success: true,
      response: responseText,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRoadmap,
};
