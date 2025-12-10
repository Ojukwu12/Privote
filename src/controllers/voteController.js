const voteService = require('../services/voteService');
const asyncHandler = require('../utils/asyncHandler');
const CustomError = require('../utils/CustomError');

/**
 * Vote Controller
 * HTTP handlers for voting operations
 *
 * Frontend integration:
 * - Submit encrypted vote with proposalId
 * - Poll job status to confirm submission
 * - Fetch encrypted tally after proposal closes
 * - Decrypt tally locally using user's private key
 */

/**
 * POST /vote/submit
 * Submit an encrypted vote
 *
 * Body:
 * {
 *   "proposalId": "507f1f77bcf86cd799439011",
 *   "encryptedVote": "0xabc123...",
 *   "inputProof": "0xdef456...",
 *   "idempotencyKey": "uuid-v4-here" (optional)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "vote": { "id": "...", "proposalId": "...", ... },
 *     "jobId": "job-uuid"
 *   },
 *   "message": "Vote submitted successfully. Processing in background."
 * }
 */
const submitVote = asyncHandler(async (req, res) => {
  const voteData = req.body;
  const userId = req.user.id;

  const requestMeta = {
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  };

  const result = await voteService.submitVote(voteData, userId, requestMeta);

  const statusCode = result.isDuplicate ? 200 : 201;
  const message = result.isDuplicate
    ? 'Duplicate vote detected. Returning existing vote.'
    : 'Vote submitted successfully. Processing in background.';

  res.status(statusCode).json({
    success: true,
    data: result,
    message
  });
});

/**
 * GET /vote/status/:jobId
 * Check vote submission job status
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "status": "completed" | "pending" | "failed",
 *     "result": { ... }
 *   }
 * }
 */
const getVoteJobStatus = asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const { getJobStatus } = require('../jobs/jobQueue');
  const status = await getJobStatus(jobId);

  if (!status) {
    throw new CustomError('Job not found', 404);
  }

  res.status(200).json({
    success: true,
    data: status
  });
});

/**
 * GET /vote/encrypted-tally/:proposalId
 * Retrieve encrypted tally for a proposal
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "encryptedTally": "0x...",
 *     "voteCount": 42,
 *     "proposal": { ... }
 *   }
 * }
 */
const getEncryptedTally = asyncHandler(async (req, res) => {
  const { proposalId } = req.params;

  const result = await voteService.getEncryptedTally(proposalId);

  res.status(200).json({
    success: true,
    data: result,
    message: 'Decrypt this tally locally using your private key'
  });
});

// Server-side user decrypt endpoint removed for security; use client-side decryption.

/**
 * GET /vote/decrypted-tally/:proposalId
 * Public decryption of tally (if made publicly decryptable)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "decryptedTally": 123,
 *     "proof": "0x...",
 *     "voteCount": 42
 *   }
 * }
 */
const getDecryptedTally = asyncHandler(async (req, res) => {
  const { proposalId } = req.params;

  const result = await voteService.decryptTallyPublic(proposalId);

  res.status(200).json({
    success: true,
    data: result,
    message: 'Tally decrypted and verified'
  });
});

/**
 * GET /vote/my-votes
 * Get authenticated user's vote history
 */
const getMyVotes = asyncHandler(async (req, res) => {
  const { Vote } = require('../models');

  const votes = await Vote.find({ userId: req.user.id })
    .populate('proposalId', 'title startTime endTime')
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    data: { votes }
  });
});

module.exports = {
  submitVote,
  getVoteJobStatus,
  getEncryptedTally,
  getDecryptedTally,
  getMyVotes
};
