const logger = require('../utils/logger');
const CustomError = require('../utils/CustomError');

/**
 * Global Error Controller
 * Centralized error handling for all routes
 *
 * Catches both operational errors (CustomError) and unexpected errors
 * Logs errors and sends appropriate HTTP responses
 *
 * Production notes:
 * - Never expose stack traces or internal details to clients
 * - Log full error details server-side
 * - Consider integrating Sentry for error tracking
 */

const errorController = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let metadata = err.metadata || {};

  // Handle specific error types

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    metadata = { errors: Object.values(err.errors).map(e => e.message) };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern)[0];
    message = `Duplicate value for ${field}`;
    metadata = { field };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Joi validation errors
  if (err.isJoi) {
    statusCode = 400;
    message = 'Validation error';
    metadata = { errors: err.details.map(d => d.message) };
  }

  // Log error server-side
  const logData = {
    statusCode,
    message,
    metadata,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  };

  if (statusCode >= 500) {
    logger.error('Server error:', { ...logData, stack: err.stack });
  } else {
    logger.warn('Client error:', logData);
  }

  // Send response to client
  const response = {
    success: false,
    message,
    ...(Object.keys(metadata).length > 0 && { metadata })
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && statusCode >= 500) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorController;
