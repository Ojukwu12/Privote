# Frontend Deployment Guide

## Overview

This Next.js frontend is designed to be deployed on **Vercel** for optimal performance and integration with Zama's FHE infrastructure.

## Quick Start: Deploy to Vercel

### Prerequisites

- GitHub account with this repository
- Vercel account (free at https://vercel.com)

### Step 1: Connect Repository to Vercel

1. Go to https://vercel.com/new
2. Select "Continue with GitHub"
3. Find and select the `Privote` repository
4. Click "Import"

### Step 2: Configure Environment Variables

In the Vercel dashboard, set the following environment variables for your deployment:

#### Backend Configuration
```
NEXT_PUBLIC_API_URL=https://your-backend-domain.com/api
```

#### FHE & Zama Configuration (Sepolia Testnet)
```
NEXT_PUBLIC_FHE_RELAYER_URL=https://relayer.testnet.zama.org
NEXT_PUBLIC_FHE_NETWORK_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_FHE_CHAIN_ID=11155111
NEXT_PUBLIC_FHE_GATEWAY_CHAIN_ID=10901
```

#### FHEVM Smart Contracts (Sepolia)
```
NEXT_PUBLIC_FHE_ACL_CONTRACT_ADDRESS=0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D
NEXT_PUBLIC_FHE_KMS_CONTRACT_ADDRESS=0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A
NEXT_PUBLIC_FHE_INPUT_VERIFIER_CONTRACT_ADDRESS=0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0
NEXT_PUBLIC_FHE_VERIFYING_CONTRACT_ADDRESS_DECRYPTION=0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478
NEXT_PUBLIC_FHE_VERIFYING_CONTRACT_ADDRESS_INPUT_VERIFICATION=0x483b9dE06E4E4C7D35CCf5837A1668487406D955
```

#### Voting Contract (Update After Deployment)
```
NEXT_PUBLIC_FHE_CONTRACT_ADDRESS=0x1361b4608cA21E28E2A7A2C881AbCa0892cF975e
NEXT_PUBLIC_FHE_VOTING_CONTRACT_ADDRESS=0x1361b4608cA21E28E2A7A2C881AbCa0892cF975e
```

### Step 3: Deploy

1. Click "Deploy"
2. Vercel will automatically build and deploy your frontend
3. Your site will be available at `https://your-project.vercel.app`

## Production Considerations

### 1. Custom Domain

To use a custom domain:
1. Go to your Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain and configure DNS

### 2. Environment Variables for Production

Make sure to update these for production:

- `NEXT_PUBLIC_API_URL`: Point to your production backend
- If using mainnet instead of Sepolia, update all Zama contract addresses

### 3. Vercel Build Settings

Default settings should work, but verify:
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Node.js Version**: 20.x (recommended)

### 4. CORS & API Proxy

Your backend must have CORS enabled to accept requests from your Vercel domain.

If using the Render backend, ensure `CORS_ORIGIN` includes your Vercel deployment URL:
```bash
CORS_ORIGIN=https://your-project.vercel.app,http://localhost:3000
```

## Monitoring & Debugging

### View Logs

1. Go to your Vercel project dashboard
2. Click on a deployment
3. View "Logs" tab for build and runtime logs

### Check Environment Variables

1. Go to "Settings" → "Environment Variables"
2. Verify all FHE configuration variables are present

### Test FHE Connectivity

Once deployed, check that FHE is working:
1. Visit your deployed site
2. Try to vote on a proposal
3. Check browser console (F12) for FHE SDK initialization logs

## Troubleshooting

### Issue: "FHE SDK not available"

**Cause**: Environment variables not properly set
**Solution**: Verify all `NEXT_PUBLIC_FHE_*` variables are configured in Vercel dashboard

### Issue: "API calls failing with 401/403"

**Cause**: Backend CORS not configured for your domain
**Solution**: Update backend `CORS_ORIGIN` environment variable

### Issue: Slow builds

**Cause**: Next.js optimization on large projects
**Solution**: 
- Increase Vercel build timeout if needed
- Check for unnecessary dependencies in `package.json`

## Testing Before Production

### Local Testing
```bash
npm run build
npm run start
```

### Staging Deployment
- Create a separate Vercel project for staging
- Test all features before promoting to production

## Maintenance

### Update Dependencies
```bash
npm update
npm run build
# Test locally
# Push to GitHub (auto-deploys to Vercel)
```

### Monitor Performance
Use Vercel Analytics dashboard to track:
- Page load times
- Core Web Vitals
- Error rates

## Support

For Vercel-specific issues: https://vercel.com/support
For Zama FHE issues: https://docs.zama.org
