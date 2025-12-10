const { Vote, Proposal, AuditLog, User } = require('../models');
const logger = require('../utils/logger');
const CustomError = require('../utils/CustomError');
const relayerService = require('../fhe/relayerService');
const proposalService = require('./proposalService');
const { addVoteJob, addTallyJob } = require('../jobs/jobQueue');
const config = require('../config');

/**
 * Vote Service
 * Business logic for voting and tally operations
 *
 * Key operations:
 * - Submit encrypted vote
 * - Process vote submission (background job)
 * - Compute encrypted tally
 * - Retrieve encrypted tally for client-side decryption
 */

class VoteService {
  /**
   * Submit an encrypted vote
   * Validates eligibility and queues background job for relayer submission
   *
   * @param {Object} voteData - { proposalId, encryptedVote, inputProof, idempotencyKey }
   * @param {string} userId
   * @param {Object} requestMeta
   * @returns {Promise<Object>} { vote, jobId }
   */
  async submitVote(voteData, userId, requestMeta = {}) {
    const { proposalId, encryptedVote, inputProof, idempotencyKey } = voteData;

    // Fetch proposal
    const proposal = await Proposal.findById(proposalId);

    if (!proposal) {
      throw new CustomError('Proposal not found', 404);
    }

    // Check if proposal is open
    if (!proposalService.isProposalOpen(proposal)) {
      throw new CustomError('Proposal is not accepting votes', 400);
    }

    // Check if user already voted
    const existingVote = await Vote.findOne({ proposalId, userId });

    if (existingVote) {
      throw new CustomError('You have already voted on this proposal', 409);
    }

    // Check idempotency key if provided
    if (idempotencyKey) {
      const duplicateVote = await Vote.findOne({ idempotencyKey });
      if (duplicateVote) {
        logger.info(`Duplicate vote submission detected: ${idempotencyKey}`);
        return {
          vote: duplicateVote,
          jobId: duplicateVote.jobId,
          isDuplicate: true
        };
      }
    }

    // Create vote record
    const vote = await Vote.create({
      proposalId,
      userId,
      encryptedVote,
      inputProof,
      idempotencyKey,
      weight: 1 // Future: weighted voting based on token holdings
    });

    // Queue background job for relayer submission
    const jobId = await addVoteJob({
      voteId: vote._id.toString(),
      proposalId: proposalId.toString(),
      userId: userId.toString(),
      encryptedVote,
      inputProof
    });

    // Update vote with job ID
    vote.jobId = jobId;
    await vote.save();

    // Audit log
    await AuditLog.create({
      userId,
      action: 'VOTE_SUBMIT',
      data: { proposalId, voteId: vote._id },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent
    });

    logger.info(`Vote submitted: ${vote._id}, Job: ${jobId}`);

    return {
      vote,
      jobId
    };
  }

  /**
   * Process vote submission via relayer
   * Called by background worker
   *
   * @param {Object} jobData - { voteId, proposalId, encryptedVote, inputProof }
   * @returns {Promise<Object>} { txHash }
   */
  async processVoteSubmission(jobData) {
    const { voteId, proposalId, encryptedVote, inputProof } = jobData;

    logger.info(`Processing vote submission: ${voteId}`);

    try {
      // In a real implementation, this would:
      // 1. Create encrypted input buffer
      // 2. Submit to contract via relayer
      // 3. Wait for transaction confirmation
      // 4. Update vote record with txHash

      // Mock implementation (replace with actual relayer calls):
      const contractAddress = config.fhevm.votingContractAddress;

      if (!contractAddress) {
        throw new Error('VOTING_CONTRACT_ADDRESS not set');
      }

      // If the client supplied ciphertext handles (stringified array), use them.
      // Otherwise, fall back to creating an encrypted input on the server (mock).
      let handles = null;
      if (encryptedVote) {
        try {
          const parsed = JSON.parse(encryptedVote);
          if (Array.isArray(parsed)) {
            handles = parsed;
          }
        } catch (e) {
          // not JSON - ignore and continue to server-side creation
          handles = null;
        }
      }

      if (!handles) {
        // Create encrypted input server-side (fallback/mock)
        const wallet = relayerService.getProjectWallet();
        const userAddress = wallet.address;

        const inputBuffer = relayerService.createEncryptedInput(
          contractAddress,
          userAddress
        );

        // Add encrypted vote value (assuming it's a uint64 for simplicity)
        inputBuffer.add64(BigInt(1)); // Placeholder

        const encrypted = await relayerService.encryptInput(inputBuffer);
        handles = encrypted.handles;
      }

      // Now we have handles and inputProof (either client-supplied or server-generated)
      const proofToUse = inputProof || '';

      // TODO: Call contract's submitVote function with handles and proofToUse
      // For now, simulate transaction
      const txHash = `0x${Math.random().toString(16).substring(2)}`;

      // Update vote record
      await Vote.findByIdAndUpdate(voteId, {
        txHash
      });

      logger.info(`Vote processed successfully: ${voteId}, tx: ${txHash}`);

      return { txHash };

    } catch (error) {
      logger.error(`Vote processing failed: ${voteId}`, error);

      // Audit log failure
      await AuditLog.create({
        action: 'VOTE_SUBMIT_FAILED',
        data: { voteId, proposalId, error: error.message },
        success: false
      });

      throw error;
    }
  }

  /**
   * Compute encrypted tally for a proposal
   * Called after proposal closes
   *
   * @param {string} proposalId
   * @returns {Promise<Object>} { encryptedTally, handle }
   */
  async computeTally(proposalId) {
    logger.info(`Computing tally for proposal: ${proposalId}`);

    const proposal = await Proposal.findById(proposalId);

    if (!proposal) {
      throw new CustomError('Proposal not found', 404);
    }

    if (!proposal.closed) {
      throw new CustomError('Proposal must be closed before tallying', 400);
    }

    // Fetch all votes for proposal
    const votes = await Vote.find({ proposalId }).lean();

    if (votes.length === 0) {
      logger.warn(`No votes found for proposal: ${proposalId}`);
      return { encryptedTally: null, voteCount: 0 };
    }

    // In a real FHEVM implementation:
    // 1. Aggregate encrypted vote handles
    // 2. Call contract's tally function (homomorphic addition)
    // 3. Retrieve encrypted result handle
    // 4. Store handle in proposal.encryptedTally

    // Mock implementation:
    const encryptedTallyHandle = `0x${Math.random().toString(16).substring(2)}`;

    // Update proposal with encrypted tally
    proposal.encryptedTally = encryptedTallyHandle;
    await proposal.save();

    // Audit log
    await AuditLog.create({
      action: 'TALLY_COMPUTE',
      data: { proposalId, voteCount: votes.length },
      success: true
    });

    logger.info(`Tally computed for proposal: ${proposalId}`);

    return {
      encryptedTally: encryptedTallyHandle,
      voteCount: votes.length
    };
  }

  /**
   * Get encrypted tally for a proposal
   * Returns encrypted result for client-side decryption
   *
   * @param {string} proposalId
   * @returns {Promise<Object>} { encryptedTally, voteCount, proposal }
   */
  async getEncryptedTally(proposalId) {
    const proposal = await Proposal.findById(proposalId).lean();

    if (!proposal) {
      throw new CustomError('Proposal not found', 404);
    }

    if (!proposal.encryptedTally) {
      // Check if proposal has ended and should be tallied
      const now = new Date();
      if (now > proposal.endTime && !proposal.closed) {
        throw new CustomError('Proposal ended but not yet tallied. Please wait.', 202);
      }

      throw new CustomError('Tally not yet computed', 404);
    }

    const voteCount = await Vote.countDocuments({ proposalId });

    return {
      encryptedTally: proposal.encryptedTally,
      voteCount,
      proposal: {
        id: proposal._id,
        title: proposal.title,
        closed: proposal.closed,
        endTime: proposal.endTime
      }
    };
  }

  /**
   * Decrypt tally (public decryption)
   * Uses relayer SDK to decrypt publicly decryptable ciphertext
   *
   * @param {string} proposalId
   * @returns {Promise<Object>} { decryptedTally, proof }
   */
  async decryptTallyPublic(proposalId) {
    const proposal = await Proposal.findById(proposalId);

    if (!proposal) {
      throw new CustomError('Proposal not found', 404);
    }

    if (!proposal.encryptedTally) {
      throw new CustomError('Tally not yet computed', 404);
    }

    // Use public decrypt from relayer
    const handles = [proposal.encryptedTally];
    const result = await relayerService.publicDecrypt(handles);

    return {
      decryptedTally: result.clearValues[proposal.encryptedTally],
      proof: result.decryptionProof,
      voteCount: await Vote.countDocuments({ proposalId })
    };
  }

  /**
   * Decrypt tally using the user's private key.
   * This will call the relayer's userDecrypt path which performs the
   * user-specific decryption workflow.
   *
   * WARNING: this method expects the caller to supply the user's private key.
   * In production you should avoid sending private keys to the server and
   * instead perform decryption client-side. This endpoint exists to support
   * environments where client-side SDKs are not available.
   */
  // Client-side decryption is preferred. Server-side user-decrypt endpoint
  // was removed for security reasons. Use relayer/public decrypt for public
  // tallies and client-side userDecrypt flow for private decryption.

  /**
   * Check if user has voted on a proposal
   *
   * @param {string} proposalId
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async hasUserVoted(proposalId, userId) {
    const vote = await Vote.findOne({ proposalId, userId });
    return !!vote;
  }
}

module.exports = new VoteService();

