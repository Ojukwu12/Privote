# Privote Frontend

Modern, production-ready React/Next.js frontend for Privote - a confidential DAO voting system powered by Zama FHEVM.

## Features

- ✅ **Authentication**: Secure login/registration with JWT token management
- ✅ **Session Management**: Secure session storage in sessionStorage
- ✅ **Proposal Listing**: Browse open, closed, and upcoming voting proposals
- ✅ **Voting Interface**: Submit encrypted votes with FHE encryption
- ✅ **Async Job Polling**: Track vote submission status in real-time
- ✅ **Tally Decryption**: View and decrypt voting results locally
- ✅ **Admin Dashboard**: Create proposals and close voting (admin only)
- ✅ **Error Handling**: Comprehensive error handling and user-friendly messages
- ✅ **Responsive Design**: Mobile-first, fully responsive layout
- ✅ **Type Safety**: Full TypeScript support
- ✅ **Production Ready**: Configured for Vercel/Render deployment

## Tech Stack

- **Frontend**: React 18 with Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context API
- **HTTP Client**: Native Fetch API
- **Code Quality**: ESLint
- **Deployment**: Vercel / Render

## Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- npm or yarn
- Git

## Installation

### 1. Clone and Install

```bash
git clone <your-repo>
cd privote-frontend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and update with your backend URL:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
# Backend API URL (adjust based on environment)
NEXT_PUBLIC_API_URL=http://localhost:3000/api
# For production:
# NEXT_PUBLIC_API_URL=https://api.privote.io/api

# Zama FHEVM Configuration (pre-configured for Sepolia)
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_GATEWAY_CHAIN_ID=10901
NEXT_PUBLIC_RELAYER_URL=https://relayer.testnet.zama.org
NEXT_PUBLIC_GATEWAY_URL=https://gateway.testnet.zama.org
```

### 3. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

## Project Structure

```
privote-frontend/
├── app/                           # Next.js app directory
│   ├── auth/                     # Authentication pages
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── proposals/                # Proposal pages
│   │   ├── page.tsx             # List proposals
│   │   ├── [id]/page.tsx        # Proposal details & voting
│   │   └── create/page.tsx      # Create proposal (admin)
│   ├── admin/                    # Admin dashboard
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   └── globals.css               # Global styles
├── components/
│   ├── ui/                       # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Alert.tsx
│   │   ├── Card.tsx
│   │   └── LoadingSpinner.tsx
│   ├── layout/                   # Layout components
│   │   ├── Navigation.tsx
│   │   └── Footer.tsx
│   └── pages/                    # Page-specific components
│       ├── LoginForm.tsx
│       ├── RegisterForm.tsx
│       └── VoteForm.tsx
├── lib/
│   ├── api/
│   │   └── client.ts             # API client with all endpoints
│   ├── context/
│   │   └── AuthContext.tsx       # Auth state management
│   ├── hooks/
│   │   └── useApi.ts             # Custom hooks for API calls
│   ├── types/
│   │   └── index.ts              # TypeScript types
│   └── utils/
│       └── (utility functions)
├── public/                        # Static assets
├── .env.example                   # Example environment variables
├── .env.local                     # Local environment (git-ignored)
├── tailwind.config.ts             # Tailwind CSS config
├── tsconfig.json                  # TypeScript config
└── package.json
```

## API Integration

The frontend integrates with all backend endpoints:

### Authentication
- `POST /api/users/register` - Create new account
- `POST /api/users/login` - Authenticate user
- `GET /api/users/profile` - Get user info

### Key Management
- `GET /api/keys/public` - Get FHE public key
- `POST /api/keys/decrypt` - Decrypt private key (password required)

### Proposals
- `GET /api/proposals?status=open` - List proposals with filters
- `GET /api/proposals/:id` - Get proposal details
- `POST /api/proposals` (admin) - Create proposal
- `POST /api/proposals/:id/close` (admin) - Close proposal

### Voting
- `POST /api/vote/submit` - Submit encrypted vote
- `GET /api/vote/status/:jobId` - Poll vote job status
- `GET /api/vote/encrypted-tally/:proposalId` - Get encrypted tally
- `GET /api/vote/decrypted-tally/:proposalId` - Get decrypted tally
- `GET /api/vote/my-votes` - Get user's vote history

See [API Documentation](../Privote/API.md) for complete endpoint details.

## Key Features Explained

### Authentication Flow

1. User registers or logs in
2. Backend returns JWT token
3. Token stored securely in **sessionStorage** (not localStorage)
4. Token included in all API requests via `Authorization` header
5. Session restored on page refresh (stored during same browser session)

### Voting Flow

1. **User decrypts private key** - Password prompt → Backend returns decrypted key (kept in memory)
2. **User votes** - Encrypted vote submitted to backend
3. **Backend queues job** - Returns jobId for status tracking
4. **Frontend polls status** - Checks job status every 2 seconds
5. **Vote processed** - Submitted to blockchain via Zama Relayer
6. **Tally retrieved** - After voting ends, encrypted tally fetched
7. **Local decryption** - User decrypts tally with their private key

### Security Measures

- **Private keys never persisted** - Decrypted from server only when needed
- **Session storage only** - Not localStorage (prevents XSS attacks)
- **HTTPS only in production** - All API calls encrypted
- **Rate limiting** - Backend enforces rate limits per endpoint
- **Input validation** - All forms validated before submission
- **Error messages** - User-friendly error displays without exposing sensitive details

## Development Guide

### Adding New Pages

1. Create folder in `app/` directory
2. Add `page.tsx` file
3. Use components from `components/` 

Example:

```tsx
'use client';

import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';

export default function MyPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold">My Page</h1>
    </div>
  );
}
```

### Making API Calls

```tsx
import { useApi } from '@/lib/hooks/useApi';
import { ApiClient } from '@/lib/api/client';

export function MyComponent() {
  const { data, loading, error, execute } = useApi(() =>
    ApiClient.listProposals()
  );

  useEffect(() => {
    execute();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <Alert type="error" message={error.message} />;

  return <div>{/* render data */}</div>;
}
```

### Custom Hooks

```tsx
import { useProposals } from '@/lib/hooks/useApi';

export function ProposalsList() {
  const { data, loading, error, fetch } = useProposals({ status: 'open' });
  const { token } = useAuth();

  useEffect(() => {
    fetch(token);
  }, [token]);

  // ... render
}
```

## Deployment

### Vercel (Recommended)

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository
   - Click "Import"

3. **Set Environment Variables**:
   - In Vercel Dashboard → Settings → Environment Variables
   - Add all variables from `.env.example`
   - For production, update `NEXT_PUBLIC_API_URL` to your backend domain

4. **Deploy**:
   - Vercel auto-deploys on push to `main` branch

### Render

1. **Create Render Account**: [render.com](https://render.com)

2. **Create New Web Service**:
   - Click "New +" → "Web Service"
   - Connect GitHub repository
   - Select branch: `main`

3. **Configure**:
   - **Name**: `privote-frontend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

4. **Environment Variables**:
   - Add all variables from `.env.example`

5. **Deploy**: Click "Create Web Service"

### Docker

Build and run with Docker:

```bash
# Build
docker build -t privote-frontend .

# Run
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://api:3000/api privote-frontend
```

## Testing

### Unit Tests

```bash
npm test
```

### Development Testing

1. **Local backend**: `npm run dev` (backend running on port 3000)
2. **Frontend**: `npm run dev` (starts on port 3000 or next available)
3. **Test authentication**: Register → Login
4. **Test proposals**: View proposals list
5. **Test voting**: Submit vote and poll status

### Mock FHE Testing

Set environment variable for testing without FHE:

```bash
NEXT_PUBLIC_MOCK_FHE=true npm run dev
```

## Troubleshooting

### "API Connection Failed"

- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Ensure backend is running
- Check backend logs for errors

### "Authentication Failed"

- Verify email and password are correct
- Check JWT token in browser DevTools → Application → sessionStorage
- Try logging in again

### "Vote Submission Failed"

- Check if proposal is still open
- Verify you haven't already voted on this proposal
- Check job status with polling

### "Cannot Decrypt Private Key"

- Verify password is correct
- Check backend logs for decryption errors

## Performance Optimization

- **Code Splitting**: Automatic with Next.js
- **Image Optimization**: Use `next/image`
- **Font Optimization**: Geist fonts optimized by default
- **CSS Optimization**: Tailwind CSS purging enabled

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Security Best Practices

1. **Never log sensitive data** - Private keys, passwords, tokens
2. **Always use HTTPS** - Production only
3. **Secure cookies** - Set `Secure` and `HttpOnly` flags
4. **CSP Headers** - Enable Content Security Policy
5. **CORS** - Configure CORS properly with backend
6. **Input Validation** - Validate on client and server
7. **Error Handling** - Show user-friendly errors, not stack traces

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](../LICENSE)

## Support

- **Documentation**: [../../README.md](../Privote/README.md)
- **Backend API Docs**: [../../API.md](../Privote/API.md)
- **Issues**: [GitHub Issues](https://github.com/yourrepo/issues)
- **Email**: support@privote.io

## Acknowledgments

- **Zama**: For FHEVM and Relayer SDK
- **Vercel**: For Next.js framework
- **Tailwind Labs**: For Tailwind CSS
- **Open Source Community**: For amazing dependencies

---

**Built with ❤️ for privacy-preserving governance**
