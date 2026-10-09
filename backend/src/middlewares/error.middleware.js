const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = err.statusCode || err.status || 500;
  let message = err.message;
  if (err.code === 11000) { status = 409; message = 'This record already exists.'; }
  if (err.name === 'CastError' || err.name === 'ValidationError') { status = 400; message = 'Invalid request data.'; }
  if (err.code === 'LIMIT_FILE_SIZE') { status = 413; message = 'Uploaded file exceeds the size limit.'; }
  else if (err.name === 'MulterError') { status = 400; message = 'Invalid file upload.'; }
  if (!Number.isInteger(status) || status < 400 || status > 599) status = 500;
  if (status >= 500) console.error('Request failed', { method: req.method, path: req.path, status, message: err.message });
  res.status(status).json({ success: false, error: status === 500 ? 'An unexpected server error occurred. Please retry.' : message || 'Request failed.' });
};
module.exports = errorHandler;
