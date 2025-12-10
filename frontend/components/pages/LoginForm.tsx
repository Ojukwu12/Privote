'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useLogin } from '@/lib/hooks/useApi';
import { useAuth } from '@/lib/context/AuthContext';
import { ApiErrorClient } from '@/lib/api/client';
import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const { login: loginApi, loading, error } = useLogin();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await loginApi(email, password);
      login(response.data.user as any, response.data.token);
      router.push('/proposals');
    } catch (err) {
      console.error(err);
    }
  };

  const friendlyError = error instanceof ApiErrorClient ? error.getUserFriendlyMessage() : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {friendlyError && <Alert type="error" message={friendlyError} />}
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
        Sign In
      </Button>
    </form>
  );
}