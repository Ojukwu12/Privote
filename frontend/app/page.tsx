import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

export default function Home() {
  return (
    <div className="bg-gray-50">
      <section className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-sm font-semibold">
              Confidential DAO Voting · Zama FHEVM
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
              End-to-end encrypted governance with fully homomorphic encryption.
            </h1>
            <p className="text-lg text-white/90 max-w-2xl">
              Privote keeps every vote encrypted from the browser to the blockchain. Built on Zama FHEVM with homomorphic tallying, background job processing, and strict security controls.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/proposals">
                <Button size="lg" className="shadow-lg shadow-blue-900/30">View Proposals</Button>
              </Link>
              <Link href="/auth/register">
                <Button size="lg" variant="ghost" className="border border-white/30 text-white hover:bg-white/10">Get Started</Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-white/80">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-300"></span>
                Encrypted end-to-end
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-300"></span>
                Homomorphic tallying
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-300"></span>
                Background jobs
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-300"></span>
                Role-based access
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8 text-gray-900 space-y-6">
            <h2 className="text-2xl font-semibold">How it works</h2>
            <div className="space-y-4 text-sm text-gray-700">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-blue-600"></div>
                <div>
                  <p className="font-semibold">Client-side encryption</p>
                  <p>Users encrypt votes with Zama&apos;s FHE public key; backend never sees plaintext.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-blue-600"></div>
                <div>
                  <p className="font-semibold">Relayer submission</p>
                  <p>Backend queues jobs and submits encrypted votes to the FHEVM via relayer.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-blue-600"></div>
                <div>
                  <p className="font-semibold">Homomorphic tally</p>
                  <p>Tallies computed on encrypted data; results decrypted only when revealed.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-blue-600"></div>
                <div>
                  <p className="font-semibold">Local decryption</p>
                  <p>Users decrypt results locally with their private key after closure.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Privacy-first</CardTitle>
            <CardDescription>Votes never decrypted on the backend; encrypted keys, strict rate limits.</CardDescription>
          </CardHeader>
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
            <li>Client-side FHE encryption</li>
            <li>AES-256-GCM encrypted private keys</li>
            <li>Rate limited auth and decryption</li>
          </ul>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Operational reliability</CardTitle>
            <CardDescription>BullMQ job queues, Redis, and health/metrics endpoints for ops.</CardDescription>
          </CardHeader>
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
            <li>Vote submission workers</li>
            <li>Tally computation jobs</li>
            <li>Metrics endpoint for admins</li>
          </ul>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Admin controls</CardTitle>
            <CardDescription>Create, close proposals; monitor queues; enforce roles.</CardDescription>
          </CardHeader>
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-2">
            <li>Role-based access (user/admin)</li>
            <li>Proposal lifecycle management</li>
            <li>Secure key handling</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
