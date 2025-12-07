const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

/**
 * Deployment script for PrivoteVoting contract
 *
 * Usage:
 *   Local:   npx hardhat run scripts/deploy.js --network localhost
 *   Testnet: npx hardhat run scripts/deploy.js --network sepolia
 *
 * After deployment:
 * 1. Copy the contract address to .env as VOTING_CONTRACT_ADDRESS
 * 2. Verify contract on block explorer (if testnet)
 */

async function main() {
  console.log('Deploying PrivoteVoting contract...\n');

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', hre.ethers.formatEther(balance), 'ETH\n');

  if (parseFloat(hre.ethers.formatEther(balance)) < 0.01) {
    console.warn('WARNING: Low balance. May need to fund wallet.');
  }

  // Deploy contract
  console.log('Deploying PrivoteVoting...');
  const PrivoteVoting = await hre.ethers.getContractFactory('PrivoteVoting');
  const contract = await PrivoteVoting.deploy();

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log('PrivoteVoting deployed to:', contractAddress);

  // Get deployment transaction
  const deployTx = contract.deploymentTransaction();
  console.log('Deployment transaction:', deployTx.hash);

  // Wait for confirmations
  console.log('\nWaiting for confirmations...');
  await deployTx.wait(3);
  console.log('Contract confirmed!\n');

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress,
    deployer: deployer.address,
    deploymentTx: deployTx.hash,
    timestamp: new Date().toISOString(),
    blockNumber: deployTx.blockNumber
  };

  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `${hre.network.name}-${Date.now()}.json`
  );

  fs.writeFileSync(
    deploymentFile,
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log('Deployment info saved to:', deploymentFile);

  // Print instructions
  console.log('\n==============================================');
  console.log('IMPORTANT: Update your .env file');
  console.log('==============================================');
  console.log(`VOTING_CONTRACT_ADDRESS=${contractAddress}`);
  console.log('==============================================\n');

  // Verification instructions
  if (hre.network.name !== 'localhost' && hre.network.name !== 'hardhat') {
    console.log('To verify contract on block explorer:');
    console.log(`npx hardhat verify --network ${hre.network.name} ${contractAddress}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
