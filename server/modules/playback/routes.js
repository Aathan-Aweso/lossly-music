const router = require('express').Router();
const fs = require('fs');
const Song = require('../../models/Song');
const { auth } = require('../auth/middleware');
const {
  issueStreamToken,
  verifyStreamToken,
  streamLossless,
  streamOpus,
  resolveFilePath,
} = require('./service');
const { STREAM_TOKEN_TTL_SECONDS } = require('../../config');

// Issue a short-lived stream token.  Requires auth.
router.get('/:id/token', auth, async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ message: 'Song not found.' });
    const token = issueStreamToken(song._id, req.user._id);
    res.json({ token, expiresIn: STREAM_TOKEN_TTL_SECONDS });
  } catch {
    res.status(500).json({ message: 'Error issuing stream token.' });
  }
});

// Stream endpoint — verified by short-lived token (?t=TOKEN) not by session.
// Supports: ?q=lossless (default) | opus128 | opus64
router.get('/:id/stream', async (req, res) => {
  try {
    const token = req.query.t;
    if (!token) return res.status(401).json({ message: 'Stream token required.' });

    let payload;
    try {
      payload = verifyStreamToken(token, req.params.id);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired stream token.' });
    }

    const song = await Song.findById(req.params.id);
    if (!song) return res.status(404).json({ message: 'Song not found.' });

    const filePath = resolveFilePath(song);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Audio file not found.' });

    const quality = req.query.q || 'lossless';

    if (quality === 'lossless') {
      streamLossless(res, filePath, req.headers.range);
    } else if (quality === 'opus128' || quality === 'opus64') {
      // Transcoded tiers don't support range; pipe full stream
      streamOpus(res, filePath, quality);
    } else {
      streamLossless(res, filePath, req.headers.range);
    }
  } catch (err) {
    console.error('stream error', err);
    if (!res.headersSent) res.status(500).json({ message: 'Stream error.' });
    else res.end();
  }
});

module.exports = router;
