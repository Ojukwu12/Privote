'use client';

import Link from 'next/link';
import { RegisterForm } from '@/components/pages/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Create your account</h1>
        <p className="text-gray-600">Register to receive your encrypted keypair and start voting privately.</p>
        <div className="text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-blue-600 font-semibold">
            Sign in
          </Link>
        </div>
      </div>
      <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-6">
        <RegisterForm />
      </div>
    </div>
  );
}