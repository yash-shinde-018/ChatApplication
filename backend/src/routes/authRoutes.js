const express = require('express');
const router = express.Router();
const { register, login, getCurrentUser } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', register);

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', login);

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authMiddleware, getCurrentUser);

module.exports = router;
