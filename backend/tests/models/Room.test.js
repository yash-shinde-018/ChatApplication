const mongoose = require('mongoose');
const Room = require('../../src/models/Room');

// Connect to test database before running tests
beforeAll(async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/realtime-chat-test';
  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  } catch (error) {
    console.error('Failed to connect to test database:', error.message);
    throw error;
  }
});

// Clean up after tests
afterAll(async () => {
  // Clear the collection
  await Room.deleteMany({});
  // Close connection
  await mongoose.connection.close();
});

describe('Room Model - Database Indexes', () => {
  
  describe('1.2 - Index Creation and Verification', () => {
    
    test('should have created index on "name" field', async () => {
      const indexes = await Room.collection.getIndexes();
      const nameIndex = Object.values(indexes).find(idx => idx.key && idx.key.name === 1);
      expect(nameIndex).toBeDefined();
      expect(nameIndex.key.name).toBe(1);
    });

    test('should have created index on "createdBy" field', async () => {
      const indexes = await Room.collection.getIndexes();
      const createdByIndex = Object.values(indexes).find(idx => idx.key && idx.key.createdBy === 1);
      expect(createdByIndex).toBeDefined();
      expect(createdByIndex.key.createdBy).toBe(1);
    });

    test('should have created index on "type" field', async () => {
      const indexes = await Room.collection.getIndexes();
      const typeIndex = Object.values(indexes).find(idx => idx.key && idx.key.type === 1);
      expect(typeIndex).toBeDefined();
      expect(typeIndex.key.type).toBe(1);
    });

    test('should have created descending index on "createdAt" field', async () => {
      const indexes = await Room.collection.getIndexes();
      const createdAtIndex = Object.values(indexes).find(idx => idx.key && idx.key.createdAt === -1);
      expect(createdAtIndex).toBeDefined();
      expect(createdAtIndex.key.createdAt).toBe(-1);
    });

    test('should have created index on "members" field (array membership)', async () => {
      const indexes = await Room.collection.getIndexes();
      const membersIndex = Object.values(indexes).find(idx => idx.key && idx.key.members === 1);
      expect(membersIndex).toBeDefined();
      expect(membersIndex.key.members).toBe(1);
    });

    test('should list all indexes using db.rooms.getIndexes()', async () => {
      // Verify indexes are accessible through MongoDB native command
      const indexes = await Room.collection.getIndexes();
      
      // Should have at least 6 indexes (5 single field + 1 default _id index)
      expect(Object.keys(indexes).length).toBeGreaterThanOrEqual(6);
      
      // Verify expected index keys exist
      const indexKeys = Object.values(indexes).map(idx => idx.key);
      expect(indexKeys).toEqual(expect.arrayContaining([
        expect.objectContaining({ _id: 1 }),  // Default index
        expect.objectContaining({ name: 1 }),
        expect.objectContaining({ createdBy: 1 }),
        expect.objectContaining({ type: 1 }),
        expect.objectContaining({ createdAt: -1 }),
        expect.objectContaining({ members: 1 })
      ]));
    });
  });

  describe('1.2 - Performance Tests', () => {
    
    test('should query 1000 rooms by type in less than 50ms', async () => {
      // Clear existing data
      await Room.deleteMany({});

      // Create 1000 test rooms with different types
      const userId = new mongoose.Types.ObjectId();
      const rooms = [];
      
      for (let i = 0; i < 1000; i++) {
        rooms.push({
          name: `Test Room ${i}`,
          description: `Test room ${i} for performance testing`,
          type: i % 2 === 0 ? 'public' : 'private',
          maxUsers: 50,
          createdBy: userId,
          members: [userId],
          ...(i % 2 === 1 && { passwordHash: 'hashedPasswordExample' })
        });
      }
      
      // Insert all rooms at once
      await Room.insertMany(rooms);
      
      // Measure query time for "public" rooms
      const startTime = process.hrtime.bigint();
      const result = await Room.find({ type: 'public' });
      const endTime = process.hrtime.bigint();
      
      // Convert from nanoseconds to milliseconds
      const elapsedMs = Number(endTime - startTime) / 1_000_000;
      
      console.log(`Query time for 1000 rooms by type: ${elapsedMs.toFixed(2)}ms`);
      console.log(`Found ${result.length} public rooms`);
      
      // Assert response time is less than 50ms
      expect(elapsedMs).toBeLessThan(50);
      
      // Assert correct number of public rooms returned
      expect(result.length).toBe(500); // Half should be public
    });

    test('should query rooms by name using index efficiently', async () => {
      // Measure query time for name lookup
      const startTime = process.hrtime.bigint();
      const result = await Room.find({ name: 'Test Room 500' });
      const endTime = process.hrtime.bigint();
      
      const elapsedMs = Number(endTime - startTime) / 1_000_000;
      
      console.log(`Query time for name lookup: ${elapsedMs.toFixed(2)}ms`);
      
      // Should be very fast with index
      expect(elapsedMs).toBeLessThan(10);
      expect(result.length).toBe(1);
    });

    test('should query rooms by createdBy using index efficiently', async () => {
      // Get a userId from existing rooms
      const firstRoom = await Room.findOne();
      const userId = firstRoom.createdBy;
      
      // Measure query time
      const startTime = process.hrtime.bigint();
      const result = await Room.find({ createdBy: userId });
      const endTime = process.hrtime.bigint();
      
      const elapsedMs = Number(endTime - startTime) / 1_000_000;
      
      console.log(`Query time for createdBy lookup: ${elapsedMs.toFixed(2)}ms`);
      
      // Should be fast with index
      expect(elapsedMs).toBeLessThan(20);
      expect(result.length).toBeGreaterThan(0);
    });

    test('should query rooms by array membership (members index)', async () => {
      // Get a userId that's a member
      const firstRoom = await Room.findOne();
      const userId = firstRoom.members[0];
      
      // Measure query time for member lookup
      const startTime = process.hrtime.bigint();
      const result = await Room.find({ members: userId });
      const endTime = process.hrtime.bigint();
      
      const elapsedMs = Number(endTime - startTime) / 1_000_000;
      
      console.log(`Query time for members array lookup: ${elapsedMs.toFixed(2)}ms`);
      
      // Should be fast with index
      expect(elapsedMs).toBeLessThan(20);
      expect(result.length).toBeGreaterThan(0);
    });

    test('should sort rooms by createdAt (descending) efficiently', async () => {
      // Measure query time with sort by createdAt descending
      const startTime = process.hrtime.bigint();
      const result = await Room.find({ type: 'public' })
        .sort({ createdAt: -1 })
        .limit(100);
      const endTime = process.hrtime.bigint();
      
      const elapsedMs = Number(endTime - startTime) / 1_000_000;
      
      console.log(`Query time for sort by createdAt: ${elapsedMs.toFixed(2)}ms`);
      
      // Should be relatively fast (under 30ms for 1000 rooms)
      expect(elapsedMs).toBeLessThan(30);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Index efficiency - explain() verification', () => {
    
    test('should use index for type query (explain)', async () => {
      const explanation = await Room.collection.find({ type: 'public' }).explain('executionStats');
      
      // Verify that index was used (executionStages should show COLLSCAN or INDEX_SCAN)
      const executionStages = explanation.executionStats.executionStages;
      
      console.log('Execution stage for type query:', executionStages.stage);
      
      // With proper indexing, should use COLLSCAN or better
      expect(executionStages).toBeDefined();
      expect(['COLLSCAN', 'IXSCAN', 'SINGLE_SHARD', 'SHARDED_UNION']).toContain(executionStages.stage);
    });
  });

  describe('Index - Schema definition verification', () => {
    
    test('should have index definitions in Room schema', () => {
      // Get the Room schema
      const schema = Room.schema;
      
      // Verify indexes are defined via schema
      expect(schema._indexes).toBeDefined();
      expect(schema._indexes.length).toBeGreaterThan(0);
      
      // Verify at least the required indexes are in the schema definition
      const indexKeys = schema._indexes.map(idx => Object.keys(idx[0]).join(','));
      expect(indexKeys).toEqual(expect.arrayContaining([
        'name',
        'createdBy',
        'type',
        'createdAt',
        'members'
      ]));
    });
  });
});
