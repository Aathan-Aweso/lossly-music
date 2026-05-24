import React, { useRef, useEffect, useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { checkDolbyAtmosSupport } from '../utils/audioUtils';
import config from '../config';
import {
  PlayIcon,
  PauseIcon,
  ForwardIcon,
  BackwardIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  SignalIcon,
  UserGroupIcon,
} from '@heroicons/react/24/solid';

const QUALITY_OPTIONS = [
  { value: 'lossless', label: 'Lossless',    desc: 'FLAC · max quality' },
  { value: 'opus128',  label: 'High',         desc: 'Opus 128 kbps' },
  { value: 'opus64',   label: 'Data Saver',   desc: 'Opus 64 kbps' },
];

const Player = () => {
  const {
    currentSong, isPlaying, togglePlay,
    playNext, playPrevious,
    volume, setVolume,
    shuffle, toggleShuffle,
    repeat, toggleRepeat,
    progress, seekTo, duration, currentTime,
    queue, listeningTime,
    quality, setQuality,
    roomId, roomMemberCount, roomSyncStatus,
    joinRoom, leaveRoom,
  } = usePlayer();

  const [isDragging, setIsDragging] = useState(false);
  const [hasDolbyAtmos, setHasDolbyAtmos] = useState(false);
  const [roomInput, setRoomInput] = useState('');
  const [roomError, setRoomError] = useState('');
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const progressBarRef = useRef(null);

  useEffect(() => {
    checkDolbyAtmosSupport().then(setHasDolbyAtmos);
  }, []);

  useEffect(() => { setRoomInput(roomId || ''); }, [roomId]);

  const handleJoinRoom = async () => {
    setRoomError('');
    if (!roomInput.trim()) { setRoomError('Enter a room id'); return; }
    setIsJoiningRoom(true);
    try {
      await joinRoom(roomInput);
    } catch (err) {
      setRoomError(err?.message || 'Unable to join room');
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const handleLeaveRoom = async () => {
    await leaveRoom();
    setRoomInput('');
    setRoomError('');
  };

  const calcSeek = (e) => {
    const bar = progressBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  };

  const fmt = (t) => {
    const s = Number.isFinite(t) ? t : 0;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const fmtListened = (s) => {
    const n = Number.isFinite(s) ? s : 0;
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const syncColor = roomSyncStatus === 'synced'
    ? 'text-emerald-400'
    : roomSyncStatus === 'degraded'
      ? 'text-amber-400'
      : 'text-gray-400';

  const currentQualityLabel = QUALITY_OPTIONS.find(o => o.value === quality)?.label || 'Lossless';

  if (!currentSong) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-gray-700/70 bg-gray-900/95 backdrop-blur-sm">
      <div className="container mx-auto px-3 py-3 md:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

          {/* Song info */}
          <div className="flex min-w-0 items-center gap-3 lg:w-1/3">
            <div className="h-14 w-14 overflow-hidden rounded-lg bg-gray-700 flex-shrink-0">
              {currentSong.coverArt ? (
                <img
                  src={`${config.API_URL}/api/songs/cover/${currentSong.coverArt}`}
                  alt={currentSong.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary-500/80">
                  <span className="text-xs font-bold">♪</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold md:text-base">{currentSong.title}</h3>
              <p className="truncate text-xs text-gray-300 md:text-sm">{currentSong.artist}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px]">
                {currentSong.format === 'FLAC' && quality === 'lossless' && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300">Lossless FLAC</span>
                )}
                {currentSong.hasDolbyAtmos && hasDolbyAtmos && (
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-blue-300">Dolby Atmos</span>
                )}
                <span className="text-gray-400">{fmtListened(listeningTime)} listened</span>
              </div>
            </div>
          </div>

          {/* Playback controls + progress */}
          <div className="lg:w-1/3">
            <div className="flex items-center justify-center gap-3">
              <button onClick={playPrevious} className="p-2 text-gray-300 transition hover:text-white" disabled={!queue.length}>
                <BackwardIcon className="h-5 w-5" />
              </button>
              <button
                onClick={toggleShuffle}
                className={`p-2 transition ${shuffle ? 'text-primary-400' : 'text-gray-400 hover:text-white'}`}
                disabled={!queue.length}
              >
                <ArrowsRightLeftIcon className="h-5 w-5" />
              </button>
              <button
                onClick={togglePlay}
                className="rounded-full bg-primary-500 p-2 text-white transition hover:bg-primary-600"
              >
                {isPlaying ? <PauseIcon className="h-6 w-6" /> : <PlayIcon className="h-6 w-6" />}
              </button>
              <button
                onClick={toggleRepeat}
                className={`p-2 transition ${repeat !== 'none' ? 'text-primary-400' : 'text-gray-400 hover:text-white'}`}
              >
                <ArrowPathIcon className={`h-5 w-5 ${repeat === 'one' ? 'rotate-180' : ''}`} />
              </button>
              <button onClick={playNext} className="p-2 text-gray-300 transition hover:text-white" disabled={!queue.length}>
                <ForwardIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <span className="w-9 text-right text-xs text-gray-400">{fmt(currentTime)}</span>
              <div
                ref={progressBarRef}
                className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-gray-700"
                onClick={(e) => { if (!isDragging) seekTo(calcSeek(e)); }}
                onMouseDown={(e) => { setIsDragging(true); seekTo(calcSeek(e)); }}
                onMouseUp={() => setIsDragging(false)}
                onMouseMove={(e) => { if (isDragging) seekTo(calcSeek(e)); }}
                onMouseLeave={() => setIsDragging(false)}
              >
                <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.max(0, Math.min(100, progress || 0))}%` }} />
                <div
                  className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-md transition-transform ${isDragging ? 'scale-125' : 'scale-100'}`}
                  style={{ left: `${Math.max(0, Math.min(100, progress || 0))}%` }}
                />
              </div>
              <span className="w-9 text-xs text-gray-400">{fmt(duration)}</span>
            </div>
          </div>

          {/* Volume + quality + room */}
          <div className="flex flex-col gap-2 lg:w-1/3 lg:items-end">

            {/* Volume + quality selector */}
            <div className="flex w-full items-center justify-end gap-3">
              <button onClick={() => setVolume(volume === 0 ? 0.8 : 0)} className="text-gray-300 transition hover:text-white">
                {volume === 0 ? <SpeakerXMarkIcon className="h-5 w-5" /> : <SpeakerWaveIcon className="h-5 w-5" />}
              </button>
              <input
                type="range" min="0" max="1" step="0.01" value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-24"
              />

              {/* Quality dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowQuality(v => !v)}
                  className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 ring-1 ring-gray-700 hover:text-white"
                >
                  {currentQualityLabel}
                </button>
                {showQuality && (
                  <div className="absolute bottom-8 right-0 z-50 w-44 rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
                    {QUALITY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setQuality(opt.value); setShowQuality(false); }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition hover:bg-gray-800 ${quality === opt.value ? 'text-primary-400' : 'text-gray-300'}`}
                      >
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-gray-500">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Room sync */}
            <div className="w-full rounded-md border border-gray-700 bg-gray-800/60 p-2">
              <div className="mb-1 flex items-center justify-between text-xs">
                <div className={`flex items-center gap-1 ${syncColor}`}>
                  <SignalIcon className="h-3.5 w-3.5" />
                  <span>{roomId ? `Room ${roomId}` : 'Room sync off'}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <UserGroupIcon className="h-3.5 w-3.5" />
                  <span>{roomMemberCount}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !roomId && handleJoinRoom()}
                  placeholder="room-id"
                  className="h-8 flex-1 rounded bg-gray-900 px-2 text-xs text-white outline-none ring-1 ring-gray-700 focus:ring-primary-500"
                />
                {!roomId ? (
                  <button
                    onClick={handleJoinRoom}
                    disabled={isJoiningRoom}
                    className="h-8 rounded bg-primary-600 px-3 text-xs font-medium text-white transition hover:bg-primary-700 disabled:opacity-60"
                  >
                    {isJoiningRoom ? 'Joining…' : 'Join'}
                  </button>
                ) : (
                  <button
                    onClick={handleLeaveRoom}
                    className="h-8 rounded bg-gray-700 px-3 text-xs font-medium text-white transition hover:bg-gray-600"
                  >
                    Leave
                  </button>
                )}
              </div>
              {roomError && <p className="mt-1 text-[11px] text-rose-400">{roomError}</p>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Player;
