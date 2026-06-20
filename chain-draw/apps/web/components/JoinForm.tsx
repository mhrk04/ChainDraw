'use client';

import { useState, useEffect } from 'react';
import { VERIFIER_API } from '@/lib/constants';

interface Props {
  campaignPubkey: string;
  postUrl: string;
  cutoffTs: number;
  requireFollow?: boolean;
}

type VerifyStatus = 'idle' | 'verifying' | 'pending' | 'verified' | 'failed' | 'duplicate' | 'error';

interface RuleState {
  favourite: boolean | 'pending' | 'skipped';
  boost: boolean | 'pending' | 'skipped';
  follow: boolean | 'pending' | 'skipped';
}

export function JoinForm({ campaignPubkey, postUrl, cutoffTs, requireFollow }: Props) {
  const [handle, setHandle] = useState('');
  const [wallet, setWallet] = useState('');
  const [status, setStatus] = useState<VerifyStatus>('idle');
  const [message, setMessage] = useState('');
  const [rules, setRules] = useState<RuleState | null>(null);
  const [entryIndex, setEntryIndex] = useState<number | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isPast = Math.floor(Date.now() / 1000) >= cutoffTs;

  // Poll verify-status while pending
  useEffect(() => {
    if (status !== 'pending' || !handle) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `${VERIFIER_API}/api/events/${campaignPubkey}/verify-status?handle=${encodeURIComponent(handle)}`
        );
        const data = await res.json();
        if (data.rules) setRules(data.rules);
        if (data.status === 'ready_to_submit') {
          setStatus('idle');
          setMessage('All requirements met! Submit to enter.');
        }
      } catch { /* silent */ }
    }, 8000);
    return () => clearInterval(interval);
  }, [status, handle, campaignPubkey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!handle || !wallet) return;

    setLoading(true);
    setStatus('verifying');
    setMessage('Checking your Mastodon activity...');
    setRules(null);

    try {
      const res = await fetch(`${VERIFIER_API}/api/events/${campaignPubkey}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, wallet }),
      });

      const data = await res.json();
      if (data.rules) setRules(data.rules);

      if (res.status === 200 && data.status === 'verified') {
        setStatus('verified');
        setEntryIndex(data.entryIndex);
        setTxSig(data.txSignature);
        setMessage(data.message);
      } else if (res.status === 202) {
        setStatus('pending');
        setMessage(data.message);
      } else if (res.status === 409) {
        setStatus('duplicate');
        setMessage(data.message);
      } else if (res.status === 404) {
        setStatus('failed');
        setMessage(data.message ?? 'Handle not found on Mastodon.');
      } else {
        setStatus('error');
        setMessage(data.error ?? data.message ?? 'Verification failed.');
      }
    } catch (e: any) {
      setStatus('error');
      setMessage(`Network error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  if (isPast) return null;

  return (
    <div className="rounded-xl border p-6" style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}>
      <h2 className="text-lg font-semibold" style={{ color: '#0b1c30' }}>
        Enter Giveaway
      </h2>
      <p className="mt-1 text-sm" style={{ color: '#737686' }}>
        No wallet signature. No gas fees. Complete the Mastodon actions, then enter.
      </p>

      {/* Requirements links */}
      <div className="mt-4 space-y-2">
        {[
          { label: '1. Favourite the giveaway post', href: postUrl },
          { label: '2. Boost (repost) the giveaway post', href: postUrl },
          ...(requireFollow ? [{ label: '3. Follow the organizer account', href: postUrl }] : []),
        ].map((r) => (
          <a
            key={r.label}
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg px-4 py-2.5 text-sm transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#eff4ff', color: '#0b1c30' }}
          >
            <span>{r.label}</span>
            <span style={{ color: '#004ac6' }}>↗ Mastodon</span>
          </a>
        ))}
      </div>

      {/* Per-rule status */}
      {rules && (
        <div className="mt-4 flex gap-3">
          {Object.entries(rules).map(([rule, val]) => (
            <div
              key={rule}
              className="flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2"
              style={{
                backgroundColor:
                  val === true ? '#c3ffd5' : val === false ? '#ffdad6' : '#e5eeff',
              }}
            >
              <span className="text-lg">
                {val === true ? '✓' : val === false ? '✗' : '…'}
              </span>
              <span
                className="font-mono text-xs capitalize"
                style={{
                  color:
                    val === true ? '#006239' : val === false ? '#93000a' : '#003ea8',
                }}
              >
                {rule}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      {status !== 'verified' && status !== 'duplicate' && (
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: '#434655' }}>
              Mastodon handle
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@you@mastodon.social"
              required
              className="w-full rounded-lg px-4 py-3 text-sm outline-none focus:ring-2"
              style={{
                backgroundColor: '#f1f5f9',
                color: '#0b1c30',
                border: 'none',
                // @ts-ignore
                '--tw-ring-color': '#2563eb',
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: '#434655' }}>
              Prize wallet (Solana address)
            </label>
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="Your Solana wallet — prize sent here"
              required
              className="w-full rounded-lg px-4 py-3 font-mono text-sm outline-none focus:ring-2"
              style={{ backgroundColor: '#f1f5f9', color: '#0b1c30', border: 'none' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !handle || !wallet}
            className="w-full rounded-lg py-3 text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#004ac6', color: '#ffffff' }}
          >
            {loading ? 'Verifying on Mastodon…' : 'Verify & Enter'}
          </button>
        </form>
      )}

      {/* Status message */}
      {message && (
        <div
          className="mt-4 rounded-lg px-4 py-3 text-sm"
          style={{
            backgroundColor:
              status === 'verified' ? '#c3ffd5'
              : status === 'duplicate' ? '#e5eeff'
              : status === 'error' || status === 'failed' ? '#ffdad6'
              : '#e5eeff',
            color:
              status === 'verified' ? '#006239'
              : status === 'duplicate' ? '#003ea8'
              : status === 'error' || status === 'failed' ? '#93000a'
              : '#003ea8',
          }}
        >
          {status === 'verified' && entryIndex !== null && (
            <span className="font-semibold">✓ Verified! You are entry #{entryIndex}. </span>
          )}
          {message}
          {txSig && (
            <a
              href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 underline"
            >
              View tx ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}
