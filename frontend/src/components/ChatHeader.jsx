import './ChatHeader.css';

function ChatHeader({ room, isConnected, onLeave, onDeleteRoom, isCreator }) {
  if (!room) return null;

  return (
    <header className="chat-header">
      <div className="header-title">
        {onLeave && (
          <button onClick={onLeave} className="back-btn">
            ← Back
          </button>
        )}
        <div className="room-context">
          <h1>💬 {room.name}</h1>
          {room.description && <p className="room-desc">{room.description}</p>}
        </div>
      </div>
      
      <div className="header-info">
        <div className="header-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '●' : '○'}
          </span>
          <span className="status-text">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        <div className="header-capacity">
          👥 {room.memberCount} / {room.maxUsers}
        </div>

        {isCreator && (
          <button className="btn-delete-room" onClick={onDeleteRoom} title="End Room">
            🗑️ End Room
          </button>
        )}

        <button className="btn-logout" onClick={onLeave} title="Leave Room">
          Exit
        </button>
      </div>
    </header>
  );
}

export default ChatHeader;
