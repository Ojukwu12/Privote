/**
 * AsyncHandler Wrapper
 * Eliminates try/catch boilerplate in async route handlers
 *
 * Wraps async functions and forwards errors to Express error handler
 *
 * Usage:
 *   router.post('/vote', asyncHandler(async (req, res) => {
 *     // async code here
 *     // any thrown errors automatically caught and passed to next()
 *   }));
 */

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
