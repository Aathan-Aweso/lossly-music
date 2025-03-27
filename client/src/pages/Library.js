import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { usePlayer } from '../contexts/PlayerContext';

const Library = () => {
  const [playlists, setPlaylists] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { playSong } = usePlayer();

  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        const [playlistsRes, likedSongsRes] = await Promise.all([
          axios.get('/api/playlists/user'),
          axios.get('/api/songs/liked')
        ]);
        setPlaylists(playlistsRes.data);
        setLikedSongs(likedSongsRes.data);
      } catch (error) {
        console.error('Error fetching library:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLibrary();
  }, []);

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Library</h1>

      {/* Liked Songs Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Liked Songs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {likedSongs.map((song) => (
            <div
              key={song._id}
              className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium">
                    {song.title}
                    {song.format === 'FLAC' && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-green-500 text-white rounded-full">
                        Lossless
                      </span>
                    )}
                  </h3>
                  <p className="text-gray-400 text-sm">{song.artist}</p>
                  <p className="text-gray-500 text-xs mt-1">{formatDuration(song.duration)}</p>
                </div>
                <button
                  onClick={() => playSong(song)}
                  className="p-2 rounded-full bg-purple-500 hover:bg-purple-600 transition-colors ml-4"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Playlists Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-6">Your Playlists</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map((playlist) => (
            <Link
              key={playlist._id}
              to={`/playlist/${playlist._id}`}
              className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors"
            >
              <h3 className="font-medium">{playlist.name}</h3>
              <p className="text-gray-400 text-sm">
                {playlist.songs.length} songs
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Library; 