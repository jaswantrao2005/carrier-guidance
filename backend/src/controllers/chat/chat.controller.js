const { generateRoadmapResponse } = require("../../services/groq/chatbot.service");

const getRoadmap = async (req, res, next) => {
  try {
    const { query, history, resumeContext } = req.body;

    if (typeof query !== 'string' || !query.trim() || query.length > 4000) {
      return res.status(400).json({
        success: false,
        message: "Query is required.",
      });
    }

    if (!resumeContext || typeof resumeContext !== 'object' || Array.isArray(resumeContext)) {
      return res.status(400).json({
        success: false,
        message: "Resume context is required to generate a personalized roadmap.",
      });
    }

    if (history !== undefined && (!Array.isArray(history) || history.length > 30 || history.some(message =>
      !message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || message.content.length > 8000))) {
      return res.status(400).json({ success: false, error: 'Invalid chat history. Only user and assistant messages are allowed.' });
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
