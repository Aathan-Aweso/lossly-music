const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const Song = require('../models/Song');
const mm = require('music-metadata');

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/songs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/flac', 'audio/wav', 'audio/mp3'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only FLAC, WAV, and MP3 files are allowed.'));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Upload a new song
router.post('/upload', auth, upload.single('audioFile'), async (req, res) => {
  try {
    const { title, artist, album, genre, releaseDate } = req.body;
    const audioFile = req.file.filename;
    const filePath = path.join(__dirname, '../../uploads/songs', audioFile);

    // Extract metadata from the audio file
    const fileStream = fs.createReadStream(filePath);
    const metadata = await mm.parseStream(fileStream);
    fileStream.destroy();

    // Extract cover art if available
    let coverArt = 'default-cover.png';
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const picture = metadata.common.picture[0];
      const coverArtFileName = `${Date.now()}-cover${path.extname(picture.format)}`;
      const coverArtPath = path.join(__dirname, '../../uploads/covers', coverArtFileName);

      // Ensure covers directory exists
      if (!fs.existsSync(path.join(__dirname, '../../uploads/covers'))) {
        fs.mkdirSync(path.join(__dirname, '../../uploads/covers'), { recursive: true });
      }

      // Save cover art
      fs.writeFileSync(coverArtPath, picture.data);
      coverArt = coverArtFileName;
    }

    // Check for Dolby Atmos support
    const hasDolbyAtmos = metadata.format.channels >= 6 &&
      (metadata.format.container === 'FLAC' || metadata.format.container === 'WAV');

    const song = new Song({
      title: title || metadata.common.title,
      artist: artist || metadata.common.artist,
      album: album || metadata.common.album,
      genre: genre || metadata.common.genre?.[0] || 'Unknown Genre',
      releaseDate: releaseDate || metadata.common.date,
      audioFile,
      coverArt,
      addedBy: req.user._id,
      duration: metadata.format.duration,
      bitrate: metadata.format.bitrate ? Math.round(metadata.format.bitrate / 1000) : 1411,
      format: path.extname(audioFile).toUpperCase().slice(1),
      hasDolbyAtmos
    });

    await song.save();
    res.status(201).json(song);
  } catch (error) {
    console.error('Error uploading song:', error);
    res.status(500).json({ message: 'Error uploading song' });
  }
});

// Get all songs
router.get('/', async (req, res) => {
  try {
    const songs = await Song.find().populate('addedBy', 'username');
    res.json(songs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching songs' });
  }
});

// Get song by ID
router.get('/:id', async (req, res) => {
  try {
    const song = await Song.findById(req.params.id).populate('addedBy', 'username');
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }
    res.json(song);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching song' });
  }
});

// Stream song
router.get('/:id/stream', async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      console.error('Song not found in database:', req.params.id);
      return res.status(404).json({ message: 'Song not found' });
    }

    const filePath = path.join(__dirname, '../../uploads/songs', song.audioFile);
    console.log('Attempting to stream file:', filePath);

    if (!fs.existsSync(filePath)) {
      console.error('File does not exist:', filePath);
      return res.status(404).json({ message: 'Audio file not found' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Set the correct content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'audio/mpeg';
    switch (ext) {
      case '.wav':
        contentType = 'audio/wav';
        break;
      case '.flac':
        contentType = 'audio/flac';
        break;
      case '.mp3':
        contentType = 'audio/mpeg';
        break;
      default:
        console.warn('Unknown file type:', ext);
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length');
    res.setHeader('Access-Control-Accept-Ranges', 'bytes');

    // Read the file into a buffer
    const fileBuffer = fs.readFileSync(filePath);

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType
      };

      res.writeHead(206, head);
      res.end(fileBuffer.slice(start, end + 1));
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType
      };
      res.writeHead(200, head);
      res.end(fileBuffer);
    }

    // Increment play count
    song.playCount += 1;
    await song.save();
  } catch (error) {
    console.error('Streaming error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      path: error.path
    });
    res.status(500).json({ message: 'Error streaming song' });
  }
});

// Delete song
router.delete('/:id', auth, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    // Check if user is the owner
    if (song.addedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete file from storage
    const filePath = path.join(__dirname, '../../uploads/songs', song.audioFile);
    fs.unlinkSync(filePath);

    await song.remove();
    res.json({ message: 'Song deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting song' });
  }
});

// Serve cover art
router.get('/cover/:filename', (req, res) => {
  try {
    const coverPath = path.join(__dirname, '../../uploads/covers', req.params.filename);
    if (fs.existsSync(coverPath)) {
      res.sendFile(coverPath);
    } else {
      res.sendFile(path.join(__dirname, '../../uploads/covers/default-cover.png'));
    }
  } catch (error) {
    console.error('Error serving cover art:', error);
    res.status(500).json({ message: 'Error serving cover art' });
  }
});

module.exports = router; 