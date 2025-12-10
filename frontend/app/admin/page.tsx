'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ApiClient, ApiErrorClient } from '@/lib/api/client';
import { Proposal, Metrics } from '@/lib/types';
import { useAuth } from '@/lib/context/AuthContext';

export default function AdminPage() {
  const { token, user } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorClient | null>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const fetchData = async () => {
      if (!token || !isAdmin) return;
      setLoading(true);
      setError(null);
      try {
        const [propsRes, metricsRes] = await Promise.all([
          ApiClient.listProposals({ status: 'open', limit: 50 }, token),
          ApiClient.getMetrics(token),
        ]);
        setProposals(propsRes.data.proposals);
        setMetrics(metricsRes.data);
      } catch (err) {
        const apiErr = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
        setError(apiErr);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, isAdmin]);

  const handleClose = async (proposalId: string) => {
    if (!token) return;
    try {
      await ApiClient.closeProposal(proposalId, token);
      setProposals((prev) => prev.filter((p) => (p._id || p.id) !== proposalId));
    } catch (err) {
      const apiErr = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
      setError(apiErr);
    }
  };

  if (!isAdmin) return <Alert type="error" message="Admin access required." />;
  if (loading) return <LoadingSpinner />;
  if (error) return <Alert type="error" message={error.getUserFriendlyMessage()} />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>{metrics.users}</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Proposals</CardTitle>
              <CardDescription>{metrics.proposals}</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Votes</CardTitle>
              <CardDescription>{metrics.votes}</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Queue (waiting)</CardTitle>
              <CardDescription>{metrics.queueStats.waiting}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Open Proposals</CardTitle>
          <CardDescription>Close proposals to trigger tally computation.</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          {proposals.length === 0 && <div className="text-gray-600 text-sm">No open proposals.</div>}
          {proposals.map((proposal) => (
            <div key={proposal._id || proposal.id} className="flex flex-col md:flex-row md:items-center md:justify-between border rounded-lg p-4">
              <div>
                <div className="font-semibold">{proposal.title}</div>
                <div className="text-sm text-gray-600">Ends {new Date(proposal.endTime).toLocaleString()}</div>
              </div>
              <Button variant="danger" size="sm" onClick={() => handleClose(proposal.id)}>
                Close &amp; queue tally
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}