const { Vote, Proposal, AuditLog, User } = require('../models');
const logger = require('../utils/logger');
const CustomError = require('../utils/CustomError');
const relayerService = require('../fhe/relayerService');
const contractService = require('./contractService');
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

    // Ensure on-chain proposal mapping exists
    if (typeof proposal.contractProposalId !== 'number') {
      throw new CustomError(
        'This proposal has not been deployed to the blockchain yet. ' +
        'Proposals must be created via the API (POST /api/proposals) to be deployable. ' +
        'Please contact an administrator.',
        503,
        { proposalId, reason: 'missing_contract_id' }
      );
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

    // Create vote record with pending status
    // Note: Vote count will only increment after blockchain submission succeeds
    const vote = await Vote.create({
      proposalId,
      userId,
      encryptedVote,
      inputProof,
      idempotencyKey,
      weight: 1, // Future: weighted voting based on token holdings
      status: 'pending'
    });

    // Queue background job for relayer submission
    let jobId;
    try {
      jobId = await addVoteJob({
        voteId: vote._id.toString(),
        proposalId: proposalId.toString(),
        contractProposalId: proposal.contractProposalId,
        userId: userId.toString(),
        encryptedVote,
        inputProof
      });
    } catch (error) {
      // Delete the vote if job queueing fails
      await Vote.findByIdAndDelete(vote._id);
      
      logger.error('Failed to queue vote job', { error: error.message, voteId: vote._id });
      throw new CustomError(
        'Failed to queue vote for processing. This usually means the background worker service is not running or Redis is unavailable. ' +
        'Please try again later or contact an administrator.',
        503,
        { reason: 'worker_unavailable', originalError: error.message }
      );
    }

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
   * Process vote submission via relayer and smart contract
   * Called by background worker
   * Writes transaction to chain using PROJECT_PRIVATE_KEY
   *
   * @param {Object} jobData - { voteId, proposalId, encryptedVote, inputProof, userId }
   * @returns {Promise<Object>} { txHash, blockNumber }
   */
  async processVoteSubmission(jobData) {
    const { voteId, proposalId, contractProposalId, encryptedVote, inputProof, userId } = jobData;

    logger.info(`Processing vote submission: ${voteId}`, { 
      proposalId, 
      userId,
      hasEncryptedVote: !!encryptedVote,
      hasInputProof: !!inputProof
    });

    try {
      const contractAddress = config.fhevm.votingContractAddress;

      if (!contractAddress) {
        throw new CustomError(
          'VOTING_CONTRACT_ADDRESS not configured. Deploy the contract first.',
          500
        );
      }

      // Ensure contract service is initialized
      if (!contractService.initialized) {
        await contractService.initialize();
      }

      // Get user's wallet address
      const user = await User.findById(userId);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      const userAddress = user.walletAddress || relayerService.getProjectWallet().address;

      if (typeof contractProposalId !== 'number') {
        throw new CustomError(
          'Missing on-chain proposal ID for vote submission',
          500,
          { proposalId }
        );
      }

      // Parse encrypted vote handles
      let handles = null;
      if (encryptedVote) {
        try {
          const parsed = JSON.parse(encryptedVote);
          if (Array.isArray(parsed)) {
            handles = parsed;
          } else if (typeof parsed === 'string') {
            handles = [parsed];
          }
        } catch (e) {
          logger.warn(`Failed to parse encryptedVote JSON: ${e.message}`);
          // If client didn't provide handles, create them server-side
          handles = null;
        }
      }

      // If no handles from client, create encrypted input server-side
      if (!handles) {
        logger.info('Creating encrypted input server-side for vote submission');
        const inputBuffer = relayerService.createEncryptedInput(
          contractAddress,
          userAddress
        );

        // Add encrypted vote value (1 for yes, 0 for no - or use the vote preference)
        // Default to 1 (yes) for now; ideally, client should pass this
        inputBuffer.add64(BigInt(1));

        logger.info('Calling relayer SDK to encrypt input (this may take 10-30 seconds)...');
        
        // Add timeout to encryptInput call (60 second timeout)
        const encryptPromise = relayerService.encryptInput(inputBuffer);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Relayer encryptInput timed out after 60 seconds')), 60000)
        );
        
        const encrypted = await Promise.race([encryptPromise, timeoutPromise]);
        logger.info('Relayer SDK encryption completed');
        
        handles = encrypted.handles;

        if (!handles || handles.length === 0) {
          throw new CustomError(
            'Failed to create encrypted input: no handles returned from relayer',
            500
          );
        }
      }

      // Use provided inputProof or generate server-side
      const proofToUse = inputProof || '';

      logger.info(`Submitting encrypted vote to contract`, {
        voteId,
        proposalId,
        handlesCount: handles.length,
        userAddress,
        contractAddress
      });

      // Call smart contract to submit vote
      // This writes a transaction to the blockchain using PROJECT_PRIVATE_KEY
      const txResult = await contractService.submitVote(
        contractProposalId,
        handles,
        proofToUse,
        userAddress
      );

      const { txHash, blockNumber, receipt } = txResult;

      // Update vote record with transaction hash and confirmation
      await Vote.findByIdAndUpdate(voteId, {
        txHash,
        blockNumber,
        status: 'confirmed',
        confirmedAt: new Date()
      });

      // Increment vote count on proposal only after successful blockchain submission
      await Proposal.findByIdAndUpdate(proposalId, {
        $inc: { voteCount: 1 }
      });

      logger.info('Vote count incremented after blockchain confirmation', { proposalId, voteId });

      // Audit log successful submission
      await AuditLog.create({
        userId,
        action: 'VOTE_SUBMITTED_ON_CHAIN',
        data: {
          voteId,
          proposalId,
          txHash,
          blockNumber
        },
        ipAddress: jobData.ipAddress,
        userAgent: jobData.userAgent,
        success: true
      });

      logger.info(`Vote submitted to chain successfully`, {
        voteId,
        txHash,
        blockNumber
      });

      return { txHash, blockNumber };

    } catch (error) {
      logger.error(`Vote processing failed: ${voteId}`, {
        error: error.message,
        stack: error.stack,
        proposalId: jobData.proposalId
      });

      // Update vote record with error status
      await Vote.findByIdAndUpdate(voteId, {
        status: 'failed',
        errorMessage: error.message,
        failedAt: new Date()
      }).catch(err => logger.error('Failed to update vote status:', err));

      // Audit log failure
      await AuditLog.create({
        userId: jobData.userId,
        action: 'VOTE_SUBMIT_FAILED',
        data: {
          voteId,
          proposalId: jobData.proposalId,
          error: error.message,
          errorType: error.constructor.name
        },
        success: false
      }).catch(err => logger.error('Failed to create audit log:', err));

      throw new CustomError(
        error.message || 'Vote submission to contract failed',
        error.statusCode || 500,
        { voteId, originalError: error.message }
      );
    }
  }

  /**
   * Compute encrypted tally for a proposal
   * Called after proposal closes
   * Calls the relayer service to compute homomorphic tally from encrypted votes
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

    if (typeof proposal.contractProposalId !== 'number') {
      throw new CustomError('On-chain proposal not ready for tallying', 503);
    }

    // Fetch all votes for proposal
    const votes = await Vote.find({ proposalId }).lean();

    const voteCount = votes.length;
    if (voteCount === 0) {
      logger.warn(`No votes found for proposal: ${proposalId}`);
      return { encryptedTally: null, voteCount: 0 };
    }

    try {
      // Ensure contract service initialized
      if (!contractService.initialized) {
        await contractService.initialize();
      }

      // Trigger on-chain tally computation (admin path)
      const tallyTx = await contractService.computeTally(proposal.contractProposalId);

      // Fetch encrypted tally from contract after computation
      const encryptedTallyHandle = await contractService.getEncryptedTally(proposal.contractProposalId);

      // Persist tally and tx hash
      proposal.encryptedTally = encryptedTallyHandle;
      proposal.txHash = tallyTx.txHash;
      await proposal.save();

      await AuditLog.create({
        action: 'TALLY_COMPUTE',
        data: { proposalId, voteCount, tallyHandle: encryptedTallyHandle, txHash: tallyTx.txHash },
        success: true
      });

      logger.info(`Tally computed on-chain for proposal: ${proposalId}`, {
        voteCount,
        tallyHandle: encryptedTallyHandle,
        txHash: tallyTx.txHash
      });

      return {
        encryptedTally: encryptedTallyHandle,
        voteCount,
        txHash: tallyTx.txHash
      };

    } catch (error) {
      logger.error(`Failed to compute tally for proposal ${proposalId}:`, error);

      await AuditLog.create({
        action: 'TALLY_COMPUTE',
        data: { proposalId, voteCount, error: error.message },
        success: false
      });

      throw new CustomError('Tally computation failed', 500, { error: error.message });
    }
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
   * Returns mock data if decryption fails for testing/development
   *
   * @param {string} proposalId
   * @returns {Promise<Object>} { decryptedTally, proof, voteCount }
   */
  async decryptTallyPublic(proposalId) {
    const proposal = await Proposal.findById(proposalId);

    if (!proposal) {
      throw new CustomError('Proposal not found', 404);
    }

    if (!proposal.encryptedTally) {
      throw new CustomError('Tally not yet computed', 404);
    }

    const voteCount = await Vote.countDocuments({ proposalId });

    // Use public decrypt from relayer (no mock fallback in production)
    if (!relayerService.initialized) {
      await relayerService.initialize();
    }

    const handles = [proposal.encryptedTally];
    logger.info(`Attempting to decrypt tally for proposal ${proposalId}`, { handles, voteCount });

    try {
      const result = await relayerService.publicDecrypt(handles);

      const decryptedValue = result.clearValues[proposal.encryptedTally];
      logger.info(`Successfully decrypted tally for proposal ${proposalId}:`, {
        decryptedValue,
        voteCount
      });

      return {
        decryptedTally: decryptedValue,
        proof: result.decryptionProof,
        voteCount,
        isDecrypted: true
      };
    } catch (error) {
      logger.error(`Failed to decrypt tally for proposal ${proposalId}:`, error);
      throw new CustomError(
        'Failed to decrypt tally via relayer. Please retry or decrypt client-side.',
        502,
        { error: error.message, proposalId }
      );
    }
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

