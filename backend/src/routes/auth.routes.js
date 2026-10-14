const express = require('express');
const { register, login } = require('../controllers/auth/auth.controller');
const { validateRegister, validateCredentials } = require('../validations/auth.validation');
const authMiddleware = require('../middlewares/auth.middleware');
const User = require('../models/User');

const router = express.Router();

router.post('/register', validateRegister, register);
router.post('/login', validateCredentials, login);
router.get('/profile', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(401).json({ success: false, error: 'Account no longer exists.' });

    res.status(200).json({
      success: true,
      user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
