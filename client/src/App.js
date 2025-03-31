import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PlayerProvider } from './contexts/PlayerContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Player from './components/Player';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Search from './pages/Search';
import Library from './pages/Library';
import Profile from './pages/Profile';
import Playlist from './pages/Playlist';
import CreatePlaylist from './pages/CreatePlaylist';
import EditPlaylist from './pages/EditPlaylist';

function App() {
  return (
    <Router>
      <AuthProvider>
        <PlayerProvider>
          <div className="min-h-screen bg-gray-900 text-white">
            <Navbar />
            <main className="pb-24">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/search" element={<Search />} />
                <Route
                  path="/library"
                  element={
                    <PrivateRoute>
                      <Library />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <PrivateRoute>
                      <Profile />
                    </PrivateRoute>
                  }
                />
                <Route path="/playlist/:id" element={<Playlist />} />
                <Route
                  path="/playlist/create"
                  element={
                    <PrivateRoute>
                      <CreatePlaylist />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/playlist/:id/edit"
                  element={
                    <PrivateRoute>
                      <EditPlaylist />
                    </PrivateRoute>
                  }
                />
              </Routes>
            </main>
            <Player />
          </div>
        </PlayerProvider>
      </AuthProvider>
    </Router>
  );
}

export default App; 