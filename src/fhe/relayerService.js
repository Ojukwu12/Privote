// Use the CommonJS entrypoint from relayer-sdk exports
const { createInstance } = require('@zama-fhe/relayer-sdk/node');
const { ethers } = require('ethers');
const config = require('../config');
const logger = require('../utils/logger');
const CustomError = require('../utils/CustomError');

/**
 * DOCS ADAPTATION NOTE:
 * This implementation follows the official Zama Relayer SDK documentation:
 * https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer/initialization
 *
 * All contract addresses and chain IDs are pulled from environment variables
 * as per the official SepoliaConfig pattern shown in the docs.
 *
 * If using a different network (mainnet, custom testnet), update .env with
 * the appropriate values from the Zama contract addresses page.
 */

class RelayerService {
  constructor() {
    this.instance = null;
    this.provider = null;
    this.projectWallet = null;
    this.initialized = false;
  }

  /**
   * Initialize the Relayer SDK FhevmInstance
   * Must be called before any FHE operations
   *
   * @throws {CustomError} if configuration is invalid or initialization fails
   */
  async initialize() {
    if (this.initialized) {
      logger.info('Relayer SDK already initialized');
      return;
    }

    try {
      // Validate required configuration
      this._validateConfig();

      // Initialize ethers provider for the host chain
      this.provider = new ethers.JsonRpcProvider(config.fhevm.networkRpcUrl);

      // Initialize project wallet (signs all transactions)
      this.projectWallet = new ethers.Wallet(
        config.fhevm.projectPrivateKey,
        this.provider
      );

      const walletAddress = await this.projectWallet.getAddress();
      logger.info(`Project wallet initialized: ${walletAddress}`);

      // Check wallet balance (warn if low)
      const balance = await this.provider.getBalance(walletAddress);
      const balanceEth = ethers.formatEther(balance);
      logger.info(`Project wallet balance: ${balanceEth} ETH`);

      if (parseFloat(balanceEth) < 0.01) {
        logger.warn('Project wallet balance is low. Fund wallet to continue operations.');
      }

      // Create FhevmInstance using official Relayer SDK
      // Follows the pattern from: https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer/initialization
      this.instance = await createInstance({
        // ACL_CONTRACT_ADDRESS (FHEVM Host chain)
        aclContractAddress: config.fhevm.aclContractAddress,

        // KMS_VERIFIER_CONTRACT_ADDRESS (FHEVM Host chain)
        kmsContractAddress: config.fhevm.kmsContractAddress,

        // INPUT_VERIFIER_CONTRACT_ADDRESS (FHEVM Host chain)
        inputVerifierContractAddress: config.fhevm.inputVerifierContractAddress,

        // DECRYPTION_ADDRESS (Gateway chain)
        verifyingContractAddressDecryption: config.fhevm.verifyingContractAddressDecryption,

        // INPUT_VERIFICATION_ADDRESS (Gateway chain)
        verifyingContractAddressInputVerification: config.fhevm.verifyingContractAddressInputVerification,

        // FHEVM Host chain id
        chainId: config.fhevm.chainId,

        // Gateway chain id
        gatewayChainId: config.fhevm.gatewayChainId,

        // Optional RPC provider to host chain
        network: config.fhevm.networkRpcUrl,

        // Relayer URL
        relayerUrl: config.fhevm.relayerUrl
      });

      this.initialized = true;
      logger.info('Relayer SDK initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Relayer SDK:', error);
      throw new CustomError('Relayer SDK initialization failed', 500, { error: error.message });
    }
  }

  /**
   * Validate required configuration parameters
   * @private
   */
  _validateConfig() {
    const required = [
      'aclContractAddress',
      'kmsContractAddress',
      'inputVerifierContractAddress',
      'verifyingContractAddressDecryption',
      'verifyingContractAddressInputVerification',
      'chainId',
      'gatewayChainId',
      'networkRpcUrl',
      'relayerUrl',
      'projectPrivateKey'
    ];

    const missing = required.filter(key => !config.fhevm[key]);

    if (missing.length > 0) {
      throw new CustomError(
        `Missing required FHEVM configuration: ${missing.join(', ')}`,
        500
      );
    }
  }

  /**
   * Create encrypted input buffer for a contract
   * Used to encrypt vote data before submission
   *
   * @param {string} contractAddress - Target contract address
   * @param {string} userAddress - User's wallet address (or public key identifier)
   * @returns {Object} Input buffer with add methods
   */
  createEncryptedInput(contractAddress, userAddress) {
    this._ensureInitialized();
    return this.instance.createEncryptedInput(contractAddress, userAddress);
  }

  /**
   * Encrypt and upload inputs to the relayer
   * Returns handles and proof for use in contract calls
   *
   * @param {Object} inputBuffer - Buffer created by createEncryptedInput
   * @returns {Promise<Object>} { handles: string[], inputProof: string }
   */
  async encryptInput(inputBuffer) {
    this._ensureInitialized();
    try {
      const encrypted = await inputBuffer.encrypt();
      return encrypted;
    } catch (error) {
      logger.error('Failed to encrypt input:', error);
      throw new CustomError('Input encryption failed', 500, { error: error.message });
    }
  }

  /**
   * Public decrypt - retrieve plaintext for publicly decryptable ciphertexts
   * Used to fetch and verify encrypted tallies after proposal closes
   * Falls back to mock data if relayer is unavailable (useful for development/testing)
   *
   * @param {string[]} handles - Array of ciphertext handles
   * @returns {Promise<Object>} { clearValues, abiEncodedClearValues, decryptionProof }
   */
  async publicDecrypt(handles) {
    this._ensureInitialized();
    try {
      logger.info('Requesting public decryption from Zama relayer', { handleCount: handles.length });
      const results = await this.instance.publicDecrypt(handles);
      logger.info('Public decrypt succeeded via Zama relayer', { resultKeys: Object.keys(results) });
      return results;
    } catch (error) {
      logger.error('Public decryption via Zama relayer failed:', {
        error: error.message,
        stack: error.stack,
        handles: handles
      });
      throw new CustomError(
        'Failed to decrypt data using Zama relayer. Ensure the ciphertext is publicly decryptable and the relayer service is available.',
        500,
        { 
          originalError: error.message,
          handleCount: handles.length,
          relayerUrl: config.fhevm.relayerUrl
        }
      );
    }
  }



  /**
   * Compute homomorphic sum of encrypted values
   * Performs homomorphic addition of multiple encrypted vote handles
   * Returns a single encrypted handle representing the sum
   *
   * @param {string[]} encryptedHandles - Array of encrypted vote handles
   * @returns {Promise<string>} Encrypted sum handle
   */
  async computeHomomorphicSum(encryptedHandles) {
    this._ensureInitialized();
    
    if (!encryptedHandles || encryptedHandles.length === 0) {
      throw new CustomError('No encrypted handles provided for tally', 400);
    }

    try {
      logger.info(`Computing homomorphic sum of ${encryptedHandles.length} encrypted values`);

      // If only one handle, return it directly
      if (encryptedHandles.length === 1) {
        logger.info('Single encrypted vote, returning handle directly');
        return encryptedHandles[0];
      }

      // Note: Zama SDK may not have computeHomomorphicSum directly
      // Instead, we need to perform homomorphic operations on-chain
      // For now, this method indicates the operation should happen via smart contract
      logger.warn('Homomorphic sum should be computed on-chain via smart contract');
      throw new CustomError(
        'Homomorphic tally computation must be performed on-chain via the voting contract',
        501,
        {
          message: 'Call contract.computeTally() instead of computing sum off-chain',
          handlesCount: encryptedHandles.length
        }
      );

    } catch (error) {
      logger.error('Failed to compute homomorphic sum:', error);
      throw new CustomError('Homomorphic sum computation failed', 500, { 
        error: error.message,
        handlesCount: encryptedHandles.length 
      });
    }
  }

  /**
   * User decrypt - re-encrypt ciphertext under user's public key
   * Allows users to decrypt their own data without exposing to blockchain
   *
   * @param {Array} handleContractPairs - Array of { handle, contractAddress }
   * @param {string} privateKey - User's FHE private key
   * @param {string} publicKey - User's FHE public key
   * @param {string} signature - EIP-712 signature
   * @param {string[]} contractAddresses - List of contract addresses
   * @param {string} userAddress - User's address
   * @param {string} startTimeStamp - Request start time
   * @param {string} durationDays - Duration in days
   * @returns {Promise<Object>} Decrypted values keyed by handle
   */
  async userDecrypt(handleContractPairs, privateKey, publicKey, signature, contractAddresses, userAddress, startTimeStamp, durationDays) {
    this._ensureInitialized();
    try {
      const result = await this.instance.userDecrypt(
        handleContractPairs,
        privateKey,
        publicKey,
        signature,
        contractAddresses,
        userAddress,
        startTimeStamp,
        durationDays
      );
      return result;
    } catch (error) {
      logger.error('Failed to user decrypt:', error);
      throw new CustomError('User decryption failed', 500, { error: error.message });
    }
  }

  /**
   * Generate FHE keypair for a new user
   * Uses the relayer SDK's keypair generation
   *
   * @returns {Object} { publicKey: string, privateKey: string }
   */
  generateKeypair() {
    this._ensureInitialized();
    try {
      return this.instance.generateKeypair();
    } catch (error) {
      logger.error('Failed to generate keypair:', error);
      throw new CustomError('Keypair generation failed', 500, { error: error.message });
    }
  }

  /**
   * Create EIP-712 message for user decryption request
   *
   * @param {string} publicKey - User's public key
   * @param {string[]} contractAddresses - Contracts to access
   * @param {string} startTimeStamp - Start time
   * @param {string} durationDays - Duration
   * @returns {Object} EIP-712 typed data
   */
  createEIP712(publicKey, contractAddresses, startTimeStamp, durationDays) {
    this._ensureInitialized();
    return this.instance.createEIP712(publicKey, contractAddresses, startTimeStamp, durationDays);
  }

  /**
   * Get project wallet instance
   * @returns {ethers.Wallet}
   */
  getProjectWallet() {
    this._ensureInitialized();
    return this.projectWallet;
  }

  /**
   * Get provider instance
   * @returns {ethers.Provider}
   */
  getProvider() {
    this._ensureInitialized();
    return this.provider;
  }

  /**
   * Check if service is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized || !this.instance) {
      throw new CustomError('Relayer SDK not initialized. Call initialize() first.', 500);
    }
  }
}

// Singleton instance
const relayerService = new RelayerService();

module.exports = relayerService;
