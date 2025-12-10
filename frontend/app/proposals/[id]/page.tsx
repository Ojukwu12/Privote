'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { VoteForm } from '@/components/pages/VoteForm';
import { ApiClient, ApiErrorClient } from '@/lib/api/client';
import { Proposal } from '@/lib/types';
import { useAuth } from '@/lib/context/AuthContext';
import { userDecryptWithPrivateKey } from '@/lib/fhe/client';
import ErrorDetails from '@/components/ui/ErrorDetails';

export default function ProposalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const proposalId = (params?.id || '') as string;
  const { token, isAuthenticated } = useAuth();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiErrorClient | null>(null);
  const [encryptedTally, setEncryptedTally] = useState<string | null>(null);
  const [decryptedTally, setDecryptedTally] = useState<string | null>(null);
  const [decryptedLocal, setDecryptedLocal] = useState<any>(null);
  const [localPrivateKey, setLocalPrivateKey] = useState<string | null>(null);

  useEffect(() => {
    const fetchProposal = async () => {
      // Wait for params to be available
      if (!proposalId || proposalId === '' || proposalId === 'undefined') {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await ApiClient.getProposal(proposalId, token || undefined);
        setProposal(res.data.proposal as any);
      } catch (err) {
        const apiErr = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
        setError(apiErr);
        console.error('Failed to fetch proposal:', { proposalId, error: apiErr.message });
      } finally {
        setLoading(false);
      }
    };

    fetchProposal();
  }, [proposalId, token]);

  const handleFetchEncryptedTally = async () => {
    try {
      const res = await ApiClient.getEncryptedTally(proposalId, token || undefined);
      setEncryptedTally(res.data.encryptedTally);
    } catch (err) {
      const apiErr = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
      setError(apiErr);
    }
  };

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('private_key');
      if (stored) setLocalPrivateKey(stored);
    } catch (e) {}
  }, []);

  const handleClientDecrypt = async (privateKey?: string | null) => {
    setError(null);
    setDecryptedLocal(null);
    try {
      const key = privateKey || localPrivateKey;
      if (!key) return setError(new ApiErrorClient('Private key required for client-side decryption', 400));
      if (!encryptedTally) return setError(new ApiErrorClient('No encrypted tally available', 400));
      const handles = [encryptedTally];
      const result = await userDecryptWithPrivateKey(key, handles, { contractAddresses: [process.env.NEXT_PUBLIC_FHE_CONTRACT_ADDRESS] });
      setDecryptedLocal(result);
    } catch (err) {
      const apiErr = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
      setError(apiErr);
    }
  };

  const handleFetchDecryptedTally = async () => {
    try {
      const res = await ApiClient.getDecryptedTally(proposalId);
      setDecryptedTally(JSON.stringify(res.data));
    } catch (err) {
      const apiErr = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
      setError(apiErr);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!proposalId || proposalId === '' || proposalId === 'undefined') {
    return <Alert type="error" message="Invalid proposal ID" />;
  }
  if (error) return (
    <div>
      <Alert type="error" message={error.getUserFriendlyMessage()} />
      <ErrorDetails error={error} />
    </div>
  );
  if (!proposal) return <Alert type="info" message="Proposal not found" />;

  const isClosed = proposal.closed;
  const now = new Date();
  const startTime = new Date(proposal.startTime);
  const endTime = new Date(proposal.endTime);
  const hasStarted = now >= startTime;
  const hasEnded = now >= endTime;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{proposal.title}</CardTitle>
          <CardDescription>{proposal.description}</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6 space-y-2 text-sm text-gray-700">
          <div className="flex justify-between"><span>Starts</span><span>{new Date(proposal.startTime).toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Ends</span><span>{new Date(proposal.endTime).toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Status</span><span>{isClosed ? 'Closed' : 'Open'}</span></div>
          <div className="flex justify-between"><span>Votes</span><span>{proposal.voteCount}</span></div>
          <div className="flex justify-between"><span>Required role</span><span>{proposal.requiredRole}</span></div>
        </div>
      </Card>

      {/* Voting section */}
      {!hasStarted && (
        <Alert type="info" message={`Voting starts on ${startTime.toLocaleString()}`} />
      )}

      {isAuthenticated && hasStarted && !hasEnded && !isClosed && (
        <Card>
          <CardHeader>
            <CardTitle>Submit encrypted vote</CardTitle>
            <CardDescription>Provide your FHE ciphertext and proof. The backend never sees plaintext.</CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <VoteForm proposalId={proposalId} />
          </div>
        </Card>
      )}

      {hasEnded && !isClosed && (
        <Alert type="info" message="This proposal has ended but has not been closed yet. Awaiting admin action." />
      )}

      {isClosed && (
        <Alert type="success" message="This proposal has been closed. Tallying is in progress or complete." />
      )}

      {/* Tally section */}
      <Card>
        <CardHeader>
          <CardTitle>Tally</CardTitle>
          <CardDescription>Encrypted tally is available after closing. Public decryption may be exposed if allowed.</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6 space-y-3">
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleFetchEncryptedTally}>
              Get encrypted tally
            </Button>
            <Button variant="ghost" onClick={handleFetchDecryptedTally}>
              Get decrypted tally (public)
            </Button>
            <Button variant="primary" onClick={() => handleClientDecrypt(null)}>
              Decrypt locally (private key)
            </Button>
          </div>
          {encryptedTally && (
            <div className="text-xs text-gray-700 break-all pt-3">
              <span className="font-semibold">Encrypted tally:</span> {encryptedTally}
            </div>
          )}
          {decryptedTally && (
            <div className="text-xs text-gray-700 break-all pt-3">
              <span className="font-semibold">Decrypted tally (public):</span> {decryptedTally}
            </div>
          )}
          {decryptedLocal && (
            <div className="text-xs text-gray-700 break-all pt-3">
              <span className="font-semibold">Decrypted tally (client):</span>
              <pre className="whitespace-pre-wrap">{JSON.stringify(decryptedLocal, null, 2)}</pre>
            </div>
          )}
          {!localPrivateKey && (
            <div className="text-xs text-gray-500">No private key in session. Paste your private key in the Vote form to enable client-side decryption.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
