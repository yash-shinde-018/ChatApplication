import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './CreateRoomModal.css';

export default function CreateRoomModal({ onClose, onRoomCreated }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'public',
    maxUsers: 20,
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'maxUsers' ? parseInt(value, 10) : value
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Room name is required');
      return false;
    }
    if (formData.name.trim().length < 3 || formData.name.trim().length > 50) {
      setError('Room name must be 3-50 characters');
      return false;
    }
    if (formData.maxUsers < 2 || formData.maxUsers > 500) {
      setError('Maximum users must be 2-500');
      return false;
    }
    if (formData.type === 'private' && !formData.password) {
      setError('Password is required for private rooms');
      return false;
    }
    if (formData.type === 'private' && formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        maxUsers: formData.maxUsers
      };

      if (formData.type === 'private') {
        payload.password = formData.password;
      }

      const response = await api.post('/api/rooms', payload);
      const newRoomId = response.data?.room?._id;
      
      onClose(); // Close modal
      onRoomCreated(); // Refresh room list
      
      // Auto-redirect to the newly created room chat
      if (newRoomId) {
        setTimeout(() => {
          navigate(`/chat/${newRoomId}`);
        }, 300);
      }
    } catch (err) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Create New Room</h2>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="create-room-form">
          <div className="form-group">
            <label htmlFor="name">Room Name *</label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter room name"
              maxLength={50}
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter room description (optional)"
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="type">Room Type *</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="type"
                  value="public"
                  checked={formData.type === 'public'}
                  onChange={handleChange}
                />
                <span>Public</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="type"
                  value="private"
                  checked={formData.type === 'private'}
                  onChange={handleChange}
                />
                <span>Private</span>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="maxUsers">Maximum Users *</label>
            <input
              id="maxUsers"
              type="number"
              name="maxUsers"
              value={formData.maxUsers}
              onChange={handleChange}
              min={2}
              max={500}
            />
          </div>

          {formData.type === 'private' && (
            <div className="form-group">
              <label htmlFor="password">Room Password *</label>
              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter room password"
                minLength={6}
              />
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn-cancel"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-create"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
