import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import axios from 'axios';

const PlayerContext = createContext(null);

const ROOM_POLL_INTERVAL_MS = 750;
const ROOM_DRIFT_THRESHOLD_SECONDS = 0.08;
const ROOM_SYNC_THROTTLE_MS = 150;

const getApiBaseUrl = () => process.env.REACT_APP_API_URL || 'http://localhost:5001';

const normalizeRoomId = (value = '') =>
  value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 32);

const createClientId = () => {
  try {
    const cached = localStorage.getItem('roomClientId');
    if (cached) return cached;
    const next = `c_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    localStorage.setItem('roomClientId', next);
    return next;
  } catch (error) {
    return `c_${Date.now().toString(36)}`;
  }
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

export const PlayerProvider = ({ children }) => {
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [progress, setProgress] = useState(0);
  const [queue, setQueue] = useState([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('none');
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [listeningTime, setListeningTime] = useState(0);

  const [roomId, setRoomId] = useState('');
  const [roomMembers, setRoomMembers] = useState([]);
  const [roomMemberCount, setRoomMemberCount] = useState(0);
  const [roomSyncStatus, setRoomSyncStatus] = useState('idle');

  const audioRef = useRef(null);
  const isChangingSong = useRef(false);
  const lastUpdateTime = useRef(Date.now());

  const roomClientIdRef = useRef(createClientId());
  const roomPollTimerRef = useRef(null);
  const roomVersionRef = useRef(0);
  const roomIdRef = useRef('');
  const currentSongRef = useRef(null);
  const suppressRoomBroadcastRef = useRef(false);
  const pendingSeekRef = useRef(null);
  const lastRoomSyncAtRef = useRef(0);

  const sanitizeSong = (song) => {
    if (!song || !song._id) return null;
    return {
      _id: song._id,
      title: song.title || 'Unknown title',
      artist: song.artist || 'Unknown artist',
      coverArt: song.coverArt || 'default-cover.png',
      duration: Number(song.duration) || 0,
      format: song.format || '',
      hasDolbyAtmos: Boolean(song.hasDolbyAtmos)
    };
  };

  const getRoomUsername = () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return 'Listener';
      return 'Listener';
    } catch (error) {
      return 'Listener';
    }
  };

  const getPlaybackPosition = () => {
    if (audioRef.current && Number.isFinite(audioRef.current.currentTime)) {
      return Math.max(0, audioRef.current.currentTime);
    }
    return Math.max(0, currentTime || 0);
  };

  const buildPlaybackSnapshot = () => ({
    currentSong: sanitizeSong(currentSong),
    queue: queue.map(sanitizeSong).filter(Boolean),
    isPlaying,
    position: getPlaybackPosition()
  });

  const applySeekIfPending = () => {
    if (!audioRef.current) return;
    if (pendingSeekRef.current === null) return;

    const seekTarget = Math.max(0, Number(pendingSeekRef.current) || 0);
    pendingSeekRef.current = null;

    try {
      audioRef.current.currentTime = seekTarget;
    } catch (error) {
      pendingSeekRef.current = seekTarget;
    }
  };

  const syncRoomState = async () => {
    const activeRoomId = roomIdRef.current;
    if (!activeRoomId) return;

    try {
      const response = await axios.get(`/api/rooms/${activeRoomId}/state`, {
        params: {
          clientId: roomClientIdRef.current,
          username: getRoomUsername()
        }
      });

      const room = response.data;
      roomVersionRef.current = Math.max(roomVersionRef.current, room.version || 0);
      setRoomMembers(room.members || []);
      setRoomMemberCount(room.memberCount || 0);
      setRoomSyncStatus('synced');

      const playback = room.playback || {};
      const remoteSongId = playback.currentSong?._id || null;
      const localSongId = currentSongRef.current?._id || null;
      const isRemoteController = playback.updatedBy && playback.updatedBy !== roomClientIdRef.current;

      if (!isRemoteController && remoteSongId === localSongId) {
        if (audioRef.current && playback.isPlaying) {
          const drift = Math.abs(audioRef.current.currentTime - (playback.position || 0));
          if (drift > ROOM_DRIFT_THRESHOLD_SECONDS) {
            audioRef.current.currentTime = Math.max(0, playback.position || 0);
          }
        }
        return;
      }

      suppressRoomBroadcastRef.current = true;

      const remoteQueue = Array.isArray(playback.queue) ? playback.queue : [];
      setQueue(remoteQueue);
      setCurrentSong(playback.currentSong || null);
      setIsPlaying(Boolean(playback.isPlaying));
      pendingSeekRef.current = Math.max(0, playback.position || 0);

      if (
        audioRef.current &&
        remoteSongId &&
        remoteSongId === localSongId &&
        Number.isFinite(audioRef.current.duration)
      ) {
        const drift = Math.abs(audioRef.current.currentTime - pendingSeekRef.current);
        if (drift > ROOM_DRIFT_THRESHOLD_SECONDS) {
          audioRef.current.currentTime = pendingSeekRef.current;
          pendingSeekRef.current = null;
        }
      }

      window.setTimeout(() => {
        suppressRoomBroadcastRef.current = false;
      }, 40);
    } catch (error) {
      setRoomSyncStatus('degraded');
    }
  };

  const pushRoomSync = async () => {
    const activeRoomId = roomIdRef.current;
    if (!activeRoomId || suppressRoomBroadcastRef.current) return;

    const now = Date.now();
    if (now - lastRoomSyncAtRef.current < ROOM_SYNC_THROTTLE_MS) {
      return;
    }
    lastRoomSyncAtRef.current = now;

    try {
      const response = await axios.post('/api/rooms/sync', {
        roomId: activeRoomId,
        clientId: roomClientIdRef.current,
        username: getRoomUsername(),
        playback: buildPlaybackSnapshot()
      });

      const room = response.data;
      roomVersionRef.current = Math.max(roomVersionRef.current, room.version || 0);
      setRoomMembers(room.members || []);
      setRoomMemberCount(room.memberCount || 0);
      setRoomSyncStatus('synced');
    } catch (error) {
      setRoomSyncStatus('degraded');
    }
  };

  const scheduleRoomSync = (delay = 80) => {
    if (!roomIdRef.current || suppressRoomBroadcastRef.current) return;
    window.setTimeout(() => {
      pushRoomSync();
    }, delay);
  };

  const startRoomPolling = () => {
    if (roomPollTimerRef.current) {
      window.clearInterval(roomPollTimerRef.current);
    }

    roomPollTimerRef.current = window.setInterval(() => {
      if (roomIdRef.current) {
        syncRoomState();
      }
    }, ROOM_POLL_INTERVAL_MS);
  };

  const stopRoomPolling = () => {
    if (roomPollTimerRef.current) {
      window.clearInterval(roomPollTimerRef.current);
      roomPollTimerRef.current = null;
    }
  };

  const joinRoom = async (rawRoomId) => {
    const normalized = normalizeRoomId(rawRoomId);
    if (!normalized) {
      throw new Error('Room id is invalid');
    }

    const response = await axios.post('/api/rooms/join', {
      roomId: normalized,
      clientId: roomClientIdRef.current,
      username: getRoomUsername()
    });

    const room = response.data;
    setRoomId(normalized);
    roomIdRef.current = normalized;
    setRoomMembers(room.members || []);
    setRoomMemberCount(room.memberCount || 0);
    roomVersionRef.current = room.version || 0;
    setRoomSyncStatus('synced');

    const playback = room.playback || {};
    if (playback.currentSong || playback.queue?.length) {
      suppressRoomBroadcastRef.current = true;
      setQueue(Array.isArray(playback.queue) ? playback.queue : []);
      setCurrentSong(playback.currentSong || null);
      setIsPlaying(Boolean(playback.isPlaying));
      pendingSeekRef.current = Math.max(0, playback.position || 0);
      window.setTimeout(() => {
        suppressRoomBroadcastRef.current = false;
      }, 50);
    }

    startRoomPolling();
    await syncRoomState();
  };

  const leaveRoom = async () => {
    const activeRoom = roomId;
    roomIdRef.current = '';
    setRoomId('');
    setRoomMembers([]);
    setRoomMemberCount(0);
    setRoomSyncStatus('idle');
    roomVersionRef.current = 0;
    stopRoomPolling();

    if (!activeRoom) return;

    try {
      await axios.post('/api/rooms/leave', {
        roomId: activeRoom,
        clientId: roomClientIdRef.current
      });
    } catch (error) {
      // noop
    }
  };

  useEffect(() => () => stopRoomPolling(), []);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  useEffect(() => {
    let interval;
    if (isPlaying && currentSong) {
      interval = setInterval(() => {
        const now = Date.now();
        const timeDiff = Math.floor((now - lastUpdateTime.current) / 1000);
        if (timeDiff > 0) {
          updateListeningTime(timeDiff);
          lastUpdateTime.current = now;
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentSong]);

  const updateListeningTime = async (timeInSeconds) => {
    try {
      const response = await axios.post('/api/users/listening-time', {
        timeInSeconds
      });
      setListeningTime(response.data.listeningTime);
    } catch (error) {
      // listening-time updates require auth, so silent failure is expected for guests
    }
  };

  useEffect(() => {
    const fetchListeningTime = async () => {
      try {
        const response = await axios.get('/api/users/listening-time');
        setListeningTime(response.data.listeningTime);
      } catch (error) {
        // silent for unauthenticated users
      }
    };
    fetchListeningTime();
  }, []);

  useEffect(() => {
    if (audioRef.current && currentSong) {
      setIsLoading(true);
      isChangingSong.current = true;
      audioRef.current.src = `${getApiBaseUrl()}/api/songs/${currentSong._id}/stream`;
      audioRef.current.load();
    }
  }, [currentSong]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    if (isPlaying && !isLoading && !isChangingSong.current) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsLoading(false);
          })
          .catch(error => {
            if (error.name !== 'AbortError') {
              console.error('Error playing audio:', error);
              setIsPlaying(false);
              setIsLoading(false);
            }
          });
      }
    } else if (!isPlaying) {
      audio.pause();
    }
  }, [isPlaying, isLoading]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const safeDuration = audioRef.current.duration || 0;
      const currentProgress = safeDuration > 0
        ? (audioRef.current.currentTime / safeDuration) * 100
        : 0;
      setProgress(currentProgress);
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
      applySeekIfPending();
    }
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    isChangingSong.current = false;
    applySeekIfPending();

    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(error => {
            if (error.name !== 'AbortError') {
              console.error('Error playing audio after load:', error);
              setIsPlaying(false);
            }
          });
      }
    }
  };

  const getNextIndex = () => {
    if (!queue.length || !currentSong) return -1;
    const currentIndex = queue.findIndex(song => song._id === currentSong._id);

    if (shuffle) {
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === currentIndex && queue.length > 1);
      return nextIndex;
    }

    return (currentIndex + 1) % queue.length;
  };

  const getPreviousIndex = () => {
    if (!queue.length || !currentSong) return -1;
    const currentIndex = queue.findIndex(song => song._id === currentSong._id);

    if (shuffle) {
      let prevIndex;
      do {
        prevIndex = Math.floor(Math.random() * queue.length);
      } while (prevIndex === currentIndex && queue.length > 1);
      return prevIndex;
    }

    return (currentIndex - 1 + queue.length) % queue.length;
  };

  const playNext = () => {
    const nextIndex = getNextIndex();
    if (nextIndex !== -1) {
      setCurrentSong(queue[nextIndex]);
      setTimeout(() => {
        setIsPlaying(true);
      }, 50);
      scheduleRoomSync(120);
    } else {
      setIsPlaying(false);
      setCurrentSong(null);
      scheduleRoomSync(120);
    }
  };

  const playPrevious = () => {
    const prevIndex = getPreviousIndex();
    if (prevIndex !== -1) {
      setCurrentSong(queue[prevIndex]);
      setTimeout(() => {
        setIsPlaying(true);
      }, 50);
      scheduleRoomSync(120);
    }
  };

  const handleEnded = () => {
    if (repeat === 'one') {
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name !== 'AbortError') {
            console.error('Error replaying audio:', error);
          }
        });
      }
      scheduleRoomSync();
      return;
    }

    if (repeat === 'all' || queue.length > 0) {
      playNext();
      return;
    }

    setIsPlaying(false);
    setCurrentSong(null);
    scheduleRoomSync(120);
  };

  const playSong = (song) => {
    if (!song) return;

    if (queue.some(s => s._id === song._id)) {
      setCurrentSong(song);
      setIsPlaying(true);
      scheduleRoomSync(120);
      return;
    }

    if (queue.length === 0) {
      setQueue([song]);
      setCurrentSong(song);
      setIsPlaying(true);
      scheduleRoomSync(120);
      return;
    }

    const currentIndex = queue.findIndex(s => s._id === currentSong?._id);
    const newQueue = [...queue];

    if (currentIndex === -1) {
      newQueue.push(song);
    } else {
      newQueue.splice(currentIndex + 1, 0, song);
    }

    setQueue(newQueue);
    setCurrentSong(song);
    setIsPlaying(true);
    scheduleRoomSync(120);
  };

  const playQueue = (songs, startIndex = 0) => {
    if (!Array.isArray(songs) || songs.length === 0) return;
    setQueue(songs);
    setCurrentSong(songs[startIndex]);
    setIsPlaying(true);
    scheduleRoomSync(120);
  };

  const clearQueue = () => {
    setQueue([]);
    setCurrentSong(null);
    setIsPlaying(false);
    scheduleRoomSync(120);
  };

  const addToQueue = (song) => {
    setQueue(prev => [...prev, song]);
    scheduleRoomSync(120);
  };

  const removeFromQueue = (index) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
    scheduleRoomSync(120);
  };

  const seekTo = (time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      const safeDuration = audioRef.current.duration || 0;
      setProgress(safeDuration > 0 ? (time / safeDuration) * 100 : 0);
      scheduleRoomSync(20);
    }
  };

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
    scheduleRoomSync(20);
  };

  const toggleShuffle = () => {
    setShuffle(!shuffle);
  };

  const toggleRepeat = () => {
    setRepeat(repeat === 'none' ? 'one' : repeat === 'one' ? 'all' : 'none');
  };

  const value = {
    currentSong,
    isPlaying,
    setIsPlaying,
    togglePlay,
    volume,
    setVolume,
    progress,
    setProgress,
    seekTo,
    playNext,
    playPrevious,
    shuffle,
    toggleShuffle,
    repeat,
    toggleRepeat,
    queue,
    playSong,
    playQueue,
    clearQueue,
    addToQueue,
    removeFromQueue,
    audioRef,
    duration,
    currentTime,
    isLoading,
    listeningTime,
    roomId,
    roomMembers,
    roomMemberCount,
    roomSyncStatus,
    joinRoom,
    leaveRoom
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onCanPlay={handleCanPlay}
        onError={(e) => {
          console.error('Audio error:', e);
          console.error('Audio element error:', audioRef.current?.error);
          setIsLoading(false);
          setIsPlaying(false);
          isChangingSong.current = false;
        }}
        crossOrigin="anonymous"
      />
    </PlayerContext.Provider>
  );
};

export default PlayerContext;
