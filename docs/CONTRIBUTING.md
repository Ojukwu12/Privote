# Contributing to Privote

Thank you for your interest in contributing to Privote! This document provides guidelines and instructions for contributing.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Git Workflow](#git-workflow)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Security](#security)
- [Documentation](#documentation)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. We pledge to:

- **Be respectful**: Treat all individuals with courtesy and respect
- **Be inclusive**: Welcome contributions from people of all backgrounds
- **Be professional**: Maintain professional discourse in all interactions
- **Be collaborative**: Work together towards common goals

### Expected Behavior

- Use inclusive language
- Be respectful of differing opinions
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassing, abusive, or discriminatory comments
- Threats or intimidation
- Deliberate misrepresentation
- Unwelcome sexual attention
- Any form of harassment

**Report violations**: Contact [conduct@privote.io](mailto:conduct@privote.io)

---

## Getting Started

### Fork & Clone

1. Fork the repository on GitHub
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Privote.git
   cd Privote
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/Ojukwu12/Privote.git
   ```

### Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates
- `test/` - Tests
- `chore/` - Build, deps, config

---

## Development Setup

### Install Dependencies

```bash
npm install
```

### Setup Environment

```bash
cp .env.example .env
# Edit .env with your development settings
```

### Start Development Servers

**Terminal 1: API**
```bash
npm run dev
```

**Terminal 2: Worker**
```bash
npm run worker
```

**Terminal 3: Tests (optional)**
```bash
npm run test:unit -- --watch
```

### Compile Smart Contracts

```bash
npm run compile
```

### Deploy to Testnet

```bash
npm run deploy:testnet
```

---

## Coding Standards

### Language & Style

- **Language**: Plain JavaScript ES6+ (no TypeScript)
- **Linter**: ESLint with Airbnb config
- **Formatter**: (Optional) Prettier with 2-space indentation

### Code Structure

#### Backend Law Pattern

All controllers must follow the "backend law" to ensure consistency:

```javascript
// ✅ CORRECT: Use asyncHandler
const submitVote = asyncHandler(async (req, res, next) => {
  const { proposalId, encryptedVote } = req.body;
  
  const vote = await voteService.submitVote(proposalId, encryptedVote);
  
  res.status(201).json({
    success: true,
    data: vote
  });
});

// ❌ WRONG: Don't use try/catch in controllers
const submitVote = async (req, res) => {
  try {
    // ...
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

#### Error Handling

Always use `CustomError` class:

```javascript
// ✅ CORRECT
if (!user) {
  throw new CustomError('User not found', 404);
}

// ❌ WRONG
if (!user) {
  throw new Error('User not found');
}
```

#### Async/Await

Use async/await consistently:

```javascript
// ✅ CORRECT
const user = await User.findById(userId);
const votes = await Vote.find({ userId });

// ❌ WRONG
User.findById(userId).then(user => {
  // callback hell
});
```

### File Organization

```
src/
├── controllers/     # Request handlers (use asyncHandler)
├── services/       # Business logic
├── models/         # Database schemas
├── routes/         # Route definitions
├── middleware/     # Middleware functions
├── utils/          # Utility functions
├── fhe/            # FHE integration
├── jobs/           # Background jobs
└── config/         # Configuration
```

### Variable Naming

- **Constants**: `UPPER_SNAKE_CASE`
- **Classes**: `PascalCase`
- **Functions/variables**: `camelCase`
- **Private variables**: `_privateVar` (optional underscore prefix)

### Comments & Documentation

```javascript
/**
 * Submit a vote to a proposal
 * @param {string} proposalId - Proposal ID
 * @param {string} encryptedVote - Encrypted vote value
 * @returns {Promise<Object>} Vote object with jobId
 * @throws {CustomError} If proposal not found or user already voted
 */
const submitVote = asyncHandler(async (proposalId, encryptedVote) => {
  // Implementation
});
```

### No Console Logs in Production Code

Use the logger instead:

```javascript
// ✅ CORRECT
logger.info('Vote submitted', { voteId, proposalId });

// ❌ WRONG
console.log('Vote submitted:', voteId);
```

---

## Testing

### Test Locations

- **Unit tests**: `src/tests/unit/`
- **Integration tests**: `src/tests/integration/`
- **Test files**: `*.test.js`

### Writing Tests

#### Unit Test Example

```javascript
const { expect } = require('chai');
const sinon = require('sinon');
const crypto = require('../utils/crypto');

describe('Crypto Utils', () => {
  describe('encryptPrivateKey', () => {
    it('should encrypt a private key with password', () => {
      const password = 'testPassword123';
      const privateKey = '0x1234...5678';
      
      const encrypted = crypto.encryptPrivateKey(privateKey, password);
      
      expect(encrypted).to.have.property('iv');
      expect(encrypted).to.have.property('salt');
      expect(encrypted).to.have.property('data');
      expect(encrypted).to.have.property('authTag');
    });
    
    it('should decrypt with correct password', () => {
      const password = 'testPassword123';
      const privateKey = '0x1234...5678';
      
      const encrypted = crypto.encryptPrivateKey(privateKey, password);
      const decrypted = crypto.decryptPrivateKey(encrypted, password);
      
      expect(decrypted).to.equal(privateKey);
    });
    
    it('should fail with incorrect password', () => {
      const encrypted = crypto.encryptPrivateKey('0x...', 'password123');
      
      expect(() => {
        crypto.decryptPrivateKey(encrypted, 'wrongPassword');
      }).to.throw();
    });
  });
});
```

#### Integration Test Example

```javascript
const request = require('supertest');
const { expect } = require('chai');
const app = require('../server');
const User = require('../models/User');

describe('Authentication Flow', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });
  
  it('should register a new user', (done) => {
    request(app)
      .post('/api/users/register')
      .send({
        username: 'alice',
        email: 'alice@example.com',
        password: 'SecurePassword123'
      })
      .expect(201)
      .end((err, res) => {
        if (err) return done(err);
        
        expect(res.body.success).to.be.true;
        expect(res.body.data.user.username).to.equal('alice');
        expect(res.body.data.token).to.exist;
        
        done();
      });
  });
});
```

### Test Coverage

- Aim for >80% coverage on critical paths
- All new features must include tests
- Both success and failure cases

### Running Tests

```bash
# All tests
npm test

# Unit only
npm run test:unit

# Integration only
npm run test:integration

# With coverage
npm run test:coverage

# Watch mode
npm test -- --watch
```

---

## Git Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/amazing-feature
```

### 2. Make Changes

- Keep commits atomic and focused
- Write descriptive commit messages
- Include tests for new features

### 3. Sync with Upstream

```bash
git fetch upstream
git rebase upstream/main
```

### 4. Push to Your Fork

```bash
git push origin feature/amazing-feature
```

### 5. Create Pull Request

- Open PR on GitHub
- Reference related issues
- Provide clear description of changes

---

## Commit Messages

Follow conventional commits format:

```
type(scope): subject

body

footer
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code refactoring
- `test`: Test additions/updates
- `docs`: Documentation
- `chore`: Build, dependencies, etc.
- `style`: Code style changes

### Examples

```bash
git commit -m "feat(auth): add JWT token refresh endpoint"
git commit -m "fix(vote): handle idempotent vote submission"
git commit -m "refactor(config): centralize environment variable validation"
git commit -m "test(crypto): add encryption edge case tests"
git commit -m "docs(api): update vote submission endpoint documentation"
```

---

## Pull Request Process

### Before Creating PR

- [ ] Run `npm run lint` and fix issues
- [ ] Run `npm test` and ensure all pass
- [ ] Rebase on latest `upstream/main`
- [ ] Update documentation if needed
- [ ] Add tests for new features
- [ ] Update CHANGELOG (if applicable)

### PR Description Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Testing
Describe how you tested the changes.

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests passing
- [ ] No new warnings generated

## Screenshots (if applicable)
```

### Review Process

1. **Automated Checks**:
   - ESLint
   - Tests
   - Coverage

2. **Code Review**:
   - At least 2 approvals required
   - Address feedback constructively
   - Maintain professional tone

3. **Merge**:
   - Squash commits if many small commits
   - Maintainer merges PR

---

## Security

### Vulnerability Reporting

**DO NOT** create a public issue for security vulnerabilities.

**Instead**: Email [security@privote.io](mailto:security@privote.io)

### Security Guidelines

- Never commit secrets, private keys, or credentials
- Validate all user input
- Use parameterized queries (Mongoose does this)
- Sanitize output
- Keep dependencies updated
- Run `npm audit` before committing

### Dependencies

- Use npm audit to check for vulnerabilities:
  ```bash
  npm audit
  npm audit fix
  ```
- Avoid adding unnecessary dependencies
- Keep dependencies up to date
- Lock major versions in package.json

---

## Documentation

### Code Comments

```javascript
/**
 * Compute encrypted tally for a proposal
 * @param {string} proposalId - Proposal ID
 * @returns {Promise<string>} Encrypted tally as hex string
 * @throws {CustomError} If proposal not found
 */
const computeTally = asyncHandler(async (proposalId) => {
  // Implementation
});
```

### README Updates

Update relevant documentation:
- `README.md` - For major features or setup changes
- `API.md` - For new endpoints
- `SECURITY.md` - For security-related changes
- `DEPLOYMENT.md` - For deployment changes

### CHANGELOG Format

```markdown
## [1.1.0] - 2025-12-24

### Added
- New endpoint for batch vote submission
- Real-time vote status WebSocket

### Fixed
- Race condition in tally computation
- MongoDB connection pool exhaustion

### Changed
- Updated Zama SDK to v0.10.0

### Security
- Improved password hashing parameters
```

---

## Development Tips

### Debugging

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev

# VS Code debugging
# Add to .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/src/server.js",
  "restart": true,
  "console": "integratedTerminal"
}
```

### Mock FHE for Testing

```bash
# Use mock shim instead of real relayer
RELAYER_MOCK=true npm run dev
```

### Database

```bash
# Connect to local MongoDB
mongosh

# See all databases
show dbs

# Use privote database
use privote

# See collections
show collections

# Query
db.users.find()
```

---

## Common Issues

### "npm install fails"

```bash
rm -rf node_modules package-lock.json
npm install
```

### "Tests fail locally but pass in CI"

- Ensure MongoDB and Redis are running
- Check environment variables
- Clear node cache: `npm cache clean --force`

### "Linting errors"

```bash
npm run lint:fix
```

### "Git rebase conflicts"

```bash
# View conflicts
git status

# After resolving
git add .
git rebase --continue
```

---

## Areas for Contribution

### High Priority

- [ ] Frontend reference implementation (React + fhevmjs)
- [ ] Additional test coverage
- [ ] Performance optimizations
- [ ] Security audit fixes

### Medium Priority

- [ ] Multi-choice voting support
- [ ] WebSocket real-time updates
- [ ] Advanced monitoring/alerting
- [ ] Improved error messages

### Nice to Have

- [ ] UI for admin dashboard
- [ ] Postman collection
- [ ] OpenAPI specification
- [ ] GraphQL API

---

## Getting Help

- **GitHub Discussions**: Ask questions and share ideas
- **GitHub Issues**: Report bugs or request features
- **Email**: [support@privote.io](mailto:support@privote.io)

---

## License

By contributing to Privote, you agree that your contributions will be licensed under the MIT License.

---

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- GitHub contributors page
- Release notes (for significant contributions)

---

Thank you for contributing to Privote! ❤️
