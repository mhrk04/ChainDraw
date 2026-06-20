'use client';

/**
 * WinnersPanel — shown after draw completes.
 *
 * Displays:
 *   - Winner wallet addresses (truncated)
 *   - Prize amount per winner
 *   - Payout tx links on Explorer
 *   - On-chain draw seed (so anyone can verify the randomness)
 *   - Draw tx link
 */

import { USDC_DECIMALS } from '@/lib/constants';

interface Payout {
  entryIndex: number;
  participantWallet: string;
  amount: string;       // base units as string
  txSignature?: string;
  explorerUrl?: string;
  status: 'paid' | 'failed' | 'skipped';
}

interface Props {
  drawTxSignature: string;
  drawSeed: string;
  payouts: Payout[];
  totalPaid: number;
  numWinners: number;
}

const USDC_DIVISOR = BigInt(10 ** USDC_DECIMALS);

function formatUsdc(baseUnits: string): string {
  try {
    const n = BigInt(baseUnits);
    const whole = n / USDC_DIVISOR;
    const frac = (n % USDC_DIVISOR).toString().padStart(USDC_DECIMALS, '0').slice(0, 2);
    return `${whole}.${frac} USDC`;
  } catch {
    return '— USDC';
  }
}

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const statusConfig = {
  paid: { label: 'Paid', bg: 'bg-[#d1fae5]', text: 'text-[#065f46]' },
  failed: { label: 'Failed', bg: 'bg-[#ffdad6]', text: 'text-[#93000a]' },
  skipped: { label: 'Already paid', bg: 'bg-[#e5eeff]', text: 'text-[#004ac6]' },
};

export function WinnersPanel({
  drawTxSignature,
  drawSeed,
  payouts,
  totalPaid,
  numWinners,
}: Props) {
  const drawExplorerUrl = `https://explorer.solana.com/tx/${drawTxSignature}?cluster=devnet`;

  return (
    <div className="rounded-xl border border-[#10b981] bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎉</span>
          <h2 className="text-lg font-semibold text-[#0b1c30]">Winners</h2>
        </div>
        <span className="rounded-full bg-[#d1fae5] px-3 py-1 font-mono text-sm font-medium text-[#065f46]">
          {totalPaid}/{numWinners} paid
        </span>
      </div>

      {/* Winners list */}
      <div className="mt-4 space-y-3">
        {payouts.map((payout, i) => {
          const cfg = statusConfig[payout.status];
          return (
            <div
              key={payout.entryIndex}
              className="flex items-center justify-between rounded-lg bg-[#f8f9ff] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2563eb] font-mono text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-mono text-sm font-medium text-[#0b1c30]">
                    {truncate(payout.participantWallet)}
                  </p>
                  <p className="font-mono text-xs text-[#737686]">
                    Entry #{payout.entryIndex}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-[#0b1c30]">
                  {formatUsdc(payout.amount)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                  {cfg.label}
                </span>
                {payout.explorerUrl && (
                  <a
                    href={payout.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[#2563eb] underline"
                  >
                    tx ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Draw proof */}
      <div className="mt-5 rounded-lg border border-[#c3c6d7] bg-[#f8f9ff] p-4">
        <p className="font-mono text-xs font-medium text-[#434655]">Verifiable Draw Proof</p>
        <div className="mt-2 space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="font-mono text-xs text-[#737686] w-20 shrink-0">Seed</span>
            <span className="font-mono text-xs text-[#0b1c30] break-all">{drawSeed}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono text-xs text-[#737686] w-20 shrink-0">Draw tx</span>
            <a
              href={drawExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-[#2563eb] underline break-all"
            >
              {drawTxSignature.slice(0, 20)}… ↗
            </a>
          </div>
          <p className="mt-2 text-xs text-[#737686]">
            Slot-hash seed is published on-chain. Anyone can recompute winner indices
            from the seed + entry count to verify the result independently.
          </p>
        </div>
      </div>
    </div>
  );
}
