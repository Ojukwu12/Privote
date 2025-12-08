const mongoose = require('mongoose');

/**
 * Vote Model
 * Stores encrypted votes submitted by users
 *
 * Key fields:
 * - encryptedVote: FHE ciphertext (hex string) representing vote value
 * - weight: vote weight (default 1, future: based on token holdings)
 * - txHash: blockchain transaction hash from relayer submission
 * - inputProof: ZKPoK proof associated with encrypted input
 *
 * Security:
 * - Unique index on (proposalId, userId) prevents double-voting
 * - encryptedVote never decrypted on backend
 * - idempotencyKey prevents duplicate submission on retry
 */

const voteSchema = new mongoose.Schema({
  proposalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proposal',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  encryptedVote: {
    type: String,
    required: true
  },
  inputProof: {
    type: String,
    default: null
  },
  weight: {
    type: Number,
    default: 1,
    min: 0
  },
  txHash: {
    type: String,
    default: null
  },
  jobId: {
    type: String,
    default: null
  },
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

// Unique composite index: one vote per user per proposal
voteSchema.index({ proposalId: 1, userId: 1 }, { unique: true });
voteSchema.index({ createdAt: 1 });

module.exports = mongoose.model('Vote', voteSchema);
