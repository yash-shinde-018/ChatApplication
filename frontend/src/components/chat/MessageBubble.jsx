import './MessageBubble.css';

function MessageBubble({ username, message, timestamp, isOwnMessage }) {
  const formatTime = (date) => {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return '';
    }
    
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div className={`message-bubble ${isOwnMessage ? 'own' : 'other'}`}>
      {!isOwnMessage && (
        <div className="message-username">{username}</div>
      )}
      <div className="message-content">
        <div className="message-text">{message}</div>
        <div className="message-time">{formatTime(timestamp)}</div>
      </div>
    </div>
  );
}

export default MessageBubble;
