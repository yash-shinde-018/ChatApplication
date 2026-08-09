require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/database');
const initializeChatSocket = require('./sockets/chatSocket');
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const roomRoutes = require('./routes/roomRoutes');

const app = express();
const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false
  },
  auth: {
    // Socket.io will use this to authenticate connections
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: '*', // Allow all origins in development
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request logging middleware - only log errors
app.use((req, res, next) => {
  // Log will happen in error handler if needed
  next();
});

// Health check endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Chat server is running'
  });
});

// Auth API routes
app.use('/api/auth', authRoutes);

// Message API routes (protected by auth middleware)
app.use('/api/messages', messageRoutes);

// Room API routes (protected by auth middleware)
app.use('/api/rooms', roomRoutes);

// Socket.io authentication middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('No token provided'));
    }

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (error) {
    console.error('Socket.io auth error:', error.message);
    next(new Error('Authentication failed'));
  }
});

// Initialize Socket.io chat handlers
initializeChatSocket(io);

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB first
    await connectDB();

    // Then start the HTTP server
    server.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };
