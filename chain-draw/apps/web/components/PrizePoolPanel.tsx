'use client';

/**
 * PrizePoolPanel — The trust widget.
 *
 * Shows:
 *   - Committed cap (from Fixed or Recurring Delegation PDA)
 *   - Remaining allowance
 *   - Per-winner share
 *   - Organizer's live USDC balance
 *   - SolvencyDot: green if balance >= cap, red if not
 *   - "Verify on Explorer ↗" link to delegation PDA
 *   - "Recurring" badge for recurring campaigns
 *
 * This is the component that makes the "trustless" claim credible to judges.
 */

import { useDelegation } from '@/hooks/useDelegation';
import { useOrganizerBalance } from '@/hooks/useOrganizerBalance';
import { USDC_DECIMALS } from '@/lib/constants';

interface Props {
  campaignPubkey: string;
  delegationPda: string;
  organizer: string;
  prizeTotal: string;   // base units
  numWinners: number;
  isRecurring: boolean;
  periodLength?: number; // seconds
}

const USDC_DIVISOR = BigInt(10 ** USDC_DECIMALS);

function formatUsdc(baseUnits: string | bigint): string {
  try {
    const n = typeof baseUnits === 'string' ? BigInt(baseUnits) : baseUnits;
    const whole = n / USDC_DIVISOR;
    const frac = n % USDC_DIVISOR;
    const fracStr = frac.toString().padStart(USDC_DECIMALS, '0').slice(0, 2);
    return `${whole.toLocaleString()}.${fracStr} USDC`;
  } catch {
    return '— USDC';
  }
}

function periodLabel(seconds: number): string {
  if (seconds === 604800) return 'Weekly';
  if (seconds === 2592000) return 'Monthly';
  if (seconds > 0) return `Every ${Math.round(seconds / 86400)}d`;
  return '';
}

function SolvencyDot({ solvent }: { solvent: boolean }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: solvent ? '#10b981' : '#f43f5e' }}
      title={solvent ? 'Organizer wallet is funded' : 'Warning: organizer balance may be insufficient'}
    />
  );
}

export function PrizePoolPanel({
  campaignPubkey,
  delegationPda,
  organizer,
  prizeTotal,
  numWinners,
  isRecurring,
  periodLength,
}: Props) {
  const { delegation, loading: delLoading } = useDelegation(delegationPda, campaignPubkey);
  const { balance, loading: balLoading } = useOrganizerBalance(organizer);

  const cap = delegation?.cap ?? prizeTotal;
  const remaining = delegation?.remaining ?? prizeTotal;
  const isExpired = delegation?.isExpired ?? false;

  // Solvency: organizer balance >= committed cap
  let isSolvent = false;
  try {
    if (balance !== null) {
      isSolvent = balance >= BigInt(cap);
    }
  } catch { /* non-fatal */ }

  const perWinner = (() => {
    try {
      return (BigInt(cap) / BigInt(numWinners)).toString();
    } catch {
      return '0';
    }
  })();

  const explorerUrl = `https://explorer.solana.com/address/${delegationPda}?cluster=devnet`;

  return (
    <div className="rounded-xl border border-[#c3c6d7] bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[#0b1c30]">Prize Pool</h2>
          {isRecurring && periodLength && (
            <span className="rounded-full bg-[#eff4ff] px-2 py-0.5 font-mono text-xs font-medium text-[#2563eb]">
              {periodLabel(periodLength)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <SolvencyDot solvent={isSolvent} />
          <span className="font-mono text-xs text-[#434655]">
            {balLoading ? 'checking…' : isSolvent ? 'Solvent' : 'Underfunded'}
          </span>
        </div>
      </div>

      {/* Main numbers */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Committed" value={formatUsdc(cap)} loading={delLoading} />
        <Stat label="Remaining" value={formatUsdc(remaining)} loading={delLoading} />
        <Stat label="Per winner" value={formatUsdc(perWinner)} />
        <Stat
          label="Organizer balance"
          value={balance !== null ? formatUsdc(balance) : '—'}
          loading={balLoading}
          highlight={isSolvent ? 'green' : 'red'}
        />
      </div>

      {/* Expiry warning */}
      {isExpired && (
        <p className="mt-3 rounded-lg bg-[#ffdad6] px-3 py-2 text-sm text-[#93000a]">
          Delegation expired — organizer must renew before payout.
        </p>
      )}

      {/* Footer */}
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[#e5eeff] pt-3">
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-[#2563eb] underline underline-offset-2 hover:text-[#004ac6]"
        >
          Verify on Explorer ↗
        </a>
        <span className="font-mono text-xs text-[#737686]">
          Delegation PDA: {delegationPda.slice(0, 8)}…{delegationPda.slice(-4)}
        </span>
        <span className="font-mono text-xs text-[#737686]">
          {isRecurring ? 'RecurringDelegation' : 'FixedDelegation'} ·{' '}
          De1egAFM…vR44
        </span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
  highlight,
}: {
  label: string;
  value: string;
  loading?: boolean;
  highlight?: 'green' | 'red';
}) {
  const valueColor =
    highlight === 'green'
      ? 'text-[#10b981]'
      : highlight === 'red'
      ? 'text-[#f43f5e]'
      : 'text-[#0b1c30]';

  return (
    <div className="rounded-lg bg-[#f8f9ff] px-3 py-2">
      <p className="font-mono text-xs text-[#737686]">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${valueColor}`}>
        {loading ? <span className="animate-pulse">…</span> : value}
      </p>
    </div>
  );
}
