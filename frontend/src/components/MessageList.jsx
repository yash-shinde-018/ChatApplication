import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import './MessageList.css';

function MessageList({ messages, currentUsername, isLoading, isEmpty, error }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (isLoading) {
    return (
      <div className="message-list loading">
        <div className="loading-spinner"></div>
        <p>Loading messages...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="message-list error">
        <div className="error-icon">⚠️</div>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (isEmpty && messages.length === 0) {
    return (
      <div className="message-list empty">
        <div className="empty-icon">💬</div>
        <p className="empty-text">No messages yet</p>
        <p className="empty-subtitle">Start the conversation!</p>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((msg) => (
        <MessageBubble
          key={msg._id}
          username={msg.username}
          message={msg.message}
          timestamp={msg.timestamp}
          isOwnMessage={msg.username === currentUsername}
          currentUsername={currentUsername}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;
