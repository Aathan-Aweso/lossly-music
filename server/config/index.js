require('dotenv').config();
const path = require('path');

module.exports = {
  PORT: Number(process.env.PORT) || 5001,
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',

  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/lossly-music',

  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production',
  JWT_SESSION_TTL: '7d',
  STREAM_TOKEN_TTL_SECONDS: 7200,

  SESSION_SECRET: process.env.SESSION_SECRET || 'change-me-in-production',

  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',

  UPLOAD_DIR: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads'),
  SONGS_DIR_NAME: 'songs',
  COVERS_DIR_NAME: 'covers',

  MAX_FILE_SIZE: Number(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024,

  ALLOWED_AUDIO_MIME: ['audio/flac', 'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/x-flac'],

  PLAY_COUNT_THRESHOLD_SECONDS: 30,

  ROOM_STALE_MEMBER_MS: 30000,
  ROOM_TTL_MS: 30 * 60 * 1000,
  ROOM_PING_INTERVAL_MS: 10000,
};
