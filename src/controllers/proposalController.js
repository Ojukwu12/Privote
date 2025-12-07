const proposalService = require('../services/proposalService');
const voteService = require('../services/voteService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Proposal Controller
 * HTTP handlers for proposal management
 *
 * Frontend integration:
 * - List proposals to display on voting UI
 * - Filter by status: open, closed, upcoming
 * - Admin users can create and close proposals
 */

/**
 * POST /proposals
 * Create a new proposal (admin only)
 *
 * Body:
 * {
 *   "title": "Increase treasury allocation",
 *   "description": "Detailed proposal text...",
 *   "startTime": "2025-01-01T00:00:00Z",
 *   "endTime": "2025-01-07T23:59:59Z",
 *   "requiredRole": "user"
 * }
 */
const createProposal = asyncHandler(async (req, res) => {
  const proposalData = req.body;
  const createdBy = req.user.id;

  const requestMeta = {
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  };

  const proposal = await proposalService.createProposal(
    proposalData,
    createdBy,
    requestMeta
  );

  res.status(201).json({
    success: true,
    data: { proposal },
    message: 'Proposal created successfully'
  });
});

/**
 * GET /proposals
 * List proposals with optional filters
 *
 * Query params:
 * - status: open | closed | upcoming | ended
 * - role: user | admin
 * - page: 1 (default)
 * - limit: 20 (default)
 */
const listProposals = asyncHandler(async (req, res) => {
  const filters = {
    status: req.query.status,
    role: req.query.role,
    page: parseInt(req.query.page) || 1,
    limit: parseInt(req.query.limit) || 20
  };

  const result = await proposalService.listProposals(filters);

  res.status(200).json({
    success: true,
    data: result
  });
});

/**
 * GET /proposals/:id
 * Get proposal details
 */
const getProposal = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const proposal = await proposalService.getProposal(id);

  // Add user's vote status if authenticated
  if (req.user) {
    const hasVoted = await voteService.hasUserVoted(id, req.user.id);
    proposal.hasUserVoted = hasVoted;
  }

  res.status(200).json({
    success: true,
    data: { proposal }
  });
});

/**
 * POST /proposals/:id/close
 * Close a proposal and trigger tallying (admin only)
 */
const closeProposal = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const requestMeta = {
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  };

  const proposal = await proposalService.closeProposal(
    id,
    req.user.id,
    requestMeta
  );

  // Queue tally computation
  const { addTallyJob } = require('../jobs/jobQueue');
  const jobId = await addTallyJob({ proposalId: id });

  res.status(200).json({
    success: true,
    data: { proposal, tallyJobId: jobId },
    message: 'Proposal closed. Tally computation queued.'
  });
});

module.exports = {
  createProposal,
  listProposals,
  getProposal,
  closeProposal
};
