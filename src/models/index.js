/**
 * Model exports
 * Central access point for all Mongoose models
 */

module.exports = {
  User: require('./User'),
  Proposal: require('./Proposal'),
  Vote: require('./Vote'),
  AuditLog: require('./AuditLog')
};
