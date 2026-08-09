const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Room = require('../src/models/Room');
const User = require('../src/models/User');

// Connect to test database
const connectTestDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/realtime-chat-test';
  
  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✓ Test database connected');
  } catch (error) {
    console.error('✗ Test database connection failed:', error.message);
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
    await Room.deleteMany({});
    await User.deleteMany({});
  } catch (error) {
    console.error('Error cleaning collections:', error);
  }
};

describe('Room Model - Password Hashing and Verification Tests', () => {
  
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await cleanCollections();
  });

  test('Create private room with password - password is hashed and stored in passwordHash', async () => {
    // Create a test user
    const user = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hashed_password'
    });

    const plainPassword = 'SecurePassword123';

    // Create a private room with password
    const room = await Room.create({
      name: 'Private Test Room',
      description: 'A private room for testing',
      type: 'private',
      password: plainPassword,
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    // Verify the room was created
    expect(room).toBeDefined();
    expect(room.type).toBe('private');
    expect(room.passwordHash).toBeDefined();
    expect(room.passwordHash).not.toBeNull();
    
    console.log('✓ Private room created with password');
  });

  test('Password hash differs from plaintext password', async () => {
    // Create a test user
    const user = await User.create({
      username: 'hashtest',
      email: 'hashtest@example.com',
      passwordHash: 'hashed_password'
    });

    const plainPassword = 'MyPassword456';

    // Create a private room with password
    const room = await Room.create({
      name: 'Hash Test Room',
      description: 'Testing hash difference',
      type: 'private',
      password: plainPassword,
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    // Verify hash is different from plaintext
    expect(room.passwordHash).not.toBe(plainPassword);
    expect(room.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt hash pattern
    
    console.log('✓ Password hash is different from plaintext');
    console.log(`Plaintext: ${plainPassword}`);
    console.log(`Hash: ${room.passwordHash}`);
  });

  test('comparePassword returns true for correct password', async () => {
    // Create a test user
    const user = await User.create({
      username: 'correctpassword',
      email: 'correct@example.com',
      passwordHash: 'hashed_password'
    });

    const plainPassword = 'CorrectPassword789';

    // Create a private room with password
    const room = await Room.create({
      name: 'Correct Password Test',
      description: 'Testing correct password match',
      type: 'private',
      password: plainPassword,
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    // Test comparePassword with correct password
    const isMatch = await room.comparePassword(plainPassword);
    expect(isMatch).toBe(true);
    
    console.log('✓ comparePassword returns true for correct password');
  });

  test('comparePassword returns false for incorrect password', async () => {
    // Create a test user
    const user = await User.create({
      username: 'wrongpassword',
      email: 'wrong@example.com',
      passwordHash: 'hashed_password'
    });

    const plainPassword = 'CorrectPassword123';
    const wrongPassword = 'WrongPassword456';

    // Create a private room with password
    const room = await Room.create({
      name: 'Wrong Password Test',
      description: 'Testing wrong password rejection',
      type: 'private',
      password: plainPassword,
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    // Test comparePassword with wrong password
    const isMatch = await room.comparePassword(wrongPassword);
    expect(isMatch).toBe(false);
    
    console.log('✓ comparePassword returns false for incorrect password');
  });

  test('Public room does not hash password field', async () => {
    // Create a test user
    const user = await User.create({
      username: 'publicroom',
      email: 'public@example.com',
      passwordHash: 'hashed_password'
    });

    // Create a public room (password should not be processed)
    const room = await Room.create({
      name: 'Public Test Room',
      description: 'A public room',
      type: 'public',
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    // Verify public room has no passwordHash
    expect(room.passwordHash).toBeNull();
    
    console.log('✓ Public room does not have password hash');
  });

  test('Password field is undefined after save for private room', async () => {
    // Create a test user
    const user = await User.create({
      username: 'undefinedtest',
      email: 'undefined@example.com',
      passwordHash: 'hashed_password'
    });

    const plainPassword = 'TestPassword123';

    // Create a private room with password
    const room = await Room.create({
      name: 'Undefined Password Test',
      description: 'Testing password field is undefined',
      type: 'private',
      password: plainPassword,
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    // Verify password field is undefined
    expect(room.password).toBeUndefined();
    expect(room.passwordHash).toBeDefined();
    expect(room.passwordHash).not.toBeNull();
    
    console.log('✓ Password field is undefined after save');
  });

  test('comparePassword is a Promise', async () => {
    // Create a test user
    const user = await User.create({
      username: 'promisetest',
      email: 'promise@example.com',
      passwordHash: 'hashed_password'
    });

    const plainPassword = 'PromiseTestPassword';

    // Create a private room with password
    const room = await Room.create({
      name: 'Promise Test Room',
      description: 'Testing comparePassword returns Promise',
      type: 'private',
      password: plainPassword,
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    // Test that comparePassword returns a Promise
    const result = room.comparePassword(plainPassword);
    expect(result).toBeInstanceOf(Promise);
    
    const isMatch = await result;
    expect(isMatch).toBe(true);
    
    console.log('✓ comparePassword returns Promise');
  });

  test('Multiple private rooms have different password hashes', async () => {
    // Create test users
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

    const samePassword = 'SamePassword123';

    // Create two private rooms with the same password
    const room1 = await Room.create({
      name: 'Room 1',
      description: 'First room',
      type: 'private',
      password: samePassword,
      maxUsers: 10,
      createdBy: user1._id,
      members: [user1._id]
    });

    const room2 = await Room.create({
      name: 'Room 2',
      description: 'Second room',
      type: 'private',
      password: samePassword,
      maxUsers: 10,
      createdBy: user2._id,
      members: [user2._id]
    });

    // Verify the hashes are different even though passwords are the same
    // (because bcrypt uses random salt)
    expect(room1.passwordHash).not.toBe(room2.passwordHash);
    
    // But both should match the original password
    const match1 = await room1.comparePassword(samePassword);
    const match2 = await room2.comparePassword(samePassword);
    expect(match1).toBe(true);
    expect(match2).toBe(true);
    
    console.log('✓ Different bcrypt hashes generated for same password (due to random salt)');
  });

  test('Password hashing only occurs if password field is modified', async () => {
    // Create a test user
    const user = await User.create({
      username: 'modifytest',
      email: 'modify@example.com',
      passwordHash: 'hashed_password'
    });

    const plainPassword = 'InitialPassword123';

    // Create a private room with password
    const room = await Room.create({
      name: 'Modify Test Room',
      description: 'Testing modification detection',
      type: 'private',
      password: plainPassword,
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    const initialHash = room.passwordHash;

    // Save room again without modifying password
    room.description = 'Updated description';
    await room.save();

    // Hash should remain the same if password wasn't modified
    expect(room.passwordHash).toBe(initialHash);
    
    console.log('✓ Password not re-hashed when only other fields modified');
  });

  test('toJSON excludes passwordHash from serialization', async () => {
    // Create a test user
    const user = await User.create({
      username: 'jsontest',
      email: 'json@example.com',
      passwordHash: 'hashed_password'
    });

    const plainPassword = 'JsonTestPassword123';

    // Create a private room with password
    const room = await Room.create({
      name: 'JSON Test Room',
      description: 'Testing toJSON excludes passwordHash',
      type: 'private',
      password: plainPassword,
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    // Convert to JSON
    const roomJSON = room.toJSON();

    // Verify passwordHash is not in JSON
    expect(roomJSON).not.toHaveProperty('passwordHash');
    expect(roomJSON.name).toBe('JSON Test Room');
    expect(roomJSON.type).toBe('private');
    
    console.log('✓ toJSON excludes passwordHash from serialization');
  });

  test('Empty password is not hashed for private room', async () => {
    // Create a test user
    const user = await User.create({
      username: 'emptypassword',
      email: 'empty@example.com',
      passwordHash: 'hashed_password'
    });

    // Try to create a private room without password - should fail or have no hash
    const room = new Room({
      name: 'Empty Password Room',
      description: 'Testing empty password',
      type: 'private',
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
      // password field not set
    });

    await room.save();

    // Verify no passwordHash is set if password wasn't provided
    expect(room.passwordHash).toBeNull();
    
    console.log('✓ Empty password results in no hash');
  });

  test('Password hash can be verified after room retrieval from database', async () => {
    // Create a test user
    const user = await User.create({
      username: 'retrievaltest',
      email: 'retrieval@example.com',
      passwordHash: 'hashed_password'
    });

    const plainPassword = 'RetrievalTestPassword123';

    // Create and save a private room
    const room = await Room.create({
      name: 'Retrieval Test Room',
      description: 'Testing password verification after retrieval',
      type: 'private',
      password: plainPassword,
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    const roomId = room._id;

    // Retrieve room from database (need to select passwordHash since it's excluded by default)
    const retrievedRoom = await Room.findById(roomId).select('+passwordHash');

    // Verify password still works after retrieval
    const isMatch = await retrievedRoom.comparePassword(plainPassword);
    expect(isMatch).toBe(true);

    // Verify wrong password fails
    const isWrong = await retrievedRoom.comparePassword('WrongPassword');
    expect(isWrong).toBe(false);
    
    console.log('✓ Password verification works after database retrieval');
  });

  test('Special characters in password are handled correctly', async () => {
    // Create a test user
    const user = await User.create({
      username: 'specialchar',
      email: 'special@example.com',
      passwordHash: 'hashed_password'
    });

    const specialPassword = 'P@ssw0rd!#$%^&*()+[]{}';

    // Create a private room with special character password
    const room = await Room.create({
      name: 'Special Char Room',
      description: 'Testing special characters',
      type: 'private',
      password: specialPassword,
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    // Verify special character password works
    const isMatch = await room.comparePassword(specialPassword);
    expect(isMatch).toBe(true);

    // Verify similar password doesn't match
    const similarPassword = 'P@ssw0rd!#$%^&*()+[]{}!';
    const isSimilar = await room.comparePassword(similarPassword);
    expect(isSimilar).toBe(false);
    
    console.log('✓ Special characters in password handled correctly');
  });

  test('Case sensitivity in password is preserved', async () => {
    // Create a test user
    const user = await User.create({
      username: 'casetest',
      email: 'case@example.com',
      passwordHash: 'hashed_password'
    });

    const originalPassword = 'MyPassword123';

    // Create a private room with password
    const room = await Room.create({
      name: 'Case Test Room',
      description: 'Testing case sensitivity',
      type: 'private',
      password: originalPassword,
      maxUsers: 10,
      createdBy: user._id,
      members: [user._id]
    });

    // Verify exact case matches
    const isMatch = await room.comparePassword('MyPassword123');
    expect(isMatch).toBe(true);

    // Verify different case doesn't match
    const isDifferentCase = await room.comparePassword('mypassword123');
    expect(isDifferentCase).toBe(false);

    const isAllCaps = await room.comparePassword('MYPASSWORD123');
    expect(isAllCaps).toBe(false);
    
    console.log('✓ Password case sensitivity is preserved');
  });

});
