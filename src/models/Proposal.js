const mongoose = require('mongoose');

/**
 * Proposal Model
 * Represents a voting proposal with time-bounded voting window
 *
 * Key fields:
 * - encryptedTally: encrypted vote count/result (hex string or JSON)
 * - closed: flag to prevent further votes after tallying
 * - requiredRole: minimum role needed to vote (user|admin)
 * - weight: future use for weighted voting based on token holdings
 *
 * Frontend integration:
 * - Fetch open proposals via GET /proposals?status=open
 * - Submit vote with proposalId
 * - Retrieve encrypted tally after voting ends
 */

const proposalSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        return value > this.startTime;
      },
      message: 'End time must be after start time'
    }
  },
  requiredRole: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  encryptedTally: {
    type: String,
    default: null
  },
  // On-chain proposal identifier (from PrivoteVoting contract)
  contractProposalId: {
    type: Number,
    unique: true,
    sparse: true
  },
  // Transaction hash for the on-chain createProposal call
  contractCreateTxHash: {
    type: String,
    default: null
  },
  closed: {
    type: Boolean,
    default: false
  },
  tallyJobId: {
    type: String,
    default: null
  },
  txHash: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
proposalSchema.index({ startTime: 1, endTime: 1 });
proposalSchema.index({ closed: 1 });
proposalSchema.index({ createdBy: 1 });

// Virtual: check if proposal is currently active
proposalSchema.virtual('isActive').get(function() {
  const now = new Date();
  return !this.closed && now >= this.startTime && now <= this.endTime;
});

// Virtual: check if voting has ended
proposalSchema.virtual('hasEnded').get(function() {
  return new Date() > this.endTime;
});

proposalSchema.set('toJSON', { virtuals: true });
proposalSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Proposal', proposalSchema);
