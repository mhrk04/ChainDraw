import { Router } from 'express';
import { runDrawAndPay } from '../lib/payout.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import path from 'path';

export const drawRouter = Router();

const DATA_DIR = path.join(process.cwd(), 'data');
const EVENTS_PATH = path.join(DATA_DIR, 'events.json');
const DRAWS_PATH = path.join(DATA_DIR, 'draws.json');

function loadEvents(): Record<string, any> {
  try {
    if (!existsSync(EVENTS_PATH)) return {};
    return JSON.parse(readFileSync(EVENTS_PATH, 'utf8'));
  } catch { return {}; }
}

function saveEvents(data: Record<string, any>) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(EVENTS_PATH, JSON.stringify(data, null, 2));
}

function loadDraws(): Record<string, any> {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(DRAWS_PATH)) writeFileSync(DRAWS_PATH, '{}');
    return JSON.parse(readFileSync(DRAWS_PATH, 'utf8'));
  } catch { return {}; }
}

function saveDraws(data: Record<string, any>) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DRAWS_PATH, JSON.stringify(data, null, 2));
}

// ─── Sign-in-with-Solana verification ─────────────────────────────────────
// Organizer signs a nonce with their wallet. We verify the signature matches
// the campaign.organizer pubkey before allowing the draw.

function verifySiwsSignature(
  organizer: string,
  nonce: string,
  signature: string
): boolean {
  try {
    const message = `ChainDraw draw authorization\nCampaign: ${nonce}\nOrganizer: ${organizer}`;
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = new PublicKey(organizer).toBytes();
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

// ─── POST /api/events/:campaign/draw ──────────────────────────────────────
//
// Auth: organizer signs nonce with Phantom (sign-in-with-Solana)
// Body: { signature: string, nonce: string }
//
// Flow:
//   1. Verify organizer signature
//   2. Check campaign status + cutoff
//   3. Call runDrawAndPay (draw_winners + transferFixed loop)
//   4. Update campaign status → Drawing/Settled
//   5. Return winners + tx links
//
// Idempotent: re-calling returns cached draw result if already drawn.
drawRouter.post('/:campaign/draw', async (req, res) => {
  const { campaign } = req.params;
  const { signature, nonce } = req.body as {
    signature?: string;
    nonce?: string;
  };

  // ── Load campaign ──
  const events = loadEvents();
  const event = events[campaign];
  if (!event) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  // ── Idempotency — return cached result if already drawn ──
  const draws = loadDraws();
  if (draws[campaign] && event.status === 'Settled') {
    return res.json({
      status: 'already_settled',
      ...draws[campaign],
    });
  }

  // ── Auth: verify organizer signature ──
  if (!signature || !nonce) {
    return res.status(400).json({
      error: 'signature and nonce required (sign-in-with-Solana)',
    });
  }

  const signatureValid = verifySiwsSignature(event.organizer, nonce, signature);
  if (!signatureValid) {
    // Dev bypass: allow draw without signature if SKIP_AUTH=true in env
    if (process.env.SKIP_AUTH !== 'true') {
      return res.status(401).json({
        error: 'Invalid organizer signature. Sign the nonce with your Phantom wallet.',
      });
    }
    console.warn('SKIP_AUTH=true — bypassing organizer signature check (dev only)');
  }

  // ── Check cutoff ──
  const now = Math.floor(Date.now() / 1000);
  if (now < event.cutoffTs) {
    const remaining = event.cutoffTs - now;
    return res.status(400).json({
      error: `Draw cannot run before cutoff. ${remaining}s remaining.`,
    });
  }

  // ── Check status ──
  if (event.status === 'Drawing') {
    return res.status(400).json({
      error: 'Draw already in progress. Check back shortly.',
    });
  }

  // ── Lock campaign as Drawing ──
  events[campaign].status = 'Drawing';
  saveEvents(events);

  // ── Run draw + pay ──
  try {
    const result = await runDrawAndPay({
      campaignPda: campaign,
      organizer: event.organizer,
      campaignId: BigInt(event.campaignId),
      delegationPda: event.delegationPda,
      organizerAta: event.organizerAta ?? 'EEJhNCzdMCCEFxPuUV5vc9sAxVWrn5W16FvAqJTHoiKT',
      prizeTotal: BigInt(event.prizeTotal),
      numWinners: event.numWinners,
      isRecurring: event.isRecurring ?? false,
    });

    // ── Update campaign status ──
    const eventsUpdated = loadEvents();
    eventsUpdated[campaign].status = result.campaignStatus;
    eventsUpdated[campaign].drawTxSignature = result.drawTxSignature;
    eventsUpdated[campaign].drawSeed = result.drawSeed;
    saveEvents(eventsUpdated);

    // ── Cache draw result ──
    const drawRecord = {
      campaign,
      drawTxSignature: result.drawTxSignature,
      drawSeed: result.drawSeed,
      winnerIndices: result.winnerIndices,
      payouts: result.payouts.map((p) => ({
        ...p,
        amount: p.amount.toString(), // bigint → string for JSON
        explorerUrl: p.txSignature
          ? `https://explorer.solana.com/tx/${p.txSignature}?cluster=devnet`
          : undefined,
      })),
      totalPaid: result.totalPaid,
      campaignStatus: result.campaignStatus,
      completedAt: Date.now(),
    };
    draws[campaign] = drawRecord;
    saveDraws(draws);

    return res.json({
      status: result.campaignStatus === 'Settled' ? 'settled' : 'partial',
      ...drawRecord,
      drawExplorerUrl: `https://explorer.solana.com/tx/${result.drawTxSignature}?cluster=devnet`,
    });
  } catch (e: any) {
    // Unlock campaign on error
    const eventsUpdated = loadEvents();
    if (eventsUpdated[campaign]) {
      eventsUpdated[campaign].status = 'Open';
      saveEvents(eventsUpdated);
    }
    console.error('Draw failed:', e.message);
    return res.status(500).json({
      error: `Draw failed: ${e.message}`,
    });
  }
});

// ─── GET /api/events/:campaign/draw ───────────────────────────────────────
// Public — get draw results (winners + tx links)
drawRouter.get('/:campaign/draw', (req, res) => {
  const { campaign } = req.params;
  const draws = loadDraws();
  const result = draws[campaign];

  if (!result) {
    return res.json({ status: 'not_drawn', winners: [] });
  }

  res.json({ status: 'settled', ...result });
});
