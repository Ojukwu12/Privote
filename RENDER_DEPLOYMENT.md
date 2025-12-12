# Render Deployment Guide for Privote

This guide explains how to properly deploy Privote with background worker support on Render.

---

## Architecture Overview

Privote requires **TWO separate processes**:

1. **API Server** (`node src/server.js`) - Handles HTTP requests
2. **Background Worker** (`node src/jobs/worker.js`) - Processes vote submissions and tally computations

Both need access to:
- MongoDB (Atlas)
- Redis (for job queue)
- Environment variables (FHE keys, contract addresses, etc.)

---

## Option 1: Separate Services (Recommended for Production)

This approach runs the API and worker as separate Render services.

### Step 1: Create Redis Instance

1. Go to Render Dashboard → **New** → **Redis**
2. Name: `privote-redis`
3. Plan: **Free** (for testing) or **Starter** (for production)
4. Note the **Internal Redis URL** (e.g., `redis://red-xxx:6379`)

### Step 2: Update Web Service (API Server)

1. Go to your existing Render web service
2. **Environment Variables** → Add:
   ```
   REDIS_URL=redis://red-xxx:6379  # Use internal Redis URL
   ```
3. **Build & Deploy Settings:**
   - **Build Command:** `npm install`
   - **Start Command:** `npm start` (or `node src/server.js`)

### Step 3: Create Background Service (Worker)

1. Go to Render Dashboard → **New** → **Background Worker**
2. Connect same Git repository
3. **Settings:**
   - **Name:** `privote-worker`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm run worker` (or `node src/jobs/worker.js`)
   - **Plan:** Free or Starter
   
4. **Environment Variables** → Copy ALL variables from your web service:
   ```
   NODE_ENV=production
   MONGO_URI=mongodb+srv://...
   REDIS_URL=redis://red-xxx:6379
   JWT_SECRET=...
   PROJECT_PRIVATE_KEY=...
   RELAYER_URL=https://relayer.testnet.zama.org
   NETWORK_RPC_URL=...
   VOTING_CONTRACT_ADDRESS=...
   GATEWAY_CONTRACT_ADDRESS=...
   # ... all other env vars
   ```

5. Deploy the worker service

### Step 4: Verify Both Services

- **API Server:** Should show "Server running on port..."
- **Worker:** Should show "Workers started and ready to process jobs"

---

## Option 2: Single Service (Development/Testing Only)

Run both API and worker in a single Render service. **Not recommended for production** due to potential resource constraints.

### Configure Single Service

1. **Start Command:** `npm run start:with-worker` (or `node src/start-all.js`)
2. This starts both processes simultaneously
3. Environment variables (same as Option 1):
   ```
   REDIS_URL=redis://...
   # ... all other variables
   ```

**Limitations:**
- Both processes share the same dyno resources
- If one crashes, both restart
- Harder to scale independently
- Not ideal for high-traffic production

---

## Environment Variables Checklist

Make sure BOTH services (web + worker) have these set:

### Required
```bash
# Database
MONGO_URI=mongodb+srv://...

# Redis (shared between API and worker)
REDIS_URL=redis://red-xxx:6379

# Authentication
JWT_SECRET=your-secret-key-here

# Blockchain
PROJECT_PRIVATE_KEY=0x...  # Wallet that signs transactions
NETWORK_RPC_URL=https://eth-sepolia.public.blastapi.io
VOTING_CONTRACT_ADDRESS=0x...  # Your deployed contract

# Zama FHE
RELAYER_URL=https://relayer.testnet.zama.org
GATEWAY_CONTRACT_ADDRESS=0x3E63c798A9bBB356F83B23AE68C1F6d985eFF58b
CHAIN_ID=11155111
GATEWAY_CHAIN_ID=10901
```

### Optional
```bash
PORT=3000  # API server only
NODE_ENV=production
LOG_LEVEL=info
BCRYPT_ROUNDS=12
```

---

## Testing the Setup

### 1. Check API Server
```bash
curl https://your-app.onrender.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "...",
  "uptime": 123,
  "database": "connected"
}
```

### 2. Submit a Test Vote

```bash
# Register user
curl -X POST https://your-app.onrender.com/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@example.com", "password": "Test123!"}'

# Login (save token)
TOKEN=$(curl -s -X POST https://your-app.onrender.com/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123!"}' | jq -r '.data.token')

# Submit vote
curl -X POST https://your-app.onrender.com/api/vote/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "proposalId": "...",
    "encryptedVote": "0x...",
    "inputProof": "0x..."
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "voteId": "...",
    "jobId": "...",
    "message": "Vote submitted successfully. Processing in background."
  }
}
```

### 3. Check Job Processing

```bash
curl https://your-app.onrender.com/api/vote/status/{jobId} \
  -H "Authorization: Bearer $TOKEN"
```

If worker is running:
```json
{
  "success": true,
  "data": {
    "state": "completed",
    "progress": 100,
    "processedOn": "..."
  }
}
```

If worker is NOT running:
```json
{
  "success": true,
  "data": {
    "state": null,  // ⚠️ Job stuck in queue
    "progress": 0
  }
}
```

### 4. Check Worker Logs

In Render Dashboard:
1. Go to `privote-worker` service
2. Click **Logs**
3. Should see:
   ```
   Worker connected to MongoDB
   Worker initialized Relayer SDK
   Workers started and ready to process jobs
   Processing vote job: ...
   ```

---

## Troubleshooting

### Issue: "worker_unavailable" Error

**Symptom:** Vote submission fails with:
```
Failed to queue vote for processing. This usually means the background worker service is not running.
```

**Solution:**
1. Check if worker service is deployed and running on Render
2. Verify `REDIS_URL` is set correctly in BOTH services
3. Check worker logs for errors
4. Restart worker service

### Issue: Jobs Stuck in Queue

**Symptom:** Vote status shows `state: null` forever

**Causes:**
- Worker service not running
- Redis connection failed
- Worker crashed but Render didn't restart it

**Solution:**
1. Check worker service logs
2. Manually restart worker service
3. Verify Redis is accessible from worker

### Issue: Database Connection Error in Worker

**Symptom:** Worker logs show "MongoDB connection failed"

**Solution:**
- Ensure `MONGO_URI` is set in worker environment variables
- Check MongoDB Atlas whitelist includes Render IPs (or use 0.0.0.0/0)

### Issue: "Cannot find module" Error

**Solution:**
- Run `npm install` on both services
- Check that `package.json` is in repo root

---

## Cost Estimate

### Free Tier (Testing)
- Web Service: **Free** (spins down after inactivity)
- Worker: **Free** (spins down after inactivity)
- Redis: **Free** (25MB, 100 connections)
- **Total: $0/month**

### Starter Tier (Production)
- Web Service: **$7/month** (always on)
- Worker: **$7/month** (always on)
- Redis: **$10/month** (256MB, 1000 connections)
- **Total: $24/month**

---

## Next Steps After Deployment

1. ✅ Verify both services are running
2. ✅ Test vote submission end-to-end
3. ✅ Check blockchain transaction on [Sepolia Etherscan](https://sepolia.etherscan.io)
4. ✅ Monitor worker logs for any errors
5. ✅ Set up proper error alerting (Render has built-in notifications)

---

## Quick Reference: Render Service Configuration

### Web Service (API)
- **Type:** Web Service
- **Start Command:** `npm start`
- **Port:** Automatic (uses `process.env.PORT`)
- **Health Check:** `/api/health`

### Background Worker
- **Type:** Background Worker
- **Start Command:** `npm run worker`
- **Health Check:** Not applicable (doesn't serve HTTP)

### Redis
- **Type:** Redis
- **Plan:** Free (testing) or Starter (production)
- **Access:** Internal URL only (not public)

---

## Summary

✅ **Option 1 (Recommended):** Separate services for API + Worker + Redis  
✅ **Option 2 (Simple):** Single service with `npm run start:with-worker`  
✅ **Both options** require Redis for job queue  
✅ **Worker must have** same environment variables as API  
✅ **Monitor logs** to ensure worker is processing jobs  

For any issues, check:
1. Worker service logs on Render
2. Redis connection status
3. MongoDB Atlas network access
4. Environment variables match between services
