import { Router } from 'express';
import { readDelegation } from '../lib/delegation.js';
import { address } from '@solana/kit';
import fs from 'fs';
import path from 'path';

export const eventsRouter = Router();

// ─── Simple JSON store (replace with SQLite/Prisma for production) ────────────
const STORE_PATH = path.join(process.cwd(), 'data', 'events.json');

function loadStore(): Record<string, any> {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, '{}');
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveStore(data: Record<string, any>) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

// ─── GET /api/events ──────────────────────────────────────────────────────────
// Public — list all campaigns (UX cache; trust-critical numbers re-read from chain by client)
eventsRouter.get('/', (_req, res) => {
  const store = loadStore();
  const events = Object.values(store);
  res.json({ events });
});

// ─── GET /api/events/:campaign ────────────────────────────────────────────────
// Public — single campaign metadata + live delegation info
eventsRouter.get('/:campaign', async (req, res) => {
  const { campaign } = req.params;
  const store = loadStore();
  const event = store[campaign];

  if (!event) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  // Enrich with live delegation data from chain
  let delegationInfo = null;
  if (event.delegationPda) {
    try {
      delegationInfo = await readDelegation(address(event.delegationPda));
    } catch {
      // Non-fatal — UI falls back to stored cap
    }
  }

  res.json({ ...event, delegationInfo });
});

// ─── POST /api/events ─────────────────────────────────────────────────────────
// Organizer stores event metadata after on-chain initialize_campaign tx
// Body: {
//   campaign: string          — campaign PDA pubkey
//   campaignId: string        — campaign_id (u64 as string)
//   organizer: string         — organizer wallet
//   delegationPda: string     — Fixed or Recurring delegation PDA
//   isRecurring: boolean
//   periodLength: number      — seconds (0 if one-shot)
//   prizeTotal: string        — base units
//   numWinners: number
//   cutoffTs: number          — unix timestamp
//   requirementsUri: string   — Mastodon post URL
//   postUrl: string           — direct link to Mastodon post for participants
//   instance: string          — e.g. "mastodon.social"
//   statusId: string          — Mastodon status ID for favourited_by/reblogged_by
//   organizerMastodonId: string — for followers check
//   title: string
//   description: string
// }
eventsRouter.post('/', (req, res) => {
  const required = [
    'campaign', 'campaignId', 'organizer', 'delegationPda',
    'prizeTotal', 'numWinners', 'cutoffTs', 'requirementsUri',
    'postUrl', 'instance', 'statusId', 'title',
  ];

  for (const field of required) {
    if (!req.body[field]) {
      return res.status(400).json({ error: `Missing field: ${field}` });
    }
  }

  const store = loadStore();
  const campaign = req.body.campaign as string;

  store[campaign] = {
    ...req.body,
    createdAt: Date.now(),
    status: 'Open',
  };

  saveStore(store);
  console.log('Campaign registered:', campaign, '| recurring:', req.body.isRecurring);
  res.json({ ok: true, campaign });
});

// ─── PATCH /api/events/:campaign ─────────────────────────────────────────────
// Internal — update status (Drawing → Settled) after draw completes
eventsRouter.patch('/:campaign', (req, res) => {
  const { campaign } = req.params;
  const store = loadStore();
  if (!store[campaign]) return res.status(404).json({ error: 'Not found' });

  store[campaign] = { ...store[campaign], ...req.body };
  saveStore(store);
  res.json({ ok: true });
});
