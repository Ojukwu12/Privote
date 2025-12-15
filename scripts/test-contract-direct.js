#!/usr/bin/env node

/**
 * Test contract interaction directly
 * This helps diagnose blockchain submission issues
 */

require('dotenv').config();
const { ethers } = require('ethers');
const config = require('../src/config');

// Simple ABI for submitVote function
const VOTING_CONTRACT_ABI = [
  "function submitVote(uint256 proposalId, bytes32 encryptedVote, bytes memory inputProof) external"
];

async function testContractSubmission() {
  try {
    console.log('=== Testing Contract Submission ===\n');

    // Check required env vars
    console.log('1. Checking configuration...');
    const required = {
      'PROJECT_PRIVATE_KEY': config.fhevm.projectPrivateKey,
      'VOTING_CONTRACT_ADDRESS': config.fhevm.votingContractAddress,
      'NETWORK_RPC_URL': config.fhevm.networkRpcUrl
    };

    for (const [key, value] of Object.entries(required)) {
      if (!value) {
        console.log(`   ❌ ${key}: NOT SET`);
        process.exit(1);
      }
      console.log(`   ✅ ${key}: ${value.substring(0, 10)}...`);
    }

    // Create provider and wallet
    console.log('\n2. Connecting to network...');
    const provider = new ethers.JsonRpcProvider(config.fhevm.networkRpcUrl);
    const wallet = new ethers.Wallet(config.fhevm.projectPrivateKey, provider);
    
    console.log(`   Wallet address: ${wallet.address}`);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance === 0n) {
      console.log('\n   ⚠️  WARNING: Wallet has 0 ETH!');
      console.log('   You need Sepolia testnet ETH to submit transactions.');
      console.log('   Get some from: https://sepoliafaucet.com/');
      process.exit(1);
    }

    // Create contract instance
    console.log('\n3. Connecting to contract...');
    const contract = new ethers.Contract(
      config.fhevm.votingContractAddress,
      VOTING_CONTRACT_ABI,
      wallet
    );
    console.log(`   Contract: ${contract.target}`);

    // Test parameters
    const proposalId = 1; // The test proposal's contract ID
    const encryptedVote = '0x' + '0'.repeat(64); // Mock bytes32
    const inputProof = '0x'; // Empty proof

    console.log('\n4. Testing contract call...');
    console.log(`   Proposal ID: ${proposalId}`);
    console.log(`   Encrypted Vote: ${encryptedVote.substring(0, 20)}...`);

    try {
      // Estimate gas first
      console.log('\n5. Estimating gas...');
      const gasEstimate = await contract.submitVote.estimateGas(
        proposalId,
        encryptedVote,
        inputProof
      );
      console.log(`   ✅ Gas estimate: ${gasEstimate.toString()}`);

      // Try the actual transaction
      console.log('\n6. Submitting test transaction...');
      const tx = await contract.submitVote(
        proposalId,
        encryptedVote,
        inputProof
      );
      
      console.log(`   ✅ Transaction sent!`);
      console.log(`   TX Hash: ${tx.hash}`);
      console.log(`   Waiting for confirmation...`);

      const receipt = await tx.wait();
      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

      console.log('\n✅ Contract interaction successful!');
      console.log('The worker should be able to submit votes.');

    } catch (contractError) {
      console.log('\n❌ Contract call failed:');
      console.log(`   Error: ${contractError.message}`);
      console.log(`   Code: ${contractError.code}`);
      
      if (contractError.reason) {
        console.log(`   Reason: ${contractError.reason}`);
      }
      
      if (contractError.data) {
        console.log(`   Data: ${contractError.data}`);
      }

      // Common error interpretations
      console.log('\n📋 Possible causes:');
      if (contractError.message.includes('already voted')) {
        console.log('   - This wallet has already voted on this proposal');
        console.log('   - Try with a different proposalId');
      } else if (contractError.message.includes('insufficient funds')) {
        console.log('   - Wallet needs more Sepolia ETH for gas');
      } else if (contractError.message.includes('nonce')) {
        console.log('   - Nonce issue, transaction might be stuck');
      } else if (contractError.message.includes('reverted')) {
        console.log('   - Contract rejected the transaction');
        console.log('   - Check contract requirements (voting started, not closed, etc.)');
      }

      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testContractSubmission();
