const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/authorize');
const { validate, proposalSchemas } = require('../middleware/validate');
const proposalController = require('../controllers/proposalController');
const { optionalAuthenticate } = require('../middleware/authenticate');

const router = express.Router();

/**
 * Proposal Routes
 * CRUD operations for voting proposals
 */

// POST /proposals - Create new proposal (admin only)
router.post(
  '/',
  authenticate,
  requireAdmin,
  validate(proposalSchemas.create),
  proposalController.createProposal
);

// GET /proposals - List proposals (public, optional auth for vote status)
router.get(
  '/',
  optionalAuthenticate,
  proposalController.listProposals
);

// GET /proposals/:id - Get proposal details (public, optional auth)
router.get(
  '/:id',
  optionalAuthenticate,
  validate(proposalSchemas.id, 'params'),
  proposalController.getProposal
);

// POST /proposals/:id/close - Close proposal and trigger tally (admin only)
router.post(
  '/:id/close',
  authenticate,
  requireAdmin,
  validate(proposalSchemas.id, 'params'),
  proposalController.closeProposal
);

module.exports = router;
