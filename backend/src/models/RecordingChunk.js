const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  segmentId: { type: String, required: true },
  seq: { type: Number, required: true },
  filename: { type: String, required: true },
  mimeType: { type: String, required: true },
  bytes: { type: Number, required: true },
  digest: { type: String, required: true },
}, { timestamps: true });
schema.index({ sessionId: 1, segmentId: 1, seq: 1 }, { unique: true });
module.exports = mongoose.model('RecordingChunk', schema);
