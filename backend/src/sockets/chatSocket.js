const Message = require('../models/Message');
const User = require('../models/User');
const Room = require('../models/Room');

/**
 * Initialize Socket.io event handlers for real-time messaging
 * @param {Object} io - Socket.io instance
 */
const initializeChatSocket = (io) => {
  io.on('connection', (socket) => {
    // ... rest of handler ...

    /**
     * Handle room join
     * Event: room:join
     * Payload: { roomId: string }
     */
    socket.on('room:join', async (data) => {
      try {
        if (!data || !data.roomId) {
          socket.emit('socket:error', { message: 'roomId is required' });
          return;
        }

        const { roomId } = data;
        const room = await Room.findById(roomId);

        if (!room) {
          socket.emit('socket:error', { message: 'Room not found' });
          return;
        }

        // Check if user is a member
        if (!room.members.includes(socket.userId)) {
          socket.emit('socket:error', { message: 'Not a member of this room' });
          return;
        }

        // Join Socket.io room
        socket.join(roomId);

        // Broadcast room:joined to room members
        io.to(roomId).emit('room:joined', {
          userId: socket.userId,
          roomId
        });
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('socket:error', { message: 'Error joining room' });
      }
    });

    /**
     * Handle room leave
     * Event: room:leave
     * Payload: { roomId: string }
     */
    socket.on('room:leave', async (data) => {
      try {
        if (!data || !data.roomId) {
          return;
        }

        const { roomId } = data;
        socket.leave(roomId);

        // Broadcast room:left to remaining room members
        io.to(roomId).emit('room:left', {
          userId: socket.userId,
          roomId
        });
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });

    /**
     * Handle incoming message from client
     * Event: message:send
     * Payload: { message: string, roomId: string }
     */
    socket.on('message:send', async (data) => {
      try {
        // Validate input
        if (!data || typeof data !== 'object') {
          socket.emit('socket:error', { message: 'Invalid message format' });
          return;
        }

        const { message, roomId } = data;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
          socket.emit('socket:error', { message: 'Message is required and cannot be empty' });
          return;
        }

        if (!roomId) {
          socket.emit('socket:error', { message: 'roomId is required' });
          return;
        }

        // Validate room and membership
        const room = await Room.findById(roomId);
        if (!room) {
          socket.emit('socket:error', { message: 'Room not found' });
          return;
        }

        if (!room.members.includes(socket.userId)) {
          socket.emit('socket:error', { message: 'Not a member of this room' });
          return;
        }

        // Get user from authenticated socket
        const user = await User.findById(socket.userId);
        if (!user) {
          socket.emit('socket:error', { message: 'User not found' });
          return;
        }

        // Create and save the message to MongoDB
        const newMessage = new Message({
          senderId: socket.userId,
          username: user.username,
          message: message.trim(),
          roomId,
          timestamp: new Date()
        });

        const savedMessage = await newMessage.save();
        const populatedMessage = await savedMessage.populate('senderId', 'id username');

        // Broadcast the saved message ONLY to the specific room
        io.to(roomId).emit('message:receive', {
          _id: populatedMessage._id,
          senderId: populatedMessage.senderId,
          username: populatedMessage.username,
          message: populatedMessage.message,
          roomId: populatedMessage.roomId,
          timestamp: populatedMessage.timestamp
        });
      } catch (error) {
        console.error('Error handling message:send event:', error);
        socket.emit('socket:error', { message: 'Failed to process message' });
      }
    });

    /**
     * Handle client disconnect
     */
    socket.on('disconnect', () => {
    });

    /**
     * Handle room deletion
     * Event: room:delete
     * Payload: { roomId: string }
     */
    socket.on('room:delete', async (data) => {
      try {
        if (!data || !data.roomId) {
          socket.emit('socket:error', { message: 'roomId is required' });
          return;
        }

        const { roomId } = data;
        
        // Broadcast room:deleted to all users in the room (including sender)
        io.to(roomId).emit('room:deleted', {
          roomId,
          message: 'Room has been deleted by the creator'
        });
      } catch (error) {
        console.error('Error handling room:delete event:', error);
        socket.emit('socket:error', { message: 'Failed to process room deletion' });
      }
    });

    /**
     * Handle socket errors
     */
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
};

module.exports = initializeChatSocket;
