const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/realtime-chat';
    
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✓ MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    console.warn('⚠ Server starting without database connection. Please ensure MongoDB is running.');
    return false;
  }
};

module.exports = connectDB;
