const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      minlength: [3, 'Room name must be at least 3 characters'],
      maxlength: [50, 'Room name must not exceed 50 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Room description must not exceed 500 characters'],
      default: ''
    },
    type: {
      type: String,
      enum: ['public', 'private'],
      required: [true, 'Room type is required']
    },
    password: {
      type: String,
      default: undefined,
      select: false // Don't include in queries by default
    },
    passwordHash: {
      type: String,
      default: null,
      select: false // Don't include in queries by default
    },
    maxUsers: {
      type: Number,
      required: [true, 'Maximum users is required'],
      min: [2, 'Maximum users must be at least 2'],
      max: [500, 'Maximum users must not exceed 500']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required']
    },
    members: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'User',
      default: []
    }
  },
  { timestamps: true }
);

// Index for performance
roomSchema.index({ name: 1 });
roomSchema.index({ createdBy: 1 });
roomSchema.index({ type: 1 });
roomSchema.index({ createdAt: -1 });
roomSchema.index({ members: 1 }); // For efficient membership queries

// Hash password before saving if private room
roomSchema.pre('save', async function (next) {
  // Ensure createdBy is in members array
  if (!this.members.includes(this.createdBy)) {
    this.members.push(this.createdBy);
  }

  // Validate members count doesn't exceed maxUsers
  if (this.members.length > this.maxUsers) {
    return next(new Error(`Members count (${this.members.length}) cannot exceed maxUsers (${this.maxUsers})`));
  }

  if (this.type === 'private' && this.isModified('password')) {
    try {
      const hashedPassword = await bcrypt.hash(this.password, 10);
      this.passwordHash = hashedPassword;
      this.password = undefined;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Method to verify password
roomSchema.methods.verifyPassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Alias for backward compatibility
roomSchema.methods.comparePassword = roomSchema.methods.verifyPassword;

// Method to get safe JSON (exclude passwordHash)
roomSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

// Override toJSON to automatically exclude passwordHash
roomSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

// Static method for finding rooms with membership filter
roomSchema.statics.findAvailableRooms = async function (userId) {
  return await this.find({
    $or: [
      { type: 'public' },
      { type: 'private', members: userId }
    ]
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Room', roomSchema);
