import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import socketManager from '../../services/socket';
import ChatHeader from '../ChatHeader';
import MessageList from '../MessageList';
import MessageInput from '../MessageInput';
import '../Chat.css';

export default function Chat() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  // Fetch room and messages on mount
  useEffect(() => {
    const fetchRoomAndMessages = async () => {
      try {
        setLoading(true);
        setError('');

        // Fetch room details
        const roomResponse = await api.get(`/api/rooms/${roomId}`);
        setRoom(roomResponse.data);

        // Fetch messages
        const messagesResponse = await api.get(`/api/rooms/${roomId}/messages`);
        setMessages(Array.isArray(messagesResponse.data) ? messagesResponse.data : messagesResponse.data?.messages || []);
      } catch (err) {
        if (err.status === 401) {
          logout();
          navigate('/login');
        } else if (err.status === 403) {
          setError('You are not a member of this room');
          navigate('/dashboard');
        } else {
          setError(err.message || 'Failed to load room data');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRoomAndMessages();
  }, [roomId, navigate, logout]);

  // Initialize Socket.io and join room
  useEffect(() => {
    if (!roomId || !user || !token) return;

    try {
      // Initialize socket with token
      const socket = socketManager.initialize(token);
      
      if (!socket) {
        setError('Failed to initialize socket connection');
        return;
      }

      // Join Socket.io room
      socket.emit('room:join', { roomId }, (response) => {
        if (response?.error) {
          setError(response.error);
        }
      });

      // Set connected status
      const handleConnect = () => {
        setConnected(true);
      };

      const handleDisconnect = () => {
        setConnected(false);
      };

      // Listen for new messages
      const handleMessageReceive = (message) => {
        // Only add if this message is for current room
        if (message.roomId === roomId) {
          setMessages(prev => {
            // Avoid duplicates
            const exists = prev.some(m => m._id === message._id);
            if (exists) return prev;
            return [...prev, message];
          });
        }
      };

      // Listen for room events
      const handleRoomJoined = () => {
        // Optionally refresh room member count
      };

      const handleRoomLeft = () => {
        // Optionally refresh room member count
      };

      // Listen for errors
      const handleSocketError = (error) => {
        setError(error.message || 'Socket error');
      };

      // Listen for room deletion
      const handleRoomDeleted = () => {
        navigate('/dashboard');
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('message:receive', handleMessageReceive);
      socket.on('room:joined', handleRoomJoined);
      socket.on('room:left', handleRoomLeft);
      socket.on('room:deleted', handleRoomDeleted);
      socket.on('socket:error', handleSocketError);

      // Set initial connected state - check if already connected
      if (socket.connected) {
        setConnected(true);
      } else {
        setConnected(false);
      }

      return () => {
        // Leave room when component unmounts
        socket.emit('room:leave', { roomId });
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('message:receive', handleMessageReceive);
        socket.off('room:joined', handleRoomJoined);
        socket.off('room:left', handleRoomLeft);
        socket.off('room:deleted', handleRoomDeleted);
        socket.off('socket:error', handleSocketError);
      };
    } catch (err) {
      console.error('Socket initialization error:', err);
      setError('Failed to connect to chat');
    }
  }, [roomId, user, token, navigate]);

  const handleSendMessage = async (messageText) => {
    if (!messageText.trim()) return;

    try {
      const socket = socketManager.get();
      
      // Send via Socket.io for real-time (Socket handles both real-time AND persistence)
      socket?.emit('message:send', {
        message: messageText.trim(),
        roomId
      });
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    }
  };

  const handleLeaveRoom = async () => {
    try {
      await api.post(`/api/rooms/${roomId}/leave`, {});
      const socket = socketManager.get();
      socket?.emit('room:leave', { roomId });
      navigate('/dashboard');
    } catch {
      setError('Failed to leave room');
    }
  };

  const handleDeleteRoom = async () => {
    if (!window.confirm('Are you sure you want to end this room? All messages will be deleted and all members will be removed.')) {
      return;
    }

    try {
      await api.delete(`/api/rooms/${roomId}`);
      const socket = socketManager.get();
      socket?.emit('room:delete', { roomId });
      navigate('/dashboard');
    } catch (err) {
      console.error('Delete room error:', err);
      setError('Failed to delete room');
    }
  };

  if (loading) {
    return (
      <div className="chat-container">
        <div className="loading-state">Loading room...</div>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="chat-container">
        <div className="error-state">{error}</div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <ChatHeader
        room={room}
        isConnected={connected}
        onLeave={handleLeaveRoom}
        onDeleteRoom={handleDeleteRoom}
        isCreator={room && user && String(room.createdBy) === String(user.id || user._id)}
      />

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

      <MessageList messages={messages} currentUserId={user?.id || user?._id} />

      <MessageInput
        onSendMessage={handleSendMessage}
        username={user?.username}
      />
    </div>
  );
}
