#!/usr/bin/env node
/**
 * Test local contract configuration
 * Verifies that our config is loading the correct contract address
 */

require('dotenv').config();
const config = require('../src/config');

console.log('=== Contract Configuration Test ===\n');

console.log('Environment Variables:');
console.log('- VOTING_CONTRACT_ADDRESS:', process.env.VOTING_CONTRACT_ADDRESS);
console.log('\nConfig Object:');
console.log('- config.fhevm.votingContractAddress:', config.fhevm.votingContractAddress);

console.log('\n Expected: 0xFc625445720C9d27b05Bc197b3c5E2a62678EB47');
console.log('- Matches expected:', config.fhevm.votingContractAddress === '0xFc625445720C9d27b05Bc197b3c5E2a62678EB47');

console.log('\n=== All FHEVM Config ===');
console.log(JSON.stringify({
  projectPrivateKeySet: !!config.fhevm.projectPrivateKey,
  relayerUrl: config.fhevm.relayerUrl,
  networkRpcUrl: config.fhevm.networkRpcUrl,
  chainId: config.fhevm.chainId,
  gatewayChainId: config.fhevm.gatewayChainId,
  votingContractAddress: config.fhevm.votingContractAddress,
  aclContractAddress: config.fhevm.aclContractAddress,
  kmsContractAddress: config.fhevm.kmsContractAddress,
  inputVerifierContractAddress: config.fhevm.inputVerifierContractAddress
}, null, 2));
