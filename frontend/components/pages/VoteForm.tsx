'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useSubmitVote, useJobStatusPolling } from '@/lib/hooks/useApi';
import { useAuth } from '@/lib/context/AuthContext';
import { ApiErrorClient } from '@/lib/api/client';
import ErrorDetails from '@/components/ui/ErrorDetails';
import { v4 as uuidv4 } from 'uuid';
import { encryptWithPublicKey } from '@/lib/fhe/client';

interface VoteFormProps {
  proposalId: string;
}

export function VoteForm({ proposalId }: VoteFormProps) {
  const { token } = useAuth();
  const { submit, loading, error } = useSubmitVote();
  const [encryptedVote, setEncryptedVote] = useState('');
  const [inputProof, setInputProof] = useState('');
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [voteChoice, setVoteChoice] = useState<'yes' | 'no' | null>(null);

  const { status, startPolling, stopPolling } = useJobStatusPolling(jobId, token || null);

  const contractAddress = process.env.NEXT_PUBLIC_FHE_CONTRACT_ADDRESS;

  // Check if FHE environment is properly configured
  useEffect(() => {
    if (!contractAddress) {
      console.warn('NEXT_PUBLIC_FHE_CONTRACT_ADDRESS not configured');
    }
  }, [contractAddress]);

  const handleEncrypt = async (choice: 'yes' | 'no') => {
    setLocalError(null);
    setIsEncrypting(true);

    try {
      if (!contractAddress) {
        throw new Error('FHE contract address not configured. Cannot encrypt vote.');
      }

      // Attempt real FHE encryption using Zama SDK
      const res = await encryptWithPublicKey(undefined, choice, { 
        contractAddress,
        userAddress: undefined 
      });

      if (!res.handles || res.handles.length === 0) {
        throw new Error('Encryption returned no handles. FHE encryption may not be configured.');
      }

      if (!res.inputProof) {
        throw new Error('Encryption did not return input proof.');
      }

      const handlesJson = JSON.stringify(res.handles);
      setEncryptedVote(handlesJson);
      setInputProof(res.inputProof);
      setVoteChoice(choice);
      
      // Save private key if requested
      if (privateKey) {
        try {
          sessionStorage.setItem('private_key', privateKey);
        } catch (e) {
          console.warn('Could not save private key to session storage');
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setLocalError(`Encryption failed: ${errorMsg}`);
      console.error('Encryption error:', err);
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!token) {
      setLocalError('You must be logged in to vote');
      return;
    }

    if (!encryptedVote) {
      setLocalError('Please encrypt your vote (click Vote YES or Vote NO) before submitting.');
      return;
    }

    if (!inputProof) {
      setLocalError('Input proof is missing. Please re-encrypt your vote and try again.');
      return;
    }

    if (!voteChoice) {
      setLocalError('Vote choice not recorded. Please encrypt your vote again.');
      return;
    }

    const payload = {
      proposalId,
      encryptedVote,
      inputProof,
      idempotencyKey: uuidv4(),
    };

    try {
      setSubmitSuccess(false);
      const response = await submit(payload, token);
      
      if (!response.data?.jobId) {
        throw new Error('Server did not return a job ID for tracking');
      }

      setJobId(response.data.jobId);
      setSubmitSuccess(true);
      setEncryptedVote('');
      setInputProof('');
      setVoteChoice(null);
      startPolling();
    } catch (err) {
      console.error('Vote submission error:', err);
      const apiErr = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
      setLocalError(apiErr.getUserFriendlyMessage());
    }
  };

  const friendlyError = error instanceof ApiErrorClient ? error.getUserFriendlyMessage() : null;

  return (
    <div className="space-y-4">
      {friendlyError && (
        <Alert type="error" message={friendlyError} />
      )}
      {localError && (
        <Alert type="error" message={localError} />
      )}
      {submitSuccess && (
        <Alert 
          type="success" 
          message="Your vote has been submitted to the blockchain! Tracking your transaction..." 
        />
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How to Vote</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Click <strong>Vote YES</strong> or <strong>Vote NO</strong> to encrypt your choice</li>
          <li>Your vote will be encrypted using Fully Homomorphic Encryption (FHE)</li>
          <li>Click <strong>Submit Encrypted Vote</strong> to send it to the blockchain</li>
          <li>Your vote will be recorded on-chain and tallied while remaining encrypted</li>
        </ol>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Private Key (Optional for decryption later)
          </label>
          <Input
            value={privateKey || ''}
            onChange={(e) => setPrivateKey(e.target.value || null)}
            placeholder="Paste your private key if you want to decrypt results later"
            type="password"
          />
          <p className="text-xs text-gray-500">
            Your private key is used client-side only for decrypting voting results after tallying is complete.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <Button 
            type="button" 
            isLoading={isEncrypting}
            disabled={isEncrypting || loading}
            className="w-full" 
            onClick={() => handleEncrypt('yes')}
          >
            🔐 Encrypt Vote: YES
          </Button>
          <Button 
            type="button" 
            variant="destructive"
            isLoading={isEncrypting}
            disabled={isEncrypting || loading}
            className="w-full" 
            onClick={() => handleEncrypt('no')}
          >
            🔐 Encrypt Vote: NO
          </Button>
        </div>

        {encryptedVote && (
          <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
              <span className="text-sm font-medium text-gray-700">
                Vote encrypted as: <strong>{voteChoice?.toUpperCase()}</strong>
              </span>
            </div>
            <p className="text-xs text-gray-600">
              Your vote has been encrypted with FHE. It is now safe to submit to the blockchain.
            </p>
          </div>
        )}

        <Button 
          type="submit" 
          isLoading={loading}
          disabled={!encryptedVote || loading || isEncrypting}
          className="w-full"
        >
          ✓ Submit Encrypted Vote to Blockchain
        </Button>
      </form>

      {jobId && (
        <div className="border border-gray-300 rounded-lg p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">Vote Submission Status</h3>
            <p className="text-xs text-gray-600 mb-2">Job ID: {jobId}</p>
          </div>

          {status ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {status.status === 'completed' ? (
                  <>
                    <span className="inline-block w-3 h-3 bg-green-500 rounded-full animate-none"></span>
                    <span className="text-sm font-medium text-green-700">✓ Vote submitted successfully!</span>
                  </>
                ) : status.status === 'failed' ? (
                  <>
                    <span className="inline-block w-3 h-3 bg-red-500 rounded-full animate-none"></span>
                    <span className="text-sm font-medium text-red-700">✗ Vote submission failed</span>
                  </>
                ) : (
                  <>
                    <span className="inline-block w-3 h-3 bg-blue-500 rounded-full animate-pulse"></span>
                    <span className="text-sm font-medium text-blue-700">⏳ Processing...</span>
                  </>
                )}
              </div>

              {status.status === 'completed' && status.result?.txHash && (
                <div className="bg-green-50 border border-green-200 rounded p-2">
                  <p className="text-xs text-gray-600">Transaction Hash:</p>
                  <code className="text-xs break-all text-green-800 font-mono">{status.result.txHash}</code>
                </div>
              )}

              {status.status === 'failed' && status.error && (
                <Alert type="error" message={`Error: ${status.error}`} />
              )}

              {status.status !== 'completed' && status.status !== 'failed' && (
                <p className="text-xs text-gray-600">Your vote is being written to the blockchain. This may take a few moments...</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600">Polling for vote confirmation...</p>
          )}

          {status?.status === 'completed' && (
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={stopPolling}
              className="w-full"
            >
              Close
            </Button>
          )}
        </div>
      )}
    </div>
  );
}