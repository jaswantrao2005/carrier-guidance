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
    throw new Error("No Groq API keys configured in .env");
  }

  let attempts = 0;
  const maxAttempts = keys.length;

  while (attempts < maxAttempts) {
    const activeKey = keys[currentKeyIndex];
    const groq = new Groq({ apiKey: activeKey });

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
          `[GROQ POOL] Key (${activeKey.substring(0, 10)}...) rate-limited. Rotating to next key...`
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
