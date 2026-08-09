const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

/**
 * Middleware to verify JWT token
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authorization header missing'
      });
    }

    // Extract Bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization header format'
      });
    }

    const token = parts[1];

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request
    req.user = {
      userId: decoded.userId
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }
};

module.exports = authMiddleware;
