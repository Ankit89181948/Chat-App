// routes/authRoutes.js
const express = require('express');
const { signup, login } = require('../controllers/authController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);

// Example protected route
router.get('/protected', requireAuth, (req, res) => {
  res.json({ msg: 'This is a protected route', userId: req.userId });
});

module.exports = router;
