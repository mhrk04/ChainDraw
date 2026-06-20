// Route: / — Explore Giveaways
// Stitch screen: 0e870d7fd58540c8a5ec4e1dca84529b

import { EventCard } from '@/components/EventCard';
import { VERIFIER_API } from '@/lib/constants';

async function getEvents() {
  try {
    const res = await fetch(`${VERIFIER_API}/api/events`, {
      next: { revalidate: 10 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.events ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const events = await getEvents();

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f8f9ff' }}>

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden px-6 pb-20 pt-16"
        style={{ backgroundColor: '#eff4ff' }}
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-2xl">
            <h1
              className="mb-5 text-5xl font-bold leading-tight tracking-tight"
              style={{ color: '#0b1c30', letterSpacing: '-0.02em' }}
            >
              Trustless social giveaways on Solana.{' '}
              <span style={{ color: '#004ac6' }}>No escrow, just math.</span>
            </h1>
            <p className="mb-8 text-lg leading-relaxed" style={{ color: '#434655' }}>
              Prize committed on-chain via Fixed Delegation. Winner selected by verifiable
              slot-hash randomness. Proof public forever. Participants pay nothing.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-3">
              {[
                { icon: '✓', label: 'Solana Subscriptions Program' },
                { icon: '🔒', label: 'Fixed Delegation Commitment' },
                { icon: '🎲', label: 'On-chain Randomness' },
              ].map((b) => (
                <div
                  key={b.label}
                  className="flex items-center gap-2 rounded-full border px-4 py-2"
                  style={{ backgroundColor: '#d3e4fe', borderColor: '#b4c5ff' }}
                >
                  <span>{b.icon}</span>
                  <span
                    className="font-mono text-xs font-medium uppercase tracking-wider"
                    style={{ color: '#004ac6' }}
                  >
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Discovery Controls ── */}
      <section
        className="sticky top-16 z-40 border-b px-6 py-5"
        style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
          <div
            className="flex flex-1 items-center gap-2 rounded-xl px-4 py-2 md:max-w-md"
            style={{ backgroundColor: '#e5eeff' }}
          >
            <span style={{ color: '#737686' }}>🔍</span>
            <input
              type="text"
              placeholder="Search giveaways..."
              className="w-full border-none bg-transparent text-sm outline-none"
              style={{ color: '#0b1c30' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: '#c3c6d7',
                backgroundColor: '#eff4ff',
                color: '#0b1c30',
              }}
            >
              <option>Status: All</option>
              <option>Open</option>
              <option>Settled</option>
            </select>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              style={{
                borderColor: '#c3c6d7',
                backgroundColor: '#eff4ff',
                color: '#0b1c30',
              }}
            >
              <option>Type: All</option>
              <option>One-shot</option>
              <option>Recurring</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── Event Grid ── */}
      <section className="mx-auto max-w-[1200px] px-6 py-12">
        {events.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-4xl">🎁</p>
            <p className="mt-4 text-xl font-semibold" style={{ color: '#0b1c30' }}>
              No giveaways yet
            </p>
            <p className="mt-2 text-sm" style={{ color: '#737686' }}>
              Be the first to create a trustless giveaway on Solana.
            </p>
            <a
              href="/organizer/new"
              className="mt-6 inline-block rounded-lg px-6 py-3 text-sm font-semibold"
              style={{ backgroundColor: '#004ac6', color: '#ffffff' }}
            >
              Create Giveaway →
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event: any) => (
              <EventCard key={event.campaign} campaign={event} />
            ))}
          </div>
        )}
      </section>

      {/* ── Stats bar ── */}
      <section
        className="border-t px-6 py-8"
        style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}
      >
        <div className="mx-auto grid max-w-[1200px] grid-cols-3 gap-8 text-center">
          {[
            { label: 'Total Giveaways', value: events.length.toString() },
            {
              label: 'Total Prize Pool',
              value: (() => {
                try {
                  const total = events.reduce(
                    (acc: bigint, e: any) => acc + BigInt(e.prizeTotal ?? 0),
                    BigInt(0)
                  );
                  return `${(total / BigInt(1_000_000)).toString()} USDC`;
                } catch { return '—'; }
              })(),
            },
            {
              label: 'Total Entries',
              value: events.reduce((acc: number, e: any) => acc + (e.entryCount ?? 0), 0).toString(),
            },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-bold" style={{ color: '#004ac6' }}>{s.value}</p>
              <p className="mt-1 text-sm" style={{ color: '#737686' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
