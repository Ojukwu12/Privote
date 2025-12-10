'use client';

import { useState, useCallback, useRef } from 'react';
import { ApiClient, ApiErrorClient } from '@/lib/api/client';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiErrorClient | null;
}

/**
 * Generic hook for making API calls with loading and error states
 */
export function useApi<T>(fn: (token?: string) => Promise<any>) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (token?: string) => {
      setState({ data: null, loading: true, error: null });
      try {
        const result = await fn(token);
        setState({ data: result, loading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
        setState({ data: null, loading: false, error });
        throw error;
      }
    },
    [fn]
  );

  return { ...state, execute };
}

/**
 * Hook for login
 */
export function useLogin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorClient | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await ApiClient.login(email, password);
      return response;
    } catch (err) {
      const apiError = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, []);

  return { login, loading, error };
}

/**
 * Hook for registration
 */
export function useRegister() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorClient | null>(null);

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await ApiClient.register(username, email, password);
        return response;
      } catch (err) {
        const apiError =
          err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
        setError(apiError);
        throw apiError;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { register, loading, error };
}

/**
 * Hook for fetching proposals with pagination and filtering
 */
export function useProposals(filters = {}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorClient | null>(null);

  const fetch = useCallback(
    async (token?: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await ApiClient.listProposals(filters, token);
        setData(response.data);
        return response.data;
      } catch (err) {
        const apiError =
          err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
        setError(apiError);
        throw apiError;
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  return { data, loading, error, fetch };
}

/**
 * Hook for polling job status
 */
export function useJobStatusPolling(jobId: string | null, token: string | null) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorClient | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout>(null);

  const startPolling = useCallback(() => {
    if (!jobId || !token) return;

    const poll = async () => {
      try {
        const response = await ApiClient.getVoteJobStatus(jobId, token);
        setStatus(response.data);

        // Stop polling if job is completed or failed
        if (response.data.status === 'completed' || response.data.status === 'failed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        }
      } catch (err) {
        const apiError =
          err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
        setError(apiError);
      }
    };

    poll(); // Initial call
    pollIntervalRef.current = setInterval(poll, 2000); // Poll every 2 seconds

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [jobId, token]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
  }, []);

  return { status, loading, error, startPolling, stopPolling };
}

/**
 * Hook for submitting votes
 */
export function useSubmitVote() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorClient | null>(null);

  const submit = useCallback(async (payload: any, token: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await ApiClient.submitVote(payload, token);
      return response;
    } catch (err) {
      const apiError =
        err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, []);

  return { submit, loading, error };
}

/**
 * Hook for decrypting private key
 */
export function useDecryptPrivateKey() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorClient | null>(null);

  const decrypt = useCallback(async (password: string, token: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await ApiClient.decryptPrivateKey(password, token);
      return response.data.privateKey;
    } catch (err) {
      const apiError =
        err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, []);

  return { decrypt, loading, error };
}

/**
 * Hook for fetching encrypted tally
 */
export function useEncryptedTally(proposalId: string | null) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorClient | null>(null);

  const fetch = useCallback(
    async (token?: string) => {
      if (!proposalId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await ApiClient.getEncryptedTally(proposalId, token);
        setData(response.data);
        return response.data;
      } catch (err) {
        const apiError =
          err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
        setError(apiError);
        throw apiError;
      } finally {
        setLoading(false);
      }
    },
    [proposalId]
  );

  return { data, loading, error, fetch };
}

/**
 * Hook for fetching decrypted tally
 */
export function useDecryptedTally(proposalId: string | null) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorClient | null>(null);

  const fetch = useCallback(async () => {
    if (!proposalId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await ApiClient.getDecryptedTally(proposalId);
      setData(response.data);
      return response.data;
    } catch (err) {
      const apiError =
        err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  return { data, loading, error, fetch };
}
