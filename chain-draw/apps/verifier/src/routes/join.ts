import { Router } from 'express';
import { verifyEntry } from '../lib/mastodon.js';
import { addVerifiedEntry } from '../lib/onchain.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

export const joinRouter = Router();

// ─── Pending verification store (federation lag support) ──────────────────────
// Tracks handles that are mid-verification so /verify-status can poll them.
const PENDING_PATH = path.join(process.cwd(), 'data', 'pending.json');

function loadPending(): Record<string, any> {
  try {
    mkdirSync(path.dirname(PENDING_PATH), { recursive: true });
    if (!existsSync(PENDING_PATH)) writeFileSync(PENDING_PATH, '{}');
    return JSON.parse(readFileSync(PENDING_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function savePending(data: Record<string, any>) {
  mkdirSync(path.dirname(PENDING_PATH), { recursive: true });
  writeFileSync(PENDING_PATH, JSON.stringify(data, null, 2));
}

function loadEvents(): Record<string, any> {
  const p = path.join(process.cwd(), 'data', 'events.json');
  try {
    if (!existsSync(p)) return {};
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

// ─── POST /api/events/:campaign/join ─────────────────────────────────────────
//
// Body: { handle: string, wallet: string }
//
// Flow:
//   1. Load campaign requirements from store
//   2. Verify handle on Mastodon (favourited_by, reblogged_by, followers)
//   3. On pass → write add_verified_entry on-chain (verifier pays gas)
//   4. On partial/pending → return "try again" with per-rule breakdown
//   5. On duplicate → return 409
//
// Participant signs NOTHING. Participant pays NOTHING.
joinRouter.post('/:campaign/join', async (req, res) => {
  const { campaign } = req.params;
  const { handle, wallet } = req.body as { handle?: string; wallet?: string };

  // ── Input validation ──
  if (!handle || !wallet) {
    return res.status(400).json({ error: 'handle and wallet are required' });
  }

  // Sanitise handle (strip leading @)
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

  // Basic wallet format check
  if (wallet.length < 32 || wallet.length > 44) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  // ── Load campaign requirements ──
  const events = loadEvents();
  const event = events[campaign];
  if (!event) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  if (event.status !== 'Open') {
    return res.status(400).json({ error: `Campaign is ${event.status} — entries closed` });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now >= event.cutoffTs) {
    return res.status(400).json({ error: 'Entry window has closed (past cutoff)' });
  }

  const requirements = {
    instance: event.instance,
    statusId: event.statusId,
    organizerMastodonId: event.organizerMastodonId ?? '',
    requireFavourite: true,
    requireBoost: true,
    requireFollow: !!event.organizerMastodonId,
  };

  // ── Track pending state ──
  const pendingKey = `${campaign}:${cleanHandle}`;
  const pending = loadPending();
  pending[pendingKey] = {
    handle: cleanHandle,
    wallet,
    campaign,
    startedAt: Date.now(),
    status: 'verifying',
    rules: { favourite: 'pending', boost: 'pending', follow: 'pending' },
  };
  savePending(pending);

  // ── Mastodon verification ──
  let verifyResult;
  try {
    verifyResult = await verifyEntry(cleanHandle, requirements);
  } catch (e: any) {
    pending[pendingKey].status = 'error';
    pending[pendingKey].error = e.message;
    savePending(pending);
    return res.status(502).json({
      status: 'error',
      message: `Mastodon verification failed: ${e.message}`,
    });
  }

  // Update pending with per-rule results
  pending[pendingKey].rules = verifyResult.rules;
  pending[pendingKey].accountId = verifyResult.accountId;

  // ── Handle not found ──
  if (!verifyResult.accountId) {
    pending[pendingKey].status = 'failed';
    savePending(pending);
    return res.status(404).json({
      status: 'failed',
      message: verifyResult.error ?? `@${cleanHandle} not found on ${requirements.instance}`,
      rules: verifyResult.rules,
    });
  }

  // ── Rules not all passed ──
  if (!verifyResult.pass) {
    pending[pendingKey].status = 'pending';
    savePending(pending);

    const missing = Object.entries(verifyResult.rules)
      .filter(([, v]) => v === false)
      .map(([k]) => k);

    return res.status(202).json({
      status: 'pending',
      message: `Not all requirements met yet. Missing: ${missing.join(', ')}. Complete the actions on Mastodon and try again.`,
      rules: verifyResult.rules,
    });
  }

  // ── All rules passed → write entry on-chain ──
  try {
    const { entryIndex, txSignature } = await addVerifiedEntry({
      campaignPda: campaign,
      organizer: event.organizer,
      campaignId: BigInt(event.campaignId),
      participantWallet: wallet,
      mastodonHandle: cleanHandle,
    });

    pending[pendingKey].status = 'verified';
    pending[pendingKey].entryIndex = entryIndex;
    pending[pendingKey].txSignature = txSignature;
    savePending(pending);

    return res.status(200).json({
      status: 'verified',
      message: `Verified ✓ — you are entry #${entryIndex}`,
      entryIndex,
      txSignature,
      explorerUrl: `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`,
      rules: verifyResult.rules,
    });
  } catch (e: any) {
    if (e.message === 'DUPLICATE_HANDLE') {
      pending[pendingKey].status = 'duplicate';
      savePending(pending);
      return res.status(409).json({
        status: 'duplicate',
        message: 'This Mastodon handle has already entered this giveaway.',
      });
    }

    pending[pendingKey].status = 'error';
    pending[pendingKey].error = e.message;
    savePending(pending);
    return res.status(500).json({
      status: 'error',
      message: `On-chain write failed: ${e.message}`,
    });
  }
});
