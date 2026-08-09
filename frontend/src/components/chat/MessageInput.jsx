import { useState } from 'react';
import './MessageInput.css';

function MessageInput({ onSendMessage }) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const trimmedMessage = message.trim();
    
    if (!trimmedMessage) {
      return;
    }

    try {
      setIsSending(true);
      await onSendMessage(trimmedMessage);
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="message-input-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Type a message..."
        className="message-input"
        disabled={isSending}
        maxLength="500"
      />
      <button
        type="submit"
        className="btn-send"
        disabled={!message.trim() || isSending}
        title={!message.trim() ? 'Message cannot be empty' : 'Send message (Enter)'}
      >
        {isSending ? (
          <span className="sending-indicator">⟳</span>
        ) : (
          <span>Send</span>
        )}
      </button>
    </form>
  );
}

export default MessageInput;
