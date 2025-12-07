const { Queue } = require('bullmq');
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Job Queue Management using BullMQ
 *
 * Queues:
 * - voteQueue: Process encrypted vote submissions to relayer
 * - tallyQueue: Compute encrypted tallies after proposal closes
 *
 * Redis connection is shared across queues and workers
 */

// Redis connection
const connection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

connection.on('connect', () => {
  logger.info('Redis connected for job queue');
});

connection.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

// Vote submission queue
const voteQueue = new Queue('vote-submissions', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500 // Keep last 500 failed jobs
  }
});

// Tally computation queue
const tallyQueue = new Queue('tally-computation', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: 50,
    removeOnFail: 200
  }
});

/**
 * Add vote submission job
 *
 * @param {Object} data - { voteId, proposalId, userId, encryptedVote, inputProof }
 * @returns {Promise<string>} Job ID
 */
async function addVoteJob(data) {
  const jobId = uuidv4();

  await voteQueue.add('process-vote', data, {
    jobId,
    priority: 1
  });

  logger.info(`Vote job queued: ${jobId}`);
  return jobId;
}

/**
 * Add tally computation job
 *
 * @param {Object} data - { proposalId }
 * @returns {Promise<string>} Job ID
 */
async function addTallyJob(data) {
  const jobId = uuidv4();

  await tallyQueue.add('compute-tally', data, {
    jobId,
    priority: 2,
    delay: 5000 // Delay 5 seconds to allow final votes to process
  });

  logger.info(`Tally job queued: ${jobId}`);
  return jobId;
}

/**
 * Get job status
 *
 * @param {string} jobId
 * @returns {Promise<Object|null>} { status, result, error }
 */
async function getJobStatus(jobId) {
  // Check vote queue first
  let job = await voteQueue.getJob(jobId);

  if (!job) {
    // Check tally queue
    job = await tallyQueue.getJob(jobId);
  }

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;

  const status = {
    id: job.id,
    status: state,
    progress,
    data: job.data
  };

  if (state === 'completed') {
    status.result = job.returnvalue;
  }

  if (state === 'failed') {
    status.error = job.failedReason;
  }

  return status;
}

/**
 * Get queue stats
 *
 * @returns {Promise<Object>} Queue statistics
 */
async function getQueueStats() {
  const [voteWaiting, voteActive, voteCompleted, voteFailed] = await Promise.all([
    voteQueue.getWaitingCount(),
    voteQueue.getActiveCount(),
    voteQueue.getCompletedCount(),
    voteQueue.getFailedCount()
  ]);

  const [tallyWaiting, tallyActive, tallyCompleted, tallyFailed] = await Promise.all([
    tallyQueue.getWaitingCount(),
    tallyQueue.getActiveCount(),
    tallyQueue.getCompletedCount(),
    tallyQueue.getFailedCount()
  ]);

  return {
    voteQueue: {
      waiting: voteWaiting,
      active: voteActive,
      completed: voteCompleted,
      failed: voteFailed
    },
    tallyQueue: {
      waiting: tallyWaiting,
      active: tallyActive,
      completed: tallyCompleted,
      failed: tallyFailed
    }
  };
}

/**
 * Close all queues gracefully
 */
async function closeQueues() {
  await Promise.all([
    voteQueue.close(),
    tallyQueue.close()
  ]);
  await connection.quit();
  logger.info('Job queues closed');
}

module.exports = {
  voteQueue,
  tallyQueue,
  addVoteJob,
  addTallyJob,
  getJobStatus,
  getQueueStats,
  closeQueues
};
