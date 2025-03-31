const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// Update listening time
router.post('/listening-time', auth, async (req, res) => {
  try {
    const { timeInSeconds } = req.body;
    
    if (typeof timeInSeconds !== 'number' || timeInSeconds < 0) {
      return res.status(400).json({ message: 'Invalid time value' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.listeningTime += timeInSeconds;
    await user.save();

    res.json({
      listeningTime: user.listeningTime,
      formattedTime: formatListeningTime(user.listeningTime)
    });
  } catch (error) {
    console.error('Error updating listening time:', error);
    res.status(500).json({ message: 'Error updating listening time' });
  }
});

// Get listening time
router.get('/listening-time', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      listeningTime: user.listeningTime,
      formattedTime: formatListeningTime(user.listeningTime)
    });
  } catch (error) {
    console.error('Error getting listening time:', error);
    res.status(500).json({ message: 'Error getting listening time' });
  }
});

// Helper function to format listening time
function formatListeningTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

module.exports = router; 