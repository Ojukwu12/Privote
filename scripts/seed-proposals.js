#!/usr/bin/env node

/**
 * Seed Proposals Script
 * Creates sample proposals for testing
 * 
 * Usage: node scripts/seed-proposals.js <admin_token>
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'https://privote-on-zama.onrender.com/api';

const proposals = [
  {
    title: 'Increase DAO Treasury by 10%',
    description: 'This proposal suggests increasing the DAO treasury allocation by 10% to fund new development initiatives. The additional funds would be used for hiring senior engineers and expanding our research team.',
    startTime: new Date(Date.now() + 1000 * 60 * 5).toISOString(), // Starts in 5 minutes
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(), // Ends in 7 days
    requiredRole: 'user'
  },
  {
    title: 'Implement Multi-Sig Governance',
    description: 'Enhance the DAO governance structure by implementing multi-signature authentication for critical operations. This will require approval from at least 3 out of 5 admin signers for treasury transfers exceeding 1M tokens.',
    startTime: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // Starts in 10 minutes
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(), // Ends in 14 days
    requiredRole: 'user'
  },
  {
    title: 'Community Fund Allocation',
    description: 'Vote on the allocation of the community fund. Options include: 40% to developer grants, 30% to marketing, 20% to community events, and 10% to emergency reserves. This decision will directly impact community growth.',
    startTime: new Date(Date.now() + 1000 * 60 * 15).toISOString(), // Starts in 15 minutes
    endTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21).toISOString(), // Ends in 21 days
    requiredRole: 'user'
  }
];

async function seedProposals(token) {
  if (!token) {
    console.error('Error: Admin token required');
    console.error('Usage: node scripts/seed-proposals.js <admin_token>');
    process.exit(1);
  }

  try {
    console.log(`Creating ${proposals.length} proposals...`);

    for (const proposal of proposals) {
      try {
        const response = await axios.post(`${BASE_URL}/proposals`, proposal, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`✓ Created: "${proposal.title}"`);
        console.log(`  ID: ${response.data.data.proposal._id}`);
      } catch (error) {
        console.error(`✗ Failed to create "${proposal.title}"`);
        if (error.response) {
          console.error(`  Status: ${error.response.status}`);
          console.error(`  Message: ${error.response.data.message}`);
        } else {
          console.error(`  Error: ${error.message}`);
        }
      }
    }

    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Get token from command line
const token = process.argv[2];
seedProposals(token);
