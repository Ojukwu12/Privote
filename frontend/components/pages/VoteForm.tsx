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
  const [saveKey, setSaveKey] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const { status, startPolling, stopPolling } = useJobStatusPolling(jobId, token || null);

  const systemPublicKey = (process.env.NEXT_PUBLIC_FHE_PUBLIC_KEY as string) || undefined;
  const contractAddress = (process.env.NEXT_PUBLIC_FHE_CONTRACT_ADDRESS as string) || undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!encryptedVote || encryptedVote.length === 0) {
      setLocalError('No encrypted vote prepared. Use the Vote YES/NO helpers to build a ciphertext first.');
      return;
    }
    if (!inputProof || inputProof.length === 0) {
      setLocalError('No input proof available. Please generate the encrypted vote (Vote YES/NO) to produce a proof before submitting.');
      return;
    }

    const payload = {
      proposalId,
      encryptedVote: encryptedVote,
      inputProof: inputProof,
      idempotencyKey: uuidv4(),
    };

    try {
      const response = await submit(payload, token);
      setJobId(response.data.jobId);
      startPolling();
    } catch (err) {
      console.error(err);
      const apiErr = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
      setLocalError(apiErr.getUserFriendlyMessage());
    }
  };

  const friendlyError = error instanceof ApiErrorClient ? error.getUserFriendlyMessage() : null;

  return (
    <div className="space-y-4">
      {friendlyError && (
        <div>
          <Alert type="error" message={friendlyError} />
          <ErrorDetails error={error} />
        </div>
      )}
      {localError && (
        <div>
          <Alert type="error" message={localError} />
        </div>
      )}
      <Alert type="info" message={systemPublicKey ? 'Encryption: system public key configured. Client will attempt real encryption.' : 'Encryption: system public key NOT configured — client will use mock encryption. Set `NEXT_PUBLIC_FHE_PUBLIC_KEY` to enable real FHE.'} />
      {!systemPublicKey && (
        <div className="text-xs text-yellow-700">Warning: running in mock encryption mode. Votes may not be real FHE ciphertexts.</div>
      )}
      <div className="space-y-2">
        <Input
          label="Private Key (paste from account creation)"
          value={privateKey || ''}
          onChange={(e) => setPrivateKey(e.target.value || null)}
          placeholder="-----BEGIN PRIVATE KEY-----"
        />
        <div className="flex items-center gap-2">
          <input
            id="saveKey"
            type="checkbox"
            checked={saveKey}
            onChange={(e) => setSaveKey(e.target.checked)}
          />
          <label htmlFor="saveKey" className="text-sm">Save private key in session for this browser session</label>
          <Button size="sm" variant="ghost" onClick={() => {
            if (!privateKey) return setLocalError('No private key to save');
            try { sessionStorage.setItem('private_key', privateKey); setLocalError(null); } catch (err) { setLocalError('Failed to save key to session'); }
          }}>Save</Button>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <Button type="button" isLoading={loading} className="w-full" onClick={async () => {
            // Build encrypted vote using system public key (preferable)
            setLocalError(null);
            try {
              const res = await encryptWithPublicKey(systemPublicKey, 'yes', { contractAddress, userAddress: undefined });
              const handlesJson = JSON.stringify(res.handles);
              setEncryptedVote(handlesJson);
              setInputProof(res.inputProof);
              if (saveKey && privateKey) try { sessionStorage.setItem('private_key', privateKey); } catch (e) {}
            } catch (err) {
              console.error('Encryption error (YES):', err);
              setLocalError('Encryption failed: ' + String(err) + (systemPublicKey ? '' : ' (system public key missing)'));
            }
          }}>Vote YES</Button>
          <Button type="button" variant="destructive" isLoading={loading} className="w-full" onClick={async () => {
            setLocalError(null);
            try {
              const res = await encryptWithPublicKey(systemPublicKey, 'no', { contractAddress, userAddress: undefined });
              const handlesJson = JSON.stringify(res.handles);
              setEncryptedVote(handlesJson);
              setInputProof(res.inputProof);
              if (saveKey && privateKey) try { sessionStorage.setItem('private_key', privateKey); } catch (e) {}
            } catch (err) {
              console.error('Encryption error (NO):', err);
              setLocalError('Encryption failed: ' + String(err) + (systemPublicKey ? '' : ' (system public key missing)'));
            }
          }}>Vote NO</Button>
        </div>

        <div>
          <div className="text-xs text-gray-600">Encrypted handles: <span className="break-all">{encryptedVote}</span></div>
          <div className="text-xs text-gray-600">Input proof: <span className="break-all">{inputProof}</span></div>
        </div>

        <Button type="submit" isLoading={loading} className="w-full">
          Submit Encrypted Vote
        </Button>
      </form>

      {jobId && (
        <div className="text-sm text-gray-700 space-y-1">
          <div className="font-semibold">Job ID: {jobId}</div>
          {status ? (
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-600"></span>
              <span>Status: {status.status}</span>
            </div>
          ) : (
            <div>Polling job status...</div>
          )}
          {status?.result && (
            <div className="text-xs text-gray-600">Result: {JSON.stringify(status.result)}</div>
          )}
          {status?.error && (
            <Alert type="error" message={status.error} />
          )}
          <Button type="button" variant="ghost" size="sm" onClick={stopPolling}>
            Stop polling
          </Button>
        </div>
      )}
    </div>
  );
}