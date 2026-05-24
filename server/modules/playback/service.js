const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, STREAM_TOKEN_TTL_SECONDS } = require('../../config');
const { songFilePath } = require('../songs/service');

const CONTENT_TYPES = {
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
};

function mimeForFile(filename) {
  return CONTENT_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}

// ── Stream tokens ──────────────────────────────────────────────────────────────

function issueStreamToken(songId, userId) {
  return jwt.sign(
    { songId: String(songId), userId: String(userId), purpose: 'stream' },
    JWT_SECRET,
    { expiresIn: STREAM_TOKEN_TTL_SECONDS }
  );
}

function verifyStreamToken(token, songId) {
  const payload = jwt.verify(token, JWT_SECRET);
  if (payload.purpose !== 'stream') throw new Error('invalid purpose');
  if (String(payload.songId) !== String(songId)) throw new Error('song mismatch');
  return payload;
}

// ── Lossless range streaming ──────────────────────────────────────────────────

function streamLossless(res, filePath, rangeHeader) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const mime = mimeForFile(filePath);

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store');

  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1;

    if (isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
      return res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
    }

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Content-Length': end - start + 1,
      'Content-Type': mime,
    });

    const stream = fs.createReadStream(filePath, { start, end });
    stream.on('error', () => res.end());
    stream.pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': mime });
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => res.end());
    stream.pipe(res);
  }
}

// ── Opus transcoded streaming (piped through ffmpeg, no temp files) ────────────

const OPUS_PRESETS = {
  opus128: '128k',
  opus64:  '64k',
};

function streamOpus(res, filePath, quality) {
  const bitrate = OPUS_PRESETS[quality] || '128k';

  res.setHeader('Content-Type', 'audio/ogg');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.writeHead(200);

  const ff = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-i', filePath,
    '-c:a', 'libopus',
    '-b:a', bitrate,
    '-vbr', 'on',
    '-application', 'audio',
    '-frame_duration', '20',
    '-f', 'ogg',
    'pipe:1',
  ]);

  ff.stdout.pipe(res);

  ff.stderr.on('data', (d) => console.error('ffmpeg stderr:', d.toString()));

  const cleanup = () => {
    if (!ff.killed) ff.kill('SIGKILL');
  };
  res.on('close', cleanup);
  res.on('error', cleanup);
  ff.on('error', (err) => {
    console.error('ffmpeg spawn error:', err);
    if (!res.headersSent) res.status(500).end();
    else res.end();
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

function resolveFilePath(song) {
  return songFilePath(song.audioFile);
}

module.exports = { issueStreamToken, verifyStreamToken, streamLossless, streamOpus, resolveFilePath };
