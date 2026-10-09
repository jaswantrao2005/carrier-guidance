const TARGET_RATE = 16000;
export const MAX_SPEECH_SECONDS = 120;

/** Average input samples into mono16kPCM. WAV fields match the server's bounded contract. */
export function encodeSpeechWav(chunks: Float32Array[], sourceRate: number): Blob {
  if (!Number.isFinite(sourceRate) || sourceRate < TARGET_RATE) throw new Error('This microphone sample rate is unsupported.');
  const count = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  if (!count || count > sourceRate * MAX_SPEECH_SECONDS + 2048) throw new Error('Keep spoken answers under two minutes.');
  const samples = new Float32Array(count); let position = 0;
  for (const chunk of chunks) { samples.set(chunk, position); position += chunk.length; }
  const outputCount = Math.min(TARGET_RATE * MAX_SPEECH_SECONDS, Math.floor(count * TARGET_RATE / sourceRate));
  const buffer = new ArrayBuffer(44 + outputCount * 2); const view = new DataView(buffer);
  const write = (offset: number, value: string) => { for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index)); };
  write(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_RATE, true); view.setUint32(28, TARGET_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, outputCount * 2, true);
  const ratio = sourceRate / TARGET_RATE;
  for (let index = 0; index < outputCount; index++) {
    const first = Math.floor(index * ratio); const last = Math.max(first + 1, Math.min(count, Math.floor((index + 1) * ratio)));
    let value = 0; for (let sample = first; sample < last; sample++) value += samples[sample];
    value = Math.max(-1, Math.min(1, value / (last - first)));
    view.setInt16(44 + index * 2, value < 0 ? value * 32768 : value * 32767, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
