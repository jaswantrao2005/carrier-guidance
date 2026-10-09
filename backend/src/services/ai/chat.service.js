const { callGroqWithRotation } = require('../groq/groqPool');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

function selectedProvider() {
  const configured = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (configured && !['gemini', 'groq'].includes(configured)) {
    throw Object.assign(new Error('AI_PROVIDER must be gemini or groq.'), { statusCode: 503 });
  }
  return configured || (process.env.GEMINI_API_KEY ? 'gemini' : 'groq');
}

async function completeChat({ messages, temperature = 0.2, max_tokens = 8192, response_format }, fetcher = fetch) {
  if (selectedProvider() === 'groq') {
    return callGroqWithRotation(client => client.chat.completions.create({
      messages, temperature, max_tokens, response_format,
      model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
    }));
  }

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw Object.assign(new Error('Gemini is not configured. Set GEMINI_API_KEY in backend/.env.'), { statusCode: 503 });
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw Object.assign(new Error('Invalid GEMINI_MODEL setting.'), { statusCode: 503 });
  const systemText = messages.filter(message => message.role === 'system').map(message => message.content).join('\n\n');
  const contents = messages.filter(message => message.role !== 'system').map(message => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(message.content) }],
  }));
  const payload = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: max_tokens,
      ...(response_format?.type === 'json_object' ? { responseMimeType: 'application/json' } : {}),
    },
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
  };
  let response;
  try {
    response = await fetcher(`${GEMINI_URL}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw Object.assign(new Error('Gemini is unavailable or timed out. Please retry.'), { statusCode: 502 });
  }
  if (!response.ok) {
    const statusCode = [401, 403, 429].includes(response.status) ? 503 : 502;
    const message = response.status === 429 ? 'Gemini usage limit reached. Please retry later.'
      : [401, 403].includes(response.status) ? 'Gemini rejected the API key. Check backend configuration.'
        : response.status === 404 ? 'Gemini model is unavailable. Check GEMINI_MODEL.'
          : 'Gemini request failed. Please retry.';
    throw Object.assign(new Error(message), { statusCode });
  }
  let data;
  try { data = await response.json(); }
  catch { throw Object.assign(new Error('Gemini returned invalid JSON.'), { statusCode: 502 }); }
  const content = data.candidates?.[0]?.content?.parts?.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('') || '';
  if (!content) throw Object.assign(new Error('Gemini returned an empty response. Please retry.'), { statusCode: 502 });
  return { choices: [{ message: { content } }] };
}

module.exports = { completeChat, selectedProvider };
