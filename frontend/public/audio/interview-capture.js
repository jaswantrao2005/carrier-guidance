/* Local mono PCM capture. Audio is sent only when the candidate chooses Finish answer. */
class InterviewCapture extends AudioWorkletProcessor {
  constructor() {
    super(); this.pending = new Float32Array(2048); this.used = 0; this.total = 0; this.closed = false;
    this.port.onmessage = event => {
      if (event.data === 'flush') { this.flush(); this.closed = true; this.port.postMessage({ type: 'flushed' }); }
    };
  }
  flush() {
    if (!this.used) return;
    const samples = this.pending.slice(0, this.used); this.used = 0;
    this.port.postMessage({ type: 'samples', samples }, [samples.buffer]);
  }
  process(inputs) {
    if (this.closed) return false;
    const channels = inputs[0];
    if (!channels || !channels.length) return true;
    for (let frame = 0; frame < channels[0].length; frame++) {
      let value = 0; for (const channel of channels) value += channel[frame] || 0;
      this.pending[this.used++] = value / channels.length; this.total++;
      if (this.used === this.pending.length) this.flush();
      if (this.total >= sampleRate * 120) { this.flush(); this.closed = true; this.port.postMessage({ type: 'limit' }); return false; }
    }
    return true;
  }
}
registerProcessor('interview-capture', InterviewCapture);
