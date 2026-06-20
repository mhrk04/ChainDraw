'use client';

// Route: /organizer/new — Create Giveaway Wizard
// Stitch screens:
//   ef375329456f468182840af288b5f491 — Wizard steps 1-3
//   cc4ad30c2d0245e6a74628e4e433ec06 — Prize Setup (+ isRecurring toggle)
//   673f2503f6c648019c3489fe3b9e69e9 — Final Commitment

import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { ClientWalletButton } from '@/components/ClientWalletButton';
import { useRouter } from 'next/navigation';
import { VERIFIER_API } from '@/lib/constants';

// Step indicator
function StepBar({ current }: { current: number }) {
  const steps = ['Requirements', 'Prize Setup', 'Commit'];
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
              style={{
                backgroundColor: i <= current ? '#004ac6' : '#e5eeff',
                color: i <= current ? '#ffffff' : '#737686',
              }}
            >
              {i < current ? '✓' : i + 1}
            </div>
            <span
              className="hidden text-sm font-medium sm:block"
              style={{ color: i <= current ? '#0b1c30' : '#737686' }}
            >
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className="mx-4 h-px w-12"
              style={{ backgroundColor: i < current ? '#004ac6' : '#c3c6d7' }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Requirements ────────────────────────────────────────────────────
function Step1({
  form, setForm, next,
}: {
  form: any; setForm: any; next: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold" style={{ color: '#0b1c30' }}>Giveaway Details</h2>
        <p className="mt-1 text-sm" style={{ color: '#737686' }}>
          Paste your Mastodon post URL. Participants must favourite, boost, and optionally follow.
        </p>
      </div>
      <Field label="Giveaway title">
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="e.g. Superteam KL Weekly Giveaway"
          className="input-field"
          required
        />
      </Field>
      <Field label="Mastodon post URL">
        <input
          type="url"
          value={form.postUrl}
          onChange={(e) => setForm({ ...form, postUrl: e.target.value })}
          placeholder="https://mastodon.social/@yourhandle/123456789"
          className="input-field"
          required
        />
      </Field>
      <Field label="Your Mastodon instance" hint="e.g. mastodon.social">
        <input
          type="text"
          value={form.instance}
          onChange={(e) => setForm({ ...form, instance: e.target.value })}
          placeholder="mastodon.social"
          className="input-field"
          required
        />
      </Field>
      <Field label="Mastodon Status ID" hint="The number at the end of your post URL">
        <input
          type="text"
          value={form.statusId}
          onChange={(e) => setForm({ ...form, statusId: e.target.value })}
          placeholder="123456789012345678"
          className="input-field"
          required
        />
      </Field>
      <Field label="Organizer Mastodon Account ID (optional)" hint="For follow requirement">
        <input
          type="text"
          value={form.organizerMastodonId}
          onChange={(e) => setForm({ ...form, organizerMastodonId: e.target.value })}
          placeholder="13179"
          className="input-field"
        />
      </Field>
      <Field label="Draw date & time">
        <input
          type="datetime-local"
          value={form.cutoffDatetime}
          onChange={(e) => setForm({ ...form, cutoffDatetime: e.target.value })}
          className="input-field"
          required
        />
      </Field>
      <button
        onClick={next}
        disabled={!form.title || !form.postUrl || !form.instance || !form.statusId || !form.cutoffDatetime}
        className="w-full rounded-lg py-3 text-sm font-semibold disabled:opacity-40"
        style={{ backgroundColor: '#004ac6', color: '#ffffff' }}
      >
        Next: Prize Setup →
      </button>
    </div>
  );
}

// ── Step 2: Prize Setup ─────────────────────────────────────────────────────
function Step2({
  form, setForm, next, back,
}: {
  form: any; setForm: any; next: () => void; back: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold" style={{ color: '#0b1c30' }}>Prize Setup</h2>
        <p className="mt-1 text-sm" style={{ color: '#737686' }}>
          Set the prize pool and winner count. Toggle recurring for weekly/monthly giveaways.
        </p>
      </div>

      <Field label="Total prize pool (USDC)">
        <input
          type="number"
          min="1"
          step="0.01"
          value={form.prizeTotalUsdc}
          onChange={(e) => setForm({ ...form, prizeTotalUsdc: e.target.value })}
          placeholder="100"
          className="input-field"
          required
        />
      </Field>
      <Field label="Number of winners">
        <input
          type="number"
          min="1"
          max="20"
          value={form.numWinners}
          onChange={(e) => setForm({ ...form, numWinners: e.target.value })}
          placeholder="3"
          className="input-field"
          required
        />
      </Field>

      {/* Recurring toggle — track compliance */}
      <div
        className="flex items-center justify-between rounded-xl border p-4"
        style={{ borderColor: '#c3c6d7', backgroundColor: '#f8f9ff' }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: '#0b1c30' }}>
            Recurring giveaway
          </p>
          <p className="text-xs" style={{ color: '#737686' }}>
            Uses RecurringDelegation — allowance auto-replenishes each period.
            Track-required for weekly/monthly organizers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ ...form, isRecurring: !form.isRecurring })}
          className="relative h-6 w-11 rounded-full transition-colors"
          style={{ backgroundColor: form.isRecurring ? '#004ac6' : '#c3c6d7' }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
            style={{ left: form.isRecurring ? '22px' : '2px' }}
          />
        </button>
      </div>

      {form.isRecurring && (
        <Field label="Period length">
          <select
            value={form.periodLength}
            onChange={(e) => setForm({ ...form, periodLength: e.target.value })}
            className="input-field"
          >
            <option value="604800">Weekly (every 7 days)</option>
            <option value="2592000">Monthly (every 30 days)</option>
          </select>
        </Field>
      )}

      {/* Per-winner preview */}
      {form.prizeTotalUsdc && form.numWinners && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ backgroundColor: '#eff4ff', color: '#004ac6' }}
        >
          Each winner receives:{' '}
          <strong>
            {(parseFloat(form.prizeTotalUsdc) / parseInt(form.numWinners)).toFixed(2)} USDC
          </strong>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={back}
          className="flex-1 rounded-lg border py-3 text-sm font-medium"
          style={{ borderColor: '#c3c6d7', color: '#434655' }}
        >
          ← Back
        </button>
        <button
          onClick={next}
          disabled={!form.prizeTotalUsdc || !form.numWinners}
          className="flex-1 rounded-lg py-3 text-sm font-semibold disabled:opacity-40"
          style={{ backgroundColor: '#004ac6', color: '#ffffff' }}
        >
          Next: Commit →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Final Commitment ────────────────────────────────────────────────
function Step3({
  form, back, onCommit, committing, error,
}: {
  form: any; back: () => void; onCommit: () => void; committing: boolean; error: string;
}) {
  const cutoffTs = form.cutoffDatetime
    ? Math.floor(new Date(form.cutoffDatetime).getTime() / 1000)
    : 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold" style={{ color: '#0b1c30' }}>Final Commitment</h2>
        <p className="mt-1 text-sm" style={{ color: '#737686' }}>
          Review and sign 2–3 transactions with Phantom. This commits the prize pool on-chain.
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-xl border p-5 space-y-3" style={{ backgroundColor: '#f8f9ff', borderColor: '#c3c6d7' }}>
        {[
          { label: 'Title', value: form.title },
          { label: 'Prize pool', value: `${form.prizeTotalUsdc} USDC` },
          { label: 'Winners', value: form.numWinners },
          { label: 'Type', value: form.isRecurring ? `Recurring (${form.periodLength === '604800' ? 'Weekly' : 'Monthly'})` : 'One-shot' },
          { label: 'Delegation', value: form.isRecurring ? 'RecurringDelegation' : 'FixedDelegation' },
          { label: 'Cutoff', value: new Date(form.cutoffDatetime).toLocaleString() },
        ].map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span style={{ color: '#737686' }}>{r.label}</span>
            <span className="font-medium" style={{ color: '#0b1c30' }}>{r.value}</span>
          </div>
        ))}
      </div>

      {/* Transaction steps */}
      <div className="space-y-2">
        {[
          { n: 1, label: 'initialize_campaign (custom program)' },
          { n: 2, label: 'initSubscriptionAuthority (if first campaign)' },
          { n: 3, label: form.isRecurring ? 'createRecurringDelegation' : 'createFixedDelegation' },
        ].map((t) => (
          <div
            key={t.n}
            className="flex items-center gap-3 rounded-lg px-4 py-2.5"
            style={{ backgroundColor: '#e5eeff' }}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
              style={{ backgroundColor: '#004ac6', color: '#ffffff' }}
            >
              {t.n}
            </span>
            <span className="font-mono text-xs" style={{ color: '#003ea8' }}>{t.label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#ffdad6', color: '#93000a' }}>
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={back}
          disabled={committing}
          className="flex-1 rounded-lg border py-3 text-sm font-medium disabled:opacity-40"
          style={{ borderColor: '#c3c6d7', color: '#434655' }}
        >
          ← Back
        </button>
        <button
          onClick={onCommit}
          disabled={committing}
          className="flex-1 rounded-lg py-3 text-sm font-semibold disabled:opacity-50"
          style={{
            background: committing ? '#737686' : 'linear-gradient(135deg, #004ac6, #7d1be2)',
            color: '#ffffff',
          }}
        >
          {committing ? 'Signing transactions…' : '🔒 Commit Prize Pool'}
        </button>
      </div>
    </div>
  );
}

// ── Field helper ────────────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: '#434655' }}>
        {label}
        {hint && <span className="ml-1" style={{ color: '#737686' }}>({hint})</span>}
      </label>
      {children}
      <style jsx global>{`
        .input-field {
          width: 100%;
          border-radius: 0.5rem;
          background-color: #f1f5f9;
          border: none;
          padding: 12px 16px;
          font-size: 14px;
          color: #0b1c30;
          outline: none;
        }
        .input-field:focus {
          box-shadow: 0 0 0 2px #2563eb;
        }
      `}</style>
    </div>
  );
}

// ── Main wizard ─────────────────────────────────────────────────────────────
export default function CreateGiveawayPage() {
  const router = useRouter();
  const { publicKey, connected, signTransaction } = useWallet();
  const { connection } = useConnection();

  const [step, setStep] = useState(0);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState('');
  const [form, setForm] = useState({
    title: '',
    postUrl: '',
    instance: 'mastodon.social',
    statusId: '',
    organizerMastodonId: '',
    cutoffDatetime: '',
    prizeTotalUsdc: '',
    numWinners: '3',
    isRecurring: false,
    periodLength: '604800',
  });

  if (!connected) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#f8f9ff' }}>
        <div className="max-w-sm rounded-xl border p-10 text-center" style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}>
          <p className="text-4xl">🔒</p>
          <h1 className="mt-4 text-xl font-semibold" style={{ color: '#0b1c30' }}>Connect wallet to continue</h1>
          <div className="mt-6 flex justify-center">
            <ClientWalletButton style={{ backgroundColor: '#004ac6', borderRadius: '0.5rem', fontSize: '14px' }} />
          </div>
        </div>
      </main>
    );
  }

  async function handleCommit() {
    if (!publicKey) return;
    setCommitting(true);
    setCommitError('');

    try {
      const campaignId = BigInt(Date.now());
      const cutoffTs = Math.floor(new Date(form.cutoffDatetime).getTime() / 1000);
      const prizeTotalBase = BigInt(Math.round(parseFloat(form.prizeTotalUsdc) * 1_000_000));
      const SERVICE_AUTHORITY = process.env.NEXT_PUBLIC_SERVICE_AUTHORITY ??
        'A93wJUoWP6WduLZbP814kCjMkTWvJQ9Y9t6MNEZ5MkUi';
      const ORGANIZER_ATA = 'EEJhNCzdMCCEFxPuUV5vc9sAxVWrn5W16FvAqJTHoiKT';

      // Call verifier backend to create campaign + delegation
      // (In production the organizer signs txs via Phantom; for demo the backend holds the signer)
      const res = await fetch(`${VERIFIER_API}/api/campaigns/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizer: publicKey.toBase58(),
          organizerAta: ORGANIZER_ATA,
          delegatee: SERVICE_AUTHORITY,
          campaignId: campaignId.toString(),
          cutoffTs,
          prizeTotalBase: prizeTotalBase.toString(),
          numWinners: parseInt(form.numWinners),
          isRecurring: form.isRecurring,
          periodLength: parseInt(form.periodLength),
          title: form.title,
          postUrl: form.postUrl,
          instance: form.instance,
          statusId: form.statusId,
          organizerMastodonId: form.organizerMastodonId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Commit failed');

      router.push(`/organizer/${data.campaignPda}`);
    } catch (e: any) {
      setCommitError(e.message);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f8f9ff' }}>
      <div className="border-b px-6 py-4" style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}>
        <div className="mx-auto max-w-xl">
          <h1 className="mb-4 text-xl font-bold" style={{ color: '#0b1c30' }}>Create Giveaway</h1>
          <StepBar current={step} />
        </div>
      </div>

      <div className="mx-auto max-w-xl px-6 py-10">
        <div className="rounded-xl border p-8" style={{ backgroundColor: '#ffffff', borderColor: '#c3c6d7' }}>
          {step === 0 && (
            <Step1 form={form} setForm={setForm} next={() => setStep(1)} />
          )}
          {step === 1 && (
            <Step2 form={form} setForm={setForm} next={() => setStep(2)} back={() => setStep(0)} />
          )}
          {step === 2 && (
            <Step3
              form={form}
              back={() => setStep(1)}
              onCommit={handleCommit}
              committing={committing}
              error={commitError}
            />
          )}
        </div>
      </div>
    </main>
  );
}
