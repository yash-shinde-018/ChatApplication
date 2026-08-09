const Message = require('../src/models/Message');

describe('Message Model - Schema and Index Verification', () => {
  
  test('Message schema has roomId and senderId fields', () => {
    const schema = Message.schema;
    
    expect(schema.paths.roomId).toBeDefined();
    expect(schema.paths.senderId).toBeDefined();
    expect(schema.paths.message).toBeDefined();
    expect(schema.paths.timestamp).toBeDefined();
    
    console.log('✓ All required fields defined in Message schema');
  });

  test('roomId field has correct type and reference', () => {
    const schema = Message.schema;
    const roomIdPath = schema.paths.roomId;
    
    expect(roomIdPath.instance).toBe('ObjectId');
    expect(roomIdPath.options.ref).toBe('Room');
    
    console.log('✓ roomId is ObjectId reference to Room');
  });

  test('senderId field has correct type and reference', () => {
    const schema = Message.schema;
    const senderIdPath = schema.paths.senderId;
    
    expect(senderIdPath.instance).toBe('ObjectId');
    expect(senderIdPath.options.ref).toBe('User');
    
    console.log('✓ senderId is ObjectId reference to User');
  });

  test('Composite index (roomId: 1, timestamp: -1) is defined', () => {
    const schema = Message.schema;
    const indexes = schema._indexes || [];
    
    // Check if composite index exists
    const hasCompositeIndex = indexes.some(index => {
      const indexObj = index[0]; // Index object
      return (
        'roomId' in indexObj && 
        'timestamp' in indexObj &&
        indexObj.roomId === 1 &&
        indexObj.timestamp === -1
      );
    });

    expect(hasCompositeIndex).toBe(true);
    console.log('✓ Composite index defined on schema: { roomId: 1, timestamp: -1 }');
  });

  test('Message schema validates message field constraints', () => {
    const schema = Message.schema;
    const messagePath = schema.paths.message;
    
    expect(messagePath.isRequired).toBe(true);
    expect(messagePath.validators.length).toBeGreaterThan(0);
    
    console.log('✓ Message field is required with validators');
  });

  test('Timestamp field defaults to current date', () => {
    const schema = Message.schema;
    const timestampPath = schema.paths.timestamp;
    
    expect(timestampPath.defaultValue).toBeDefined();
    
    console.log('✓ Timestamp field has default value');
  });

  test('roomId and senderId are optional for backward compatibility', () => {
    const schema = Message.schema;
    
    expect(schema.paths.roomId.isRequired).toBe(false);
    expect(schema.paths.senderId.isRequired).toBe(false);
    
    console.log('✓ roomId and senderId are optional (backward compatible)');
  });

  test('Verify Message model exports correctly', () => {
    expect(Message).toBeDefined();
    expect(Message.collection).toBeDefined();
    expect(typeof Message.find).toBe('function');
    expect(typeof Message.create).toBe('function');
    
    console.log('✓ Message model exports all required methods');
  });
});
