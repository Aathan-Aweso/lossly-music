import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

const PlayerContext = createContext(null);

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
  const [repeat, setRepeat] = useState('none'); // none, one, all
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);
  const isChangingSong = useRef(false);
  const playPromiseRef = useRef(null);

  // Update audio source when currentSong changes
  useEffect(() => {
    if (audioRef.current && currentSong) {
      setIsLoading(true);
      isChangingSong.current = true;
      
      // Cancel any existing play promise
      if (playPromiseRef.current) {
        playPromiseRef.current = null;
      }
      
      // Set new source and load
      audioRef.current.src = `http://localhost:5000/api/songs/${currentSong._id}/stream`;
      audioRef.current.load();
    }
  }, [currentSong]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle play/pause state changes
  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    if (isPlaying && !isLoading && !isChangingSong.current) {
      // Cancel any existing play promise
      if (playPromiseRef.current) {
        playPromiseRef.current = null;
      }

      // Create new play promise
      playPromiseRef.current = audio.play();
      if (playPromiseRef.current !== undefined) {
        playPromiseRef.current.catch(error => {
          if (error.name !== 'AbortError') {
            console.error('Error playing audio:', error);
            setIsPlaying(false);
            setIsLoading(false);
          }
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, isLoading]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const currentProgress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(currentProgress);
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    isChangingSong.current = false;
    if (isPlaying) {
      // Cancel any existing play promise
      if (playPromiseRef.current) {
        playPromiseRef.current = null;
      }

      // Create new play promise
      playPromiseRef.current = audioRef.current.play();
      if (playPromiseRef.current !== undefined) {
        playPromiseRef.current.catch(error => {
          if (error.name !== 'AbortError') {
            console.error('Error playing audio after load:', error);
            setIsPlaying(false);
          }
        });
      }
    }
  };

  const handleEnded = () => {
    if (repeat === 'one') {
      audioRef.current.currentTime = 0;
      // Cancel any existing play promise
      if (playPromiseRef.current) {
        playPromiseRef.current = null;
      }

      // Create new play promise
      playPromiseRef.current = audioRef.current.play();
      if (playPromiseRef.current !== undefined) {
        playPromiseRef.current.catch(error => {
          if (error.name !== 'AbortError') {
            console.error('Error replaying audio:', error);
          }
        });
      }
    } else if (repeat === 'all' && queue.length > 0) {
      playNext();
    } else if (queue.length > 0) {
      playNext();
    } else {
      setIsPlaying(false);
      setCurrentSong(null);
    }
  };

  const playSong = (song) => {
    // If the song is already in the queue, just set it as current
    if (queue.some(s => s._id === song._id)) {
      setCurrentSong(song);
      setIsPlaying(true);
      return;
    }

    // If no queue exists, create one with just this song
    if (queue.length === 0) {
      setQueue([song]);
      setCurrentSong(song);
      setIsPlaying(true);
      return;
    }

    // Add song to queue and play it
    const currentIndex = queue.findIndex(s => s._id === currentSong?._id);
    const newQueue = [...queue];
    
    if (currentIndex === -1) {
      // If no current song, add to end
      newQueue.push(song);
    } else {
      // Add after current song
      newQueue.splice(currentIndex + 1, 0, song);
    }
    
    setQueue(newQueue);
    setCurrentSong(song);
    setIsPlaying(true);
  };

  const playQueue = (songs, startIndex = 0) => {
    setQueue(songs);
    setCurrentSong(songs[startIndex]);
    setIsPlaying(true);
  };

  const getNextIndex = () => {
    if (!queue.length) return -1;
    const currentIndex = queue.findIndex(song => song._id === currentSong._id);
    
    if (shuffle) {
      // Get a random index different from the current one
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === currentIndex && queue.length > 1);
      return nextIndex;
    }
    
    return (currentIndex + 1) % queue.length;
  };

  const getPreviousIndex = () => {
    if (!queue.length) return -1;
    const currentIndex = queue.findIndex(song => song._id === currentSong._id);
    
    if (shuffle) {
      // Get a random index different from the current one
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
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
      setCurrentSong(null);
    }
  };

  const playPrevious = () => {
    const prevIndex = getPreviousIndex();
    if (prevIndex !== -1) {
      setCurrentSong(queue[prevIndex]);
      setIsPlaying(true);
    }
  };

  const clearQueue = () => {
    setQueue([]);
    setCurrentSong(null);
    setIsPlaying(false);
  };

  const addToQueue = (song) => {
    setQueue([...queue, song]);
  };

  const removeFromQueue = (index) => {
    setQueue(queue.filter((_, i) => i !== index));
  };

  const seekTo = (time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleShuffle = () => {
    setShuffle(!shuffle);
  };

  const toggleRepeat = () => {
    setRepeat(repeat === 'none' ? 'one' : repeat === 'one' ? 'all' : 'none');
  };

  const value = {
    currentSong,
    queue,
    isPlaying,
    volume,
    progress,
    setProgress,
    shuffle,
    repeat,
    audioRef,
    playSong,
    playQueue,
    togglePlay,
    playNext,
    playPrevious,
    clearQueue,
    addToQueue,
    removeFromQueue,
    seekTo,
    toggleShuffle,
    toggleRepeat,
    setVolume,
    handleTimeUpdate,
    handleEnded,
    duration,
    currentTime
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
          playPromiseRef.current = null;
        }}
        crossOrigin="anonymous"
      />
    </PlayerContext.Provider>
  );
};

export default PlayerContext; 