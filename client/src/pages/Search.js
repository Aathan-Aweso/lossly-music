import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { usePlayer } from '../contexts/PlayerContext';
import { useDebounce } from '../hooks/useDebounce';

const Search = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({
    songs: [],
    playlists: []
  });
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 500);
  const { playSong } = usePlayer();

  useEffect(() => {
    const searchContent = async () => {
      if (!debouncedQuery.trim()) {
        setResults({ songs: [], playlists: [] });
        return;
      }

      setLoading(true);
      try {
        const [songsRes, playlistsRes] = await Promise.all([
          axios.get(`/api/songs/search?q=${debouncedQuery}`),
          axios.get(`/api/playlists/search?q=${debouncedQuery}`)
        ]);
        setResults({
          songs: songsRes.data,
          playlists: playlistsRes.data
        });
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    };

    searchContent();
  }, [debouncedQuery]);

  return (
    <div className="space-y-8">
      <div className="relative">
        <input
          type="text"
          placeholder="Search songs, artists, or playlists..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-12 text-lg"
        />
        <svg
          className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {loading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <>
          {/* Songs Results */}
          {results.songs.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-white mb-6">Songs</h2>
              <div className="space-y-2">
                {results.songs.map((song) => (
                  <div
                    key={song._id}
                    className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors duration-200"
                  >
                    <div className="flex items-center space-x-4">
                      <img
                        src={song.coverArt}
                        alt={song.title}
                        className="w-12 h-12 rounded-md"
                      />
                      <div>
                        <h3 className="font-medium text-white">{song.title}</h3>
                        <p className="text-sm text-gray-400">{song.artist}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => playSong(song)}
                      className="text-primary-500 hover:text-primary-400"
                    >
                      Play
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Playlists Results */}
          {results.playlists.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-white mb-6">Playlists</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {results.playlists.map((playlist) => (
                  <div
                    key={playlist._id}
                    className="card hover:bg-gray-700 transition-colors duration-200"
                  >
                    <img
                      src={playlist.coverArt}
                      alt={playlist.name}
                      className="w-full aspect-square object-cover rounded-md mb-4"
                    />
                    <h3 className="font-medium text-white">{playlist.name}</h3>
                    <p className="text-sm text-gray-400">
                      {playlist.songs.length} songs
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* No Results */}
          {!loading && query && results.songs.length === 0 && results.playlists.length === 0 && (
            <div className="text-center text-gray-400">
              No results found for "{query}"
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Search; 