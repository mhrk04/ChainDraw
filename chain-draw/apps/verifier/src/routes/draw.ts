import { Router } from 'express';

export const drawRouter = Router();

// POST /api/events/:campaign/draw
// Auth: organizer must sign a nonce (sign-in-with-Solana)
// - calls draw_winners on-chain
// - loops transferFixed per winner (delegatee keypair pays)
// - idempotent on entry.paid
drawRouter.post('/:campaign/draw', async (req, res) => {
  const { campaign } = req.params;
  const { signature, nonce } = req.body;

  if (!signature || !nonce) {
    return res.status(400).json({ error: 'signature and nonce required (sign-in-with-Solana)' });
  }

  // TODO Phase 4: verify organizer signature == campaign.organizer
  // TODO Phase 4: call draw_winners instruction
  // TODO Phase 4: loop transferFixed per winner with delegatee keypair
  res.json({ status: 'pending', message: 'Draw not yet implemented (Phase 4)' });
});
