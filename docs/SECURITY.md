# Security Policy

## Overview

Privote is designed with security as a core principle. This document outlines the threat model, security practices, and guidelines for secure deployment and operation.

---

## Threat Model

### Trust Boundaries

```
┌──────────────────────────────────────────────────────┐
│                     CLIENT                           │
│  - Holds private FHE key in memory                   │
│  - Encrypts votes locally                            │
│  - Decrypts tallies locally                          │
│  - Trusts: Backend for availability, not privacy     │
└──────────────────┬───────────────────────────────────┘
                   │ HTTPS + JWT
┌──────────────────▼───────────────────────────────────┐
│                    BACKEND                           │
│  - Stores encrypted private keys                     │
│  - Relays encrypted votes to chain                   │
│  - Never sees plaintext votes or keys                │
│  - Trusts: Zama relayer, blockchain integrity        │
└──────────────────┬───────────────────────────────────┘
                   │ Relayer SDK
┌──────────────────▼───────────────────────────────────┐
│              ZAMA FHEVM + RELAYER                    │
│  - Performs homomorphic operations                   │
│  - Returns encrypted results                         │
│  - Trusts: FHE cryptographic assumptions             │
└──────────────────────────────────────────────────────┘
```

### Assets Protected

1. **User Private Keys**: FHE private keys for vote decryption
2. **Vote Content**: Encrypted vote values (never decrypted on backend)
3. **Tally Results**: Encrypted until publicly revealed
4. **User Credentials**: Passwords, JWTs
5. **Project Wallet Private Key**: Signs all blockchain transactions

### Adversary Model

**Threats We Mitigate:**

- ✅ Compromised backend database (encrypted private keys)
- ✅ Man-in-the-middle attacks (HTTPS, encrypted payloads)
- ✅ Vote manipulation (blockchain immutability, FHE integrity)
- ✅ Tally tampering (homomorphic operations, on-chain verification)
- ✅ Unauthorized access (JWT authentication, role-based authorization)
- ✅ Brute force attacks (rate limiting, bcrypt password hashing)

**Threats Requiring Additional Mitigation:**

- ⚠️ Compromised client device (user must protect their session)
- ⚠️ Social engineering (user education required)
- ⚠️ Quantum computing (FHE is post-quantum secure; other crypto may need upgrades)

---

## Security Features

### 1. Private Key Protection

**Hybrid Encryption Model:**

```
User Password
     │
     ▼
  [scrypt KDF] ← Unique Salt (32 bytes)
     │
     ▼
 AES-256-GCM Key (32 bytes)
     │
     ▼
  Encrypt(FHE Private Key)
     │
     ▼
  { iv, salt, data, authTag } → Stored in MongoDB
```

**Properties:**
- **Memory-hard KDF**: scrypt with N=16384, r=8, p=1
- **Authenticated encryption**: AES-256-GCM with 128-bit auth tag
- **Unique salt per user**: Prevents rainbow table attacks
- **No plaintext storage**: Private keys never persisted unencrypted

**Attack Resistance:**
- Password cracking: ~2^70 operations for 8-char password
- Database compromise: Attacker needs password to decrypt keys

### 2. Vote Encryption

- Votes encrypted with FHE **client-side** using Zama SDK
- Backend only handles encrypted ciphertexts
- Zero-knowledge proofs (ZKPoK) verify encrypted inputs
- Homomorphic operations preserve encryption

### 3. Authentication & Authorization

- **JWT tokens**: Signed with HS256, 7-day expiry
- **Bcrypt password hashing**: 12 rounds (adjustable)
- **Role-based access control**: `user` vs `admin` roles
- **Rate limiting**: 
  - Auth endpoints: 5 attempts / 15 minutes
  - Vote submission: 10 votes / minute
  - Key decryption: 20 requests / hour

### 4. Audit Logging

All sensitive operations logged to `AuditLog` model:

- User registration, login, logout
- Private key decryption requests
- Vote submissions
- Proposal creation/closure
- Admin actions
- Failed authentication attempts

Logs include: userId, action, timestamp, IP address, success/failure.

**Production**: Export audit logs to external SIEM (Splunk, ELK, etc.).

### 5. Network Security

- **HTTPS only** in production
- **Helmet.js**: Sets security headers (CSP, HSTS, etc.)
- **CORS**: Configurable origin whitelist
- **Rate limiting**: Global and per-endpoint limits

---

## Production Security Checklist

### Before Deployment

- [ ] Change `JWT_SECRET` to a strong random value (64+ bytes)
- [ ] Store `PROJECT_PRIVATE_KEY` in KMS (AWS Secrets Manager, HashiCorp Vault, etc.)
- [ ] Enable HTTPS with valid TLS certificate (Let's Encrypt, Cloudflare)
- [ ] Configure CORS to whitelist only your frontend domain
- [ ] Set `NODE_ENV=production`
- [ ] Disable debug logging in production (`LOG_LEVEL=info` or `warn`)
- [ ] Review and adjust rate limits for your traffic patterns
- [ ] Enable MongoDB authentication and encryption at rest
- [ ] Enable Redis authentication (`requirepass` in redis.conf)
- [ ] Set up firewall rules (allow only necessary ports)
- [ ] Configure security groups / network policies (cloud providers)

### KMS Integration

**Recommended Approach:**

Store `PROJECT_PRIVATE_KEY` in a KMS and retrieve at runtime:

```javascript
// Example: AWS Secrets Manager
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager({ region: 'us-east-1' });

async function getProjectPrivateKey() {
  const data = await secretsManager.getSecretValue({
    SecretId: 'privote/project-wallet-key'
  }).promise();
  
  return data.SecretString;
}
```

Update `src/config/index.js` to fetch from KMS instead of environment variable.

### Monitoring & Incident Response

- [ ] Set up error tracking (Sentry, Rollbar)
- [ ] Configure uptime monitoring (Pingdom, UptimeRobot)
- [ ] Enable CloudWatch / Stackdriver / Azure Monitor for logs
- [ ] Set up alerts for:
  - Failed authentication spikes
  - Unusual vote submission patterns
  - Database connection failures
  - Worker job failures
- [ ] Define incident response plan
- [ ] Document breach notification procedures (if applicable)

---

## Security Best Practices

### For Developers

1. **Never log sensitive data**:
   - ❌ Don't log: passwords, private keys, JWTs, raw votes
   - ✅ Do log: userIds, proposalIds, action types, timestamps

2. **Validate all inputs**:
   - Use Joi schemas for request validation
   - Sanitize user-provided strings
   - Reject malformed data early

3. **Use parameterized queries**:
   - Mongoose prevents NoSQL injection by default
   - Never concatenate user input into queries

4. **Secure dependencies**:
   ```bash
   npm audit              # Check for vulnerabilities
   npm audit fix          # Auto-fix where possible
   npm outdated           # Check for updates
   ```

5. **Code review**:
   - Require PR reviews for all changes
   - Run automated security scans (Snyk, Dependabot)

### For Operators

1. **Principle of least privilege**:
   - Grant minimal permissions to service accounts
   - Separate dev/staging/production environments

2. **Secrets rotation**:
   - Rotate JWT secrets every 90 days
   - Rotate project wallet periodically (requires contract migration)
   - Use short-lived credentials where possible

3. **Backup & disaster recovery**:
   - Backup MongoDB regularly (encrypted backups)
   - Store backups off-site
   - Test restore procedures

4. **Network segmentation**:
   - Place database on private subnet
   - Use VPN/bastion for admin access
   - Restrict inbound/outbound traffic

### For Users (Frontend Integration)

1. **Secure key storage**:
   - Store private key in memory only (never localStorage)
   - Use platform-secure storage if available (Keychain, Keystore)
   - Clear key from memory on logout

2. **Password requirements**:
   - Enforce minimum 8 characters
   - Recommend password manager usage
   - Support 2FA (future enhancement)

3. **Session management**:
   - Implement auto-logout after inactivity
   - Revoke tokens on explicit logout
   - Use HTTPS-only cookies for JWT (if cookie-based)

---

## Known Limitations

1. **Single Project Wallet**:
   - All transactions signed by one wallet
   - Wallet compromise = full system compromise
   - Mitigation: Use hardware wallet / KMS for signing

2. **Backend Can Deny Service**:
   - Backend controls which votes reach the chain
   - Malicious backend could censor votes (but not alter them)
   - Mitigation: User-signed messages, on-chain event monitoring

3. **Client Trust Required**:
   - User must trust their client device to not leak private key
   - Compromised client can reveal user's decrypted data
   - Mitigation: Client-side security audits, sandboxing

4. **No Anonymous Voting**:
   - Backend knows which user voted (not what they voted)
   - On-chain transactions link wallet to vote submission
   - Future: Zero-knowledge identity proofs for anonymity

---

## Vulnerability Disclosure

### Reporting a Vulnerability

**DO NOT** open a public GitHub issue for security vulnerabilities.

**Instead:**

1. Email security contact: [security@privote.io](mailto:security@privote.io)
2. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

3. We will:
   - Acknowledge within 48 hours
   - Investigate and validate
   - Develop and test a fix
   - Release a patch
   - Credit you (if desired) in release notes

**Responsible Disclosure Timeline:**

- Day 0: Report received
- Day 2: Acknowledgment sent
- Day 14: Fix developed
- Day 30: Patch released
- Day 90: Public disclosure (if not sooner)

### Security Updates

Security patches will be released as:

- **Patch versions** for minor/low severity (e.g., 1.0.1)
- **Minor versions** for moderate severity (e.g., 1.1.0)
- **Emergency releases** for critical vulnerabilities

Subscribe to security advisories: [GitHub Security Advisories](https://github.com/Ojukwu12/Privote/security/advisories)

---

## Compliance

### GDPR (EU General Data Protection Regulation)

Privote collects:
- Email addresses (PII)
- Encrypted private keys (not readable without password)
- Audit logs (IP addresses, user agents)

**User Rights:**
- Right to access: Export user data via API
- Right to deletion: Delete user account (anonymize audit logs)
- Right to portability: Export votes and proposals

**Data Processing:**
- Encrypted data is not "personal data" under GDPR if key is unknown
- Users control decryption keys (data controller = user)

### Other Regulations

- **CCPA** (California): Similar rights as GDPR
- **SOC 2**: Audit controls for security, availability, confidentiality
- **ISO 27001**: Information security management

**Recommendation**: Consult legal counsel for specific compliance requirements.

---

## Security Roadmap

Future enhancements:

- [ ] Hardware wallet integration for project wallet
- [ ] Multi-signature admin operations
- [ ] On-chain governance for admin actions
- [ ] Anonymous voting with zk-SNARKs
- [ ] Rate limit by user (not just IP)
- [ ] Advanced anomaly detection (ML-based)
- [ ] Client-side E2E encryption for proposal metadata
- [ ] Formal security audit by third party

---

## References

- [OWASP Top 10](https://owasp.org/Top10/)
- [Zama Security Model](https://docs.zama.ai/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [MongoDB Security Checklist](https://www.mongodb.com/docs/manual/administration/security-checklist/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)

---

**Last Updated**: December 2025

**Contact**: security@privote.io
