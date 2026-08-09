const mongoose = require('mongoose');
const Message = require('../src/models/Message');
const Room = require('../src/models/Room');
const User = require('../src/models/User');

// Connect to test database
const connectTestDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/realtime-chat-test';
  
  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });
    console.log('✓ Test database connected');
  } catch (error) {
    console.error('✗ Test database connection failed:', error.message);
    console.error('Please ensure MongoDB Atlas connection is available or MongoDB is running locally');
    process.exit(1);
  }
};

// Disconnect from test database
const disconnectTestDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('✓ Test database disconnected');
  } catch (error) {
    console.error('✗ Test database disconnection failed:', error.message);
  }
};

// Clean collections
const cleanCollections = async () => {
  try {
    await Message.deleteMany({});
    await Room.deleteMany({});
    await User.deleteMany({});
  } catch (error) {
    console.error('Error cleaning collections:', error);
  }
};

describe('Message Model - Composite Index Tests', () => {
  
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await cleanCollections();
  });

  test('Composite index (roomId, timestamp) is created on Message collection', async () => {
    // Get all indexes on the messages collection
    const indexes = await Message.collection.getIndexes();
    
    // Check if composite index exists
    const hasCompositeIndex = Object.values(indexes).some(index => {
      const keys = Object.keys(index.key || {});
      return keys.length === 2 && 
             'roomId' in index.key && 
             'timestamp' in index.key &&
             index.key.roomId === 1 &&
             index.key.timestamp === -1;
    });

    expect(hasCompositeIndex).toBe(true);
    console.log('✓ Composite index verified');
  });

  test('Query by roomId uses composite index efficiently', async () => {
    // Create test user and room
    const user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hashed_password'
    });

    const room = await Room.create({
      name: 'Test Room',
      description: 'Test Description',
      type: 'public',
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    // Create multiple messages for the room
    const messages = [];
    for (let i = 0; i < 10; i++) {
      messages.push({
        roomId: room._id,
        senderId: user._id,
        username: user.username,
        message: `Test message ${i}`,
        timestamp: new Date(Date.now() - i * 1000) // Different timestamps
      });
    }

    await Message.insertMany(messages);

    // Query messages by roomId and check explain plan
    const explainResult = await Message.find({ roomId: room._id })
      .sort({ timestamp: -1 })
      .explain('executionStats');

    // Check if index was used (executionStats shows index usage)
    const executionStats = explainResult.executionStats;
    const isIndexUsed = executionStats.executionStages.stage !== 'COLLSCAN';

    expect(isIndexUsed).toBe(true);
    console.log('✓ Query uses composite index');
    console.log(`Execution Stage: ${executionStats.executionStages.stage}`);
    console.log(`Documents Examined: ${executionStats.totalDocsExamined}`);
  });

  test('Query by roomId returns messages ordered by timestamp descending', async () => {
    // Create test data
    const user = await User.create({
      username: 'testuser2',
      email: 'test2@example.com',
      passwordHash: 'hashed_password'
    });

    const room = await Room.create({
      name: 'Test Room 2',
      description: 'Test Description 2',
      type: 'public',
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    // Create messages with different timestamps
    const now = Date.now();
    await Message.create({
      roomId: room._id,
      senderId: user._id,
      username: user.username,
      message: 'First message',
      timestamp: new Date(now - 2000)
    });

    await Message.create({
      roomId: room._id,
      senderId: user._id,
      username: user.username,
      message: 'Second message',
      timestamp: new Date(now - 1000)
    });

    await Message.create({
      roomId: room._id,
      senderId: user._id,
      username: user.username,
      message: 'Third message',
      timestamp: new Date(now)
    });

    // Query messages
    const result = await Message.find({ roomId: room._id })
      .sort({ timestamp: -1 });

    expect(result.length).toBe(3);
    expect(result[0].message).toBe('Third message');
    expect(result[1].message).toBe('Second message');
    expect(result[2].message).toBe('First message');
    console.log('✓ Messages returned in correct order (newest first)');
  });

  test('Performance: 10K messages query by roomId returns < 100ms', async () => {
    // Create test data
    const user = await User.create({
      username: 'perftest',
      email: 'perf@example.com',
      passwordHash: 'hashed_password'
    });

    const room = await Room.create({
      name: 'Performance Test Room',
      description: 'Test Description',
      type: 'public',
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    // Create 10,000 messages
    console.log('Creating 10,000 test messages...');
    const messages = [];
    const baseTime = Date.now();
    for (let i = 0; i < 10000; i++) {
      messages.push({
        roomId: room._id,
        senderId: user._id,
        username: user.username,
        message: `Performance test message ${i}`,
        timestamp: new Date(baseTime - (i * 1000))
      });
    }

    await Message.insertMany(messages);
    console.log('✓ 10,000 messages created');

    // Measure query time
    const startTime = performance.now();
    const result = await Message.find({ roomId: room._id })
      .sort({ timestamp: -1 });
    const endTime = performance.now();

    const queryTime = endTime - startTime;
    console.log(`Query time: ${queryTime.toFixed(2)}ms`);
    console.log(`Documents returned: ${result.length}`);

    // Assert query completes within 100ms
    expect(queryTime).toBeLessThan(100);
    expect(result.length).toBe(10000);
    console.log('✓ Performance test passed: < 100ms');
  });

  test('Cross-room message isolation: queries do not return messages from other rooms', async () => {
    // Create two users and rooms
    const user1 = await User.create({
      username: 'user1',
      email: 'user1@example.com',
      passwordHash: 'hashed_password'
    });

    const user2 = await User.create({
      username: 'user2',
      email: 'user2@example.com',
      passwordHash: 'hashed_password'
    });

    const room1 = await Room.create({
      name: 'Room 1',
      description: 'Test Room 1',
      type: 'public',
      maxUsers: 10,
      createdBy: user1._id,
      members: [user1._id]
    });

    const room2 = await Room.create({
      name: 'Room 2',
      description: 'Test Room 2',
      type: 'public',
      maxUsers: 10,
      createdBy: user2._id,
      members: [user2._id]
    });

    // Create messages for both rooms
    await Message.create({
      roomId: room1._id,
      senderId: user1._id,
      username: user1.username,
      message: 'Room 1 message',
      timestamp: new Date()
    });

    await Message.create({
      roomId: room2._id,
      senderId: user2._id,
      username: user2.username,
      message: 'Room 2 message',
      timestamp: new Date()
    });

    // Query for room1 messages
    const room1Messages = await Message.find({ roomId: room1._id });
    expect(room1Messages.length).toBe(1);
    expect(room1Messages[0].message).toBe('Room 1 message');
    expect(room1Messages[0].roomId.toString()).toBe(room1._id.toString());

    // Query for room2 messages
    const room2Messages = await Message.find({ roomId: room2._id });
    expect(room2Messages.length).toBe(1);
    expect(room2Messages[0].message).toBe('Room 2 message');
    expect(room2Messages[0].roomId.toString()).toBe(room2._id.toString());

    console.log('✓ Messages properly isolated by roomId');
  });

  test('Backward compatibility: old messages without roomId are not returned in room-specific queries', async () => {
    // Create test data
    const user = await User.create({
      username: 'legacy',
      email: 'legacy@example.com',
      passwordHash: 'hashed_password'
    });

    const room = await Room.create({
      name: 'Legacy Test Room',
      description: 'Test Description',
      type: 'public',
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    // Create a new message with roomId
    await Message.create({
      roomId: room._id,
      senderId: user._id,
      username: user.username,
      message: 'New message with roomId',
      timestamp: new Date()
    });

    // Create a legacy message without roomId (simulating old data)
    await Message.create({
      username: user.username,
      message: 'Legacy message without roomId',
      timestamp: new Date()
    });

    // Query messages for specific room
    const roomMessages = await Message.find({ roomId: room._id });
    
    expect(roomMessages.length).toBe(1);
    expect(roomMessages[0].message).toBe('New message with roomId');
    expect(roomMessages[0].roomId).toBeDefined();
    console.log('✓ Room-specific queries correctly exclude legacy messages');
  });
});
