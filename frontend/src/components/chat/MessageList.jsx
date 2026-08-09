import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import './MessageList.css';

function MessageList({ messages, currentUserId }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (messages.length === 0) {
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
      {messages.map((msg) => {
        const senderId = msg.senderId?._id || msg.senderId;
        const isOwnMessage = senderId === currentUserId;
        const senderName = msg.senderId?.username || msg.username || 'Unknown';

        return (
          <MessageBubble
            key={msg._id}
            username={senderName}
            message={msg.message}
            timestamp={msg.timestamp}
            isOwnMessage={isOwnMessage}
          />
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;
