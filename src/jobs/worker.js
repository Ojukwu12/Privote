const { Worker } = require('bullmq');
const Redis = require('ioredis');
const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../utils/logger');
const voteService = require('../services/voteService');
const relayerService = require('../fhe/relayerService');

/**
 * Background Worker
 * Processes jobs from BullMQ queues
 *
 * Workers:
 * - Vote worker: Process encrypted vote submissions to relayer
 * - Tally worker: Compute encrypted tallies
 *
 * Run with: npm run worker
 */

// Redis connection for workers
const connection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
  // Suppress BullMQ eviction policy warning
  // Note: If you control your Redis instance, set eviction policy to "noeviction"
  showFriendlyErrorStack: process.env.NODE_ENV !== 'production'
});

/**
 * Vote submission worker
 * Processes encrypted vote submissions to Zama relayer
 */
const voteWorker = new Worker(
  'vote-submissions',
  async (job) => {
    logger.info(`Processing vote job: ${job.id}`, job.data);

    try {
      const result = await voteService.processVoteSubmission(job.data);

      logger.info(`Vote job completed: ${job.id}`, result);
      return result;

    } catch (error) {
      logger.error(`Vote job failed: ${job.id}`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 5, // Process up to 5 votes concurrently
    limiter: {
      max: 10,
      duration: 1000 // Max 10 jobs per second
    }
  }
);

/**
 * Tally computation worker
 * Computes encrypted tallies for closed proposals
 */
const tallyWorker = new Worker(
  'tally-computation',
  async (job) => {
    logger.info(`Processing tally job: ${job.id}`, job.data);

    try {
      const { proposalId } = job.data;
      const result = await voteService.computeTally(proposalId);

      logger.info(`Tally job completed: ${job.id}`, result);
      return result;

    } catch (error) {
      logger.error(`Tally job failed: ${job.id}`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 2 // Process up to 2 tallies concurrently
  }
);

// Worker event handlers
voteWorker.on('completed', (job) => {
  logger.info(`Vote worker completed job: ${job.id}`);
});

voteWorker.on('failed', (job, err) => {
  logger.error(`Vote worker failed job: ${job.id}`, err);
});

tallyWorker.on('completed', (job) => {
  logger.info(`Tally worker completed job: ${job.id}`);
});

tallyWorker.on('failed', (job, err) => {
  logger.error(`Tally worker failed job: ${job.id}`, err);
});

/**
 * Initialize worker
 * Connect to MongoDB and Relayer SDK
 */
async function initializeWorker() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongoUri);
    logger.info('Worker connected to MongoDB');

    // Initialize Relayer SDK
    await relayerService.initialize();
    logger.info('Worker initialized Relayer SDK');

    // Log Redis connection status
    connection.on('connect', () => {
      logger.info('Worker connected to Redis successfully');
    });

    connection.on('error', (err) => {
      logger.error('Redis connection error in worker:', err);
    });

    logger.info('✅ Workers started and ready to process jobs');
    logger.info('   - Vote worker: Processing up to 5 votes concurrently');
    logger.info('   - Tally worker: Processing up to 2 tallies concurrently');

  } catch (error) {
    logger.error('Worker initialization failed:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  logger.info('Shutting down workers...');

  await Promise.all([
    voteWorker.close(),
    tallyWorker.close()
  ]);

  await mongoose.connection.close();
  await connection.quit();

  logger.info('Workers shut down gracefully');
  process.exit(0);
}

// Handle termination signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start worker if run directly
if (require.main === module) {
  initializeWorker().catch((error) => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  voteWorker,
  tallyWorker,
  initializeWorker,
  shutdown
};
