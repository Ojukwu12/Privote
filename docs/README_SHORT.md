# Privote Backend

**Confidential DAO Voting Powered by Zama FHEVM**

Privote is a production-ready backend system for confidential DAO voting using Fully Homomorphic Encryption (FHE) via Zama's FHEVM. Users can vote on proposals while keeping their votes completely encrypted end-to-end, with tamper-proof on-chain tallying and client-side result decryption.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🎯 Features

- **Fully Encrypted Voting**: Votes remain encrypted on-chain; backend never sees plaintext
- **Homomorphic Tallying**: Compute vote counts on encrypted data using Zama FHEVM
- **Hybrid Private Key Storage**: User FHE keys encrypted with password-derived keys (scrypt)
- **Background Job Processing**: Vote submissions and tally computation via BullMQ + Redis
- **Project Wallet Model**: Single wallet pays gas; users don't need blockchain keys
- **Comprehensive API**: RESTful endpoints for proposals, voting, and tally retrieval
- **Production-Ready**: Docker, CI/CD, structured logging, rate limiting, comprehensive tests

---

## 📋 Quick Start

```bash
# Clone repository
git clone https://github.com/Ojukwu12/Privote.git
cd Privote

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start with Docker Compose
docker-compose up

# Or start manually
npm start        # API server
npm run worker   # Background worker
```

API available at: [http://localhost:3000](http://localhost:3000)

---

## 📚 Full Documentation

See the comprehensive guides in `docs/`:

- **[SETUP.md](docs/SETUP.md)** - Detailed installation and configuration
- **[API.md](docs/API.md)** - Complete API reference
- **[SECURITY.md](docs/SECURITY.md)** - Security best practices
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Production deployment guide

---

## 🔗 Zama FHEVM Integration

Privote uses the official Zama Relayer SDK. Configuration sourced from:

- [Relayer SDK Docs](https://docs.zama.org/protocol/relayer-sdk-guides/fhevm-relayer/initialization)
- [Contract Addresses](https://docs.zama.org/protocol/solidity-guides/smart-contract/configure/contract_addresses)

Default network: **Sepolia Testnet**

---

## 🧪 Testing

```bash
npm test                  # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:coverage     # Coverage report
```

---

## 📜 License

MIT License - see [LICENSE](LICENSE)

---

**Built with ❤️ for privacy-preserving governance**
