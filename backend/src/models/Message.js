const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: false // Backward compatible - old messages might not have roomId
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false // Backward compatible - older messages might not have senderId
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      minlength: [1, 'Username cannot be empty']
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      minlength: [1, 'Message cannot be empty'],
      maxlength: [500, 'Message must not exceed 500 characters']
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

// Index for room-specific message queries
messageSchema.index({ roomId: 1, timestamp: -1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
