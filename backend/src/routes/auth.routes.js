const express = require('express');
const { register, login } = require('../controllers/auth/auth.controller');
const { validateRegister } = require('../validations/auth.validation');
const authMiddleware = require('../middlewares/auth.middleware');
const User = require('../models/User');

const router = express.Router();

router.post('/register', validateRegister, register);
router.post('/login', login);
router.get('/profile', authMiddleware, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
