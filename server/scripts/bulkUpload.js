const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Song = require('../models/Song');
const User = require('../models/User');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Function to get audio file duration (in seconds)
async function getAudioDuration(filePath) {
  // This is a placeholder - you might want to use a proper audio duration library
  // For now, we'll return a default value
  return 180; // 3 minutes default
}

// Function to get audio file bitrate
async function getAudioBitrate(filePath) {
  // This is a placeholder - you might want to use a proper audio analysis library
  // For now, we'll return a default value
  return 1411; // CD quality default
}

// Function to get audio file format
function getAudioFormat(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.flac':
      return 'FLAC';
    case '.wav':
      return 'WAV';
    case '.mp3':
      return 'MP3';
    default:
      return 'UNKNOWN';
  }
}

// Function to extract metadata from filename
function extractMetadata(filename) {
  // Remove file extension
  const nameWithoutExt = path.parse(filename).name;
  
  // Try to parse common filename patterns
  // Example: "Artist - Title" or "Artist - Album - Title"
  const parts = nameWithoutExt.split(' - ');
  
  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      title: parts[parts.length - 1].trim(),
      album: parts.length > 2 ? parts[1].trim() : 'Unknown Album'
    };
  }
  
  // If no pattern matches, use filename as title
  return {
    artist: 'Unknown Artist',
    title: nameWithoutExt,
    album: 'Unknown Album'
  };
}

async function bulkUpload(songsDir) {
  try {
    // Get or create a default user for the uploads
    let defaultUser = await User.findOne({ username: 'admin' });
    if (!defaultUser) {
      defaultUser = await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123' // You should change this in production
      });
    }

    // Read all files from the songs directory
    const files = fs.readdirSync(songsDir);
    
    // Filter for audio files
    const audioFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.mp3', '.wav', '.flac'].includes(ext);
    });

    console.log(`Found ${audioFiles.length} audio files`);

    // Get all songs from database
    const dbSongs = await Song.find({});
    const dbSongFiles = new Set(dbSongs.map(song => song.audioFile));

    // Remove songs from database that don't have corresponding files
    const filesToRemove = [...dbSongFiles].filter(file => !audioFiles.includes(file));
    if (filesToRemove.length > 0) {
      console.log(`Removing ${filesToRemove.length} songs that no longer have files`);
      await Song.deleteMany({ audioFile: { $in: filesToRemove } });
      console.log('Removed songs from database');
    }

    // Process each audio file
    for (const file of audioFiles) {
      const filePath = path.join(songsDir, file);
      const metadata = extractMetadata(file);
      
      // Check if song already exists
      const existingSong = await Song.findOne({ 
        title: metadata.title,
        artist: metadata.artist,
        audioFile: file
      });

      if (existingSong) {
        console.log(`Song already exists: ${metadata.title} - ${metadata.artist}`);
        continue;
      }

      // Get audio file details
      const duration = await getAudioDuration(filePath);
      const bitrate = await getAudioBitrate(filePath);
      const format = getAudioFormat(filePath);

      // Create new song document
      const song = new Song({
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        duration,
        audioFile: file,
        bitrate,
        format,
        addedBy: defaultUser._id,
        genre: 'Unknown Genre', // You can modify this based on your needs
        releaseDate: new Date() // You can modify this based on your needs
      });

      await song.save();
      console.log(`Uploaded: ${metadata.title} - ${metadata.artist}`);
    }

    console.log('Bulk upload completed!');
    process.exit(0);
  } catch (error) {
    console.error('Error during bulk upload:', error);
    process.exit(1);
  }
}

// Get songs directory from command line argument or use default
const songsDir = process.argv[2] || path.join(__dirname, '../../uploads/songs');
bulkUpload(songsDir); 