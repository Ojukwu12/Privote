'use client';

import Link from 'next/link';
import { LoginForm } from '@/components/pages/LoginForm';

export default function LoginPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="text-gray-600">Sign in to manage proposals, submit encrypted votes, and view results.</p>
        <div className="text-sm text-gray-600">
          New here?{' '}
          <Link href="/auth/register" className="text-blue-600 font-semibold">
            Create an account
          </Link>
        </div>
      </div>
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
        <LoginForm />
      </div>
    </div>
  );
}