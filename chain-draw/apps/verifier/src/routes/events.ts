import { Router } from 'express';

export const eventsRouter = Router();

// GET /api/events — list all campaigns (UX cache; trust-critical data re-read from chain by client)
eventsRouter.get('/', async (_req, res) => {
  // TODO Phase 5: query on-chain campaigns + return merged list
  res.json({ events: [] });
});

// GET /api/events/:campaign — single campaign metadata
eventsRouter.get('/:campaign', async (req, res) => {
  const { campaign } = req.params;
  // TODO Phase 5: fetch from chain + local store
  res.json({ campaign });
});

// POST /api/events — store event metadata after on-chain init
eventsRouter.post('/', async (req, res) => {
  const { campaign, metadata } = req.body;
  if (!campaign || !metadata) {
    return res.status(400).json({ error: 'campaign and metadata required' });
  }
  // TODO Phase 2: persist to local store (SQLite/JSON)
  res.json({ ok: true, campaign });
});
