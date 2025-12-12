const { ethers } = require('ethers');
const config = require('../config');
const logger = require('../utils/logger');
const CustomError = require('../utils/CustomError');
const relayerService = require('../fhe/relayerService');

/**
 * Contract Service
 * Handles all smart contract interactions for the Privote Voting Contract
 * 
 * Uses ethers.js to interact with the deployed PrivoteVoting.sol contract
 * All transactions are signed by the PROJECT_PRIVATE_KEY wallet
 */

// PrivoteVoting Contract ABI (essential methods only)
const VOTING_CONTRACT_ABI = [
  // View functions
  'function proposalCount() view returns (uint256)',
  'function getProposal(uint256 proposalId) view returns (string title, string description, uint256 startTime, uint256 endTime, bool closed, bool tallyComputed, uint256 voteCount)',
  'function hasAddressVoted(uint256 proposalId, address voter) view returns (bool)',
  'function getEncryptedTally(uint256 proposalId) view returns (bytes32)',
  
  // Write functions
  'function createProposal(string title, string description, uint256 startTime, uint256 endTime) returns (uint256)',
  'function submitVote(uint256 proposalId, bytes32 encryptedVote, bytes inputProof)',
  'function closeProposal(uint256 proposalId)',
  'function computeTally(uint256 proposalId)',
  
  // Events
  'event ProposalCreated(uint256 indexed proposalId, string title, uint256 startTime, uint256 endTime)',
  'event VoteSubmitted(uint256 indexed proposalId, address indexed voter)',
  'event ProposalClosed(uint256 indexed proposalId)',
  'event TallyComputed(uint256 indexed proposalId)'
];

class ContractService {
  constructor() {
    this.contract = null;
    this.wallet = null;
    this.provider = null;
    this.initialized = false;
  }

  /**
   * Initialize contract service
   * Must be called before any contract interactions
   */
  async initialize() {
    if (this.initialized) {
      logger.info('Contract service already initialized');
      return;
    }

    try {
      const contractAddress = config.fhevm.votingContractAddress;
      
      if (!contractAddress) {
        throw new CustomError(
          'VOTING_CONTRACT_ADDRESS not configured. Deploy the contract first.',
          500
        );
      }

      // Check if relayer service is initialized
      if (!relayerService.initialized) {
        logger.warn('Relayer service not initialized, initializing now...');
        await relayerService.initialize();
      }

      // Get wallet and provider from relayer service
      this.provider = relayerService.getProvider();
      this.wallet = relayerService.getProjectWallet();

      if (!this.provider || !this.wallet) {
        throw new Error('Failed to get provider or wallet from relayer service');
      }

      // Initialize contract instance
      this.contract = new ethers.Contract(
        contractAddress,
        VOTING_CONTRACT_ABI,
        this.wallet
      );

      logger.info('Contract service initialized', {
        contractAddress,
        walletAddress: this.wallet.address
      });

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize contract service:', {
        error: error.message,
        stack: error.stack,
        hasContractAddress: !!config.fhevm.votingContractAddress,
        hasPrivateKey: !!config.fhevm.projectPrivateKey,
        hasRelayerUrl: !!config.fhevm.relayerUrl,
        hasRpcUrl: !!config.fhevm.networkRpcUrl
      });
      throw new CustomError('Contract service initialization failed', 500, {
        error: error.message,
        details: 'Check that all FHEVM environment variables are set correctly'
      });
    }
  }

  /**
   * Submit an encrypted vote to the smart contract
   * 
   * @param {string} proposalId - Proposal ID
   * @param {string|string[]} encryptedVote - Encrypted vote data (handle or array of handles)
   * @param {string} inputProof - Input proof from FHE encryption
   * @param {string} userAddress - Voter's address
   * @returns {Promise<Object>} { txHash, receipt }
   */
  async submitVote(proposalId, encryptedVote, inputProof, userAddress) {
    this._ensureInitialized();

    try {
      logger.info('Submitting vote to contract', {
        proposalId,
        userAddress,
        hasProof: !!inputProof
      });

      // Parse encrypted vote handles
      let handles;
      if (typeof encryptedVote === 'string') {
        try {
          handles = JSON.parse(encryptedVote);
        } catch {
          handles = [encryptedVote];
        }
      } else if (Array.isArray(encryptedVote)) {
        handles = encryptedVote;
      } else {
        throw new CustomError('Invalid encryptedVote format', 400);
      }

      // Convert first handle to bytes32 for contract
      const voteHandle = handles[0];
      if (!voteHandle || !voteHandle.startsWith('0x')) {
        throw new CustomError('Invalid encrypted vote handle', 400);
      }

      // Ensure handle is bytes32 (32 bytes = 64 hex chars + 0x)
      const paddedHandle = voteHandle.padEnd(66, '0');

      // Convert proof to bytes
      const proofBytes = inputProof || '0x';

      logger.info('Calling contract submitVote', {
        proposalId,
        voteHandle: paddedHandle.substring(0, 20) + '...',
        proofLength: proofBytes.length
      });

      // Call smart contract
      const tx = await this.contract.submitVote(
        proposalId,
        paddedHandle,
        proofBytes
      );

      logger.info('Vote transaction submitted', {
        txHash: tx.hash,
        proposalId
      });

      // Wait for confirmation
      const receipt = await tx.wait();

      logger.info('Vote transaction confirmed', {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      });

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        receipt
      };

    } catch (error) {
      logger.error('Failed to submit vote to contract:', {
        error: error.message,
        code: error.code,
        proposalId
      });

      // Parse contract revert reasons
      let errorMessage = 'Failed to submit vote to blockchain';
      if (error.reason) {
        errorMessage += `: ${error.reason}`;
      } else if (error.message.includes('Already voted')) {
        errorMessage = 'You have already voted on this proposal';
      } else if (error.message.includes('Proposal closed')) {
        errorMessage = 'This proposal is no longer accepting votes';
      } else if (error.message.includes('Voting not started')) {
        errorMessage = 'Voting has not started yet for this proposal';
      } else if (error.message.includes('Voting ended')) {
        errorMessage = 'Voting period has ended for this proposal';
      }

      throw new CustomError(errorMessage, 500, {
        originalError: error.message,
        code: error.code,
        proposalId
      });
    }
  }

  /**
   * Create a proposal on-chain
   * @param {Object} params
   * @param {string} params.title
   * @param {string} params.description
   * @param {number} params.startTimeSec - unix seconds
   * @param {number} params.endTimeSec - unix seconds
   * @returns {Promise<{proposalId: number, txHash: string, receipt: Object}>}
   */
  async createProposalOnChain({ title, description, startTimeSec, endTimeSec }) {
    this._ensureInitialized();

    try {
      logger.info('Creating proposal on-chain', { title, startTimeSec, endTimeSec });

      const tx = await this.contract.createProposal(
        title,
        description,
        startTimeSec,
        endTimeSec
      );

      const receipt = await tx.wait();

      // Parse ProposalCreated event for proposalId
      let proposalId;
      try {
        for (const log of receipt.logs) {
          try {
            const parsed = this.contract.interface.parseLog(log);
            if (parsed && parsed.name === 'ProposalCreated') {
              proposalId = Number(parsed.args.proposalId);
              break;
            }
          } catch (e) {
            // ignore non-matching logs
          }
        }
      } catch (parseErr) {
        logger.warn('Could not parse ProposalCreated event; falling back to proposalCount', parseErr);
      }

      if (proposalId === undefined) {
        proposalId = Number(await this.contract.proposalCount());
      }

      logger.info('Proposal created on-chain', {
        txHash: receipt.hash,
        proposalId
      });

      return {
        proposalId,
        txHash: receipt.hash,
        receipt
      };
    } catch (error) {
      logger.error('Failed to create proposal on-chain:', error);
      throw new CustomError('Failed to create proposal on blockchain', 500, {
        error: error.message
      });
    }
  }

  /**
   * Check if an address has voted on a proposal
   * 
   * @param {string} proposalId - Proposal ID
   * @param {string} address - Voter address
   * @returns {Promise<boolean>}
   */
  async hasVoted(proposalId, address) {
    this._ensureInitialized();

    try {
      const hasVoted = await this.contract.hasAddressVoted(proposalId, address);
      return hasVoted;
    } catch (error) {
      logger.error('Failed to check vote status:', error);
      throw new CustomError('Failed to verify vote status', 500, {
        error: error.message
      });
    }
  }

  /**
   * Get encrypted tally from contract
   * 
   * @param {string} proposalId - Proposal ID  
   * @returns {Promise<string>} Encrypted tally handle (bytes32)
   */
  async getEncryptedTally(proposalId) {
    this._ensureInitialized();

    try {
      const tallyBytes32 = await this.contract.getEncryptedTally(proposalId);
      return tallyBytes32;
    } catch (error) {
      logger.error('Failed to get encrypted tally:', error);
      throw new CustomError('Failed to retrieve encrypted tally from contract', 500, {
        error: error.message
      });
    }
  }

  /**
   * Close a proposal (admin only)
   * 
   * @param {string} proposalId - Proposal ID
   * @returns {Promise<Object>} { txHash, receipt }
   */
  async closeProposal(proposalId) {
    this._ensureInitialized();

    try {
      logger.info('Closing proposal on contract', { proposalId });

      const tx = await this.contract.closeProposal(proposalId);
      const receipt = await tx.wait();

      logger.info('Proposal closed successfully', {
        txHash: receipt.hash,
        proposalId
      });

      return {
        txHash: receipt.hash,
        receipt
      };
    } catch (error) {
      logger.error('Failed to close proposal:', error);
      throw new CustomError('Failed to close proposal on blockchain', 500, {
        error: error.message
      });
    }
  }

  /**
   * Compute tally on contract (admin only)
   * Triggers on-chain homomorphic computation
   * 
   * @param {string} proposalId - Proposal ID
   * @returns {Promise<Object>} { txHash, receipt }
   */
  async computeTally(proposalId) {
    this._ensureInitialized();

    try {
      logger.info('Computing tally on contract', { proposalId });

      const tx = await this.contract.computeTally(proposalId);
      const receipt = await tx.wait();

      logger.info('Tally computation completed', {
        txHash: receipt.hash,
        proposalId
      });

      return {
        txHash: receipt.hash,
        receipt
      };
    } catch (error) {
      logger.error('Failed to compute tally:', error);
      throw new CustomError('Failed to compute tally on blockchain', 500, {
        error: error.message
      });
    }
  }

  /**
   * Get proposal details from contract
   * 
   * @param {string} proposalId - Proposal ID
   * @returns {Promise<Object>} Proposal data
   */
  async getProposal(proposalId) {
    this._ensureInitialized();

    try {
      const proposal = await this.contract.getProposal(proposalId);
      return {
        title: proposal.title,
        description: proposal.description,
        startTime: Number(proposal.startTime),
        endTime: Number(proposal.endTime),
        closed: proposal.closed,
        tallyComputed: proposal.tallyComputed,
        voteCount: Number(proposal.voteCount)
      };
    } catch (error) {
      logger.error('Failed to get proposal from contract:', error);
      throw new CustomError('Failed to retrieve proposal from blockchain', 500, {
        error: error.message
      });
    }
  }

  /**
   * Ensure service is initialized
   * @private
   */
  _ensureInitialized() {
    if (!this.initialized || !this.contract) {
      throw new CustomError('Contract service not initialized. Call initialize() first.', 500);
    }
  }
}

// Singleton instance
const contractService = new ContractService();

module.exports = contractService;
