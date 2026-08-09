import { useState } from 'react';
import './Login.css';

function Login({ onJoin }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const trimmedUsername = username.trim();
    
    if (!trimmedUsername) {
      setError('Username cannot be empty');
      return;
    }

    if (trimmedUsername.length < 1 || trimmedUsername.length > 50) {
      setError('Username must be between 1 and 50 characters');
      return;
    }

    setError('');
    onJoin(trimmedUsername);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">💬 RealTime Chat</h1>
        <p className="login-subtitle">Join the conversation</p>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username" className="form-label">
              Enter your username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit(e);
                }
              }}
              placeholder="e.g., John, Alice, Yash"
              className="form-input"
              autoFocus
              maxLength="50"
            />
            {error && <div className="error-message">{error}</div>}
          </div>
          
          <button type="submit" className="btn-join">
            Join Chat
          </button>
        </form>

        <div className="login-footer">
          <p>Enter your name to start chatting in real-time</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
