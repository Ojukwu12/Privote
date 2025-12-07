const CustomError = require('../utils/CustomError');

/**
 * Authorization Middleware
 * Checks user role against required roles
 *
 * Usage:
 *   router.post('/proposals', authenticate, authorize('admin'), handler);
 *
 * Roles:
 * - user: standard voter
 * - admin: can create proposals, close voting, access admin endpoints
 */

/**
 * Require specific role(s)
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new CustomError('Authentication required', 401);
    }

    if (!roles.includes(req.user.role)) {
      throw new CustomError('Insufficient permissions', 403);
    }

    next();
  };
};

/**
 * Require admin role
 */
const requireAdmin = authorize('admin');

/**
 * Check if user owns resource (for user-specific operations)
 * @param {Function} getResourceOwnerId - Function that extracts owner ID from req
 */
const authorizeOwner = (getResourceOwnerId) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new CustomError('Authentication required', 401);
    }

    const resourceOwnerId = getResourceOwnerId(req);

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns resource
    if (req.user.id !== resourceOwnerId.toString()) {
      throw new CustomError('Access denied', 403);
    }

    next();
  };
};

module.exports = {
  authorize,
  requireAdmin,
  authorizeOwner
};
