const { Proposal, Vote, AuditLog } = require('../models');
const config = require('../config');
const logger = require('../utils/logger');
const CustomError = require('../utils/CustomError');
const contractService = require('./contractService');

/**
 * Proposal Service
 * Business logic for proposal management
 *
 * Key operations:
 * - Create proposal (admin only)
 * - List proposals (with filters)
 * - Get proposal details
 * - Close proposal (admin only, triggers tallying)
 */

class ProposalService {
  /**
   * Create a new proposal
   *
   * @param {Object} proposalData - { title, description, startTime, endTime, requiredRole }
   * @param {string} createdBy - User ID
   * @param {Object} requestMeta
   * @returns {Promise<Object>} Created proposal
   */
  async createProposal(proposalData, createdBy, requestMeta = {}) {
    const { title, description, startTime, endTime, requiredRole } = proposalData;

    // Validate times
    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    if (start <= now) {
      throw new CustomError('Start time must be in the future', 400);
    }

    if (end <= start) {
      throw new CustomError('End time must be after start time', 400);
    }

    // Ensure contract service ready
    if (!contractService.initialized) {
      await contractService.initialize();
    }

    // Create proposal on-chain first to obtain contractProposalId
    const startTimeSec = Math.floor(start.getTime() / 1000);
    const endTimeSec = Math.floor(end.getTime() / 1000);

    const onChain = await contractService.createProposalOnChain({
      title,
      description,
      startTimeSec,
      endTimeSec
    });

    if (typeof onChain.proposalId !== 'number') {
      throw new CustomError('Failed to retrieve on-chain proposal id', 500);
    }

    // Get contract address from config
    const contractAddress = config.fhevm.votingContractAddress;

    // Create proposal in database with on-chain mapping
    const proposal = await Proposal.create({
      title,
      description,
      startTime: start,
      endTime: end,
      requiredRole: requiredRole || 'user',
      createdBy,
      contractAddress,
      contractProposalId: onChain.proposalId,
      contractCreateTxHash: onChain.txHash
    });

    // Audit log
    await AuditLog.create({
      userId: createdBy,
      action: 'PROPOSAL_CREATE',
      data: { proposalId: proposal._id, title, contractProposalId: proposal.contractProposalId, txHash: proposal.contractCreateTxHash },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent
    });

    logger.info(`Proposal created: ${proposal._id}`);

    return proposal;
  }

  /**
   * Get proposal by ID
   *
   * @param {string} proposalId
   * @returns {Promise<Object>} Proposal
   */
  async getProposal(proposalId) {
    const proposal = await Proposal.findById(proposalId)
      .populate('createdBy', 'username email')
      .lean();

    if (!proposal) {
      throw new CustomError('Proposal not found', 404);
    }

    // Add vote count
    const voteCount = await Vote.countDocuments({ proposalId });
    proposal.voteCount = voteCount;

    return proposal;
  }

  /**
   * List proposals with filters
   *
   * @param {Object} filters - { status: 'open'|'closed'|'upcoming', role, page, limit }
   * @returns {Promise<Object>} { proposals, pagination }
   */
  async listProposals(filters = {}) {
    const { status, role, page = 1, limit = 20 } = filters;
    const query = {};
    const now = new Date();

    // Filter by status
    if (status === 'open') {
      query.closed = false;
      query.startTime = { $lte: now };
      query.endTime = { $gte: now };
    } else if (status === 'closed') {
      query.closed = true;
    } else if (status === 'upcoming') {
      query.closed = false;
      query.startTime = { $gt: now };
    } else if (status === 'ended') {
      query.closed = false;
      query.endTime = { $lt: now };
    }

    // Filter by required role
    if (role) {
      query.requiredRole = role;
    }

    const skip = (page - 1) * limit;

    const [proposals, total] = await Promise.all([
      Proposal.find(query)
        .populate('createdBy', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Proposal.countDocuments(query)
    ]);

    // Add vote counts
    for (const proposal of proposals) {
      const voteCount = await Vote.countDocuments({ proposalId: proposal._id });
      proposal.voteCount = voteCount;
    }

    return {
      proposals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Close proposal and trigger tallying
   * Admin only
   *
   * @param {string} proposalId
   * @param {string} userId - Admin user ID
   * @param {Object} requestMeta
   * @returns {Promise<Object>} Updated proposal
   */
  async closeProposal(proposalId, userId, requestMeta = {}) {
    const proposal = await Proposal.findById(proposalId);

    if (!proposal) {
      throw new CustomError('Proposal not found', 404);
    }

    if (proposal.closed) {
      throw new CustomError('Proposal already closed', 400);
    }

    const now = new Date();
    if (now < proposal.endTime) {
      throw new CustomError('Cannot close proposal before end time', 400);
    }

    // Ensure on-chain proposal exists
    if (typeof proposal.contractProposalId !== 'number') {
      throw new CustomError('On-chain proposal not ready. Cannot close.', 503);
    }

    // Close on-chain first (admin wallet)
    if (!contractService.initialized) {
      await contractService.initialize();
    }

    const closeResult = await contractService.closeProposal(proposal.contractProposalId);

    // Mark as closed locally with tx hash
    proposal.closed = true;
    proposal.txHash = closeResult.txHash;
    await proposal.save();

    // Audit log
    await AuditLog.create({
      userId,
      action: 'PROPOSAL_CLOSE',
      data: { proposalId, title: proposal.title, contractProposalId: proposal.contractProposalId, txHash: closeResult.txHash },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent
    });

    logger.info(`Proposal closed: ${proposalId}`);

    // Note: Tallying will be handled by background job
    // See voteService.computeTally() and jobs/tallyWorker.js

    return proposal;
  }

  /**
   * Check if proposal is currently accepting votes
   *
   * @param {Object} proposal - Proposal document
   * @returns {boolean}
   */
  isProposalOpen(proposal) {
    const now = new Date();
    return !proposal.closed &&
           now >= proposal.startTime &&
           now <= proposal.endTime;
  }

  /**
   * Check if user is eligible to vote on proposal
   *
   * @param {Object} proposal
   * @param {Object} user
   * @returns {boolean}
   */
  canUserVote(proposal, user) {
    if (!this.isProposalOpen(proposal)) {
      return false;
    }

    // Check role requirement
    if (proposal.requiredRole === 'admin' && user.role !== 'admin') {
      return false;
    }

    return true;
  }
}

module.exports = new ProposalService();
