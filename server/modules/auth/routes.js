const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../../models/User');
const { auth } = require('./middleware');
const { JWT_SECRET, JWT_SESSION_TTL } = require('../../config');

function issueToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_SESSION_TTL });
}

function userPublic(u) {
  return { id: u._id, username: u.username, email: u.email };
}

router.post('/register',
  [
    body('username').trim().isLength({ min: 3 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { username, email, password } = req.body;
      const existing = await User.findOne({ $or: [{ email }, { username }] });
      if (existing) return res.status(400).json({ message: 'Username or email already in use.' });

      const user = await User.create({ username, email, password });
      res.status(201).json({ token: issueToken(user._id), user: userPublic(user) });
    } catch (err) {
      console.error('register error', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.post('/login',
  [body('email').isEmail(), body('password').exists()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user || !(await user.comparePassword(password))) {
        return res.status(400).json({ message: 'Invalid credentials.' });
      }
      res.json({ token: issueToken(user._id), user: userPublic(user) });
    } catch (err) {
      console.error('login error', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
