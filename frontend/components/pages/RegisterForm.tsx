'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useRegister } from '@/lib/hooks/useApi';
import { ApiClient, ApiErrorClient } from '@/lib/api/client';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';
import ErrorDetails from '@/components/ui/ErrorDetails';

export function RegisterForm() {
  const router = useRouter();
  const { register: registerApi, loading, error } = useRegister();
  const { login } = useAuth();

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

      // Navigate to proposals page
      // Private key remains encrypted on server and will be decrypted with password when needed for voting
      router.push('/proposals');
    } catch (err) {
      console.error(err);
      const apiErr = err instanceof ApiErrorClient ? err : new ApiErrorClient(String(err), 500);
      setValidationError(apiErr.getUserFriendlyMessage());
    }
  };

  const friendlyError = error instanceof ApiErrorClient ? error.getUserFriendlyMessage() : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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