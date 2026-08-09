import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import RoomList from './RoomList';
import CreateRoomModal from './CreateRoomModal';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch rooms on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchRooms();
  }, []);

  // Filter rooms based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRooms(rooms);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = rooms.filter(
        room =>
          room.name.toLowerCase().includes(query) ||
          room.description.toLowerCase().includes(query)
      );
      setFilteredRooms(filtered);
    }
  }, [searchQuery, rooms]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/api/rooms');
      // Backend returns { success: true, data: { rooms: [...] } }
      const rooms = response.data?.rooms || [];
      setRooms(rooms);
    } catch (err) {
      if (err.status === 401) {
        logout();
        navigate('/login');
      } else {
        setError(err.message || 'Failed to load rooms. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRoomCreated = () => {
    setShowCreateModal(false);
    fetchRooms();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>RealTime Chat</h1>
        </div>
        <div className="header-right">
          <span className="user-badge">User: {user?.username}</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        <div className="welcome-section">
          <h2>Welcome back, {user?.username} 👋</h2>
          <p>Find a room and start chatting.</p>
        </div>

        {/* Search and Create */}
        <div className="controls-section">
          <input
            type="text"
            className="search-input"
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            onClick={() => setShowCreateModal(true)}
            className="create-room-btn"
          >
            + Create Room
          </button>
          <button onClick={fetchRooms} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button
              onClick={() => setError('')}
              className="error-close"
            >
              ✕
            </button>
          </div>
        )}

        {/* Room List */}
        {loading ? (
          <div className="loading-state">Loading rooms...</div>
        ) : filteredRooms.length === 0 ? (
          <div className="empty-state">
            {rooms.length === 0
              ? 'No rooms available yet. Create the first one!'
              : 'No rooms match your search.'}
          </div>
        ) : (
          <RoomList rooms={filteredRooms} onRoomJoined={fetchRooms} />
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onRoomCreated={handleRoomCreated}
        />
      )}
    </div>
  );
}
