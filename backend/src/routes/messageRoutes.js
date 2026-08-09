const express = require('express');
const router = express.Router();
const { createMessage, getMessages, getRoomMessages } = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * POST /api/messages
 * Create a new message (requires authentication)
 */
router.post('/', authMiddleware, createMessage);

/**
 * GET /api/messages
 * Get all messages (requires authentication)
 */
router.get('/', authMiddleware, getMessages);

/**
 * GET /api/messages/room/:roomId
 * Get room message history (requires authentication and room membership)
 */
router.get('/room/:roomId', authMiddleware, getRoomMessages);

module.exports = router;
