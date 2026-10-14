function validateCredentials(req, res, next) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
  }
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ success: false, error: 'Password must contain at least 8 characters and at most 72 UTF-8 bytes.' });
  }
  req.body.email = email.trim().toLowerCase();
  next();
}
function validateRegister(req, res, next) {
  if (typeof req.body?.name !== 'string' || !req.body.name.trim() || req.body.name.length > 100) {
    return res.status(400).json({ success: false, error: 'Name must contain 1 to 100 characters.' });
  }
  req.body.name = req.body.name.trim();
  validateCredentials(req, res, next);
}
module.exports = { validateRegister, validateCredentials };
