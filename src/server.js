const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
const errorController = require('./middleware/errorController');
const { apiLimiter } = require('./middleware/rateLimiter');
const relayerService = require('./fhe/relayerService');

// Import routes
const userRoutes = require('./routes/userRoutes');
const proposalRoutes = require('./routes/proposalRoutes');
const voteRoutes = require('./routes/voteRoutes');
const healthRoutes = require('./routes/healthRoutes');

/**
 * Express Application Setup
 * Main server configuration and middleware
 */

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy (for accurate IP in logs/rate limiting)
app.set('trust proxy', 1);

// Request logging (simple)
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Rate limiting (global)
app.use('/api/', apiLimiter);

// Mount routes
app.use('/api/users', userRoutes);
app.use('/api/keys', userRoutes); // Key routes under /api/keys
app.use('/api/proposals', proposalRoutes);
app.use('/api/vote', voteRoutes);
app.use('/api', healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Privote API',
    version: '1.0.0',
    description: 'Confidential DAO voting powered by Zama FHEVM',
    docs: '/api/docs'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error controller (must be last)
app.use(errorController);

/**
 * Database connection
 */
async function connectDatabase() {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    throw error;
  }
}

/**
 * Initialize services
 */
async function initializeServices() {
  try {
    // Initialize Relayer SDK (or shim in mock mode)
    if (config.fhevm.mockMode) {
      logger.warn('Running in MOCK mode - using FHE shim instead of real relayer');
      const fheShim = require('./fhe/fheShim');
      // Monkey-patch relayerService for testing
      relayerService.instance = await fheShim.createInstance();
      relayerService.initialized = true;
      relayerService.generateKeypair = () => fheShim.generateKeypair();
    } else {
      await relayerService.initialize();
    }
    logger.info('Relayer service initialized');
  } catch (error) {
    logger.error('Service initialization failed:', error);
    throw error;
  }
}

/**
 * Start server
 */
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();

    // Initialize services
    await initializeServices();

    // Start listening
    const server = app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
      logger.info(`Health check: http://localhost:${config.port}/api/health`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await mongoose.connection.close();
          logger.info('MongoDB connection closed');

          const { closeQueues } = require('./jobs/jobQueue');
          await closeQueues();

          logger.info('Graceful shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forcing shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if run directly
if (require.main === module) {
  startServer();
}

module.exports = app;
