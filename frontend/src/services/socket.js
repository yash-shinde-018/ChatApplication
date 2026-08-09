import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

/**
 * Initialize Socket.io connection with JWT authentication
 * @param {string} token - JWT token for authentication
 */
export const initializeSocket = (token) => {
  if (socket) {
    return socket;
  }

  if (!token) {
    return null;
  }

  socket = io(SOCKET_URL, {
    auth: {
      token,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
  });

  socket.on('disconnect', () => {
  });

  socket.on('error', () => {
  });

  socket.on('connect_error', () => {
  });

  return socket;
};

/**
 * Get the socket instance
 */
export const getSocket = () => {
  return socket;
};

/**
 * Emit message:send event
 * @param {string} message - The message content
 * @param {string} roomId - The room ID
 */
export const sendSocketMessage = (message, roomId) => {
  const s = getSocket();
  if (!s) {
    return;
  }
  
  s.emit('message:send', {
    message,
    roomId,
  });
};

/**
 * Listen for message:receive event
 * @param {Function} callback - Function to call when a message is received
 */
export const onMessageReceive = (callback) => {
  const s = getSocket();
  if (!s) {
    return;
  }
  
  s.on('message:receive', callback);
};

/**
 * Check if socket is connected
 */
export const isSocketConnected = () => {
  return socket && socket.connected;
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Default export - socket instance manager
 */
const socketManager = {
  initialize: initializeSocket,
  get: getSocket,
  send: sendSocketMessage,
  onMessage: onMessageReceive,
  isConnected: isSocketConnected,
  disconnect: disconnectSocket,
  emit: (event, data) => socket?.emit(event, data),
  on: (event, callback) => socket?.on(event, callback),
  off: (event, callback) => socket?.off(event, callback),
};

export default socketManager;
