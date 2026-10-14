module.exports = (req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (process.env.NODE_ENV !== 'test') console.info(JSON.stringify({
      event: 'http_request', method: req.method, path: req.path,
      status: res.statusCode, durationMs: Date.now() - started,
    }));
  });
  next();
};
