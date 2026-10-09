const { createHash } = require('node:crypto');
const { fail } = require('../../validations/interview.validation');

const MODEL = 'gemini-3.8-flash-lite-tts';
const VOICE = 'Kore';
const KINDS = new Set(['greeting', 'question', 'warm_up_ready', 'warm_up_nervous']);
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 6 * 1024 * 1024;
const CACHE_TTL = 5 * 60 * 1000;
const READY_TEXT = "I'm glad you're ready. Take your time, and we'll work through this together. Let's begin.";
const NERVOUS_TEXT = "It's okay to feel nervous. This is a practice conversation, and you can take your time or skip a question. We'll go one step at a time. Let's begin.";

function plain(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function greetingText(name, role) {
  const firstName = plain(name, 80).split(/\s+/)[0].slice(0, 40);
  return `Hi${firstName ? ', ' + firstName : ''}. I'm Alex, your AI practice interviewer. It's nice to meet you. We'll practice for your ${plain(role, 120) || 'upcoming'} interview together, one question at a time. Before we begin, how are you feeling today?`;
}
function validateSession(session, seq, kind, now) {
  if (session.status !== 'active' || session.readyToComplete || new Date(session.deadlineAt).getTime() <= now) fail('This session is no longer accepting spoken questions.', 409);
  if (session.currentSeq !== seq) fail('Question changed. Reload the saved session before playing speech.', 409);
  if (kind !== 'question' && seq !== 0) fail('The welcome conversation is only available before the first answer.', 409);
}
function wavMetadata(wav) {
  if (!Buffer.isBuffer(wav) || wav.length < 44 || wav.length > MAX_AUDIO_BYTES || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') fail('Gemini returned unsupported speech audio.', 502);
  let format, dataBytes = 0;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const tag = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    if (offset + 8 + size > wav.length) fail('Gemini returned incomplete speech audio.', 502);
    if (tag === 'fmt ' && size >= 16) format = { encoding: wav.readUInt16LE(offset + 8), channels: wav.readUInt16LE(offset + 10), sampleRate: wav.readUInt32LE(offset + 12), byteRate: wav.readUInt32LE(offset + 16), bits: wav.readUInt16LE(offset + 22) };
    if (tag === 'data') dataBytes += size;
    offset += 8 + size + size % 2;
  }
  if (!format || format.encoding !== 1 || format.channels !== 1 || format.sampleRate !== 24000 || format.bits !== 16 || format.byteRate !== 48000 || !dataBytes || dataBytes / format.byteRate > 60) fail('Gemini returned unsupported speech audio.', 502);
  return { ...format, dataBytes, durationSeconds: dataBytes / format.byteRate };
}
async function synthesizeSpeech(text, { fetcher = global.fetch, apiKey = process.env.GEMINI_API_KEY?.trim(), timeoutMs = 20000 } = {}) {
  if (!apiKey) fail('Gemini speech is not configured. You can continue with browser voice.', 503);
  const controller = new AbortController();
  let timeout;
  const operation = (async () => {
    const response = await fetcher('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, signal: controller.signal,
      body: JSON.stringify({ model: MODEL, input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: 'Warm, calm, natural female practice interviewer. Read the supplied words clearly at a relaxed conversational pace.' }] }] }],
        response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice: VOICE }] } }),
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      if (response.status === 429) fail('Gemini speech usage limit reached. You can continue with browser voice.', 503);
      if ([401, 403, 404].includes(response.status)) fail('Gemini speech is unavailable. Check the configured key and speech model.', 503);
      fail('Gemini speech generation failed. You can continue with browser voice.', 502);
    }
    if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
      controller.abort();
      await response.body?.cancel().catch(() => {});
      fail('Gemini speech response is too large.', 502);
    }
    const reader = response.body?.getReader();
    if (!reader) fail('Gemini returned an empty speech response.', 502);
    const chunks = []; let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) { await reader.cancel(); fail('Gemini speech response is too large.', 502); }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    let payload;
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('Gemini returned an invalid speech response.', 502); }
    const audio = payload.steps?.flatMap(step => Array.isArray(step.content) ? step.content : []).filter(item => item.type === 'audio').at(-1);
    if (audio?.mime_type !== 'audio/wav' || typeof audio.data !== 'string' || audio.data.length > Math.ceil(MAX_AUDIO_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(audio.data)) fail('Gemini returned unsupported speech audio.', 502);
    const wav = Buffer.from(audio.data, 'base64');
    wavMetadata(wav);
    return wav;
  })();
  try {
    return await Promise.race([operation, new Promise((_, reject) => {
      timeout = setTimeout(() => { controller.abort(); reject(Object.assign(new Error('Gemini speech timed out. You can continue with browser voice.'), { statusCode: 504 })); }, timeoutMs);
    })]);
  } catch (error) {
    if (error.statusCode) throw error;
    fail('Gemini speech is unavailable. You can continue with browser voice.', 502);
  } finally { clearTimeout(timeout); }
}

function createSessionSpeechService({ loadSession = (id, user) => require('./session.service').owned(id, user), loadUser = id => require('../../models/User').findById(id).select('name').lean(), synthesize = synthesizeSpeech, now = Date.now } = {}) {
  const cache = new Map(), pending = new Map(), rates = new Map();
  let cachedBytes = 0;
  function trimCache() {
    for (const [key, entry] of cache) if (entry.expiresAt <= now()) { cachedBytes -= entry.wav.length; cache.delete(key); }
    while (cache.size > 32 || cachedBytes > 16 * 1024 * 1024) { const key = cache.keys().next().value; cachedBytes -= cache.get(key).wav.length; cache.delete(key); }
    for (const [key, rate] of rates) if (rate.expiresAt <= now()) rates.delete(key);
  }
  async function prepare(id, user, body) {
    if (!Number.isInteger(body?.seq) || body.seq < 0 || !KINDS.has(body.kind)) fail('Choose a valid speech kind and question sequence.');
    const { seq, kind } = body;
    const session = await loadSession(id, user);
    validateSession(session, seq, kind, now());
    let text;
    if (kind === 'greeting') text = greetingText((await loadUser(user))?.name, session.setup.role);
    else if (kind === 'warm_up_ready') text = READY_TEXT;
    else if (kind === 'warm_up_nervous') text = NERVOUS_TEXT;
    else {
      if (typeof session.currentQuestion?.question !== 'string' || !session.currentQuestion.question.trim()) fail('Your next question is still being prepared.', 409);
      text = [session.currentQuestion.acknowledgement, session.currentQuestion.question].filter(value => typeof value === 'string' && value.trim()).join(' ');
    }
    if (text.length > 1600) fail('This question is too long for spoken playback. You can read it instead.', 413);
    return { id, user, seq, kind, text, voice: VOICE };
  }
  async function audio(prepared) {
    trimCache();
    const { id, user, seq, kind, text } = prepared;
    const key = createHash('sha256').update(JSON.stringify([String(user), String(id), seq, kind, MODEL, VOICE, text])).digest('hex');
    let wav = cache.get(key)?.wav;
    if (!wav) {
      let task = pending.get(key);
      if (!task) {
        if (pending.size >= 4) fail('Speech generation is busy. Please try again shortly.', 503);
        const rateKey = String(user);
        const rate = rates.get(rateKey) || { count: 0, expiresAt: now() + 60000 };
        if (rate.count >= 12) fail('Too many speech requests. Please wait a minute before trying again.', 429);
        rate.count++; rates.set(rateKey, rate);
        if (rates.size > 512) rates.delete(rates.keys().next().value);
        task = Promise.resolve().then(() => synthesize(text)).then(result => {
          wavMetadata(result);
          cache.set(key, { wav: result, expiresAt: now() + CACHE_TTL }); cachedBytes += result.length; trimCache();
          return result;
        }).finally(() => pending.delete(key));
        pending.set(key, task);
      }
      wav = await task;
    }
    // A response from a slow provider must not revive a discarded or advanced turn.
    validateSession(await loadSession(id, user), seq, kind, now());
    return wav;
  }
  return { prepare, audio };
}
module.exports = { ...createSessionSpeechService(), createSessionSpeechService, synthesizeSpeech, wavMetadata, greetingText, READY_TEXT, NERVOUS_TEXT, MODEL, VOICE };
