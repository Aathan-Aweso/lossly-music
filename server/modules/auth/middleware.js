const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const { JWT_SECRET } = require('../../config');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error('no token');
    const { userId } = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(userId).select('-password');
    if (!user) throw new Error('user not found');
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Authentication required.' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const { userId } = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(userId).select('-password');
      if (user) req.user = user;
    }
  } catch {
    // fine — guest access
  }
  next();
};

module.exports = { auth, optionalAuth };
