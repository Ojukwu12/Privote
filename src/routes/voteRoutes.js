const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { validate, voteSchemas } = require('../middleware/validate');
const { voteLimiter } = require('../middleware/rateLimiter');
const voteController = require('../controllers/voteController');

const router = express.Router();

/**
 * Vote Routes
 * Vote submission and tally retrieval
 */

// POST /vote/submit - Submit encrypted vote
router.post(
  '/submit',
  authenticate,
  voteLimiter,
  validate(voteSchemas.submit),
  voteController.submitVote
);

// GET /vote/status/:jobId - Check vote submission job status
router.get(
  '/status/:jobId',
  authenticate,
  voteController.getVoteJobStatus
);

// GET /vote/encrypted-tally/:proposalId - Get encrypted tally
router.get(
  '/encrypted-tally/:proposalId',
  authenticate,
  voteController.getEncryptedTally
);

// GET /vote/decrypted-tally/:proposalId - Get publicly decrypted tally
router.get(
  '/decrypted-tally/:proposalId',
  voteController.getDecryptedTally
);

// POST /vote/decrypt/:proposalId - Decrypt tally using user's private key
// Server-side user decrypt route removed. Client-side decryption is recommended.

// GET /vote/my-votes - Get user's vote history
router.get(
  '/my-votes',
  authenticate,
  voteController.getMyVotes
);

module.exports = router;
