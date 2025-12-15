#!/usr/bin/env node

/**
 * Check what proposals exist on the contract
 */

require('dotenv').config();
const { ethers } = require('ethers');
const config = require('../src/config');

const VOTING_CONTRACT_ABI = [
  "function proposals(uint256) external view returns (string memory title, string memory description, uint256 startTime, uint256 endTime, bool closed, uint256 yesVotes, uint256 noVotes)",
  "function proposalCount() external view returns (uint256)"
];

async function checkContractProposals() {
  try {
    console.log('=== Checking Contract State ===\n');

    const provider = new ethers.JsonRpcProvider(config.fhevm.networkRpcUrl);
    const wallet = new ethers.Wallet(config.fhevm.projectPrivateKey, provider);
    const contract = new ethers.Contract(
      config.fhevm.votingContractAddress,
      VOTING_CONTRACT_ABI,
      wallet
    );

    console.log(`Contract: ${contract.target}`);
    console.log(`Network: Sepolia Testnet\n`);

    // Get proposal count
    console.log('1. Checking proposal count...');
    try {
      const count = await contract.proposalCount();
      console.log(`   ✅ Proposal count: ${count.toString()}\n`);

      if (count === 0n) {
        console.log('   ⚠️  No proposals exist on the contract!');
        console.log('   This means proposals were created in MongoDB but not deployed to blockchain.\n');
        console.log('   Solution: Create a new proposal via the admin API endpoint:');
        console.log('   POST /api/proposals - this will automatically deploy to blockchain.');
        return;
      }

      // Check each proposal
      console.log('2. Checking existing proposals...\n');
      for (let i = 0; i < count; i++) {
        try {
          const proposal = await contract.proposals(i);
          console.log(`   Proposal ${i}:`);
          console.log(`   - Title: ${proposal.title || '(empty)'}`);
          console.log(`   - Start: ${new Date(Number(proposal.startTime) * 1000).toISOString()}`);
          console.log(`   - End: ${new Date(Number(proposal.endTime) * 1000).toISOString()}`);
          console.log(`   - Closed: ${proposal.closed}`);
          console.log(`   - Yes votes: ${proposal.yesVotes.toString()}`);
          console.log(`   - No votes: ${proposal.noVotes.toString()}`);
          console.log('');
        } catch (err) {
          console.log(`   ❌ Failed to read proposal ${i}: ${err.message}\n`);
        }
      }

    } catch (error) {
      console.log(`   ❌ Contract call failed: ${error.message}`);
      console.log('\n   Possible issues:');
      console.log('   - Contract not deployed at this address');
      console.log('   - Wrong network (not Sepolia)');
      console.log('   - Contract ABI mismatch');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkContractProposals();
