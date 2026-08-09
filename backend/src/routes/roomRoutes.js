const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const roomController = require('../controllers/roomController');

// All routes require authentication
router.use(authMiddleware);

// Create room
router.post('/', roomController.createRoom);

// List available rooms
router.get('/', roomController.listRooms);

// Get room details
router.get('/:roomId', roomController.getRoomDetails);

// Join public room
router.post('/:roomId/join', (req, res, next) => {
  // If password is not provided, it's a public join; if provided, it's private join
  if (!req.body.password) {
    return roomController.joinPublicRoom(req, res);
  } else {
    return roomController.joinPrivateRoom(req, res);
  }
});

// Leave room
router.post('/:roomId/leave', roomController.leaveRoom);

// Delete room (only creator can delete)
router.delete('/:roomId', roomController.deleteRoom);

// Get room messages
router.get('/:roomId/messages', roomController.getRoomMessages);

module.exports = router;
