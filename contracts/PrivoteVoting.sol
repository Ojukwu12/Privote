// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * Privote Voting Contract
 * Confidential DAO voting using Zama FHEVM
 *
 * DOCS ADAPTATION:
 * This contract follows Zama FHEVM Solidity patterns:
 * - https://docs.zama.org/protocol/solidity-guides/smart-contract/inputs
 * - https://docs.zama.org/protocol/solidity-guides/smart-contract/operations
 * - https://docs.zama.org/protocol/solidity-guides/smart-contract/oracle
 *
 * Key features:
 * - Encrypted vote storage
 * - Homomorphic tally computation
 * - Public decryption of results after voting ends
 * - ACL-based access control
 */

contract PrivoteVoting is SepoliaConfig {
    // Proposal struct
    struct Proposal {
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        bool closed;
        euint64 encryptedTally; // Encrypted vote count
        bool tallyComputed;
        address creator;
        uint256 voteCount;
    }

    // State variables
    address public owner;
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => euint64)) private votes;
    mapping(uint256 => address[]) private proposalVoters;

    // Events
    event ProposalCreated(uint256 indexed proposalId, string title, uint256 startTime, uint256 endTime);
    event VoteSubmitted(uint256 indexed proposalId, address indexed voter);
    event ProposalClosed(uint256 indexed proposalId);
    event TallyComputed(uint256 indexed proposalId);
    event TallyRevealed(uint256 indexed proposalId, uint64 result);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier proposalExists(uint256 proposalId) {
        require(proposalId > 0 && proposalId <= proposalCount, "Invalid proposal");
        _;
    }

    modifier proposalActive(uint256 proposalId) {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.closed, "Proposal closed");
        require(block.timestamp >= proposal.startTime, "Voting not started");
        require(block.timestamp <= proposal.endTime, "Voting ended");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * Create a new proposal
     */
    function createProposal(
        string memory title,
        string memory description,
        uint256 startTime,
        uint256 endTime
    ) external onlyOwner returns (uint256) {
        require(startTime > block.timestamp, "Start time must be in future");
        require(endTime > startTime, "End time must be after start time");

        proposalCount++;
        uint256 proposalId = proposalCount;

        proposals[proposalId] = Proposal({
            title: title,
            description: description,
            startTime: startTime,
            endTime: endTime,
            closed: false,
            encryptedTally: FHE.asEuint64(0),
            tallyComputed: false,
            creator: msg.sender,
            voteCount: 0
        });

        emit ProposalCreated(proposalId, title, startTime, endTime);
        return proposalId;
    }

    /**
     * Submit an encrypted vote
     * Uses Zama encrypted inputs pattern
     */
    function submitVote(
        uint256 proposalId,
        externalEuint64 encryptedVote,
        bytes calldata inputProof
    ) external proposalExists(proposalId) proposalActive(proposalId) {
        require(!hasVoted[proposalId][msg.sender], "Already voted");

        // Convert external encrypted input to euint64
        euint64 vote = FHE.fromExternal(encryptedVote, inputProof);

        // Store encrypted vote
        votes[proposalId][msg.sender] = vote;
        hasVoted[proposalId][msg.sender] = true;
        proposalVoters[proposalId].push(msg.sender);

        // Allow voter to access their vote
        FHE.allow(vote, msg.sender);

        // Increment vote count
        proposals[proposalId].voteCount++;

        emit VoteSubmitted(proposalId, msg.sender);
    }

    /**
     * Close proposal (admin only)
     */
    function closeProposal(uint256 proposalId) 
        external 
        onlyOwner 
        proposalExists(proposalId) 
    {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.closed, "Already closed");
        require(block.timestamp > proposal.endTime, "Voting period not ended");

        proposal.closed = true;
        emit ProposalClosed(proposalId);
    }

    /**
     * Compute encrypted tally
     * Homomorphically adds all encrypted votes
     */
    function computeTally(uint256 proposalId) 
        external 
        onlyOwner 
        proposalExists(proposalId) 
    {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.closed, "Proposal must be closed");
        require(!proposal.tallyComputed, "Tally already computed");

        // Initialize tally to zero
        euint64 tally = FHE.asEuint64(0);

        address[] storage voters = proposalVoters[proposalId];
        uint256 voterCount = voters.length;

        for (uint256 i = 0; i < voterCount; i++) {
            address voter = voters[i];
            euint64 v = votes[proposalId][voter];
            tally = FHE.add(tally, v);
        }

        proposal.encryptedTally = tally;
        proposal.tallyComputed = true;

        // Make tally publicly decryptable for anyone to verify
        FHE.makePubliclyDecryptable(tally);

        emit TallyComputed(proposalId);
    }

    /**
     * Get encrypted tally
     * Returns handle for off-chain decryption
     */
    function getEncryptedTally(uint256 proposalId) 
        external 
        view 
        proposalExists(proposalId) 
        returns (bytes32) 
    {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.tallyComputed, "Tally not computed");

        return FHE.toBytes32(proposal.encryptedTally);
    }

    /**
     * Get voter's encrypted vote
     * Only the voter can access their own vote
     */
    function getMyVote(uint256 proposalId) 
        external 
        view 
        proposalExists(proposalId) 
        returns (bytes32) 
    {
        require(hasVoted[proposalId][msg.sender], "Haven't voted");
        return FHE.toBytes32(votes[proposalId][msg.sender]);
    }

    /**
     * Check if address has voted
     */
    function hasAddressVoted(uint256 proposalId, address voter) 
        external 
        view 
        returns (bool) 
    {
        return hasVoted[proposalId][voter];
    }

    /**
     * Get proposal details
     */
    function getProposal(uint256 proposalId) 
        external 
        view 
        proposalExists(proposalId) 
        returns (
            string memory title,
            string memory description,
            uint256 startTime,
            uint256 endTime,
            bool closed,
            bool tallyComputed,
            uint256 voteCount
        ) 
    {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.title,
            proposal.description,
            proposal.startTime,
            proposal.endTime,
            proposal.closed,
            proposal.tallyComputed,
            proposal.voteCount
        );
    }

    /**
     * Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
