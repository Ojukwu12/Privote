Jim
# API Reference

Complete documentation for the Privote REST API.

---

## Base URL

```
Development: http://localhost:3000/api
Production:  https://api.privote.io/api
```

---

## Authentication

Most endpoints require a JWT token in the `Authorization` header:

```http
Authorization: Bearer <JWT_TOKEN>
```

Obtain a token via `POST /api/users/login`.

### Authentication Status Codes

- `200 OK` - Success
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Insufficient permissions
- `429 Too Many Requests` - Rate limit exceeded

---

## Rate Limits

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| Auth (login/register) | 5 requests | 15 minutes |
| Vote submission | 10 requests | 1 minute |
| Key decryption | 20 requests | 1 hour |
| General API | 100 requests | 15 minutes |

**Rate Limit Headers:**

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1735056000
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400,
  "metadata": {
    "field": "additional context"
  }
}
```

### Common Error Codes

- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Authentication required
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `422 Unprocessable Entity` - Validation failed
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Endpoints

### Health Check

#### `GET /api/health`

Check API health and version.

**Authentication:** None

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-12-24T12:00:00.000Z",
    "uptime": 3600,
    "version": "1.0.0"
  }
}
```

---

#### `GET /api/metrics`

Get system metrics (admin only).

**Authentication:** Required (admin role)

**Response:**

```json
{
  "success": true,
  "data": {
    "users": 1234,
    "proposals": 56,
    "votes": 7890,
    "activeProposals": 12,
    "queueStats": {
      "waiting": 3,
      "active": 2,
      "completed": 1234,
      "failed": 5
    }
  }
}
```

---

### User Management

#### `POST /api/users/register`

Register a new user and generate FHE keypair.

**Authentication:** None

**Request Body:**

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "SecureP@ss123"
}
```

**Validation:**
- `username`: 3-30 chars, alphanumeric + underscore
- `email`: Valid email format
- `password`: Min 8 chars

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "676a1234567890abcdef1234",
      "username": "alice",
      "email": "alice@example.com",
      "publicKey": "0xabcd...ef01",
      "role": "user",
      "createdAt": "2025-12-24T12:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "message": "User registered successfully. Store your password securely - it is required to decrypt your private key."
  }
}
```

**Errors:**
- `409 Conflict` - Email already registered

**Example:**

```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com",
    "password": "SecureP@ss123"
  }'
```

---

#### `POST /api/users/login`

Authenticate and receive JWT token.

**Authentication:** None

**Request Body:**

```json
{
  "email": "alice@example.com",
  "password": "SecureP@ss123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "676a1234567890abcdef1234",
      "username": "alice",
      "email": "alice@example.com",
      "publicKey": "0xabcd...ef01",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors:**
- `401 Unauthorized` - Invalid credentials

**Example:**

```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecureP@ss123"
  }'
```

---

#### `GET /api/users/profile`

Get authenticated user's profile.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "676a1234567890abcdef1234",
    "username": "alice",
    "email": "alice@example.com",
    "publicKey": "0xabcd...ef01",
    "role": "user",
    "createdAt": "2025-12-24T12:00:00.000Z"
  }
}
```

**Example:**

```bash
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

#### `GET /api/users/public/:userId`

Get a user's public FHE key.

**Authentication:** None

**Parameters:**
- `userId` (path) - User ID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "userId": "676a1234567890abcdef1234",
    "publicKey": "0xabcd...ef01"
  }
}
```

**Errors:**
- `404 Not Found` - User not found

**Example:**

```bash
curl -X GET http://localhost:3000/api/users/public/676a1234567890abcdef1234
```

---

#### `POST /api/users/decrypt`

Decrypt user's private FHE key (requires password).

**Authentication:** Required

**Request Body:**

```json
{
  "password": "SecureP@ss123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "privateKey": "0x1234...5678",
    "message": "CRITICAL: Do not log or store this private key. Use it immediately and clear from memory."
  }
}
```

**Errors:**
- `401 Unauthorized` - Incorrect password

**Rate Limit:** 20 requests / hour

**Example:**

```bash
curl -X POST http://localhost:3000/api/users/decrypt \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password": "SecureP@ss123"}'
```

---

### Proposals

#### `POST /api/proposals`

Create a new proposal (admin only).

**Authentication:** Required (admin role)

**Request Body:**

```json
{
  "title": "Should we upgrade to v2?",
  "description": "Proposal to upgrade the protocol to version 2 with new features...",
  "startTime": "2025-12-25T00:00:00.000Z",
  "endTime": "2025-12-31T23:59:59.000Z",
  "requiredRole": "user",
  "metadata": {
    "quorum": "50",
    "category": "governance"
  }
}
```

**Validation:**
- `title`: 3-200 chars
- `description`: Max 5000 chars
- `startTime`: ISO 8601 date
- `endTime`: Must be after startTime
- `requiredRole`: "user" or "admin"

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "676b9876543210fedcba9876",
    "title": "Should we upgrade to v2?",
    "description": "Proposal to upgrade the protocol...",
    "startTime": "2025-12-25T00:00:00.000Z",
    "endTime": "2025-12-31T23:59:59.000Z",
    "requiredRole": "user",
    "closed": false,
    "encryptedTally": null,
    "txHash": null,
    "metadata": {
      "quorum": "50",
      "category": "governance"
    },
    "createdBy": "676a1234567890abcdef1234",
    "createdAt": "2025-12-24T12:00:00.000Z"
  }
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/proposals \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Should we upgrade to v2?",
    "description": "Proposal to upgrade the protocol to version 2...",
    "startTime": "2025-12-25T00:00:00.000Z",
    "endTime": "2025-12-31T23:59:59.000Z",
    "requiredRole": "user"
  }'
```

---

#### `GET /api/proposals`

List all proposals with optional filters.

**Authentication:** None (public proposals visible)

**Query Parameters:**
- `status` (optional) - "open", "closed", "upcoming"
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20, max: 100) - Results per page

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "proposals": [
      {
        "id": "676b9876543210fedcba9876",
        "title": "Should we upgrade to v2?",
        "description": "Proposal to upgrade...",
        "startTime": "2025-12-25T00:00:00.000Z",
        "endTime": "2025-12-31T23:59:59.000Z",
        "requiredRole": "user",
        "closed": false,
        "voteCount": 42,
        "createdBy": {
          "id": "676a1234567890abcdef1234",
          "username": "admin"
        },
        "createdAt": "2025-12-24T12:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 56,
      "page": 1,
      "limit": 20,
      "pages": 3
    }
  }
}
```

**Example:**

```bash
# Get all open proposals
curl -X GET "http://localhost:3000/api/proposals?status=open&limit=10"

# Get page 2 of closed proposals
curl -X GET "http://localhost:3000/api/proposals?status=closed&page=2"
```

---

#### `GET /api/proposals/:id`

Get a specific proposal by ID.

**Authentication:** None

**Parameters:**
- `id` (path) - Proposal ID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "676b9876543210fedcba9876",
    "title": "Should we upgrade to v2?",
    "description": "Proposal to upgrade the protocol...",
    "startTime": "2025-12-25T00:00:00.000Z",
    "endTime": "2025-12-31T23:59:59.000Z",
    "requiredRole": "user",
    "closed": false,
    "encryptedTally": null,
    "voteCount": 42,
    "metadata": {
      "quorum": "50",
      "category": "governance"
    },
    "createdBy": {
      "id": "676a1234567890abcdef1234",
      "username": "admin"
    },
    "createdAt": "2025-12-24T12:00:00.000Z"
  }
}
```

**Errors:**
- `404 Not Found` - Proposal not found

**Example:**

```bash
curl -X GET http://localhost:3000/api/proposals/676b9876543210fedcba9876
```

---

#### `POST /api/proposals/:id/close`

Close a proposal and trigger tally computation (admin only).

**Authentication:** Required (admin role)

**Parameters:**
- `id` (path) - Proposal ID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "proposalId": "676b9876543210fedcba9876",
    "closed": true,
    "tallyJobId": "tally-job-123456",
    "message": "Proposal closed. Tally computation queued.",
    "estimatedCompletionTime": "2-5 minutes"
  }
}
```

**Errors:**
- `400 Bad Request` - Proposal already closed or not yet ended
- `404 Not Found` - Proposal not found

**Example:**

```bash
curl -X POST http://localhost:3000/api/proposals/676b9876543210fedcba9876/close \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

---

### Voting

#### `POST /api/votes/submit`

Submit an encrypted vote.

**Authentication:** Required

**Request Body:**

```json
{
  "proposalId": "676b9876543210fedcba9876",
  "encryptedVote": "0x1234...abcd",
  "inputProof": "0x5678...ef01",
  "idempotencyKey": "vote-alice-proposal-1"
}
```

**Validation:**
- `proposalId`: Valid MongoDB ObjectId
- `encryptedVote`: Hex string (FHE ciphertext)
- `inputProof`: Hex string (ZKPoK)
- `idempotencyKey`: Unique identifier for duplicate prevention

**Response (202 Accepted):**

```json
{
  "success": true,
  "data": {
    "voteId": "676c1111222233334444555",
    "jobId": "vote-job-789012",
    "status": "queued",
    "message": "Vote accepted and queued for processing",
    "statusUrl": "/api/votes/status/vote-job-789012"
  }
}
```

**Errors:**
- `400 Bad Request` - Proposal not open or user not eligible
- `409 Conflict` - User already voted on this proposal
- `422 Unprocessable Entity` - Invalid encrypted data format

**Rate Limit:** 10 requests / minute

**Example:**

```bash
curl -X POST http://localhost:3000/api/votes/submit \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "proposalId": "676b9876543210fedcba9876",
    "encryptedVote": "0x1234...abcd",
    "inputProof": "0x5678...ef01",
    "idempotencyKey": "vote-alice-proposal-1"
  }'
```

---

#### `GET /api/votes/status/:jobId`

Check vote submission job status.

**Authentication:** Required

**Parameters:**
- `jobId` (path) - Job ID from submit response

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "jobId": "vote-job-789012",
    "status": "completed",
    "progress": 100,
    "result": {
      "txHash": "0xabcd...1234",
      "blockNumber": 12345678,
      "timestamp": "2025-12-24T12:05:00.000Z"
    },
    "createdAt": "2025-12-24T12:00:00.000Z",
    "completedAt": "2025-12-24T12:05:00.000Z"
  }
}
```

**Status Values:**
- `queued` - Waiting to be processed
- `active` - Currently processing
- `completed` - Successfully submitted to blockchain
- `failed` - Processing failed

**Errors:**
- `404 Not Found` - Job not found

**Example:**

```bash
curl -X GET http://localhost:3000/api/votes/status/vote-job-789012 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

#### `GET /api/votes/encrypted-tally/:proposalId`

Get encrypted tally for a proposal.

**Authentication:** None

**Parameters:**
- `proposalId` (path) - Proposal ID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "proposalId": "676b9876543210fedcba9876",
    "encryptedTally": "0xabcd...ef01",
    "voteCount": 123,
    "computedAt": "2025-12-31T23:59:59.000Z"
  }
}
```

**Errors:**
- `404 Not Found` - Proposal not found or tally not computed
- `400 Bad Request` - Proposal not yet closed

**Example:**

```bash
curl -X GET http://localhost:3000/api/votes/encrypted-tally/676b9876543210fedcba9876
```

---

#### `GET /api/votes/decrypted-tally/:proposalId`

Get publicly decrypted tally.

**Authentication:** None

**Parameters:**
- `proposalId` (path) - Proposal ID

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "proposalId": "676b9876543210fedcba9876",
    "decryptedTally": 87,
    "voteCount": 123,
    "decryptedAt": "2025-12-31T23:59:59.000Z"
  }
}
```

**Errors:**
- `404 Not Found` - Proposal not found or tally not decrypted
- `400 Bad Request` - Public decryption not yet performed

**Example:**

```bash
curl -X GET http://localhost:3000/api/votes/decrypted-tally/676b9876543210fedcba9876
```

---

#### `GET /api/votes/my-votes`

Get authenticated user's vote history.

**Authentication:** Required

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 20, max: 100)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "votes": [
      {
        "id": "676c1111222233334444555",
        "proposalId": "676b9876543210fedcba9876",
        "proposalTitle": "Should we upgrade to v2?",
        "encryptedVote": "0x1234...abcd",
        "txHash": "0xabcd...1234",
        "submittedAt": "2025-12-26T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "pages": 1
    }
  }
}
```

**Example:**

```bash
curl -X GET http://localhost:3000/api/votes/my-votes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Frontend Integration Guide

### Complete Voting Flow

#### 1. User Registration

```javascript
// Register new user
const registerResponse = await fetch('http://localhost:3000/api/users/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'alice',
    email: 'alice@example.com',
    password: 'SecureP@ss123'
  })
});

const { data } = await registerResponse.json();
const { token, user } = data;

// Store token securely
localStorage.setItem('authToken', token);
console.log('User public key:', user.publicKey);
```

#### 2. User Login

```javascript
const loginResponse = await fetch('http://localhost:3000/api/users/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'alice@example.com',
    password: 'SecureP@ss123'
  })
});

const { data } = await loginResponse.json();
localStorage.setItem('authToken', data.token);
```

#### 3. Fetch Proposals

```javascript
const proposalsResponse = await fetch('http://localhost:3000/api/proposals?status=open');
const { data } = await proposalsResponse.json();

data.proposals.forEach(proposal => {
  console.log(`${proposal.title} (ID: ${proposal.id})`);
  console.log(`Ends: ${proposal.endTime}`);
});
```

#### 4. Encrypt and Submit Vote

```javascript
import { createFhevmInstance } from 'fhevmjs';

// Initialize FHEVM instance
const fhevmInstance = await createFhevmInstance({
  chainId: 11155111,
  publicKey: proposalCreatorPublicKey,
  gatewayUrl: 'https://gateway.testnet.zama.org',
  aclAddress: '0xC1820b6Eb60f448E6c44d3A8f36EC6D5fCc76754'
});

// Encrypt vote value (e.g., 1 for "yes")
const encryptedInput = fhevmInstance.createEncryptedInput(
  proposalContractAddress,
  userWalletAddress
);

encryptedInput.add64(1); // Vote value

const { handles, inputProof } = encryptedInput.encrypt();

// Submit vote
const voteResponse = await fetch('http://localhost:3000/api/votes/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  },
  body: JSON.stringify({
    proposalId: proposal.id,
    encryptedVote: handles[0],
    inputProof: inputProof,
    idempotencyKey: `vote-${userId}-${proposal.id}`
  })
});

const { data: voteData } = await voteResponse.json();
console.log('Vote queued:', voteData.jobId);
```

#### 5. Poll Vote Status

```javascript
async function waitForVoteConfirmation(jobId) {
  while (true) {
    const statusResponse = await fetch(
      `http://localhost:3000/api/votes/status/${jobId}`,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    const { data } = await statusResponse.json();

    if (data.status === 'completed') {
      console.log('Vote confirmed on-chain:', data.result.txHash);
      return data.result;
    } else if (data.status === 'failed') {
      throw new Error('Vote submission failed');
    }

    // Wait 5 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

const result = await waitForVoteConfirmation(voteData.jobId);
```

#### 6. View Encrypted Tally (After Proposal Closes)

```javascript
const tallyResponse = await fetch(
  `http://localhost:3000/api/votes/encrypted-tally/${proposal.id}`
);

const { data } = await tallyResponse.json();
console.log('Encrypted tally:', data.encryptedTally);
console.log('Total votes:', data.voteCount);
```

#### 7. Decrypt Tally (User-Side)

```javascript
// User must decrypt their private key first
const decryptKeyResponse = await fetch(
  'http://localhost:3000/api/users/decrypt',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ password: userPassword })
  }
);

const { data: keyData } = await decryptKeyResponse.json();
const privateKey = keyData.privateKey;

// Decrypt the tally using FHEVM
const decryptedTally = await fhevmInstance.decrypt(
  data.encryptedTally,
  privateKey
);

console.log('Decrypted tally:', decryptedTally);

// CRITICAL: Clear private key from memory
privateKey = null;
```

#### 8. View Public Decryption

```javascript
// After admin triggers public decryption
const publicTallyResponse = await fetch(
  `http://localhost:3000/api/votes/decrypted-tally/${proposal.id}`
);

const { data } = await publicTallyResponse.json();
console.log('Public tally:', data.decryptedTally);
console.log('Total votes:', data.voteCount);
```

---

## WebSocket Support (Future)

For real-time updates, WebSocket support may be added:

```javascript
const socket = new WebSocket('ws://localhost:3000');

socket.on('vote-confirmed', (data) => {
  console.log('Vote confirmed:', data.voteId);
});

socket.on('tally-updated', (data) => {
  console.log('Tally updated for proposal:', data.proposalId);
});
```

---

## Pagination

All list endpoints support pagination:

```
GET /api/proposals?page=2&limit=50
```

**Response includes pagination metadata:**

```json
{
  "pagination": {
    "total": 123,
    "page": 2,
    "limit": 50,
    "pages": 3
  }
}
```

---

## Idempotency

Vote submissions use idempotency keys to prevent duplicate votes:

```json
{
  "idempotencyKey": "vote-alice-proposal-1"
}
```

If the same key is submitted again:

- Within 5 minutes: Returns original response (deduplicated)
- After 5 minutes: Treated as new submission (may fail if user already voted)

---

## Testing with Mock Mode

Set `RELAYER_MOCK=true` in `.env` to use the FHE shim:

```bash
RELAYER_MOCK=true
npm run dev
```

In mock mode:
- FHE operations are simulated
- No blockchain interaction
- Instant vote/tally processing
- Useful for frontend development

---

## Postman Collection

Import the Postman collection for easy API testing:

[Download Postman Collection](./postman_collection.json) *(to be created)*

---

## OpenAPI Specification

Full OpenAPI 3.0 spec available:

[Download OpenAPI YAML](./openapi.yaml) *(to be created)*

---

**Last Updated**: December 2025
