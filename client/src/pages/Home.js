import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { usePlayer } from '../contexts/PlayerContext';

const Home = () => {
  const [featuredPlaylists, setFeaturedPlaylists] = useState([]);
  const [recentSongs, setRecentSongs] = useState([]);
  const { playQueue } = usePlayer();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [playlistsRes, songsRes] = await Promise.all([
          axios.get('/api/playlists/public'),
          axios.get('/api/songs')
        ]);
        setFeaturedPlaylists(playlistsRes.data.slice(0, 5));
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
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="text-center py-20">
        <h1 className="text-5xl font-bold text-white mb-4">
          Listen to Lossless Music
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          Experience high-quality audio streaming with our premium service
        </p>
        <Link to="/register" className="btn btn-primary text-lg">
          Get Started
        </Link>
      </section>

      {/* Featured Playlists */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-6">Featured Playlists</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {featuredPlaylists.map((playlist) => (
            <Link
              key={playlist._id}
              to={`/playlist/${playlist._id}`}
              className="group"
            >
              <div className="card group-hover:bg-gray-700 transition-colors duration-200">
                <img
                  src={playlist.coverArt}
                  alt={playlist.name}
                  className="w-full aspect-square object-cover rounded-md mb-4"
                />
                <h3 className="font-medium text-white group-hover:text-primary-400">
                  {playlist.name}
                </h3>
                <p className="text-sm text-gray-400">
                  {playlist.songs.length} songs
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Songs */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-6">Recent Songs</h2>
        <div className="space-y-2">
          {recentSongs.map((song, index) => (
            <div
              key={song._id}
              className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors duration-200"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-md overflow-hidden">
                  {song.coverArt ? (
                    <img
                      src={song.coverArt}
                      alt={song.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-purple-500 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white"
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
                  <h3 className="font-medium text-white">
                    {song.title}
                    {song.format === 'FLAC' && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-green-500 text-white rounded-full">
                        Lossless
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-400">{song.artist}</p>
                  <p className="text-xs text-gray-500 mt-1">{formatDuration(song.duration)}</p>
                </div>
              </div>
              <button
                onClick={() => playQueue(recentSongs, index)}
                className="text-primary-500 hover:text-primary-400"
              >
                Play
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home; 