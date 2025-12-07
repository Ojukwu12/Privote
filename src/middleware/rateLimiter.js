const rateLimit = require('express-rate-limit');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Rate Limiting Middleware
 * Prevents abuse and DDoS attacks
 *
 * Different limits for different route categories:
 * - Auth endpoints: stricter limits
 * - General API: standard limits
 * - Admin endpoints: relaxed limits
 */

// Standard rate limiter for general API
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userId: req.user?.id
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later'
    });
  }
});

// Strict limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later'
  },
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later'
    });
  }
});

// Strict limiter for vote submission
const voteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 votes per minute max
  message: {
    success: false,
    message: 'Too many vote submissions, please slow down'
  }
});

// Limiter for key decryption requests
const keyDecryptLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 decryptions per hour
  message: {
    success: false,
    message: 'Too many key decryption requests'
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  voteLimiter,
  keyDecryptLimiter
};
