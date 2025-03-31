import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import axios from 'axios';

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
  const [listeningTime, setListeningTime] = useState(0);
  const audioRef = useRef(null);
  const isChangingSong = useRef(false);
  const playPromiseRef = useRef(null);
  const lastUpdateTime = useRef(Date.now());

  // Update listening time periodically
  useEffect(() => {
    let interval;
    if (isPlaying && currentSong) {
      interval = setInterval(() => {
        const now = Date.now();
        const timeDiff = Math.floor((now - lastUpdateTime.current) / 1000); // Convert to seconds
        if (timeDiff > 0) {
          updateListeningTime(timeDiff);
          lastUpdateTime.current = now;
        }
      }, 1000); // Update every second
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentSong]);

  // Update listening time in the database
  const updateListeningTime = async (timeInSeconds) => {
    try {
      const response = await axios.post('/api/users/listening-time', {
        timeInSeconds
      });
      setListeningTime(response.data.listeningTime);
    } catch (error) {
      console.error('Error updating listening time:', error);
    }
  };

  // Fetch initial listening time
  useEffect(() => {
    const fetchListeningTime = async () => {
      try {
        const response = await axios.get('/api/users/listening-time');
        setListeningTime(response.data.listeningTime);
      } catch (error) {
        console.error('Error fetching listening time:', error);
      }
    };
    fetchListeningTime();
  }, []);

  // Update audio source when currentSong changes
  useEffect(() => {
    if (audioRef.current && currentSong) {
      setIsLoading(true);
      isChangingSong.current = true;

      // Set new source and load
      audioRef.current.src = `http://localhost:5001/api/songs/${currentSong._id}/stream`;
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
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsLoading(false);
          })
          .catch(error => {
            // Only update state if it's not an AbortError
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

    // Only attempt to play if we're supposed to be playing
    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(error => {
            // Only update state if it's not an AbortError
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
      // For single song repeat, just reset the current song
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
          })
          .catch(error => {
            if (error.name !== 'AbortError') {
              console.error('Error replaying audio:', error);
            }
          });
      }
    } else if (repeat === 'all') {
      // For queue repeat, move to next song
      playNext();
    } else {
      // For no repeat, move to next song if available
      if (queue.length > 0) {
        playNext();
      } else {
        setIsPlaying(false);
        setCurrentSong(null);
      }
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
      // Set the next song first
      setCurrentSong(queue[nextIndex]);
      // Then set playing state after a small delay to ensure the audio element is ready
      setTimeout(() => {
        setIsPlaying(true);
      }, 50); // Reduced delay for smoother transitions
    } else {
      setIsPlaying(false);
      setCurrentSong(null);
    }
  };

  const playPrevious = () => {
    const prevIndex = getPreviousIndex();
    if (prevIndex !== -1) {
      // Set the previous song first
      setCurrentSong(queue[prevIndex]);
      // Then set playing state after a small delay to ensure the audio element is ready
      setTimeout(() => {
        setIsPlaying(true);
      }, 50); // Reduced delay for smoother transitions
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
    playQueue,
    audioRef,
    duration,
    currentTime,
    isLoading,
    listeningTime
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