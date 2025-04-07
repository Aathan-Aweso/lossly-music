export const config = {
  API_URL: process.env.NODE_ENV === 'production' 
    ? window.location.origin 
    : 'http://localhost:5002',
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  SUPPORTED_AUDIO_FORMATS: ['mp3', 'flac', 'wav', 'm4a'],
  SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'webp'],
  DEFAULT_COVER_ART: '/default-cover.png',
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  LISTENING_TIME_UPDATE_INTERVAL: 1000, // 1 second
  PLAYBACK_UPDATE_INTERVAL: 1000, // 1 second
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

export const { API_URL } = config; 