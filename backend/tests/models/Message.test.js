const mongoose = require('mongoose');
require('dotenv').config();
const Message = require('../../src/models/Message');

describe('Message Model', () => {
  beforeAll(async () => {
    const mongodb_uri = process.env.MONGODB_URI;
    if (!mongodb_uri) {
      throw new Error('MONGODB_URI not configured in .env');
    }
    
    try {
      await mongoose.connect(mongodb_uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      });
    } catch (error) {
      console.error('MongoDB connection failed:', error.message);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Clean up: drop test messages
      await Message.deleteMany({});
      await mongoose.connection.close();
    } catch (error) {
      console.error('Cleanup error:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    // Clear messages before each test
    await Message.deleteMany({});
  });

  describe('Message Schema Validation', () => {
    it('should create a message with all required fields', async () => {
      const roomId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();
      
      const message = await Message.create({
        roomId,
        senderId,
        username: 'testuser',
        message: 'Hello, world!'
      });

      expect(message._id).toBeDefined();
      expect(message.roomId.toString()).toBe(roomId.toString());
      expect(message.senderId.toString()).toBe(senderId.toString());
      expect(message.username).toBe('testuser');
      expect(message.message).toBe('Hello, world!');
      expect(message.timestamp).toBeDefined();
    });

    it('should create a message without roomId (backward compatibility)', async () => {
      const message = await Message.create({
        username: 'legacyuser',
        message: 'Old message'
      });

      expect(message._id).toBeDefined();
      expect(message.roomId).toBeUndefined();
      expect(message.senderId).toBeUndefined();
      expect(message.username).toBe('legacyuser');
      expect(message.message).toBe('Old message');
    });

    it('should require username field', async () => {
      const roomId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();

      try {
        await Message.create({
          roomId,
          senderId,
          message: 'Test message'
        });
        fail('Should have thrown validation error for missing username');
      } catch (error) {
        expect(error.message).toContain('Username is required');
      }
    });

    it('should require message field', async () => {
      const roomId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();

      try {
        await Message.create({
          roomId,
          senderId,
          username: 'testuser'
        });
        fail('Should have thrown validation error for missing message');
      } catch (error) {
        expect(error.message).toContain('Message is required');
      }
    });

    it('should reject empty message string', async () => {
      const roomId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();

      try {
        await Message.create({
          roomId,
          senderId,
          username: 'testuser',
          message: ''
        });
        fail('Should have thrown validation error for empty message');
      } catch (error) {
        expect(error.message).toContain('Message cannot be empty');
      }
    });

    it('should reject message exceeding 500 characters', async () => {
      const roomId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();
      const longMessage = 'a'.repeat(501);

      try {
        await Message.create({
          roomId,
          senderId,
          username: 'testuser',
          message: longMessage
        });
        fail('Should have thrown validation error for message > 500 chars');
      } catch (error) {
        expect(error.message).toContain('Message must not exceed 500 characters');
      }
    });

    it('should accept message exactly 500 characters', async () => {
      const roomId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();
      const message500Chars = 'a'.repeat(500);

      const message = await Message.create({
        roomId,
        senderId,
        username: 'testuser',
        message: message500Chars
      });

      expect(message.message.length).toBe(500);
    });

    it('should trim whitespace from message and username', async () => {
      const roomId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();

      const message = await Message.create({
        roomId,
        senderId,
        username: '  testuser  ',
        message: '  Hello, world!  '
      });

      expect(message.username).toBe('testuser');
      expect(message.message).toBe('Hello, world!');
    });

    it('should have roomId as ObjectId reference to Room', async () => {
      const roomId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();

      const message = await Message.create({
        roomId,
        senderId,
        username: 'testuser',
        message: 'Test'
      });

      // Verify roomId is stored as ObjectId
      expect(mongoose.Types.ObjectId.isValid(message.roomId)).toBe(true);
      expect(message.roomId.constructor.name).toBe('ObjectId');
    });

    it('should have senderId as ObjectId reference to User', async () => {
      const roomId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();

      const message = await Message.create({
        roomId,
        senderId,
        username: 'testuser',
        message: 'Test'
      });

      // Verify senderId is stored as ObjectId
      expect(mongoose.Types.ObjectId.isValid(message.senderId)).toBe(true);
      expect(message.senderId.constructor.name).toBe('ObjectId');
    });

    it('should set default timestamp', async () => {
      const roomId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();
      const beforeCreation = new Date();

      const message = await Message.create({
        roomId,
        senderId,
        username: 'testuser',
        message: 'Test'
      });

      const afterCreation = new Date();

      expect(message.timestamp).toBeDefined();
      expect(message.timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(message.timestamp.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    it('should reject invalid ObjectId for roomId', async () => {
      const senderId = new mongoose.Types.ObjectId();

      try {
        await Message.create({
          roomId: 'invalid-id',
          senderId,
          username: 'testuser',
          message: 'Test'
        });
        fail('Should have thrown validation error for invalid roomId');
      } catch (error) {
        expect(error.message).toContain('valid');
      }
    });

    it('should reject invalid ObjectId for senderId', async () => {
      const roomId = new mongoose.Types.ObjectId();

      try {
        await Message.create({
          roomId,
          senderId: 'invalid-id',
          username: 'testuser',
          message: 'Test'
        });
        fail('Should have thrown validation error for invalid senderId');
      } catch (error) {
        expect(error.message).toContain('valid');
      }
    });
  });

  describe('Composite Index', () => {
    it('should have composite index on roomId and timestamp', async () => {
      const indexes = await Message.collection.getIndexes();
      
      // Check if composite index exists
      const compositeIndexExists = Object.values(indexes).some(index => {
        return (index.key && 
                index.key[0] && 
                index.key[0][0] === 'roomId' && 
                index.key[1] && 
                index.key[1][0] === 'timestamp');
      });

      expect(compositeIndexExists).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should query messages excluding those without roomId', async () => {
      const roomId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();

      // Create new-style message with roomId
      await Message.create({
        roomId,
        senderId,
        username: 'newuser',
        message: 'New message'
      });

      // Create old-style message without roomId (legacy)
      await Message.create({
        username: 'legacyuser',
        message: 'Old message'
      });

      // Query with roomId filter (should exclude legacy messages)
      const messages = await Message.find({ roomId: { $exists: true } });

      expect(messages.length).toBe(1);
      expect(messages[0].roomId.toString()).toBe(roomId.toString());
      expect(messages[0].username).toBe('newuser');
    });

    it('should find all messages when not filtering by roomId', async () => {
      const roomId = new mongoose.Types.ObjectId();
      const senderId = new mongoose.Types.ObjectId();

      // Create new-style message
      await Message.create({
        roomId,
        senderId,
        username: 'newuser',
        message: 'New message'
      });

      // Create old-style message
      await Message.create({
        username: 'legacyuser',
        message: 'Old message'
      });

      // Query all messages
      const messages = await Message.find({});

      expect(messages.length).toBe(2);
    });
  });
});
