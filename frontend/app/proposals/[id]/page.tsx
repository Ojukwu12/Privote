'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
// import { VoteForm } from '@/components/pages/VoteForm';
import { ApiClient, ApiErrorClient } from '@/lib/api/client';
import { Proposal } from '@/lib/types';
import { useAuth } from '@/lib/context/AuthContext';

export default function ProposalDetailPage() {
  const params = useParams();
  const proposalId = (params?.id || '') as string;
  const { token, isAuthenticated } = useAuth();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorClient | null>(null);

  useEffect(() => {
    if (!proposalId || proposalId === 'undefined') return;
    
    setLoading(true);
    setError(null);
    
    ApiClient.getProposal(proposalId, token || undefined)
      .then(res => setProposal(res.data.proposal as any))
      .catch(err => setError(err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500)))
      .finally(() => setLoading(false));
  }, [proposalId, token]);

  if (loading) return <LoadingSpinner />;
  if (error) return <Alert type="error" message={error.getUserFriendlyMessage()} />;
  if (!proposal) return <Alert type="info" message="Proposal not found" />;

  const now = new Date();
  const startTime = new Date(proposal.startTime);
  const endTime = new Date(proposal.endTime);
  const hasStarted = now >= startTime;
  const hasEnded = now >= endTime;
  const isClosed = proposal.closed;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{proposal.title}</CardTitle>
          <CardDescription>{proposal.description}</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6 space-y-2 text-sm text-gray-700">
          <div className="flex justify-between"><span>Starts</span><span>{startTime.toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Ends</span><span>{endTime.toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Status</span><span>{isClosed ? 'Closed' : 'Open'}</span></div>
          <div className="flex justify-between"><span>Votes</span><span>{proposal.voteCount}</span></div>
          <div className="flex justify-between"><span>Required role</span><span>{proposal.requiredRole}</span></div>
        </div>
      </Card>

      {!hasStarted && (
        <Alert type="info" message={`Voting starts on ${startTime.toLocaleString()}`} />
      )}

      {isAuthenticated && hasStarted && !hasEnded && !isClosed && (
        <Card>
          <CardHeader>
            <CardTitle>Submit encrypted vote</CardTitle>
            <CardDescription>Voting temporarily unavailable - VoteForm disabled for debugging</CardDescription>
          </CardHeader>
        </Card>
      )}

      {hasEnded && !isClosed && (
        <Alert type="info" message="This proposal has ended but has not been closed yet. Awaiting admin action." />
      )}

      {isClosed && (
        <Alert type="success" message="This proposal has been closed. Tallying is in progress or complete." />
      )}
    </div>
  );
}
