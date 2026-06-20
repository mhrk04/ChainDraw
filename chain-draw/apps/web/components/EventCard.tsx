'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Campaign {
  campaign: string;
  title: string;
  prizeTotal: string;
  numWinners: number;
  cutoffTs: number;
  entryCount?: number;
  status: 'Open' | 'Drawing' | 'Settled';
  isRecurring: boolean;
  periodLength?: number;
  delegationPda?: string;
}

function useCountdown(cutoffTs: number) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = cutoffTs - Math.floor(Date.now() / 1000);
      if (diff <= 0) { setRemaining('Ended'); return; }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (h > 24) setRemaining(`${Math.floor(h / 24)}d ${h % 24}h`);
      else setRemaining(`${h}h ${m}m ${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [cutoffTs]);

  return remaining;
}

const USDC_DIVISOR = BigInt(1_000_000);

function formatUsdc(baseUnits: string): string {
  try {
    const n = BigInt(baseUnits);
    return `${(n / USDC_DIVISOR).toString()} USDC`;
  } catch { return '— USDC'; }
}

const statusColors = {
  Open: { bg: '#c3ffd5', text: '#006239', dot: '#10b981' },
  Drawing: { bg: '#eddcff', text: '#6300bb', dot: '#9742fd' },
  Settled: { bg: '#e5eeff', text: '#003ea8', dot: '#004ac6' },
};

function periodLabel(s: number) {
  if (s === 604800) return 'Weekly';
  if (s === 2592000) return 'Monthly';
  return '';
}

export function EventCard({ campaign }: { campaign: Campaign }) {
  const countdown = useCountdown(campaign.cutoffTs);
  const sc = statusColors[campaign.status] ?? statusColors.Open;
  const share = (() => {
    try { return (BigInt(campaign.prizeTotal) / BigInt(campaign.numWinners)).toString(); }
    catch { return '0'; }
  })();

  return (
    <Link
      href={`/event/${campaign.campaign}`}
      className="group flex flex-col overflow-hidden rounded-xl border transition-all duration-300 hover:shadow-lg"
      style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}
    >
      {/* Header band */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ backgroundColor: '#eff4ff' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: sc.dot }}
          />
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{ backgroundColor: sc.bg, color: sc.text }}
          >
            {campaign.status}
          </span>
          {campaign.isRecurring && campaign.periodLength && (
            <span
              className="rounded-full px-2 py-0.5 font-mono text-xs font-medium"
              style={{ backgroundColor: '#dbe1ff', color: '#003ea8' }}
            >
              {periodLabel(campaign.periodLength)}
            </span>
          )}
        </div>
        <span
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: '#004ac6' }}
        >
          ✓ Verified Commitment
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-base font-semibold leading-snug" style={{ color: '#0b1c30' }}>
          {campaign.title}
        </h3>

        {/* Prize row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs" style={{ color: '#737686' }}>Total prize</p>
            <p className="text-lg font-bold" style={{ color: '#004ac6' }}>
              {formatUsdc(campaign.prizeTotal)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs" style={{ color: '#737686' }}>Per winner</p>
            <p className="text-sm font-semibold" style={{ color: '#0b1c30' }}>
              {formatUsdc(share)}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div
          className="flex items-center justify-between rounded-lg px-3 py-2"
          style={{ backgroundColor: '#f8f9ff' }}
        >
          <div className="text-center">
            <p className="font-mono text-xs" style={{ color: '#737686' }}>Winners</p>
            <p className="text-sm font-semibold" style={{ color: '#0b1c30' }}>
              {campaign.numWinners}
            </p>
          </div>
          <div className="h-8 w-px" style={{ backgroundColor: '#c3c6d7' }} />
          <div className="text-center">
            <p className="font-mono text-xs" style={{ color: '#737686' }}>Entries</p>
            <p className="text-sm font-semibold" style={{ color: '#0b1c30' }}>
              {campaign.entryCount ?? 0}
            </p>
          </div>
          <div className="h-8 w-px" style={{ backgroundColor: '#c3c6d7' }} />
          <div className="text-center">
            <p className="font-mono text-xs" style={{ color: '#737686' }}>Closes in</p>
            <p
              className="text-sm font-semibold"
              style={{ color: campaign.status === 'Open' ? '#006239' : '#737686' }}
            >
              {countdown}
            </p>
          </div>
        </div>

        {/* CTA */}
        <div
          className="mt-auto rounded-lg py-2.5 text-center text-sm font-semibold transition-opacity group-hover:opacity-90"
          style={{ backgroundColor: '#004ac6', color: '#ffffff' }}
        >
          {campaign.status === 'Open' ? 'Enter Giveaway →' : 'View Results →'}
        </div>
      </div>
    </Link>
  );
}
