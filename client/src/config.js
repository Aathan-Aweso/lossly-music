const API_URL = process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:5001');

const WS_URL = process.env.REACT_APP_WS_URL ||
  (process.env.NODE_ENV === 'production'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`
    : 'ws://localhost:5001');

const config = {
  API_URL,
  WS_URL,
  MAX_FILE_SIZE: 100 * 1024 * 1024,
  SUPPORTED_AUDIO_FORMATS: ['mp3', 'flac', 'wav', 'm4a'],
  SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'webp'],
  DEFAULT_COVER_ART: '/default-cover.png',
};

export default config;
