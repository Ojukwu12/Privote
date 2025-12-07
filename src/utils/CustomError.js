/**
 * Custom Error Class
 * Extends native Error with HTTP status code and additional metadata
 *
 * Usage in controllers:
 *   throw new CustomError('User not found', 404);
 *   throw new CustomError('Invalid vote', 400, { proposalId });
 *
 * Handled by global error controller middleware
 */

class CustomError extends Error {
  constructor(message, statusCode = 500, metadata = {}) {
    super(message);
    this.statusCode = statusCode;
    this.metadata = metadata;
    this.isOperational = true; // Distinguishes operational vs programmer errors
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = CustomError;
