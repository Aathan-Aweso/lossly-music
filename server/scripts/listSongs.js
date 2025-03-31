const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Song = require('../models/Song');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Get all songs
    const songs = await Song.find();
    
    console.log('\nSongs in database:');
    songs.forEach(song => {
      console.log(`\nID: ${song._id}`);
      console.log(`Title: ${song.title}`);
      console.log(`Artist: ${song.artist}`);
      console.log(`Audio File: ${song.audioFile}`);
      console.log(`Format: ${song.format}`);
    });
    
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }); 