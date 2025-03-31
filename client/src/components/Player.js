import React, { useRef, useEffect, useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { checkDolbyAtmosSupport } from '../utils/audioUtils';
import {
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/solid';

const Player = () => {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    playNext,
    playPrevious,
    volume,
    setVolume,
    shuffle,
    toggleShuffle,
    repeat,
    toggleRepeat,
    progress,
    setProgress,
    seekTo,
    audioRef,
    duration,
    currentTime,
    queue,
    setIsPlaying,
    listeningTime
  } = usePlayer();

  const [isDragging, setIsDragging] = useState(false);
  const [hasDolbyAtmos, setHasDolbyAtmos] = useState(false);
  const progressBarRef = useRef(null);

  useEffect(() => {
    const checkSupport = async () => {
      const supportsDolbyAtmos = await checkDolbyAtmosSupport();
      setHasDolbyAtmos(supportsDolbyAtmos);
    };
    checkSupport();
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (isPlaying) {
      const playPromise = audioRef.current?.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error playing audio:', error);
          setIsPlaying(false);
        });
      }
    } else {
      audioRef.current?.pause();
    }
  }, [isPlaying, currentSong]);

  // Add event listeners for external audio state changes
  useEffect(() => {
    if (!audioRef.current) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      playNext();
    };
    const handleError = (error) => {
      console.error('Audio error:', error);
      setIsPlaying(false);
    };

    // Listen for system media controls
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, check if audio is still playing
        if (audioRef.current.paused) {
          setIsPlaying(false);
        }
      }
    };

    // Listen for audio element events
    audioRef.current.addEventListener('play', handlePlay);
    audioRef.current.addEventListener('pause', handlePause);
    audioRef.current.addEventListener('ended', handleEnded);
    audioRef.current.addEventListener('error', handleError);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup event listeners
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('play', handlePlay);
        audioRef.current.removeEventListener('pause', handlePause);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('error', handleError);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [audioRef.current, setIsPlaying, playNext]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const currentProgress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(currentProgress);
    }
  };

  const calculateSeekPosition = (e) => {
    const progressBar = progressBarRef.current;
    const rect = progressBar.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const progressBarWidth = rect.width;
    const percentage = Math.max(0, Math.min(1, clickPosition / progressBarWidth));
    return percentage * duration;
  };

  const handleProgressClick = (e) => {
    if (isDragging) return;
    const seekTime = calculateSeekPosition(e);
    seekTo(seekTime);
  };

  const handleProgressMouseDown = (e) => {
    setIsDragging(true);
    const seekTime = calculateSeekPosition(e);
    seekTo(seekTime);
  };

  const handleProgressMouseUp = () => {
    setIsDragging(false);
  };

  const handleProgressMouseMove = (e) => {
    if (!isDragging) return;
    const seekTime = calculateSeekPosition(e);
    seekTo(seekTime);
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatListeningTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (!currentSong) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Song Info */}
          <div className="flex items-center space-x-4 w-1/3">
            <div className="w-14 h-14 rounded-lg overflow-hidden">
              {currentSong.coverArt ? (
                <img
                  src={`http://localhost:5001/api/songs/cover/${currentSong.coverArt}`}
                  alt={currentSong.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-purple-500 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    />
                  </svg>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium">
                {currentSong.title}
                <div className="flex gap-2 mt-1">
                  {currentSong.format === 'FLAC' && (
                    <span className="px-2 py-0.5 text-xs bg-green-500 text-white rounded-full">
                      Lossless
                    </span>
                  )}
                  {currentSong.hasDolbyAtmos && hasDolbyAtmos && (
                    <span className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                      Dolby Atmos
                    </span>
                  )}
                </div>
              </h3>
              <p className="text-gray-400 text-sm">{currentSong.artist}</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatListeningTime(listeningTime)} listening time
              </p>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex flex-col items-center space-y-2 w-1/3">
            <div className="flex items-center space-x-4">
              <button
                onClick={playPrevious}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                disabled={!queue.length}
              >
                <BackwardIcon className="w-5 h-5" />
              </button>

              <button
                onClick={toggleShuffle}
                className={`p-2 transition-colors ${
                  shuffle 
                    ? 'text-primary-500 hover:text-primary-400' 
                    : 'text-gray-400 hover:text-white'
                }`}
                disabled={!queue.length}
              >
                <ArrowsRightLeftIcon className="w-5 h-5" />
              </button>

              <button
                onClick={togglePlay}
                className="bg-primary-500 p-2 rounded-full hover:bg-primary-600"
                disabled={!currentSong}
              >
                {isPlaying ? (
                  <PauseIcon className="w-6 h-6" />
                ) : (
                  <PlayIcon className="w-6 h-6" />
                )}
              </button>

              <button
                onClick={toggleRepeat}
                className={`p-2 transition-colors ${
                  repeat !== 'none'
                    ? 'text-primary-500 hover:text-primary-400'
                    : 'text-gray-400 hover:text-white'
                }`}
                disabled={!currentSong}
              >
                <ArrowPathIcon className={`w-5 h-5 ${repeat === 'one' ? 'rotate-180' : ''}`} />
              </button>

              <button
                onClick={playNext}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                disabled={!queue.length}
              >
                <ForwardIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full flex items-center space-x-2 mt-2">
              <span className="text-xs text-gray-400">
                {formatTime(currentTime)}
              </span>
              <div
                ref={progressBarRef}
                className="flex-1 h-1 bg-gray-700 rounded-full cursor-pointer relative"
                onClick={handleProgressClick}
                onMouseDown={handleProgressMouseDown}
                onMouseUp={handleProgressMouseUp}
                onMouseMove={handleProgressMouseMove}
                onMouseLeave={handleProgressMouseUp}
              >
                <div
                  className="h-full bg-primary-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
                <div
                  className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg transition-transform ${
                    isDragging ? 'scale-125' : 'scale-100'
                  }`}
                  style={{ left: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Volume Control */}
          <div className="flex items-center justify-end space-x-2 w-1/3">
            <button
              onClick={() => setVolume(volume === 0 ? 1 : 0)}
              className="text-gray-400 hover:text-white"
            >
              {volume === 0 ? (
                <SpeakerXMarkIcon className="w-5 h-5" />
              ) : (
                <SpeakerWaveIcon className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Player; 