import {
  ApiError,
  AuthResponse,
  DecryptKeyPayload,
  DecryptKeyResponse,
  ProposalListResponse,
  ProposalFilters,
  SubmitVotePayload,
  SubmitVoteResponse,
  VoteJobStatusResponse,
  EncryptedTallyResponse,
  DecryptedTallyResponse,
  UserVotesResponse,
  HealthResponse,
  MetricsResponse,
  CreateProposalPayload,
} from '@/lib/types';

// Default to backend on 3001 to avoid colliding with Next dev server on 3000.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export class ApiClient {
  /**
   * Helper method to make API requests
   */
  private static async request<T>(
    endpoint: string,
    options: RequestInit & { token?: string } = {}
  ): Promise<T> {
    const { token, ...requestOptions } = options;
    const url = `${API_BASE_URL}${endpoint}`;

    // Ensure headers is always a Record<string, string>
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(requestOptions.headers ? Object.fromEntries(Object.entries(requestOptions.headers).map(([k, v]) => [k, String(v)])) : {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...requestOptions,
      headers,
    });

    let data: any = undefined;
    try {
      data = await response.json();
    } catch (e) {
      // Response is not JSON (e.g. empty body or plain text); fall back to text
      try {
        data = await response.text();
      } catch (e2) {
        data = undefined;
      }
    }

    if (!response.ok) {
      // Backend may return { message, metadata } or { error, metadata }
      const errMsg = (data && (data.error || data.message)) || (typeof data === 'string' ? data : 'Unknown error');
      const errMetadata = (data && (data.metadata || data.meta)) || undefined;
      // Log detailed error information for debugging
      console.error(`API Error [${response.status}] ${endpoint}:`, {
        message: errMsg,
        metadata: errMetadata,
        fullResponse: data,
        statusCode: response.status,
      });

      // Include the raw response under metadata.raw for easier debugging in UI
      const metadataWithRaw = { ...(errMetadata || {}), raw: data };

      throw new ApiErrorClient(errMsg, response.status, metadataWithRaw);
    }

    return data as T;
  }

  // ============================================
  // Authentication Endpoints
  // ============================================

  static async register(
    username: string,
    email: string,
    password: string
  ): Promise<AuthResponse> {
    return this.request<AuthResponse>('/users/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  }

  static async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  static async getProfile(token: string): Promise<{ success: boolean; data: { id: string; username: string; email: string; publicKey: string; role: string } }> {
    return this.request('/users/profile', {
      method: 'GET',
      token,
    });
  }

  // ============================================
  // Key Management Endpoints
  // ============================================

  static async getPublicKey(token: string): Promise<{ success: boolean; data: { publicKey: string } }> {
    return this.request('/keys/public', {
      method: 'GET',
      token,
    });
  }

  static async decryptPrivateKey(
    password: string,
    token: string
  ): Promise<DecryptKeyResponse> {
    return this.request<DecryptKeyResponse>('/keys/decrypt', {
      method: 'POST',
      body: JSON.stringify({ password }),
      token,
    });
  }

  // ============================================
  // Proposal Endpoints
  // ============================================

  static async listProposals(
    filters?: ProposalFilters,
    token?: string
  ): Promise<ProposalListResponse> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const endpoint = `/proposals${queryString ? `?${queryString}` : ''}`;

    return this.request<ProposalListResponse>(endpoint, {
      method: 'GET',
      token,
    });
  }

  static async getProposal(
    proposalId: string,
    token?: string
  ): Promise<{ success: boolean; data: { proposal: any } }> {
    return this.request(`/proposals/${proposalId}`, {
      method: 'GET',
      token,
    });
  }

  static async createProposal(
    payload: CreateProposalPayload,
    token: string
  ): Promise<{ success: boolean; data: { proposal: any } }> {
    return this.request('/proposals', {
      method: 'POST',
      body: JSON.stringify(payload),
      token,
    });
  }

  static async closeProposal(
    proposalId: string,
    token: string
  ): Promise<{ success: boolean; data: { proposal: any; tallyJobId: string } }> {
    return this.request(`/proposals/${proposalId}/close`, {
      method: 'POST',
      token,
    });
  }

  // ============================================
  // Vote Endpoints
  // ============================================

  static async submitVote(
    payload: SubmitVotePayload,
    token: string
  ): Promise<SubmitVoteResponse> {
    return this.request<SubmitVoteResponse>('/vote/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
      token,
    });
  }

  static async getVoteJobStatus(
    jobId: string,
    token: string
  ): Promise<VoteJobStatusResponse> {
    return this.request<VoteJobStatusResponse>(`/vote/status/${jobId}`, {
      method: 'GET',
      token,
    });
  }

  static async getEncryptedTally(
    proposalId: string,
    token?: string
  ): Promise<EncryptedTallyResponse> {
    return this.request<EncryptedTallyResponse>(
      `/vote/encrypted-tally/${proposalId}`,
      {
        method: 'GET',
        token,
      }
    );
  }

  static async getDecryptedTally(
    proposalId: string
  ): Promise<DecryptedTallyResponse> {
    return this.request<DecryptedTallyResponse>(
      `/vote/decrypted-tally/${proposalId}`,
      {
        method: 'GET',
      }
    );
  }

  static async getMyVotes(token: string): Promise<UserVotesResponse> {
    return this.request<UserVotesResponse>('/vote/my-votes', {
      method: 'GET',
      token,
    });
  }

  // ============================================
  // Health & Metrics Endpoints
  // ============================================

  static async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health', {
      method: 'GET',
    });
  }

  static async getMetrics(token: string): Promise<MetricsResponse> {
    return this.request<MetricsResponse>('/metrics', {
      method: 'GET',
      token,
    });
  }
}

/**
 * Custom API Error class for better error handling
 */
export class ApiErrorClient extends Error {
  statusCode: number;
  metadata?: Record<string, any>;

  constructor(message: string, statusCode: number, metadata?: Record<string, any>) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.metadata = metadata;
  }

  isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  isForbidden(): boolean {
    return this.statusCode === 403;
  }

  isNotFound(): boolean {
    return this.statusCode === 404;
  }

  isConflict(): boolean {
    return this.statusCode === 409;
  }

  isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  isValidationError(): boolean {
    return this.statusCode === 400 || this.statusCode === 422;
  }

  getUserFriendlyMessage(): string {
    // If server provided validation errors, surface them directly
    if (this.metadata && Array.isArray(this.metadata.errors) && this.metadata.errors.length > 0) {
      try {
        return this.metadata.errors.join('; ');
      } catch (e) {
        // fallthrough to the switch below
      }
    }

    switch (this.statusCode) {
      case 400:
        return 'Invalid request. Please check your input.';
      case 401:
        return 'Authentication failed. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'Resource not found.';
      case 409:
        return 'This resource already exists.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 422:
        return 'Validation failed. Please check your input.';
      case 500:
        return 'Server error. Please try again later.';
      default:
        return this.message;
    }
  }

  /**
   * Return a detailed string useful for debugging (includes metadata and status)
   */
  getDetailedMessage(): string {
    const md = this.metadata ? JSON.stringify(this.metadata, null, 2) : undefined;
    return `Status: ${this.statusCode}\nMessage: ${this.message}${md ? `\nMetadata: ${md}` : ''}`;
  }

  toJSON() {
    return {
      name: this.name,
      statusCode: this.statusCode,
      message: this.message,
      metadata: this.metadata
    };
  }
}
