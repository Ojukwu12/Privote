'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ApiClient, ApiErrorClient } from '@/lib/api/client';
import { useAuth } from '@/lib/context/AuthContext';

export default function CreateProposalPage() {
  const router = useRouter();
  const { token, user, isLoading } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [requiredRole, setRequiredRole] = useState<'user' | 'admin'>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiErrorClient | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  // Get minimum datetime (current time) in ISO format for input min attribute
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const minDateTime = getMinDateTime();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      setAuthError('Admin role required to create proposals.');
    }
  }, [isLoading, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !isAdmin) return;
    
    // Validate inputs
    if (!title.trim() || !description.trim() || !startTime || !endTime) {
      setError(new ApiErrorClient('Please fill in all fields', 400));
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    // Validate start time is in the future
    if (start <= now) {
      setError(new ApiErrorClient('Start time must be in the future', 400));
      return;
    }

    // Validate end time is in the future
    if (end <= now) {
      setError(new ApiErrorClient('End time must be in the future', 400));
      return;
    }

    // Validate start is before end
    if (start >= end) {
      setError(new ApiErrorClient('Start time must be before end time', 400));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await ApiClient.createProposal(
        { 
          title, 
          description, 
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          requiredRole 
        },
        token
      );
      
      const newId = response.data?.proposal?._id;
      if (newId) {
        router.push(`/proposals/${newId}`);
      } else {
        // Fallback to proposals list if ID is not returned
        router.push('/proposals');
      }
    } catch (err) {
      const apiErr = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
      setError(apiErr);
      console.error('Proposal creation error:', apiErr);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!isLoading && !isAdmin) return <Alert type="error" message="Admin role required to create proposals." />;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold mb-4">Create Proposal</h1>
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
        {error && <Alert type="error" message={error.getUserFriendlyMessage()} />}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-950 font-medium placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400 transition-colors"
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Input
            label="Start Time"
            type="datetime-local"
            required
            min={minDateTime}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            label="End Time"
            type="datetime-local"
            required
            min={minDateTime}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Required Role</label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-950 font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400 transition-colors"
              value={requiredRole}
              onChange={(e) => setRequiredRole(e.target.value as 'user' | 'admin')}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit" isLoading={loading} className="w-full">
            Create Proposal
          </Button>
        </form>
      </div>
    </div>
  );
}