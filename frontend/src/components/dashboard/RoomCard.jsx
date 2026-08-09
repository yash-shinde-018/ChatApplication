import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PasswordModal from './PasswordModal';
import api from '../../services/api';
import './RoomCard.css';

export default function RoomCard({ room, onJoined }) {
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoinPublic = async () => {
    try {
      setLoading(true);
      setError('');
      await api.post(`/api/rooms/${room._id}/join`, {});
      // Navigate to chat with the room ID
      navigate(`/chat/${room._id}`);
      onJoined?.();
    } catch (err) {
      const message = err.message || 'Failed to join room';
      if (err.status === 409) {
        // Already member - just enter the room
        navigate(`/chat/${room._id}`);
        onJoined?.();
      } else if (err.status === 404) {
        setError('Room not found');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPrivate = async (password) => {
    try {
      setLoading(true);
      setError('');
      await api.post(`/api/rooms/${room._id}/join`, { password });
      setShowPasswordModal(false);
      navigate(`/chat/${room._id}`);
      onJoined?.();
    } catch (err) {
      const message = err.message || 'Failed to join room';
      if (err.status === 401) {
        setError('Invalid password');
      } else if (err.status === 409) {
        // Already member - just enter the room
        setShowPasswordModal(false);
        navigate(`/chat/${room._id}`);
        onJoined?.();
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="room-card">
      <div className="room-header">
        <h3 className="room-name">{room.name}</h3>
        <span className={`room-type-badge ${room.type}`}>
          {room.type === 'public' ? '🔓 Public' : '🔒 Private'}
        </span>
      </div>

      {room.description && (
        <p className="room-description">{room.description}</p>
      )}

      <div className="room-meta">
        <span className="room-members">
          👥 {room.memberCount} / {room.maxUsers}
        </span>
      </div>

      {error && <div className="room-error">{error}</div>}

      <button
        onClick={
          room.type === 'public'
            ? handleJoinPublic
            : () => setShowPasswordModal(true)
        }
        disabled={loading}
        className="join-btn"
      >
        {loading ? 'Joining...' : 'Join Room'}
      </button>

      {showPasswordModal && (
        <PasswordModal
          onClose={() => {
            setShowPasswordModal(false);
            setError('');
          }}
          onSubmit={handleJoinPrivate}
          loading={loading}
          error={error}
        />
      )}
    </div>
  );
}
