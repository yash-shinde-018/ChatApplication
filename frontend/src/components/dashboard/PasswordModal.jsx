import React, { useState } from 'react';
import './PasswordModal.css';

export default function PasswordModal({ onClose, onSubmit, loading, error }) {
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(password);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content password-modal">
        <div className="modal-header">
          <h2>Enter Room Password</h2>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="password-form">
          <div className="form-group">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              disabled={loading}
            />
          </div>

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
              className="btn-join"
              disabled={loading || !password}
            >
              {loading ? 'Joining...' : 'Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
