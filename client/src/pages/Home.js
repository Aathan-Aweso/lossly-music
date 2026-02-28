import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { usePlayer } from '../contexts/PlayerContext';
import { checkDolbyAtmosSupport } from '../utils/audioUtils';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const Home = () => {
  const [featuredPlaylists, setFeaturedPlaylists] = useState([]);
  const [recentSongs, setRecentSongs] = useState([]);
  const [hasDolbyAtmos, setHasDolbyAtmos] = useState(false);
  const { playQueue } = usePlayer();

  useEffect(() => {
    const checkSupport = async () => {
      const supportsDolbyAtmos = await checkDolbyAtmosSupport();
      setHasDolbyAtmos(supportsDolbyAtmos);
    };
    checkSupport();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [playlistsRes, songsRes] = await Promise.all([
          axios.get('/api/playlists/public'),
          axios.get('/api/songs')
        ]);
        setFeaturedPlaylists(playlistsRes.data.slice(0, 6));
        setRecentSongs(songsRes.data.slice(0, 10));
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-10 px-3 py-6 md:px-6 lg:px-8">
      <section className="rounded-2xl border border-gray-700/70 bg-gradient-to-r from-gray-800 to-gray-900 p-8 md:p-10">
        <h1 className="text-3xl font-bold text-white md:text-5xl">Lossless FLAC streaming, now with room sync</h1>
        <p className="mt-4 max-w-2xl text-sm text-gray-300 md:text-lg">
          Stream FLAC without transcoding. Join a room and your playback time is continuously reconciled for tight, shared listening.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/register" className="rounded-md bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 md:text-base">
            Start Listening
          </Link>
          <Link to="/search" className="rounded-md border border-gray-600 px-5 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-400 hover:text-white md:text-base">
            Browse Library
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white md:text-2xl">Featured Playlists</h2>
          <Link to="/search" className="text-sm text-primary-400 hover:text-primary-300">Explore all</Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {featuredPlaylists.map((playlist) => (
            <Link
              key={playlist._id}
              to={`/playlist/${playlist._id}`}
              className="rounded-xl border border-gray-700 bg-gray-800/70 p-3 transition hover:-translate-y-0.5 hover:border-gray-500 hover:bg-gray-800"
            >
              <img
                src={playlist.coverArt}
                alt={playlist.name}
                className="mb-3 aspect-square w-full rounded-lg object-cover"
              />
              <h3 className="truncate text-sm font-semibold text-white">{playlist.name}</h3>
              <p className="text-xs text-gray-400">{playlist.songs.length} songs</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-white md:text-2xl">Recent Songs</h2>
        <div className="overflow-hidden rounded-xl border border-gray-700/80">
          {recentSongs.map((song, index) => (
            <div
              key={song._id}
              className="flex items-center justify-between gap-3 border-b border-gray-700/70 bg-gray-800/50 px-3 py-2.5 transition last:border-b-0 hover:bg-gray-700/60 md:px-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-gray-700">
                  {song.coverArt ? (
                    <img
                      src={`${API_BASE_URL}/api/songs/cover/${song.coverArt}`}
                      alt={song.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary-500/80 text-[10px] font-bold">
                      FLAC
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-white">{song.title}</h3>
                  <p className="truncate text-xs text-gray-300">{song.artist}</p>
                </div>
              </div>

              <div className="hidden items-center gap-2 md:flex">
                {song.format === 'FLAC' && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-300">
                    Lossless
                  </span>
                )}
                {song.hasDolbyAtmos && hasDolbyAtmos && (
                  <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-[11px] text-blue-300">
                    Dolby Atmos
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{formatDuration(song.duration)}</span>
                <button
                  onClick={() => playQueue(recentSongs, index)}
                  className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-700"
                >
                  Play
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
