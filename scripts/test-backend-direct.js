#!/usr/bin/env node

/**
 * Simplified Vote Test
 * Tests the backend without needing real FHE encryption
 * Uses mock data to verify the flow works
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function testSimplifiedFlow() {
  try {
    console.log('=== Simplified Backend Flow Test ===\n');

    // Connect to MongoDB
    console.log('1. Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('   ✅ Connected\n');

    const Proposal = require('../src/models/Proposal');
    const User = require('../src/models/User');

    // Find test user
    console.log('2. Finding test user...');
    const user = await User.findOne({ username: 'testvoter1' });
    if (!user) {
      console.log('   ❌ User not found');
      process.exit(1);
    }
    console.log(`   ✅ Found user: ${user.username} (${user._id})\n`);

    // Find first open proposal
    console.log('3. Finding open proposals...');
    const now = new Date();
    const proposals = await Proposal.find({
      startTime: { $lte: now },
      endTime: { $gte: now },
      closed: false
    }).limit(3);
    
    console.log(`   ✅ Found ${proposals.length} open proposals:`);
    proposals.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.title}`);
      console.log(`      - ID: ${p._id}`);
      console.log(`      - Contract ID: ${p.contractProposalId !== undefined ? p.contractProposalId : 'NOT SET'}`);
      console.log(`      - Vote count: ${p.voteCount || 0}`);
    });
    console.log();

    if (proposals.length === 0) {
      console.log('   ⚠️  No open proposals found\n');
      await mongoose.connection.close();
      return;
    }

    // Check if any have contract IDs
    const withContract = proposals.filter(p => p.contractProposalId !== null && p.contractProposalId !== undefined);
    console.log(`4. Proposals with blockchain deployment: ${withContract.length}/${proposals.length}\n`);

    if (withContract.length === 0) {
      console.log('   ⚠️  No proposals are deployed to the blockchain');
      console.log('   This is why votes cannot be submitted.\n');
      console.log('   To fix:');
      console.log('   - Proposals must be created via POST /api/proposals endpoint');
      console.log('   - The endpoint automatically deploys them to the contract');
      console.log('   - Direct MongoDB creation skips blockchain deployment\n');
    } else {
      console.log(`   ✅ Testing with: ${withContract[0].title}\n`);
      
      // Check votes
      const Vote = require('../src/models/Vote');
      const votes = await Vote.find({ proposalId: withContract[0]._id });
      console.log(`5. Existing votes for this proposal: ${votes.length}`);
      votes.forEach((v, i) => {
        console.log(`   ${i + 1}. User: ${v.userId}, Job: ${v.jobId}, Status: ${v.status}`);
      });
      console.log();
    }

    console.log('=== Test Complete ===\n');
    console.log('Summary:');
    console.log('- Database connection: ✅');
    console.log('- User exists: ✅');
    console.log(`- Open proposals: ${proposals.length}`);
    console.log(`- Blockchain-deployed proposals: ${withContract.length}`);
    console.log('\nTo enable voting:');
    console.log('1. Create an admin user');
    console.log('2. Use POST /api/proposals endpoint to create proposals');
    console.log('3. The endpoint will automatically deploy to Sepolia');

    await mongoose.connection.close();

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

testSimplifiedFlow();
