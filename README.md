# Privote

**Confidential DAO Voting Backend using Zama FHEVM**

Privote is a production-ready Node.js backend for secure, privacy-preserving DAO voting. Using Zama's Fully Homomorphic Encryption (FHE), votes remain encrypted end-to-end while allowing homomorphic tallying on-chain.

---

## Features

- ✅ **Confidential Voting**: Votes encrypted with FHE, never decrypted on backend
- ✅ **Homomorphic Tallying**: Compute encrypted tallies without revealing individual votes
- ✅ **Hybrid Key Management**: User private keys encrypted with password-derived keys (scrypt + AES-256-GCM)
- ✅ **Role-Based Access**: User and admin roles with proposal creation restrictions
- ✅ **Background Jobs**: Asynchronous vote processing with BullMQ and Redis
- ✅ **Blockchain Integration**: Zama FHEVM on Sepolia testnet via Relayer SDK
- ✅ **Comprehensive Testing**: Unit and integration tests with mock FHE shim
- ✅ **Docker Ready**: Full Docker Compose setup for local development
- ✅ **CI/CD Pipeline**: GitHub Actions for linting, testing, and deployment
- ✅ **Audit Logging**: All sensitive operations logged for compliance
- ✅ **Rate Limiting**: Protection against brute force and spam attacks

---

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running Locally](#running-locally)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Quick Start

### Fastest Way: Docker Compose

```bash
git clone https://github.com/Ojukwu12/Privote.git
cd Privote
cp .env.example .env
# Edit .env with your settings
docker-compose up
```

Then visit: `http://localhost:3000/api/health`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          FRONTEND                               │
│  - User encrypts vote with FHE (fhevmjs)                        │
│  - Submits encrypted vote + proof to backend                    │
│  - Decrypts tally locally after reveal                          │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS + JWT
┌────────────────────▼────────────────────────────────────────────┐
│                       BACKEND (Node.js)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  REST API (Express)                                       │  │
│  │   - User registration & authentication                    │  │
│  │   - Proposal management                                   │  │
│  │   - Vote submission (queues job)                          │  │
│  │   - Tally computation (queues job)                        │  │
│  └──────────────┬───────────────────────────────────────────┘  │
│                 │                                               │
│  ┌──────────────▼───────────────────────────────────────────┐  │
│  │  Background Worker (BullMQ)                              │  │
│  │   - Processes vote submissions                            │  │
│  │   - Computes encrypted tallies                            │  │
│  │   - Interacts with Zama Relayer                           │  │
│  └──────────────┬───────────────────────────────────────────┘  │
│                 │                                               │
│  ┌──────────────▼───────────────────────────────────────────┐  │
│  │  Database (MongoDB)                                       │  │
│  │   - Users (encrypted private keys)                        │  │
│  │   - Proposals                                             │  │
│  │   - Votes                                                 │  │
│  │   - Audit Logs                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────────┘
                     │ Zama Relayer SDK
┌────────────────────▼────────────────────────────────────────────┐
│                   ZAMA FHEVM + RELAYER                          │
│  - Relayer: https://relayer.testnet.zama.org                   │
│  - Gateway: https://gateway.testnet.zama.org                   │
│  - Blockchain: Sepolia (ChainId 11155111)                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Runtime** | Node.js | >=18.0.0 |
| **Language** | JavaScript ES6+ | Plain (no TypeScript) |
| **Web Framework** | Express.js | 4.18.2 |
| **Database** | MongoDB | 8.0.3 |
| **ORM** | Mongoose | 8.0.3 |
| **Cache/Queue** | Redis + BullMQ | 5.3.2 + 5.1.0 |
| **FHE Integration** | @zama-fhe/relayer-sdk | 0.9.0 |
| **Blockchain** | ethers.js | 6.9.0 |
| **Smart Contracts** | Hardhat | 2.19.4 |
| **Auth** | JWT + bcrypt | jsonwebtoken 9.0.2 + bcryptjs 2.4.3 |
| **Validation** | Joi | 17.11.0 |
| **Testing** | Mocha + Chai | 10.2.0 + 4.3.10 |
| **Logging** | Winston | 3.11.0 |
| **Security** | helmet, cors, rate-limit | Latest |
| **Containerization** | Docker | Latest |

---

## Prerequisites

### Required

- **Node.js**: v18.0.0+ ([Download](https://nodejs.org/))
- **MongoDB**: v5.0+ ([Installation Guide](https://www.mongodb.com/docs/manual/installation/))
- **Redis**: v6.0+ ([Installation Guide](https://redis.io/docs/getting-started/installation/))
- **Docker & Docker Compose**: For containerized setup ([Get Docker](https://docs.docker.com/get-docker/))

### For Blockchain Interaction

- **Sepolia ETH**: Fund your project wallet (0.1 ETH recommended)
  - [Sepolia Faucet](https://sepoliafaucet.com/)
  - [Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)
- **Zama Testnet Access**: Relayer at https://relayer.testnet.zama.org (no API key needed)

---

## Installation

### Clone Repository

```bash
git clone https://github.com/Ojukwu12/Privote.git
cd Privote
```

### Install Dependencies

```bash
npm install
```

Installs all dependencies including:
- Express, Mongoose, Redis clients
- Zama Relayer SDK
- Hardhat and ethers.js
- Testing frameworks
- Security middleware

---

## Configuration

### Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# ============================================
# Server
# ============================================
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# ============================================
# Database (MongoDB)
# ============================================
MONGO_URI=mongodb://localhost:27017/privote

# ============================================
# Redis (Job Queue)
# ============================================
REDIS_HOST=localhost
REDIS_PORT=6379

# ============================================
# Authentication
# ============================================
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d

# ============================================
# Zama FHEVM Configuration
# ============================================
# Project wallet private key (signs transactions)
# ⚠️ CRITICAL: Store in KMS in production!
PROJECT_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Zama Relayer URL (Sepolia testnet)
RELAYER_URL=https://relayer.testnet.zama.org

# Blockchain RPC URL (Sepolia)
RPC_URL=https://rpc.sepolia.org

# Chain IDs
CHAIN_ID=11155111          # Sepolia
GATEWAY_CHAIN_ID=10901     # Zama Gateway

# Official Zama Contract Addresses (Sepolia)
# Source: https://docs.zama.ai/fhevm/getting_started/connect
ACL_CONTRACT_ADDRESS=0xC1820b6Eb60f448E6c44d3A8f36EC6D5fCc76754
KMS_CONTRACT_ADDRESS=0x208De73316E44722e16f6dDFF40881A3e4F86104
ZAMA_GATEWAY_ADDRESS=0x6Fdc11e82f9dB00DcdC01Ab678A1B3c34D1eE089

# Your deployed PrivoteVoting contract
VOTING_CONTRACT_ADDRESS=

# ============================================
# Mock Mode (for testing without relayer)
# ============================================
RELAYER_MOCK=false   # Set 'true' to use fheShim.js

# ============================================
# Security
# ============================================
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Get Zama Contract Addresses

All contract addresses come from official Zama documentation:

📖 **[Zama Docs - Getting Started](https://docs.zama.ai/fhevm/getting_started/connect)**

The `.env.example` has official Sepolia addresses. Do not change unless migrating networks.

### Fund Project Wallet

1. **Generate wallet** (or use existing):
   ```bash
   node -e "console.log(require('ethers').Wallet.createRandom().privateKey)"
   ```

2. **Get Sepolia ETH**:
   - [Sepolia Faucet](https://sepoliafaucet.com/)
   - Need: 0.1 ETH minimum for testing

3. **Update `.env`**:
   ```bash
   PROJECT_PRIVATE_KEY=0x<your_key>
   ```

⚠️ **Never commit private keys to Git. Use KMS in production.**

---

## Running Locally

### Option 1: Docker Compose (Recommended)

```bash
docker-compose up
```

Starts all services:
- MongoDB: `mongodb://localhost:27017`
- Redis: `redis://localhost:6379`
- API: `http://localhost:3000`
- Worker: Background job processor

Check health:
```bash
curl http://localhost:3000/api/health
```

Stop:
```bash
docker-compose down
```

### Option 2: Manual Setup

#### 1. Start MongoDB

```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Docker
docker run -d -p 27017:27017 --name mongodb mongo:7
```

#### 2. Start Redis

```bash
# macOS
brew services start redis

# Linux
sudo systemctl start redis

# Docker
docker run -d -p 6379:6379 --name redis redis:7
```

#### 3. Compile & Deploy Smart Contract

```bash
npm run compile
npm run deploy:testnet
```

Update `.env` with deployed contract address.

#### 4. Start API

```bash
npm run dev
```

API available at `http://localhost:3000`

#### 5. Start Worker

In another terminal:

```bash
npm run worker
```

---

## Testing

### All Tests

```bash
npm test
```

Runs unit + integration tests with coverage.

### Unit Tests Only

```bash
npm run test:unit
```

- `crypto.test.js` - Encryption/decryption
- `CustomError.test.js` - Error class
- `User.model.test.js` - Model validation

### Integration Tests

```bash
npm run test:integration
```

- `auth.test.js` - Full authentication flow

### Test Coverage

```bash
npm run test:coverage
```

### Mock Mode Testing

```bash
RELAYER_MOCK=true npm test
```

Uses `fheShim.js` for FHE simulation (no relayer needed).

---

## API Documentation

**Complete API Reference**: [docs/API.md](docs/API.md)

### Quick API Examples

#### Register User

```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com",
    "password": "SecurePass123"
  }'
```

#### Login

```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecurePass123"
  }'
```

#### Create Proposal (Admin)

```bash
curl -X POST http://localhost:3000/api/proposals \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Should we upgrade?",
    "description": "...",
    "startTime": "2025-12-25T00:00:00Z",
    "endTime": "2025-12-31T23:59:59Z",
    "requiredRole": "user"
  }'
```

#### Submit Encrypted Vote

```bash
curl -X POST http://localhost:3000/api/votes/submit \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "proposalId": "...",
    "encryptedVote": "0x...",
    "inputProof": "0x...",
    "idempotencyKey": "vote-alice-1"
  }'
```

See [docs/API.md](docs/API.md) for complete endpoint list and examples.

---

## Frontend Integration

### Key Steps

1. **Install fhevmjs**:
   ```bash
   npm install fhevmjs
   ```

2. **Initialize FHEVM instance**:
   ```javascript
   import { createFhevmInstance } from 'fhevmjs';
   
   const fhevmInstance = await createFhevmInstance({
     chainId: 11155111,
     publicKey: proposalCreatorPublicKey,
     gatewayUrl: 'https://gateway.testnet.zama.org',
     aclAddress: '0xC1820b6Eb60f448E6c44d3A8f36EC6D5fCc76754'
   });
   ```

3. **Encrypt vote**:
   ```javascript
   const encryptedInput = fhevmInstance.createEncryptedInput(
     votingContractAddress,
     userWalletAddress
   );
   encryptedInput.add64(1); // Vote value
   const { handles, inputProof } = encryptedInput.encrypt();
   ```

4. **Submit to backend**:
   ```javascript
   const response = await fetch('http://localhost:3000/api/votes/submit', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${authToken}`
     },
     body: JSON.stringify({
       proposalId: proposalId,
       encryptedVote: handles[0],
       inputProof: inputProof,
       idempotencyKey: `vote-${userId}-${proposalId}`
     })
   });
   ```

**Full frontend guide**: [API.md - Frontend Integration](docs/API.md#frontend-integration-guide)

---

## Security

### Key Security Features

- ✅ **Encrypted Voting**: FHE ensures votes never decrypted on backend
- ✅ **Encrypted Keys**: AES-256-GCM with scrypt KDF
- ✅ **Blockchain Immutability**: Votes recorded on-chain
- ✅ **Rate Limiting**: Prevents brute force
- ✅ **Audit Logging**: All sensitive operations logged

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET` (64+ bytes)
- [ ] Store `PROJECT_PRIVATE_KEY` in KMS
- [ ] Enable HTTPS with valid certificate
- [ ] Configure CORS for production domain
- [ ] Enable MongoDB authentication
- [ ] Enable Redis authentication
- [ ] Set up monitoring (Sentry, CloudWatch)
- [ ] Enable log aggregation
- [ ] Review rate limits

**Full security guide**: [docs/SECURITY.md](docs/SECURITY.md)

---

## Troubleshooting

### "Cannot connect to MongoDB"

```bash
# Check if MongoDB is running
ps aux | grep mongod

# Restart
brew services restart mongodb-community   # macOS
sudo systemctl restart mongod             # Linux
```

### "Redis connection refused"

```bash
# Check Redis
redis-cli ping

# Restart
brew services restart redis               # macOS
sudo systemctl restart redis              # Linux
```

### "Insufficient funds for gas"

Fund your project wallet:
- [Sepolia Faucet](https://sepoliafaucet.com/)
- Check balance with ethers.js:
  ```bash
  node -e "const ethers = require('ethers'); const provider = new ethers.JsonRpcProvider('https://rpc.sepolia.org'); provider.getBalance('YOUR_ADDRESS').then(b => console.log(ethers.formatEther(b) + ' ETH'));"
  ```

### "Contract not deployed"

```bash
npm run compile
npm run deploy:testnet
# Update VOTING_CONTRACT_ADDRESS in .env
```

### "JWT token expired"

User must log in again to get a fresh token.

### "Vote submission failed"

```bash
# Check worker
npm run worker

# Check job queue
curl http://localhost:3000/api/metrics \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Enable debug logging
LOG_LEVEL=debug npm run dev
```

More troubleshooting: [Full README in docs](#)

---

## Project Structure

```
Privote/
├── src/
│   ├── config/              # Configuration
│   ├── models/              # Mongoose schemas
│   ├── fhe/                 # FHE/Relayer integration
│   ├── utils/               # Utilities
│   ├── middleware/          # Express middleware
│   ├── services/            # Business logic
│   ├── controllers/         # Request handlers
│   ├── routes/              # Route definitions
│   ├── jobs/                # Background jobs
│   ├── tests/               # Test suites
│   └── server.js            # Main entry point
├── contracts/               # Solidity contracts
├── scripts/                 # Deployment scripts
├── docker-compose.yml       # Docker Compose
├── Dockerfile
├── package.json
├── .env.example
├── README.md                # This file
├── API.md                   # API reference
├── SECURITY.md              # Security documentation
└── LICENSE
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start with auto-reload |
| `npm test` | Run all tests |
| `npm run test:unit` | Unit tests |
| `npm run test:integration` | Integration tests |
| `npm run lint` | ESLint |
| `npm run lint:fix` | Fix linting errors |
| `npm run compile` | Compile contracts |
| `npm run deploy:testnet` | Deploy to Sepolia |
| `npm run worker` | Start background worker |

---

## FAQ

### Q: Can the backend see my votes?

**A:** No. Votes are encrypted client-side with FHE. Backend only handles encrypted ciphertexts.

### Q: What if I lose my password?

**A:** There is no recovery. Your encrypted private key cannot be decrypted without your password. Store passwords securely.

### Q: Can I change my vote?

**A:** No. Votes are immutable once submitted on-chain.

### Q: How long does vote processing take?

**A:** 30-60 seconds for submission (includes blockchain confirmation). Tally takes 2-5 minutes.

### Q: Is this production-ready?

**A:** Yes, with proper security configuration. Always conduct a security audit before handling real assets.

### Q: Can I run on mainnet?

**A:** Not yet. Zama FHEVM is on testnet. Mainnet support coming soon.

---

## Contributing

We welcome contributions! See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

### Quick Start

1. Fork the repo
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and add tests
4. Run: `npm run lint && npm test`
5. Commit: `git commit -m "feat: add amazing feature"`
6. Push and create Pull Request

### Code Standards

- Plain JavaScript ES6+ (no TypeScript)
- Use asyncHandler + CustomError (no try/catch in controllers)
- ESLint compliant
- Add tests for new features

---

## License

MIT License - see [LICENSE](./LICENSE)

---

## Support & Contact

- **GitHub Issues**: [https://github.com/Ojukwu12/Privote/issues](https://github.com/Ojukwu12/Privote/issues)
- **Documentation**: [API.md](docs/API.md) | [SECURITY.md](docs/SECURITY.md)
- **Email**: support@privote.io
- **Security**: security@privote.io (for vulnerability reports)

---

## Acknowledgments

- **Zama**: For FHEVM and Relayer SDK
- **Ethereum Foundation**: For Sepolia testnet
- **Open Source Community**: For amazing dependencies

---

**Built with ❤️ for privacy-preserving governance**
