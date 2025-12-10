'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ApiClient, ApiErrorClient } from '@/lib/api/client';
import { Proposal } from '@/lib/types';
import { useAuth } from '@/lib/context/AuthContext';

export default function ProposalsPage() {
  const { token, isAuthenticated, user } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorClient | null>(null);
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'upcoming' | 'ended' | undefined>('open');

  useEffect(() => {
    const fetchProposals = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await ApiClient.listProposals({ status: statusFilter, limit: 20 }, token || undefined);
        setProposals(res.data.proposals);
      } catch (err) {
        const apiErr = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
        setError(apiErr);
      } finally {
        setLoading(false);
      }
    };

    fetchProposals();
  }, [statusFilter, token]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Proposals</h1>
          <p className="text-gray-600">Browse and vote on active governance proposals.</p>
        </div>
        <div className="flex items-center gap-2">
          {['open', 'closed', 'upcoming', 'ended'].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setStatusFilter(s as any)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {isAuthenticated && user?.role === 'admin' && (
        <div>
          <Link href="/proposals/create">
            <Button>Create Proposal</Button>
          </Link>
        </div>
      )}

      {loading && <LoadingSpinner />}
      {error && <Alert type="error" message={error.getUserFriendlyMessage()} />}

      {!loading && proposals.length === 0 && (
        <div className="text-gray-600">No proposals found.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {proposals.map((proposal) => (
          <Card key={proposal._id || proposal.id}>
            <CardHeader>
              <CardTitle>{proposal.title}</CardTitle>
              <CardDescription>{proposal.description.slice(0, 120)}...</CardDescription>
            </CardHeader>
            <div className="text-sm text-gray-700 space-y-2">
              <div className="flex justify-between"><span>Starts</span><span>{new Date(proposal.startTime).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Ends</span><span>{new Date(proposal.endTime).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Status</span><span>{proposal.closed ? 'Closed' : 'Open'}</span></div>
              <div className="flex justify-between"><span>Votes</span><span>{proposal.voteCount}</span></div>
            </div>
            <div className="mt-4 flex justify-between items-center">
              <Link href={`/proposals/${proposal._id || proposal.id}`} className="text-blue-600 font-semibold">
                View &amp; vote
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}