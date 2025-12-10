'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useRegister } from '@/lib/hooks/useApi';
import { ApiClient, ApiErrorClient } from '@/lib/api/client';
import { useAuth } from '@/lib/context/AuthContext';
import { useDecryptPrivateKey } from '@/lib/hooks/useApi';
import PrivateKeyModal from '@/components/ui/PrivateKeyModal';
import { useRouter } from 'next/navigation';
import ErrorDetails from '@/components/ui/ErrorDetails';

export function RegisterForm() {
  const router = useRouter();
  const { register: registerApi, loading, error } = useRegister();
  const { login } = useAuth();
  const { decrypt, loading: decryptLoading } = useDecryptPrivateKey();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateUsername = (value: string): string | null => {
    if (!value) return null;
    // Backend requires alphanumeric-only usernames; mirror that validation here
    if (!/^[a-zA-Z0-9]+$/.test(value)) {
      return 'Username can only contain letters and numbers (no spaces or symbols).';
    }
    if (value.length < 3) {
      return 'Username must be at least 3 characters long.';
    }
    if (value.length > 20) {
      return 'Username must be at most 20 characters long.';
    }
    return null;
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    setValidationError(validateUsername(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const usernameError = validateUsername(username);
    if (usernameError) {
      setValidationError(usernameError);
      return;
    }
    try {
      const response = await registerApi(username, email, password);
      const user = response.data.user as any;
      const token = response.data.token as string;

      // Log user in
      login(user, token);

      // Try to fetch/decrypt the private key immediately so the user can save it.
      try {
        const privateKey = await decrypt(password, token);
        if (privateKey) {
          setPrivateKeyToShow(privateKey);
          setShowKeyModal(true);
          setValidationError(null);
          // Wait for the user to close the modal before navigating.
        }
      } catch (err) {
        // Non-fatal: user can still log in, but surface a friendly message
        const apiErr = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
        setValidationError(apiErr.getUserFriendlyMessage());
        // navigate even if decryption failed
        router.push('/proposals');
      }
    } catch (err) {
      console.error(err);
      const apiErr = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
      setValidationError(apiErr.getUserFriendlyMessage());
    }
  };

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [privateKeyToShow, setPrivateKeyToShow] = useState<string | null>(null);

  const handleSaveToSession = () => {
    if (!privateKeyToShow) return;
    try {
      sessionStorage.setItem('private_key', privateKeyToShow);
    } catch (err) {
      console.warn('Failed to save private key to session', err);
    }
  };

  const handleCopiedAndDelete = () => {
    // User copied their key — clear from client state to reduce exposure
    setPrivateKeyToShow(null);
    setShowKeyModal(false);
    // Navigate after modal closed
    router.push('/proposals');
  };

  const handleModalClose = () => {
    setShowKeyModal(false);
    router.push('/proposals');
  };

  const friendlyError = error instanceof ApiErrorClient ? error.getUserFriendlyMessage() : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PrivateKeyModal
        open={showKeyModal}
        privateKey={privateKeyToShow || ''}
        onClose={handleModalClose}
        onSaveToSession={handleSaveToSession}
        onCopiedAndDelete={handleCopiedAndDelete}
      />
      {friendlyError && (
        <div>
          <Alert type="error" message={friendlyError} />
          <ErrorDetails error={error} />
        </div>
      )}
      {validationError && <Alert type="error" message={validationError} />}
      <Input
        label="Username"
        required
        value={username}
        onChange={handleUsernameChange}
        placeholder="alphanumeric, underscore, hyphen only"
      />
      <Input
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Password"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" isLoading={loading} className="w-full">
        Create Account
      </Button>
    </form>
  );
}