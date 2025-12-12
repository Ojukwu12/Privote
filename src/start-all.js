#!/usr/bin/env node

/**
 * Start both API server and background worker
 * Useful for development and single-instance deployments
 * 
 * Usage: npm run start:with-worker
 * or: node src/start-all.js
 */

const { spawn } = require('child_process');
const logger = require('./utils/logger');

logger.info('Starting Privote with API server and background worker...');

// Start API server
const server = spawn('node', ['src/server.js'], {
  stdio: 'inherit',
  env: process.env
});

// Start background worker
const worker = spawn('node', ['src/jobs/worker.js'], {
  stdio: 'inherit',
  env: process.env
});

// Handle server exit
server.on('exit', (code) => {
  logger.error(`API server exited with code ${code}`);
  worker.kill();
  process.exit(code);
});

// Handle worker exit
worker.on('exit', (code) => {
  logger.error(`Worker exited with code ${code}`);
  server.kill();
  process.exit(code);
});

// Handle termination signals
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  server.kill('SIGTERM');
  worker.kill('SIGTERM');
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  server.kill('SIGINT');
  worker.kill('SIGINT');
});

logger.info('✅ Both API server and worker started');
logger.info('   - API server: Running on configured PORT');
logger.info('   - Worker: Processing jobs from Redis queue');
