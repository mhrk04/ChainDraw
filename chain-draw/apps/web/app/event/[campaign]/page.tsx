// Route: /event/[campaign] — Giveaway Detail (public)
// Stitch screen: 5b2300d4d036474a9206964d128e795a

import { PrizePoolPanel } from '@/components/PrizePoolPanel';
import { JoinForm } from '@/components/JoinForm';
import { WinnersPanel } from '@/components/WinnersPanel';
import { VERIFIER_API } from '@/lib/constants';
import Link from 'next/link';

interface Props { params: { campaign: string } }

async function getCampaignData(campaign: string) {
  try {
    const [eventRes, drawRes] = await Promise.all([
      fetch(`${VERIFIER_API}/api/events/${campaign}`, { next: { revalidate: 5 } }),
      fetch(`${VERIFIER_API}/api/events/${campaign}/draw`, { next: { revalidate: 5 } }),
    ]);
    const event = eventRes.ok ? await eventRes.json() : null;
    const draw = drawRes.ok ? await drawRes.json() : null;
    return { event, draw };
  } catch {
    return { event: null, draw: null };
  }
}

function Countdown({ cutoffTs }: { cutoffTs: number }) {
  const diff = cutoffTs - Math.floor(Date.now() / 1000);
  if (diff <= 0) return <span style={{ color: '#93000a' }}>Entry closed</span>;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const display = h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
  return <span style={{ color: '#006239' }}>{display} remaining</span>;
}

export default async function EventPage({ params }: Props) {
  const { event, draw } = await getCampaignData(params.campaign);

  if (!event) {
    return (
      <main className="min-h-screen px-6 py-20 text-center" style={{ backgroundColor: '#f8f9ff' }}>
        <p className="text-4xl">❓</p>
        <p className="mt-4 text-xl font-semibold" style={{ color: '#0b1c30' }}>
          Campaign not found
        </p>
        <Link href="/" className="mt-4 inline-block text-sm underline" style={{ color: '#004ac6' }}>
          ← Back to Explore
        </Link>
      </main>
    );
  }

  const isSettled = event.status === 'Settled';

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f8f9ff' }}>
      {/* Nav breadcrumb */}
      <div className="border-b px-6 py-3" style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}>
        <div className="mx-auto flex max-w-3xl items-center gap-2 text-sm" style={{ color: '#737686' }}>
          <Link href="/" style={{ color: '#004ac6' }}>Explore</Link>
          <span>›</span>
          <span style={{ color: '#0b1c30' }}>{event.title}</span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-6 py-10">

        {/* Title + meta */}
        <div>
          <div className="flex items-start justify-between">
            <h1 className="text-3xl font-bold" style={{ color: '#0b1c30', letterSpacing: '-0.02em' }}>
              {event.title}
            </h1>
            <span
              className="mt-1 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                backgroundColor: isSettled ? '#e5eeff' : '#c3ffd5',
                color: isSettled ? '#003ea8' : '#006239',
              }}
            >
              {event.status}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-sm" style={{ color: '#737686' }}>
            <span className="font-mono">{params.campaign.slice(0, 8)}…{params.campaign.slice(-4)}</span>
            <span>·</span>
            <Countdown cutoffTs={event.cutoffTs} />
            {event.isRecurring && (
              <>
                <span>·</span>
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-xs"
                  style={{ backgroundColor: '#dbe1ff', color: '#003ea8' }}
                >
                  Recurring
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── TRUST WIDGET ── */}
        <PrizePoolPanel
          campaignPubkey={params.campaign}
          delegationPda={event.delegationPda}
          organizer={event.organizer}
          prizeTotal={event.prizeTotal}
          numWinners={event.numWinners}
          isRecurring={event.isRecurring}
          periodLength={event.periodLength}
        />

        {/* Winners (if settled) */}
        {isSettled && draw?.payouts?.length > 0 && (
          <WinnersPanel
            drawTxSignature={draw.drawTxSignature}
            drawSeed={draw.drawSeed}
            payouts={draw.payouts}
            totalPaid={draw.totalPaid}
            numWinners={event.numWinners}
          />
        )}

        {/* Requirements + Join form */}
        {!isSettled && (
          <JoinForm
            campaignPubkey={params.campaign}
            postUrl={event.postUrl}
            cutoffTs={event.cutoffTs}
            requireFollow={!!event.organizerMastodonId}
          />
        )}

        {/* Entries panel */}
        <div className="rounded-xl border p-6" style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: '#0b1c30' }}>
              Verified Entries
            </h2>
            <span
              className="rounded-full px-3 py-1 font-mono text-sm font-medium"
              style={{ backgroundColor: '#eff4ff', color: '#004ac6' }}
            >
              {event.entryCount ?? 0}
            </span>
          </div>
          <p className="mt-2 text-sm" style={{ color: '#737686' }}>
            Each entry is an on-chain PDA. Entry index and handle hash are publicly
            verifiable. Handles are stored as sha256 hashes — no PII on-chain.
          </p>
          <a
            href={`https://explorer.solana.com/address/${params.campaign}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block font-mono text-xs underline"
            style={{ color: '#004ac6' }}
          >
            View campaign on Explorer ↗
          </a>
        </div>

      </div>
    </main>
  );
}
