import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/context/AuthContext';
import { Navigation } from '@/components/layout/Navigation';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: 'Privote - Confidential DAO Voting',
  description:
    'Secure, privacy-preserving DAO voting using Zama FHEVM. Your votes stay encrypted end-to-end.',
  keywords: ['DAO', 'voting', 'FHE', 'privacy', 'encryption', 'governance'],
  authors: [{ name: 'Privote' }],
  viewport: 'width=device-width, initial-scale=1.0',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <AuthProvider>
          <Navigation />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
