const express = require('express');
const { getQueueStats } = require('../jobs/jobQueue');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireAdmin } = require('../middleware/authorize');

const router = express.Router();

/**
 * Health and Metrics Routes
 * System status and monitoring
 */

// GET /health - Basic health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// GET /metrics - System metrics (admin only)
router.get('/metrics', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const queueStats = await getQueueStats();

  res.status(200).json({
    success: true,
    data: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      queues: queueStats,
      timestamp: new Date().toISOString()
    }
  });
}));

module.exports = router;
