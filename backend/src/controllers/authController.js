const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token
 * @param {string} userId - User ID
 */
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * User registration
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    // Validate input
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Username is required'
      });
    }

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if user already exists (username)
    const existingUsername = await User.findOne({ username: username.trim() });
    if (existingUsername) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Create new user
    const newUser = new User({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: password // Will be hashed by pre-save hook
    });

    const savedUser = await newUser.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: savedUser.toSafeJSON()
      }
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed: ' + error.message
    });
  }
};

/**
 * User login
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Generic error to avoid revealing user existence
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: user.toSafeJSON()
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user: user.toSafeJSON()
      }
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  generateToken
};
