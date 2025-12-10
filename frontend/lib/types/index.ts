/**
 * User Types
 */
export interface User {
  id: string;
  username: string;
  email: string;
  publicKey: string;
  role: 'user' | 'admin';
  createdAt: string;
  lastLogin?: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
  message?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface DecryptKeyPayload {
  password: string;
}

export interface DecryptKeyResponse {
  success: boolean;
  data: {
    privateKey: string;
  };
  message?: string;
}

/**
 * Proposal Types
 */
export interface Proposal {
  id?: string;
  _id?: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  closed: boolean;
  requiredRole: 'user' | 'admin';
  voteCount: number;
  encryptedTally?: string;
  createdBy: {
    id: string;
    username: string;
  };
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface ProposalFilters {
  status?: 'open' | 'closed' | 'upcoming' | 'ended';
  page?: number;
  limit?: number;
}

export interface ProposalListResponse {
  success: boolean;
  data: {
    proposals: Proposal[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  };
}

export interface CreateProposalPayload {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  requiredRole?: 'user' | 'admin';
}

/**
 * Vote Types
 */
export interface Vote {
  id: string;
  proposalId: string;
  userId: string;
  encryptedVote: string;
  weight: number;
  createdAt: string;
  txHash?: string;
}

export interface SubmitVotePayload {
  proposalId: string;
  encryptedVote: string;
  inputProof?: string;
  idempotencyKey?: string;
}

export interface SubmitVoteResponse {
  success: boolean;
  data: {
    vote: Vote;
    jobId: string;
  };
  message?: string;
}

export interface JobStatus {
  id: string;
  status: 'queued' | 'active' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  createdAt?: string;
  completedAt?: string;
}

export interface VoteJobStatusResponse {
  success: boolean;
  data: JobStatus;
}

export interface EncryptedTallyResponse {
  success: boolean;
  data: {
    proposalId: string;
    encryptedTally: string;
    voteCount: number;
    computedAt: string;
  };
}

export interface DecryptedTallyResponse {
  success: boolean;
  data: {
    proposalId: string;
    decryptedTally: number;
    voteCount: number;
    proof?: string;
  };
}

export interface UserVotesResponse {
  success: boolean;
  data: {
    votes: (Vote & { proposal?: Proposal })[];
  };
}

/**
 * Health & Metrics Types
 */
export interface HealthResponse {
  success: boolean;
  data: {
    status: string;
    timestamp: string;
    uptime: number;
    version: string;
  };
}

export interface Metrics {
  users: number;
  proposals: number;
  votes: number;
  activeProposals: number;
  queueStats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
}

export interface MetricsResponse {
  success: boolean;
  data: Metrics;
}

/**
 * API Error Response
 */
export interface ApiError {
  success: false;
  error: string;
  statusCode: number;
  metadata?: Record<string, any>;
}

/**
 * Session & Auth Context Types
 */
export interface SessionData {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * FHE Types
 */
export interface FHEEncryptedInput {
  handles: string[];
  inputProof: string;
}

export interface EncryptedVoteData {
  encryptedVote: string;
  inputProof: string;
  idempotencyKey: string;
}
