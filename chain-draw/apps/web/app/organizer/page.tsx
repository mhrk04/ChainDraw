'use client';

// Route: /organizer — Organizer Dashboard (wallet-gated)
// Stitch screen: 0e229b502dcd4cf7854f62f04cca864e

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { VERIFIER_API } from '@/lib/constants';
import { EventCard } from '@/components/EventCard';

export default function OrganizerPage() {
  const { publicKey, connected } = useWallet();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) return;
    setLoading(true);
    fetch(`${VERIFIER_API}/api/events`)
      .then((r) => r.json())
      .then((d) => {
        const mine = (d.events ?? []).filter(
          (e: any) => e.organizer === publicKey.toBase58()
        );
        setEvents(mine);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [publicKey]);

  if (!connected) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#f8f9ff' }}>
        <div className="max-w-sm rounded-xl border p-10 text-center" style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}>
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold" style={{ color: '#0b1c30' }}>
            Connect your wallet
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#737686' }}>
            Connect your Phantom wallet to manage your giveaways.
          </p>
          <div className="mt-6 flex justify-center">
            <WalletMultiButton
              style={{
                backgroundColor: '#004ac6',
                borderRadius: '0.5rem',
                fontSize: '14px',
              }}
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f8f9ff' }}>
      {/* Header */}
      <div className="border-b px-6 py-5" style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#0b1c30', letterSpacing: '-0.01em' }}>
              My Giveaways
            </h1>
            <p className="mt-0.5 font-mono text-xs" style={{ color: '#737686' }}>
              {publicKey?.toBase58().slice(0, 8)}…{publicKey?.toBase58().slice(-6)}
            </p>
          </div>
          <Link
            href="/organizer/new"
            className="rounded-lg px-5 py-2.5 text-sm font-semibold"
            style={{ backgroundColor: '#004ac6', color: '#ffffff' }}
          >
            + Create Giveaway
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-6 py-10">
        {loading ? (
          <div className="py-20 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="mt-4 text-sm" style={{ color: '#737686' }}>Loading campaigns…</p>
          </div>
        ) : events.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-4xl">🎁</p>
            <p className="mt-4 text-xl font-semibold" style={{ color: '#0b1c30' }}>
              No giveaways yet
            </p>
            <p className="mt-2 text-sm" style={{ color: '#737686' }}>
              Create your first trustless giveaway in minutes.
            </p>
            <Link
              href="/organizer/new"
              className="mt-6 inline-block rounded-lg px-6 py-3 text-sm font-semibold"
              style={{ backgroundColor: '#004ac6', color: '#ffffff' }}
            >
              Create Giveaway →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event: any) => (
              <div key={event.campaign} className="relative">
                <EventCard campaign={event} />
                <Link
                  href={`/organizer/${event.campaign}`}
                  className="absolute bottom-3 right-3 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{ backgroundColor: '#eff4ff', color: '#004ac6' }}
                >
                  Manage →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
