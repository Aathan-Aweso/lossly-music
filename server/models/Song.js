const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  artist: {
    type: String,
    required: true,
    trim: true
  },
  album: {
    type: String,
    trim: true
  },
  duration: {
    type: Number,
    required: true
  },
  audioFile: {
    type: String,
    required: true
  },
  coverArt: {
    type: String,
    default: 'default-cover.png'
  },
  genre: {
    type: String,
    trim: true
  },
  releaseDate: {
    type: Date
  },
  bitrate: {
    type: Number,
    required: true,
    default: 1411 // CD quality (kbps)
  },
  format: {
    type: String,
    required: true,
    default: 'FLAC'
  },
  hasDolbyAtmos: {
    type: Boolean,
    default: false
  },
  playCount: {
    type: Number,
    default: 0
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for search functionality
songSchema.index({ title: 'text', artist: 'text', album: 'text', genre: 'text' });

module.exports = mongoose.model('Song', songSchema); 