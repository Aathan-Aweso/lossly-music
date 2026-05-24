const router = require('express').Router();
const { auth } = require('../auth/middleware');
const Playlist = require('../../models/Playlist');
const Song = require('../../models/Song');

router.post('/', auth, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required.' });
    const playlist = await Playlist.create({ name, description, isPublic, owner: req.user._id });
    res.status(201).json(playlist);
  } catch {
    res.status(500).json({ message: 'Error creating playlist.' });
  }
});

router.get('/my-playlists', auth, async (req, res) => {
  try {
    const playlists = await Playlist.find({ owner: req.user._id })
      .populate('songs.song')
      .sort({ updatedAt: -1 });
    res.json(playlists);
  } catch {
    res.status(500).json({ message: 'Error fetching playlists.' });
  }
});

router.get('/public', async (req, res) => {
  try {
    const playlists = await Playlist.find({ isPublic: true })
      .populate('owner', 'username')
      .populate('songs.song')
      .sort({ updatedAt: -1 });
    res.json(playlists);
  } catch {
    res.status(500).json({ message: 'Error fetching playlists.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate('owner', 'username')
      .populate('songs.song');
    if (!playlist) return res.status(404).json({ message: 'Playlist not found.' });
    if (!playlist.isPublic && String(playlist.owner._id) !== String(req.user?._id)) {
      return res.status(403).json({ message: 'Not authorized.' });
    }
    res.json(playlist);
  } catch {
    res.status(500).json({ message: 'Error fetching playlist.' });
  }
});

router.post('/:id/songs', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found.' });
    if (String(playlist.owner) !== String(req.user._id)) return res.status(403).json({ message: 'Not authorized.' });

    const song = await Song.findById(req.body.songId);
    if (!song) return res.status(404).json({ message: 'Song not found.' });

    playlist.songs.push({ song: song._id });
    await playlist.save();
    res.json(playlist);
  } catch {
    res.status(500).json({ message: 'Error adding song.' });
  }
});

router.delete('/:id/songs/:songId', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found.' });
    if (String(playlist.owner) !== String(req.user._id)) return res.status(403).json({ message: 'Not authorized.' });
    playlist.songs = playlist.songs.filter(s => String(s.song) !== req.params.songId);
    await playlist.save();
    res.json(playlist);
  } catch {
    res.status(500).json({ message: 'Error removing song.' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found.' });
    if (String(playlist.owner) !== String(req.user._id)) return res.status(403).json({ message: 'Not authorized.' });
    const { name, description, isPublic } = req.body;
    if (name !== undefined) playlist.name = name;
    if (description !== undefined) playlist.description = description;
    if (isPublic !== undefined) playlist.isPublic = isPublic;
    await playlist.save();
    res.json(playlist);
  } catch {
    res.status(500).json({ message: 'Error updating playlist.' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found.' });
    if (String(playlist.owner) !== String(req.user._id)) return res.status(403).json({ message: 'Not authorized.' });
    await Playlist.deleteOne({ _id: playlist._id });
    res.json({ message: 'Playlist deleted.' });
  } catch {
    res.status(500).json({ message: 'Error deleting playlist.' });
  }
});

module.exports = router;
