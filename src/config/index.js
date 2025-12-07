require('dotenv').config();

/**
 * Central configuration module
 * All environment variables and app settings
 *
 * DOCS ADAPTATION:
 * Contract addresses and chain IDs sourced from:
 * https://docs.zama.org/protocol/solidity-guides/smart-contract/configure/contract_addresses
 *
 * For Sepolia testnet (default):
 * - CHAIN_ID: 11155111
 * - GATEWAY_CHAIN_ID: 10901
 * - RELAYER_URL: https://relayer.testnet.zama.org
 */

const config = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/privote',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Authentication
  jwt: {
    secret: process.env.JWT_SECRET || 'change_this_secret_in_production',
    expiry: process.env.JWT_EXPIRY || '7d'
  },

  // Security
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
  },
  scrypt: {
    N: parseInt(process.env.SCRYPT_N) || 16384,
    r: parseInt(process.env.SCRYPT_R) || 8,
    p: parseInt(process.env.SCRYPT_P) || 1,
    keylen: parseInt(process.env.SCRYPT_KEYLEN) || 32
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // FHEVM / Zama Configuration
  fhevm: {
    // Project wallet private key (signs all transactions)
    projectPrivateKey: process.env.PROJECT_PRIVATE_KEY,

    // Relayer configuration
    relayerUrl: process.env.RELAYER_URL || 'https://relayer.testnet.zama.org',
    networkRpcUrl: process.env.NETWORK_RPC_URL || 'https://eth-sepolia.public.blastapi.io',

    // Chain IDs
    chainId: parseInt(process.env.CHAIN_ID) || 11155111, // Sepolia
    gatewayChainId: parseInt(process.env.GATEWAY_CHAIN_ID) || 10901,

    // Contract addresses (Sepolia defaults from Zama docs)
    aclContractAddress: process.env.ACL_CONTRACT_ADDRESS || '0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D',
    kmsContractAddress: process.env.KMS_CONTRACT_ADDRESS || '0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A',
    inputVerifierContractAddress: process.env.INPUT_VERIFIER_CONTRACT_ADDRESS || '0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0',
    verifyingContractAddressDecryption: process.env.VERIFYING_CONTRACT_ADDRESS_DECRYPTION || '0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478',
    verifyingContractAddressInputVerification: process.env.VERIFYING_CONTRACT_ADDRESS_INPUT_VERIFICATION || '0x483b9dE06E4E4C7D35CCf5837A1668487406D955',

    // Deployed Privote contract address (must be set after deployment)
    votingContractAddress: process.env.VOTING_CONTRACT_ADDRESS,

    // Mock mode for testing
    mockMode: process.env.RELAYER_MOCK === 'true'
  },

  // Optional integrations
  sentry: {
    dsn: process.env.SENTRY_DSN
  },

  // KMS (for production)
  kms: {
    provider: process.env.KMS_PROVIDER, // aws|gcp|azure
    keyId: process.env.KMS_KEY_ID
  }
};

// Validation helper
function validateConfig() {
  const errors = [];

  if (!config.jwt.secret || config.jwt.secret === 'change_this_secret_in_production') {
    errors.push('JWT_SECRET must be set to a secure value');
  }

  if (!config.fhevm.projectPrivateKey && config.nodeEnv !== 'test') {
    errors.push('PROJECT_PRIVATE_KEY must be set');
  }

  if (!config.mongoUri) {
    errors.push('MONGO_URI must be set');
  }

  if (errors.length > 0 && config.nodeEnv === 'production') {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }

  if (errors.length > 0) {
    console.warn('Configuration warnings:', errors);
  }
}

validateConfig();

module.exports = config;
