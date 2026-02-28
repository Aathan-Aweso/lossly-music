import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <nav className="sticky top-0 z-30 border-b border-gray-700/70 bg-gray-900/85 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight text-white md:text-xl">
            Lossly
            <span className="ml-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
              FLAC
            </span>
          </Link>

          <div className="flex items-center gap-3 text-sm md:gap-5">
            <Link to="/search" className="text-gray-300 transition hover:text-white">
              Search
            </Link>

            {user ? (
              <>
                <Link to="/library" className="text-gray-300 transition hover:text-white">
                  Library
                </Link>
                <Link to="/playlist/create" className="text-gray-300 transition hover:text-white">
                  New Playlist
                </Link>
                <Link to="/profile" className="text-gray-300 transition hover:text-white">
                  {user.username}
                </Link>
                <button
                  onClick={handleLogout}
                  className="rounded-md border border-gray-600 px-3 py-1.5 text-gray-200 transition hover:border-gray-400 hover:text-white"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-300 transition hover:text-white">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="rounded-md bg-primary-600 px-3 py-1.5 font-medium text-white transition hover:bg-primary-700"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
