# Documentation Index

Quick navigation guide for all Privote documentation.

---

## Getting Started

**Start here if you're new to Privote:**

1. **[README.md](./README.md)** - Main documentation
   - Installation instructions
   - Quick start guide (Docker)
   - Architecture overview
   - Tech stack
   - Running locally
   - Testing guide
   - Troubleshooting

2. **[README_SHORT.md](./README_SHORT.md)** - Quick reference
   - Features overview
   - Quick start commands
   - Links to detailed docs

---

## API Documentation

**For frontend developers integrating with Privote:**

- **[API.md](./API.md)** - Complete API reference
  - All endpoints (15+ total)
  - Authentication & rate limiting
  - Request/response examples with curl
  - Frontend integration guide with code samples
  - Pagination, filtering, idempotency
  - WebSocket support (future)
  - Error handling

**Endpoint Quick Links:**
- User Management: `/api/users/register`, `/api/users/login`, `/api/users/profile`, `/api/users/decrypt`
- Proposals: `GET/POST /api/proposals`, `GET /api/proposals/:id`, `POST /api/proposals/:id/close`
- Voting: `POST /api/votes/submit`, `GET /api/votes/status`, `GET /api/votes/encrypted-tally`, `GET /api/votes/decrypted-tally`
- Health: `GET /api/health`, `GET /api/metrics`

---

## Security

**For security considerations & production deployment:**

- **[SECURITY.md](./SECURITY.md)** - Security documentation
  - Threat model & trust boundaries
  - Security features explained
  - Private key protection (hybrid encryption)
  - Vote encryption (FHE)
  - Authentication & authorization
  - Audit logging
  - Network security
  - **Production security checklist** (20+ items)
  - KMS integration
  - Vulnerability disclosure process
  - Compliance (GDPR, CCPA, SOC 2)
  - Security roadmap

**Read this before production deployment!**

---

## Deployment

**For deploying to production:**

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment guide
  - Docker deployment (single container & compose)
  - Kubernetes deployment with manifests
  - Cloud platforms:
    - AWS (ECS/Fargate, ECR)
    - Google Cloud (Cloud Run)
    - Azure Container Instances
  - Secrets management
  - HTTPS/TLS configuration
  - Database setup (MongoDB, Redis)
  - Monitoring & logging (Sentry, ELK, CloudWatch)
  - Backup & disaster recovery
  - Auto-scaling
  - Performance tuning
  - CI/CD pipeline

**Choose your platform, follow the guide.**

---

## Contributing

**For developers contributing to Privote:**

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contributing guidelines
  - Code of conduct
  - Getting started (fork, clone, setup)
  - Development environment setup
  - **Coding standards:**
    - Backend Law pattern (asyncHandler, CustomError)
    - File organization
    - Variable naming conventions
    - JSDoc comments
    - No console logs (use logger)
  - Testing guidelines with examples
  - Git workflow & branch naming
  - Conventional commits
  - Pull request process with template
  - Security vulnerability reporting
  - Documentation guidelines
  - Areas for future contribution

**Read this before submitting PRs!**

---

## Documentation by Topic

### For Frontend Developers

1. **API Integration**: [API.md](./API.md) - Complete endpoint reference with examples
2. **User Flow**: [API.md - Frontend Integration](./API.md#frontend-integration-guide) - Step-by-step voting flow
3. **Error Handling**: [API.md - Error Responses](./API.md#error-responses) - All error codes & meanings
4. **Authentication**: [API.md - User Management](./API.md#user-management) - Registration, login, key decryption
5. **Voting**: [API.md - Voting](./API.md#voting) - Vote submission & tally retrieval

### For Backend Developers

1. **Setup**: [README.md - Installation](./README.md#installation) - Prerequisites & installation
2. **Development**: [README.md - Running Locally](./README.md#running-locally) - Docker & manual setup
3. **Code Standards**: [CONTRIBUTING.md - Coding Standards](./CONTRIBUTING.md#coding-standards) - Required patterns
4. **Testing**: [CONTRIBUTING.md - Testing](./CONTRIBUTING.md#testing) - How to write tests
5. **Git Workflow**: [CONTRIBUTING.md - Git Workflow](./CONTRIBUTING.md#git-workflow) - Fork, branch, PR process

### For DevOps / Operations

1. **Quick Deploy**: [README.md - Running Locally](./README.md#running-locally) - Docker Compose setup
2. **Production**: [DEPLOYMENT.md](./DEPLOYMENT.md) - Full production deployment guide
3. **Kubernetes**: [DEPLOYMENT.md - Kubernetes](./DEPLOYMENT.md#kubernetes-deployment) - K8s manifests
4. **Cloud**: [DEPLOYMENT.md - Cloud Platforms](./DEPLOYMENT.md#cloud-platforms) - AWS/GCP/Azure
5. **Monitoring**: [DEPLOYMENT.md - Monitoring](./DEPLOYMENT.md#monitoring--logging) - Sentry, ELK, CloudWatch
6. **Backup**: [DEPLOYMENT.md - Backup](./DEPLOYMENT.md#backup--recovery) - Database backups

### For Security / Compliance

1. **Threat Model**: [SECURITY.md - Threat Model](./SECURITY.md#threat-model) - What we protect against
2. **Features**: [SECURITY.md - Security Features](./SECURITY.md#security-features) - How we protect it
3. **Production Checklist**: [SECURITY.md - Production Checklist](./SECURITY.md#production-security-checklist) - 20+ items
4. **Vulnerability Reporting**: [SECURITY.md - Vulnerability Disclosure](./SECURITY.md#vulnerability-disclosure) - How to report
5. **Compliance**: [SECURITY.md - Compliance](./SECURITY.md#compliance) - GDPR, CCPA, SOC 2

### For Project Managers / Product

1. **Overview**: [README.md](./README.md) - Full feature overview
2. **Features**: [README.md - Features](./README.md#features) - What's included
3. **Architecture**: [README.md - Architecture](./README.md#architecture) - System design
4. **Security**: [SECURITY.md - Threat Model](./SECURITY.md#threat-model) - What's protected
5. **Roadmap**: [SECURITY.md - Security Roadmap](./SECURITY.md#security-roadmap) - Future enhancements

---

## File Structure Quick Reference

```
Privote/
├── README.md              ← START HERE
├── README_SHORT.md        ← Quick reference
├── API.md                 ← Endpoint documentation
├── SECURITY.md            ← Security & compliance
├── DEPLOYMENT.md          ← Production deployment
├── CONTRIBUTING.md        ← Contributing guidelines
│
├── src/
│   ├── config/            ← Configuration (uses .env)
│   ├── models/            ← Database schemas
│   ├── controllers/       ← Request handlers (use asyncHandler)
│   ├── services/          ← Business logic
│   ├── routes/            ← Express routes
│   ├── middleware/        ← Middleware (auth, error, etc.)
│   ├── fhe/               ← FHE integration & Zama SDK
│   ├── utils/             ← Utilities (crypto, logger, etc.)
│   ├── jobs/              ← Background job processing
│   ├── tests/             ← Unit & integration tests
│   └── server.js          ← Main Express app
│
├── contracts/
│   └── PrivoteVoting.sol  ← FHEVM smart contract
│
├── scripts/
│   └── deploy.js          ← Hardhat deployment script
│
├── docker-compose.yml     ← Multi-container setup
├── Dockerfile             ← Production container image
├── hardhat.config.js      ← Hardhat configuration
├── package.json           ← NPM dependencies & scripts
├── .env.example           ← Environment template
└── .eslintrc.json         ← Linting rules
```

---

## Common Tasks

### "I want to..."

**...get started quickly:**
→ [README.md - Quick Start](./README.md#quick-start)

**...integrate the API in my frontend:**
→ [API.md - Frontend Integration](./API.md#frontend-integration-guide)

**...understand the security model:**
→ [SECURITY.md - Threat Model](./SECURITY.md#threat-model)

**...deploy to production:**
→ [DEPLOYMENT.md](./DEPLOYMENT.md)

**...contribute code:**
→ [CONTRIBUTING.md](./CONTRIBUTING.md)

**...report a security issue:**
→ [SECURITY.md - Vulnerability Disclosure](./SECURITY.md#vulnerability-disclosure)

**...understand the voting flow:**
→ [API.md - Voting](./API.md#voting)

**...set up the development environment:**
→ [README.md - Installation](./README.md#installation) + [README.md - Running Locally](./README.md#running-locally)

**...understand the codebase structure:**
→ [CONTRIBUTING.md - Coding Standards](./CONTRIBUTING.md#coding-standards)

**...troubleshoot an issue:**
→ [README.md - Troubleshooting](./README.md#troubleshooting)

---

## Documentation Statistics

| File | Size | Focus | Audience |
|------|------|-------|----------|
| README.md | 20 KB | Installation, setup, overview | Everyone |
| API.md | 21 KB | Endpoints, integration, examples | Frontend devs |
| SECURITY.md | 13 KB | Threat model, compliance, best practices | Security, ops |
| DEPLOYMENT.md | 21 KB | Production deployment, scaling | DevOps, ops |
| CONTRIBUTING.md | 14 KB | Code standards, PR process, testing | Backend devs |
| **Total** | **~90 KB** | Comprehensive coverage | All roles |

---

## Need Help?

- **GitHub Issues**: [https://github.com/Ojukwu12/Privote/issues](https://github.com/Ojukwu12/Privote/issues)
- **Email**: support@privote.io
- **Security Issues**: security@privote.io (do not open public issues)

---

## Key Resources

**Zama FHEVM:**
- [Zama Documentation](https://docs.zama.ai/fhevm/)
- [Sepolia Network Configuration](https://docs.zama.ai/fhevm/getting_started/connect)
- [fhevmjs Client Library](https://docs.zama.ai/fhevmjs)

**Blockchain:**
- [Sepolia Faucet](https://sepoliafaucet.com/)
- [ethers.js Documentation](https://docs.ethers.org/)
- [Hardhat Documentation](https://hardhat.org/docs)

**Development:**
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [MongoDB Security](https://www.mongodb.com/docs/manual/security/)

---

**Last Updated**: December 2025

**Documentation Version**: 1.0

**Application Version**: 1.0.0
