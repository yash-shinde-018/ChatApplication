const Room = require('../models/Room');
const User = require('../models/User');
const Message = require('../models/Message');

// Create public or private room
exports.createRoom = async (req, res) => {
  try {
    const { name, description, type, maxUsers, password } = req.body;
    const userId = req.user.userId;

    // Validation
    if (!name || !type || !maxUsers) {
      return res.status(400).json({
        success: false,
        message: 'name, type, and maxUsers are required'
      });
    }

    if (type !== 'public' && type !== 'private') {
      return res.status(400).json({
        success: false,
        message: 'type must be "public" or "private"'
      });
    }

    if (maxUsers < 2 || maxUsers > 500) {
      return res.status(400).json({
        success: false,
        message: 'maxUsers must be between 2 and 500'
      });
    }

    if (type === 'private' && !password) {
      return res.status(400).json({
        success: false,
        message: 'password is required for private rooms'
      });
    }

    if (type === 'public' && password) {
      return res.status(400).json({
        success: false,
        message: 'password should not be provided for public rooms'
      });
    }

    if (password && password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'password must be at least 6 characters'
      });
    }

    // Create room
    const roomData = {
      name,
      description: description || '',
      type,
      maxUsers,
      createdBy: userId,
      members: [userId], // Add creator to members
      password: type === 'private' ? password : undefined
    };

    const room = new Room(roomData);
    await room.save();

    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: {
        room: room.toSafeJSON()
      }
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating room',
      error: error.message
    });
  }
};

// List available rooms
exports.listRooms = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find all public rooms AND all private rooms (visible to everyone, but access controlled by password)
    const rooms = await Room.find()
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    // Add member count to each room
    const roomsWithCount = rooms.map(room => {
      const obj = room.toObject();
      obj.memberCount = room.members.length;
      delete obj.passwordHash;
      return obj;
    });

    res.status(200).json({
      success: true,
      data: {
        rooms: roomsWithCount
      }
    });
  } catch (error) {
    console.error('List rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching rooms'
    });
  }
};

// Get room details
exports.getRoomDetails = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    const room = await Room.findById(roomId).populate('members', 'id username');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Allow viewing room details for both public and private rooms
    // Access control is enforced at message fetch time, not here
    const isUserMember = room.members.some(m => m._id.toString() === userId);

    const response = {
      _id: room._id,
      name: room.name,
      description: room.description,
      type: room.type,
      maxUsers: room.maxUsers,
      memberCount: room.members.length,
      members: room.members,
      createdBy: room.createdBy,
      isUserMember,
      createdAt: room.createdAt
    };

    res.status(200).json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Get room details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching room details'
    });
  }
};

// Join public room
exports.joinPublicRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (room.type !== 'public') {
      return res.status(403).json({
        success: false,
        message: 'This is not a public room'
      });
    }

    // Check if user is already a member
    if (room.members.includes(userId)) {
      return res.status(409).json({
        success: false,
        message: 'Already a member of this room'
      });
    }

    // Check capacity
    if (room.members.length >= room.maxUsers) {
      return res.status(409).json({
        success: false,
        message: 'Room is full'
      });
    }

    // Add user to members
    room.members.push(userId);
    await room.save();

    res.status(200).json({
      success: true,
      message: 'Joined room successfully',
      data: {
        room: room.toSafeJSON()
      }
    });
  } catch (error) {
    console.error('Join public room error:', error);
    res.status(500).json({
      success: false,
      message: 'Error joining room'
    });
  }
};

// Join private room
exports.joinPrivateRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { password } = req.body;
    const userId = req.user.userId;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Use select to include passwordHash for comparison
    const room = await Room.findById(roomId).select('+passwordHash');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (room.type !== 'private') {
      return res.status(403).json({
        success: false,
        message: 'Use public join endpoint for public rooms'
      });
    }

    // Check password
    const isPasswordCorrect = await room.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Check if user is already a member
    if (room.members.includes(userId)) {
      return res.status(409).json({
        success: false,
        message: 'Already a member of this room'
      });
    }

    // Check capacity
    if (room.members.length >= room.maxUsers) {
      return res.status(409).json({
        success: false,
        message: 'Room is full'
      });
    }

    // Add user to members
    room.members.push(userId);
    await room.save();

    res.status(200).json({
      success: true,
      message: 'Joined room successfully',
      data: {
        room: room.toSafeJSON()
      }
    });
  } catch (error) {
    console.error('Join private room error:', error);
    res.status(500).json({
      success: false,
      message: 'Error joining room'
    });
  }
};

// Leave room
exports.leaveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is a member
    if (!room.members.includes(userId)) {
      return res.status(409).json({
        success: false,
        message: 'Not a member of this room'
      });
    }

    // Remove user from members
    room.members = room.members.filter(memberId => memberId.toString() !== userId);
    await room.save();

    res.status(200).json({
      success: true,
      message: 'Left room successfully'
    });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({
      success: false,
      message: 'Error leaving room'
    });
  }
};

// Delete room (only creator can delete)
exports.deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check if user is the creator
    if (room.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only room creator can delete the room'
      });
    }

    // Delete all messages in this room
    await Message.deleteMany({ roomId });

    // Delete the room
    await Room.findByIdAndDelete(roomId);

    res.status(200).json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting room'
    });
  }
};

// Get room messages
exports.getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId;

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

    // Fetch messages for this room
    const messages = await Message.find({ roomId })
      .populate('senderId', 'id username')
      .sort({ timestamp: 1 });

    res.status(200).json({
      success: true,
      data: {
        messages
      }
    });
  } catch (error) {
    console.error('Get room messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching messages'
    });
  }
};
