import { Router } from 'express';
import { verifyEntry } from '../lib/mastodon.js';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export const verifyStatusRouter = Router();

function loadPending(): Record<string, any> {
  const p = path.join(process.cwd(), 'data', 'pending.json');
  try {
    if (!existsSync(p)) return {};
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
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

// ─── GET /api/events/:campaign/verify-status?handle=user@instance ─────────────
//
// Polls current per-rule verification status for a handle.
// If status is 'verified', returns entryIndex + txSignature.
// If status is 'pending', re-checks Mastodon (handles federation lag).
// Frontend polls this every 10s after submitting the join form.
verifyStatusRouter.get('/:campaign/verify-status', async (req, res) => {
  const { campaign } = req.params;
  const handle = req.query.handle as string | undefined;

  if (!handle) {
    return res.status(400).json({ error: 'handle query param required' });
  }

  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
  const pendingKey = `${campaign}:${cleanHandle}`;
  const pending = loadPending();
  const entry = pending[pendingKey];

  // ── Already verified or failed — return cached result ──
  if (!entry || entry.status === 'verified' || entry.status === 'failed' || entry.status === 'duplicate') {
    if (!entry) {
      return res.json({
        status: 'not_started',
        message: 'No verification attempt found. Submit the join form first.',
      });
    }
    return res.json({
      status: entry.status,
      rules: entry.rules,
      entryIndex: entry.entryIndex,
      txSignature: entry.txSignature,
      explorerUrl: entry.txSignature
        ? `https://explorer.solana.com/tx/${entry.txSignature}?cluster=devnet`
        : undefined,
    });
  }

  // ── Status is 'pending' — re-check Mastodon (federation lag retry) ──
  const events = loadEvents();
  const event = events[campaign];
  if (!event) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  try {
    const result = await verifyEntry(cleanHandle, {
      instance: event.instance,
      statusId: event.statusId,
      organizerMastodonId: event.organizerMastodonId ?? '',
      requireFavourite: true,
      requireBoost: true,
      requireFollow: !!event.organizerMastodonId,
    });

    return res.json({
      status: result.pass ? 'ready_to_submit' : 'pending',
      message: result.pass
        ? 'All requirements met! Submit the join form to enter.'
        : 'Still waiting — complete the Mastodon actions and try again shortly.',
      rules: result.rules,
      accountId: result.accountId,
    });
  } catch (e: any) {
    return res.status(502).json({
      status: 'error',
      message: `Mastodon check failed: ${e.message}`,
    });
  }
});
