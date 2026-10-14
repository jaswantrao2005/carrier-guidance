const Groq = require("groq-sdk");

// Get all Groq keys from environment (comma-separated or single key)
function getGroqKeys() {
  const rawKeys = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || "";
  return rawKeys
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}
let currentKeyIndex = 0;

/**
 * Executes a Groq API request with automatic key rotation on 429/quota limits.
 * @param {Function} apiCallfn - async function receiving (groqInstance, apiKey)
 */
async function callGroqWithRotation(apiCallFn) {
  const keys = getGroqKeys();

  if (keys.length === 0) {
    throw Object.assign(new Error("AI service is not configured. Ask the operator to configure GROQ_API_KEY."), { statusCode: 503 });
  }

  let attempts = 0;
  const maxAttempts = Math.min(keys.length, 2);

  while (attempts < maxAttempts) {
    currentKeyIndex %= keys.length;
    const activeKey = keys[currentKeyIndex];
    const groq = new Groq({ apiKey: activeKey, timeout: 45000, maxRetries: 0 });

    try {
      return await apiCallFn(groq, activeKey);
    } catch (error) {
      const isRateLimit =
        error?.status === 429 ||
        error?.code === "rate_limit_exceeded" ||
        error?.message?.toLowerCase().includes("rate limit") ||
        error?.message?.toLowerCase().includes("tokens");

      if (isRateLimit && keys.length > 1) {
        console.warn(
          '[GROQ POOL] Rate limit reached; trying the next configured credential.'
        );
        currentKeyIndex = (currentKeyIndex + 1) % keys.length;
        attempts++;
      } else {
        throw error;
      }
    }
  }

  throw new Error("All configured Groq API keys have exceeded their rate limits.");
}

module.exports = {
  callGroqWithRotation,
  getGroqKeys,
};
