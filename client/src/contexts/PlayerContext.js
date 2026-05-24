import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import config from '../config';

const PlayerContext = createContext(null);

// ── Constants ──────────────────────────────────────────────────────────────────

const QUALITY_KEY = 'lossly_quality';
const ROOM_CLIENT_KEY = 'lossly_room_client_id';
const ROOM_SYNC_THROTTLE_MS = 200;
const PLAY_COUNT_THRESHOLD_SECONDS = 30;

// ── Helpers ────────────────────────────────────────────────────────────────────

function getClientId() {
  try {
    const cached = localStorage.getItem(ROOM_CLIENT_KEY);
    if (cached) return cached;
    const id = `c_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    localStorage.setItem(ROOM_CLIENT_KEY, id);
    return id;
  } catch {
    return `c_${Date.now().toString(36)}`;
  }
}

function getSavedQuality() {
  try { return localStorage.getItem(QUALITY_KEY) || 'lossless'; } catch { return 'lossless'; }
}

function saveQuality(q) {
  try { localStorage.setItem(QUALITY_KEY, q); } catch {}
}

function normalizeRoomId(v = '') {
  return String(v).trim().toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 32);
}

function sanitizeSong(song) {
  if (!song?._id) return null;
  return {
    _id: song._id,
    title: song.title || 'Unknown',
    artist: song.artist || 'Unknown',
    coverArt: song.coverArt || 'default-cover.png',
    duration: Number(song.duration) || 0,
    format: song.format || '',
    hasDolbyAtmos: Boolean(song.hasDolbyAtmos),
  };
}

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within a PlayerProvider');
  return ctx;
};

// ── Stream token cache ────────────────────────────────────────────────────────
// Maps songId -> { token, expiresAt }

const tokenCache = new Map();

async function fetchStreamToken(songId) {
  const cached = tokenCache.get(songId);
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const authToken = localStorage.getItem('token');
  if (!authToken) throw new Error('Not authenticated');

  const { data } = await axios.get(`${config.API_URL}/api/playback/${songId}/token`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  tokenCache.set(songId, {
    token: data.token,
    expiresAt: Date.now() + data.expiresIn * 1000,
  });
  return data.token;
}

function buildStreamUrl(songId, quality, token) {
  return `${config.API_URL}/api/playback/${songId}/stream?t=${encodeURIComponent(token)}&q=${quality}`;
}

// ── Provider ───────────────────────────────────────────────────────────────────

export const PlayerProvider = ({ children }) => {
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [queue, setQueue] = useState([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('none');
  const [isLoading, setIsLoading] = useState(false);
  const [listeningTime, setListeningTime] = useState(0);
  const [quality, setQualityState] = useState(getSavedQuality);

  // Room state
  const [roomId, setRoomId] = useState('');
  const [roomMemberCount, setRoomMemberCount] = useState(0);
  const [roomSyncStatus, setRoomSyncStatus] = useState('idle');

  const audioRef = useRef(null);
  const isChangingSong = useRef(false);
  const pendingSeekRef = useRef(null);

  const currentSongRef = useRef(null);
  const isPlayingRef = useRef(false);
  const queueRef = useRef([]);

  // Room WS refs
  const wsRef = useRef(null);
  const roomIdRef = useRef('');
  const clientIdRef = useRef(getClientId());
  const suppressBroadcastRef = useRef(false);
  const lastSyncAtRef = useRef(0);
  const playedCountedRef = useRef(false);
  const playTimeRef = useRef(0);
  const lastPlayTickRef = useRef(null);

  // Keep refs in sync with state for use in callbacks
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  // ── Quality ──────────────────────────────────────────────────────────────────

  const setQuality = useCallback((q) => {
    saveQuality(q);
    setQualityState(q);
    // Reload current song with new quality
    const song = currentSongRef.current;
    if (song && audioRef.current) {
      const wasPlaying = !audioRef.current.paused;
      const time = audioRef.current.currentTime;
      pendingSeekRef.current = time;
      loadSongIntoAudio(song, q).then(() => {
        if (wasPlaying) audioRef.current?.play().catch(() => {});
      });
    }
  }, []);

  // ── Audio loading ────────────────────────────────────────────────────────────

  async function loadSongIntoAudio(song, q) {
    if (!audioRef.current || !song) return;
    setIsLoading(true);
    isChangingSong.current = true;
    playedCountedRef.current = false;
    playTimeRef.current = 0;

    try {
      const token = await fetchStreamToken(song._id);
      audioRef.current.src = buildStreamUrl(song._id, q || quality, token);
      audioRef.current.load();
    } catch (err) {
      console.error('Failed to get stream token:', err);
      setIsLoading(false);
      setIsPlaying(false);
      isChangingSong.current = false;
    }
  }

  useEffect(() => {
    if (currentSong) loadSongIntoAudio(currentSong, quality);
  }, [currentSong]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Volume ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ── Play/pause ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!audioRef.current || isLoading || isChangingSong.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(err => {
        if (err.name !== 'AbortError') { console.error(err); setIsPlaying(false); }
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, isLoading]);

  // ── Play count tracking ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!isPlaying || !currentSong) {
      lastPlayTickRef.current = null;
      return;
    }
    const tick = setInterval(() => {
      if (!isPlayingRef.current) return;
      const now = Date.now();
      if (lastPlayTickRef.current) {
        playTimeRef.current += (now - lastPlayTickRef.current) / 1000;
      }
      lastPlayTickRef.current = now;

      // Update listening time on server every 10s
      if (playTimeRef.current > 0 && Math.floor(playTimeRef.current) % 10 === 0) {
        const authToken = localStorage.getItem('token');
        if (authToken) {
          axios.post(`${config.API_URL}/api/users/listening-time`,
            { timeInSeconds: 10 },
            { headers: { Authorization: `Bearer ${authToken}` } }
          ).catch(() => {});
        }
      }

      if (!playedCountedRef.current && playTimeRef.current >= PLAY_COUNT_THRESHOLD_SECONDS) {
        playedCountedRef.current = true;
        const authToken = localStorage.getItem('token');
        const songId = currentSongRef.current?._id;
        if (authToken && songId) {
          axios.post(`${config.API_URL}/api/songs/${songId}/played`,
            {},
            { headers: { Authorization: `Bearer ${authToken}` } }
          ).catch(() => {});
        }
      }
    }, 1000);

    lastPlayTickRef.current = Date.now();
    return () => clearInterval(tick);
  }, [isPlaying, currentSong]);

  // ── Fetch initial listening time ─────────────────────────────────────────────

  useEffect(() => {
    const authToken = localStorage.getItem('token');
    if (!authToken) return;
    axios.get(`${config.API_URL}/api/users/listening-time`, {
      headers: { Authorization: `Bearer ${authToken}` },
    }).then(r => setListeningTime(r.data.listeningTime)).catch(() => {});
  }, []);

  // ── Audio element events ──────────────────────────────────────────────────────

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const d = audioRef.current.duration || 0;
    const t = audioRef.current.currentTime;
    setCurrentTime(t);
    setProgress(d > 0 ? (t / d) * 100 : 0);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
      applyPendingSeek();
    }
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    isChangingSong.current = false;
    applyPendingSeek();
    if (isPlayingRef.current) {
      audioRef.current?.play().catch(err => {
        if (err.name !== 'AbortError') { console.error(err); setIsPlaying(false); }
      });
    }
  };

  const handleEnded = () => {
    if (repeat === 'one') {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      wsSend({ type: 'sync', playback: buildSnapshot() });
      return;
    }
    if (repeat === 'all' || queueRef.current.length > 0) {
      advanceQueue(1);
      return;
    }
    setIsPlaying(false);
    setCurrentSong(null);
  };

  const handleAudioError = (e) => {
    console.error('Audio error:', audioRef.current?.error);
    setIsLoading(false);
    setIsPlaying(false);
    isChangingSong.current = false;
  };

  function applyPendingSeek() {
    if (pendingSeekRef.current !== null && audioRef.current) {
      try {
        audioRef.current.currentTime = Math.max(0, pendingSeekRef.current);
        pendingSeekRef.current = null;
      } catch {
        // will retry
      }
    }
  }

  // ── Queue navigation ──────────────────────────────────────────────────────────

  function getNextIndex(q, song, shuf) {
    if (!q.length || !song) return -1;
    const cur = q.findIndex(s => s._id === song._id);
    if (shuf) {
      if (q.length === 1) return 0;
      let next;
      do { next = Math.floor(Math.random() * q.length); } while (next === cur);
      return next;
    }
    return (cur + 1) % q.length;
  }

  function getPrevIndex(q, song, shuf) {
    if (!q.length || !song) return -1;
    const cur = q.findIndex(s => s._id === song._id);
    if (shuf) {
      if (q.length === 1) return 0;
      let prev;
      do { prev = Math.floor(Math.random() * q.length); } while (prev === cur);
      return prev;
    }
    return (cur - 1 + q.length) % q.length;
  }

  function advanceQueue(direction) {
    const q = queueRef.current;
    const song = currentSongRef.current;
    const idx = direction > 0 ? getNextIndex(q, song, shuffle) : getPrevIndex(q, song, shuffle);
    if (idx !== -1) {
      setCurrentSong(q[idx]);
      setTimeout(() => setIsPlaying(true), 50);
      setTimeout(() => wsSend({ type: 'sync', playback: buildSnapshot() }), 150);
    } else {
      setIsPlaying(false);
      setCurrentSong(null);
    }
  }

  const playNext = useCallback(() => advanceQueue(1), [shuffle, repeat]);
  const playPrevious = useCallback(() => advanceQueue(-1), [shuffle]);

  // ── Playback controls ─────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    setIsPlaying(p => !p);
    setTimeout(() => wsSend({ type: 'sync', playback: buildSnapshot() }), 50);
  }, []);

  const seekTo = useCallback((time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
    const d = audioRef.current.duration || 0;
    setProgress(d > 0 ? (time / d) * 100 : 0);
    setTimeout(() => wsSend({ type: 'sync', playback: buildSnapshot() }), 50);
  }, []);

  const toggleShuffle = useCallback(() => setShuffle(s => !s), []);
  const toggleRepeat = useCallback(() => setRepeat(r => r === 'none' ? 'one' : r === 'one' ? 'all' : 'none'), []);

  // ── Queue management ──────────────────────────────────────────────────────────

  const playSong = useCallback((song) => {
    if (!song) return;
    const q = queueRef.current;
    if (q.some(s => s._id === song._id)) {
      setCurrentSong(song);
      setIsPlaying(true);
      setTimeout(() => wsSend({ type: 'sync', playback: buildSnapshot() }), 150);
      return;
    }
    const cur = currentSongRef.current;
    if (q.length === 0) {
      setQueue([song]);
      setCurrentSong(song);
    } else {
      const curIdx = q.findIndex(s => s._id === cur?._id);
      const newQ = [...q];
      newQ.splice(curIdx === -1 ? newQ.length : curIdx + 1, 0, song);
      setQueue(newQ);
      setCurrentSong(song);
    }
    setIsPlaying(true);
    setTimeout(() => wsSend({ type: 'sync', playback: buildSnapshot() }), 150);
  }, []);

  const playQueue = useCallback((songs, startIndex = 0) => {
    if (!Array.isArray(songs) || !songs.length) return;
    setQueue(songs);
    setCurrentSong(songs[startIndex]);
    setIsPlaying(true);
    setTimeout(() => wsSend({ type: 'sync', playback: buildSnapshot() }), 150);
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentSong(null);
    setIsPlaying(false);
  }, []);

  const addToQueue = useCallback((song) => setQueue(q => [...q, song]), []);
  const removeFromQueue = useCallback((idx) => setQueue(q => q.filter((_, i) => i !== idx)), []);

  // ── Room WebSocket ────────────────────────────────────────────────────────────

  function buildSnapshot() {
    return {
      currentSong: sanitizeSong(currentSongRef.current),
      queue: queueRef.current.map(sanitizeSong).filter(Boolean),
      isPlaying: isPlayingRef.current,
      position: audioRef.current?.currentTime ?? 0,
    };
  }

  function wsSend(msg) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (msg.type === 'sync') {
      const now = Date.now();
      if (now - lastSyncAtRef.current < ROOM_SYNC_THROTTLE_MS) return;
      lastSyncAtRef.current = now;
    }
    ws.send(JSON.stringify(msg));
  }

  function applyRoomState(playback) {
    if (!playback) return;
    suppressBroadcastRef.current = true;

    setQueue(Array.isArray(playback.queue) ? playback.queue : []);
    setCurrentSong(playback.currentSong || null);
    setIsPlaying(Boolean(playback.isPlaying));
    pendingSeekRef.current = Math.max(0, playback.position || 0);

    // If same song already loaded, just seek directly
    if (
      audioRef.current &&
      playback.currentSong?._id === currentSongRef.current?._id &&
      Number.isFinite(audioRef.current.duration)
    ) {
      audioRef.current.currentTime = Math.max(0, playback.position || 0);
      pendingSeekRef.current = null;
    }

    setTimeout(() => { suppressBroadcastRef.current = false; }, 60);
  }

  const joinRoom = useCallback(async (rawId) => {
    const id = normalizeRoomId(rawId);
    if (!id) throw new Error('Invalid room id');

    closeWs();

    const wsUrl = `${config.WS_URL}/ws/rooms?roomId=${id}&clientId=${clientIdRef.current}&username=Listener`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Room connection timed out'));
      }, 8000);

      ws.onopen = () => {
        clearTimeout(timeout);
        setRoomId(id);
        roomIdRef.current = id;
        setRoomSyncStatus('synced');
        resolve();
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            return;
          }
          if (msg.type === 'state' && msg.room) {
            const room = msg.room;
            setRoomMemberCount(room.memberCount || 0);
            setRoomSyncStatus('synced');
            if (!suppressBroadcastRef.current) {
              applyRoomState(room.playback);
            }
          }
        } catch {}
      };

      ws.onerror = () => setRoomSyncStatus('degraded');
      ws.onclose = () => {
        if (roomIdRef.current === id) {
          setRoomSyncStatus('degraded');
        }
      };
    });
  }, []);

  const leaveRoom = useCallback(async () => {
    closeWs();
    setRoomId('');
    roomIdRef.current = '';
    setRoomMemberCount(0);
    setRoomSyncStatus('idle');
  }, []);

  function closeWs() {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }

  useEffect(() => () => closeWs(), []);

  // ── Context value ─────────────────────────────────────────────────────────────

  const value = {
    currentSong, isPlaying, setIsPlaying, togglePlay,
    volume, setVolume,
    progress, setProgress, seekTo,
    playNext, playPrevious,
    shuffle, toggleShuffle,
    repeat, toggleRepeat,
    queue, playSong, playQueue, clearQueue, addToQueue, removeFromQueue,
    audioRef,
    duration, currentTime, isLoading,
    listeningTime,
    quality, setQuality,
    // Room
    roomId, roomMemberCount, roomSyncStatus,
    joinRoom, leaveRoom,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onEnded={handleEnded}
        onError={handleAudioError}
        crossOrigin="anonymous"
      />
    </PlayerContext.Provider>
  );
};

export default PlayerContext;
