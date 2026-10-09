const Usage = require('../models/Usage');
async function consumeQuota(user, category, limit) {
  const date = new Date().toISOString().slice(0, 10);
  const id = `${user}:${category}:${date}`;
  try {
    await Usage.findOneAndUpdate({ _id: id, count: { $lt: limit } }, {
      $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
    }, { upsert: true, returnDocument: 'after' });
  } catch (error) {
    if (error.code !== 11000) throw error;
    // A concurrent first request can insert the counter between query and upsert.
    const retried = await Usage.updateOne({ _id: id, count: { $lt: limit } }, { $inc: { count: 1 } });
    if (retried.modifiedCount) return;
    throw Object.assign(new Error(`Daily ${category} limit reached. Please try again tomorrow.`), { statusCode: 429 });
  }
}
const quota = (category, limit) => (req, res, next) => consumeQuota(req.user.id, category, limit).then(() => next(), next);
module.exports = { consumeQuota, quota };
