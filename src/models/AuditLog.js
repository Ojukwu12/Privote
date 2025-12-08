const mongoose = require('mongoose');

/**
 * AuditLog Model
 * Records all sensitive operations for security auditing
 *
 * Logged actions:
 * - USER_REGISTER, USER_LOGIN, USER_LOGOUT
 * - KEY_DECRYPT_REQUEST (when user retrieves private key)
 * - VOTE_SUBMIT, PROPOSAL_CREATE, PROPOSAL_CLOSE
 * - ADMIN_ACTION
 *
 * Production notes:
 * - Set TTL index to auto-delete old logs (e.g., 90 days)
 * - Export logs to external SIEM for compliance
 * - Never log plaintext keys or votes
 */

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  action: {
    type: String,
    required: true,
    enum: [
      'USER_REGISTER',
      'USER_LOGIN',
      'USER_LOGOUT',
      'KEY_DECRYPT_REQUEST',
      'VOTE_SUBMIT',
      'VOTE_SUBMIT_FAILED',
      'PROPOSAL_CREATE',
      'PROPOSAL_CLOSE',
      'TALLY_COMPUTE',
      'ADMIN_ACTION',
      'AUTH_FAILED',
      'RATE_LIMIT_EXCEEDED',
      'ERROR'
    ]
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient time-based queries
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

// TTL index: automatically delete logs older than 90 days (configurable)
// Uncomment in production:
// auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
