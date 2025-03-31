const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Playlist = require('../models/Playlist');
const Song = require('../models/Song');

// Create a new playlist
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const playlist = new Playlist({
      name,
      description,
      isPublic,
      owner: req.user._id
    });

    await playlist.save();
    res.status(201).json(playlist);
  } catch (error) {
    res.status(500).json({ message: 'Error creating playlist' });
  }
});

// Get user's playlists
router.get('/my-playlists', auth, async (req, res) => {
  try {
    const playlists = await Playlist.find({ owner: req.user._id })
      .populate('songs.song')
      .sort({ updatedAt: -1 });
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching playlists' });
  }
});

// Get public playlists
router.get('/public', async (req, res) => {
  try {
    const playlists = await Playlist.find({ isPublic: true })
      .populate('owner', 'username')
      .populate('songs.song')
      .sort({ updatedAt: -1 });
    res.json(playlists);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching playlists' });
  }
});

// Get playlist by ID
router.get('/:id', async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate('owner', 'username')
      .populate('songs.song');
    
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    if (!playlist.isPublic && playlist.owner.toString() !== req.user?._id?.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(playlist);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching playlist' });
  }
});

// Add song to playlist
router.post('/:id/songs', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    if (playlist.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { songId } = req.body;
    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({ message: 'Song not found' });
    }

    playlist.songs.push({ song: songId });
    await playlist.save();

    res.json(playlist);
  } catch (error) {
    res.status(500).json({ message: 'Error adding song to playlist' });
  }
});

// Remove song from playlist
router.delete('/:id/songs/:songId', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    if (playlist.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    playlist.songs = playlist.songs.filter(
      song => song.song.toString() !== req.params.songId
    );

    await playlist.save();
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ message: 'Error removing song from playlist' });
  }
});

// Update playlist
router.put('/:id', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    if (playlist.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { name, description, isPublic } = req.body;
    playlist.name = name || playlist.name;
    playlist.description = description || playlist.description;
    playlist.isPublic = isPublic !== undefined ? isPublic : playlist.isPublic;

    await playlist.save();
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ message: 'Error updating playlist' });
  }
});

// Delete playlist
router.delete('/:id', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    if (playlist.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await playlist.remove();
    res.json({ message: 'Playlist deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting playlist' });
  }
});

module.exports = router; 