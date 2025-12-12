#!/usr/bin/env node

/**
 * Environment Variable Checker
 * Verifies all required environment variables are set
 * Run this to diagnose configuration issues
 */

const required = [
  'MONGO_URI',
  'REDIS_URL',
  'JWT_SECRET',
  'PROJECT_PRIVATE_KEY',
  'VOTING_CONTRACT_ADDRESS',
  'RELAYER_URL',
  'NETWORK_RPC_URL',
  'GATEWAY_CONTRACT_ADDRESS'
];

const optional = [
  'PORT',
  'NODE_ENV',
  'CORS_ORIGIN',
  'LOG_LEVEL',
  'BCRYPT_ROUNDS',
  'CHAIN_ID',
  'GATEWAY_CHAIN_ID'
];

console.log('🔍 Checking Environment Variables...\n');

let missingRequired = [];
let presentRequired = [];
let presentOptional = [];

// Check required
required.forEach(key => {
  const value = process.env[key];
  if (!value) {
    missingRequired.push(key);
    console.log(`❌ ${key}: NOT SET`);
  } else {
    presentRequired.push(key);
    // Show first 10 chars for security
    const preview = value.length > 10 ? value.substring(0, 10) + '...' : value.substring(0, 5) + '...';
    console.log(`✅ ${key}: ${preview} (${value.length} chars)`);
  }
});

console.log('\n📋 Optional Variables:\n');

// Check optional
optional.forEach(key => {
  const value = process.env[key];
  if (value) {
    presentOptional.push(key);
    console.log(`✅ ${key}: ${value}`);
  } else {
    console.log(`⚪ ${key}: not set (using default)`);
  }
});

console.log('\n' + '='.repeat(60) + '\n');

// Summary
console.log('📊 Summary:');
console.log(`   Required: ${presentRequired.length}/${required.length} set`);
console.log(`   Optional: ${presentOptional.length}/${optional.length} set`);

if (missingRequired.length > 0) {
  console.log('\n❌ MISSING REQUIRED VARIABLES:');
  missingRequired.forEach(key => console.log(`   - ${key}`));
  console.log('\n⚠️  The application will likely fail to start.');
  console.log('   Set these in Render Dashboard → Environment Variables\n');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are set!');
  console.log('   The application should be able to start.\n');
  process.exit(0);
}
