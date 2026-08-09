const Message = require('../models/Message');
const User = require('../models/User');
const Room = require('../models/Room');

/**
 * Create a new message
 * POST /api/messages
 * Supports both room-based and legacy global messages
 */
const createMessage = async (req, res) => {
  try {
    const { message, roomId } = req.body;
    const userId = req.user.userId; // From authenticated middleware

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate input
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required and cannot be empty'
      });
    }

    // If roomId provided, validate room access
    if (roomId) {
      // Validate roomId format
      if (!roomId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'RoomId is required and must be valid'
        });
      }

      const room = await Room.findById(roomId);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }

      // Check if user is a member
      if (!room.members.includes(userId)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden'
        });
      }
    }

    // Create and save the message
    const newMessage = new Message({
      senderId: userId,
      username: user.username,
      message: message.trim(),
      roomId: roomId || null,
      timestamp: new Date()
    });

    const savedMessage = await newMessage.save();
    const populatedMessage = await savedMessage.populate('senderId', 'id username');

    res.status(201).json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create message'
    });
  }
};

/**
 * Get all messages (legacy - for backward compatibility)
 * GET /api/messages
 * Only returns messages without roomId (global chat messages)
 */
const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({ roomId: null }).sort({ timestamp: 1 });

    res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
};

/**
 * Get room message history
 * GET /api/rooms/:roomId/messages
 * Returns all messages for a specific room, ensuring user is a member
 * 
 * **Validates: Requirements 9.1-9.10**
 * - Validates Requirements 16.4: Backward compatibility for messages without roomId
 * - Ensures only messages with roomId are returned (legacy messages excluded)
 * - Verifies membership before returning messages
 */
const getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId; // From authenticated middleware

    // Validate roomId format
    if (!roomId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room ID format'
      });
    }

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Verify user is a member of the room
    if (!room.members.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden'
      });
    }

    // Query messages with roomId filter to ensure backward compatibility
    // This ensures messages without roomId (legacy messages) are NOT returned
    const messages = await Message.find({ 
      roomId: roomId
    })
      .populate('senderId', 'id username')
      .sort({ timestamp: 1 });

    res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Error fetching room messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room messages'
    });
  }
};

module.exports = {
  createMessage,
  getMessages,
  getRoomMessages
};
