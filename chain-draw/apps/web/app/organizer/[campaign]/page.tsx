'use client';

// Route: /organizer/[campaign] — Manage Event (organizer-only)

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ClientWalletButton } from '@/components/ClientWalletButton';
import { WinnersPanel } from '@/components/WinnersPanel';
import { PrizePoolPanel } from '@/components/PrizePoolPanel';
import { VERIFIER_API } from '@/lib/constants';
import Link from 'next/link';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

interface Props { params: { campaign: string } }

export default function ManageEventPage({ params }: Props) {
  const { publicKey, connected, signMessage } = useWallet();
  const [event, setEvent] = useState<any>(null);
  const [draw, setDraw] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [drawError, setDrawError] = useState('');

  const fetchData = async () => {
    try {
      const [eRes, dRes] = await Promise.all([
        fetch(`${VERIFIER_API}/api/events/${params.campaign}`),
        fetch(`${VERIFIER_API}/api/events/${params.campaign}/draw`),
      ]);
      if (eRes.ok) setEvent(await eRes.json());
      if (dRes.ok) {
        const d = await dRes.json();
        if (d.status !== 'not_drawn') setDraw(d);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [params.campaign]);

  // Poll entries every 10s
  useEffect(() => {
    const t = setInterval(fetchData, 10_000);
    return () => clearInterval(t);
  }, [params.campaign]);

  async function handleDraw() {
    if (!publicKey || !signMessage) return;
    setDrawing(true);
    setDrawError('');

    try {
      // Sign-in-with-Solana
      const msg = `ChainDraw draw authorization\nCampaign: ${params.campaign}\nOrganizer: ${publicKey.toBase58()}`;
      const msgBytes = new TextEncoder().encode(msg);
      const sigBytes = await signMessage(msgBytes);
      const signature = bs58.encode(sigBytes);

      const res = await fetch(`${VERIFIER_API}/api/events/${params.campaign}/draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, nonce: params.campaign }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Draw failed');

      setDraw(data);
      await fetchData();
    } catch (e: any) {
      setDrawError(e.message);
    } finally {
      setDrawing(false);
    }
  }

  if (!connected) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#f8f9ff' }}>
        <div className="max-w-sm rounded-xl border p-10 text-center" style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}>
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold" style={{ color: '#0b1c30' }}>Connect wallet</h1>
          <div className="mt-6 flex justify-center">
            <ClientWalletButton style={{ backgroundColor: '#004ac6', borderRadius: '0.5rem' }} />
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#f8f9ff' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </main>
    );
  }

  if (!event) {
    return (
      <main className="min-h-screen px-6 py-20 text-center" style={{ backgroundColor: '#f8f9ff' }}>
        <p className="text-xl font-semibold" style={{ color: '#0b1c30' }}>Campaign not found</p>
        <Link href="/organizer" className="mt-4 inline-block text-sm underline" style={{ color: '#004ac6' }}>
          ← My Giveaways
        </Link>
      </main>
    );
  }

  const isOrganizer = publicKey?.toBase58() === event.organizer;
  const now = Math.floor(Date.now() / 1000);
  const cutoffPassed = now >= event.cutoffTs;
  const canDraw = isOrganizer && cutoffPassed && event.status === 'Open';
  const isSettled = event.status === 'Settled';
  const totalPaid = draw?.totalPaid ?? 0;

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f8f9ff' }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm" style={{ color: '#737686' }}>
              <Link href="/organizer" style={{ color: '#004ac6' }}>My Giveaways</Link>
              <span>›</span>
              <span>Manage</span>
            </div>
            <h1 className="mt-0.5 text-xl font-bold" style={{ color: '#0b1c30' }}>{event.title}</h1>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{
              backgroundColor: isSettled ? '#e5eeff' : cutoffPassed ? '#eddcff' : '#c3ffd5',
              color: isSettled ? '#003ea8' : cutoffPassed ? '#6300bb' : '#006239',
            }}
          >
            {event.status}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-6 py-8">

        {/* Trust widget */}
        <PrizePoolPanel
          campaignPubkey={params.campaign}
          delegationPda={event.delegationPda}
          organizer={event.organizer}
          prizeTotal={event.prizeTotal}
          numWinners={event.numWinners}
          isRecurring={event.isRecurring}
          periodLength={event.periodLength}
        />

        {/* Winners */}
        {isSettled && draw?.payouts?.length > 0 && (
          <WinnersPanel
            drawTxSignature={draw.drawTxSignature}
            drawSeed={draw.drawSeed}
            payouts={draw.payouts}
            totalPaid={draw.totalPaid}
            numWinners={event.numWinners}
          />
        )}

        {/* Draw & Pay section */}
        {!isSettled && (
          <div className="rounded-xl border p-6" style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}>
            <h2 className="text-lg font-semibold" style={{ color: '#0b1c30' }}>Draw & Pay</h2>

            {/* Payout progress */}
            {draw && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm" style={{ color: '#737686' }}>
                  <span>Payout progress</span>
                  <span className="font-medium" style={{ color: '#0b1c30' }}>
                    {totalPaid} / {event.numWinners} winners paid
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full" style={{ backgroundColor: '#e5eeff' }}>
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${(totalPaid / event.numWinners) * 100}%`,
                      backgroundColor: '#004ac6',
                    }}
                  />
                </div>
              </div>
            )}

            {!cutoffPassed && (
              <p className="mt-4 text-sm" style={{ color: '#737686' }}>
                Draw available after cutoff:{' '}
                <strong>{new Date(event.cutoffTs * 1000).toLocaleString()}</strong>
              </p>
            )}

            {!isOrganizer && (
              <p className="mt-4 text-sm" style={{ color: '#93000a' }}>
                Only the organizer ({event.organizer.slice(0, 8)}…) can trigger the draw.
              </p>
            )}

            {canDraw && (
              <button
                onClick={handleDraw}
                disabled={drawing}
                className="mt-4 w-full rounded-lg py-3 text-sm font-semibold disabled:opacity-50"
                style={{
                  background: drawing
                    ? '#737686'
                    : 'linear-gradient(135deg, #004ac6, #7d1be2)',
                  color: '#ffffff',
                }}
              >
                {drawing ? 'Running draw & paying winners…' : '🎲 Draw Winners & Pay'}
              </button>
            )}

            {drawError && (
              <div className="mt-3 rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#ffdad6', color: '#93000a' }}>
                {drawError}
              </div>
            )}
          </div>
        )}

        {/* Entries table */}
        <div className="rounded-xl border p-6" style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: '#0b1c30' }}>Entries</h2>
            <span
              className="rounded-full px-3 py-1 font-mono text-sm font-medium"
              style={{ backgroundColor: '#eff4ff', color: '#004ac6' }}
            >
              {event.entryCount ?? 0} verified
            </span>
          </div>
          <p className="mt-2 text-sm" style={{ color: '#737686' }}>
            Entries update every 10s. Each entry is an on-chain PDA with participant wallet and
            handle hash (no PII stored on-chain).
          </p>
          <a
            href={`https://explorer.solana.com/address/${params.campaign}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block font-mono text-xs underline"
            style={{ color: '#004ac6' }}
          >
            View on Explorer ↗
          </a>
        </div>

        {/* Revoke delegation */}
        {isSettled && (
          <div className="rounded-xl border p-6" style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}>
            <h2 className="text-lg font-semibold" style={{ color: '#0b1c30' }}>Revoke Delegation</h2>
            <p className="mt-2 text-sm" style={{ color: '#737686' }}>
              All winners paid. Revoke the delegation to reclaim rent from the delegation PDA.
            </p>
            <button
              className="mt-4 rounded-lg border px-5 py-2.5 text-sm font-semibold"
              style={{ borderColor: '#004ac6', color: '#004ac6' }}
            >
              Revoke & Reclaim Rent
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
