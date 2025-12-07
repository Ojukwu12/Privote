const jwt = require('jsonwebtoken');
const config = require('../config');
const CustomError = require('../utils/CustomError');
const asyncHandler = require('../utils/asyncHandler');
const { User } = require('../models');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 *
 * Usage:
 *   router.get('/protected', authenticate, handler);
 *
 * Frontend integration:
 * - Include JWT in Authorization header: "Bearer <token>"
 * - Token obtained from POST /users/login
 * - Refresh token before expiry
 */

const authenticate = asyncHandler(async (req, res, next) => {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new CustomError('No token provided', 401);
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Fetch user from database
    const user = await User.findById(decoded.id).select('-passwordHash -encryptedPrivateKey');

    if (!user) {
      throw new CustomError('User not found', 401);
    }

    if (!user.isActive) {
      throw new CustomError('User account is disabled', 403);
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new CustomError('Invalid token', 401);
    }
    if (error.name === 'TokenExpiredError') {
      throw new CustomError('Token expired', 401);
    }
    throw error;
  }
});

/**
 * Optional authentication - attach user if token present, but don't require it
 */
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.id).select('-passwordHash -encryptedPrivateKey');

    if (user && user.isActive) {
      req.user = user;
    }
  } catch (error) {
    // Silently fail for optional auth
  }

  next();
});

module.exports = {
  authenticate,
  optionalAuthenticate
};
