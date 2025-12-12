#!/usr/bin/env node

/**
 * Test script for voting flow
 * Tests the complete voting flow with FHE encryption
 */

const axios = require('axios');

const BASE_URL = 'https://privote-on-zama.onrender.com/api';

// Test credentials
const TEST_USER = {
  username: 'testvoter1',
  password: 'TestPass123!'
};

// Auth token
let AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5M2I0YTU0NWJjYTZjNzNmMzhkMmIxZSIsImVtYWlsIjoidGVzdHZvdGVyMUBleGFtcGxlLmNvbSIsInJvbGUiOiJ1c2VyIiwiaWF0IjoxNzY1NDkzMzMyLCJleHAiOjE3NjYwOTgxMzJ9.3SL42j0TX_gu2iQd1i1jpl7vVL4-0MRuX4w4DYkzKy4';

async function testVoteFlow() {
  try {
    console.log('=== Testing Backend Vote Flow ===\n');

    // Step 1: Get open proposals
    console.log('1. Fetching open proposals...');
    const proposalsRes = await axios.get(`${BASE_URL}/proposals?status=open`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
    });
    
    const proposals = proposalsRes.data.data.proposals;
    console.log(`   ✅ Found ${proposals.length} open proposals`);
    
    if (proposals.length === 0) {
      console.log('   ⚠️  No open proposals found');
      return;
    }

    const proposalId = proposals[0]._id || proposals[0].id;
    console.log(`   📝 Using proposal: ${proposals[0].title} (${proposalId})\n`);

    // Step 2: Get proposal details
    console.log('2. Getting proposal details...');
    const proposalRes = await axios.get(`${BASE_URL}/proposals/${proposalId}`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
    });
    
    const proposal = proposalRes.data.data.proposal;
    console.log(`   ✅ Proposal loaded`);
    console.log(`   - Has voted: ${proposal.hasUserVoted}`);
    console.log(`   - Vote count: ${proposal.voteCount}`);
    console.log(`   - Closed: ${proposal.closed}\n`);

    if (proposal.hasUserVoted) {
      console.log('   ⚠️  User has already voted on this proposal\n');
      
      // Skip to tally check
      console.log('4. Checking encrypted tally...');
      try {
        const tallyRes = await axios.get(`${BASE_URL}/vote/encrypted-tally/${proposalId}`, {
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
        });
        console.log(`   ✅ Encrypted tally retrieved:`, tallyRes.data);
      } catch (err) {
        console.log(`   ❌ Error:`, err.response?.data || err.message);
      }
      
      return;
    }

    // Step 3: Get user's public key
    console.log('3. Getting user public key...');
    const publicKeyRes = await axios.get(`${BASE_URL}/users/public`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
    });
    
    const publicKey = publicKeyRes.data.data.publicKey;
    console.log(`   ✅ Public key retrieved (length: ${publicKey.length})\n`);

    // Step 4: For testing, create a mock encrypted vote
    // In production, this would use fhevmjs to encrypt
    console.log('4. Creating mock encrypted vote (for testing)...');
    const mockEncryptedVote = '0x' + Buffer.from('encrypted-vote-yes').toString('hex').padEnd(128, '0');
    const mockInputProof = '0x' + Buffer.from('proof-data').toString('hex').padEnd(128, '0');
    
    console.log(`   ✅ Mock vote created\n`);

    // Step 5: Submit vote
    console.log('5. Submitting vote...');
    try {
      const voteRes = await axios.post(
        `${BASE_URL}/vote/submit`,
        {
          proposalId,
          encryptedVote: mockEncryptedVote,
          inputProof: mockInputProof
        },
        {
          headers: { 
            Authorization: `Bearer ${AUTH_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`   ✅ Vote submitted successfully!`);
      console.log(`   - Job ID: ${voteRes.data.data.jobId}`);
      console.log(`   - Vote ID: ${voteRes.data.data.vote.id}\n`);

      // Step 6: Check job status
      const jobId = voteRes.data.data.jobId;
      console.log('6. Checking job status...');
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
      
      try {
        const jobRes = await axios.get(`${BASE_URL}/vote/status/${jobId}`, {
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
        });
        console.log(`   ✅ Job status:`, jobRes.data.data);
      } catch (err) {
        console.log(`   ❌ Error checking job:`, err.response?.data || err.message);
      }

    } catch (err) {
      console.log(`   ❌ Error submitting vote:`);
      console.log(err.response?.data || err.message);
      console.log('\n   This might indicate:');
      console.log('   - Contract proposal ID not ready');
      console.log('   - Invalid encrypted vote format');
      console.log('   - Backend validation error');
    }

    console.log('\n=== Test Complete ===');

  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

testVoteFlow();
