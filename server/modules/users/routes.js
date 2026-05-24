const router = require('express').Router();
const { auth } = require('../auth/middleware');
const User = require('../../models/User');

router.post('/listening-time', auth, async (req, res) => {
  try {
    const { timeInSeconds } = req.body;
    if (typeof timeInSeconds !== 'number' || timeInSeconds < 0 || timeInSeconds > 86400) {
      return res.status(400).json({ message: 'Invalid time value.' });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { listeningTime: timeInSeconds } },
      { new: true, select: 'listeningTime' }
    );
    res.json({ listeningTime: user.listeningTime });
  } catch {
    res.status(500).json({ message: 'Error updating listening time.' });
  }
});

router.get('/listening-time', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('listeningTime');
    res.json({ listeningTime: user?.listeningTime || 0 });
  } catch {
    res.status(500).json({ message: 'Error fetching listening time.' });
  }
});

module.exports = router;
