import { Router } from 'express';

export const joinRouter = Router();

// POST /api/events/:campaign/join
// Body: { handle: string, wallet: string }
// - verifies Mastodon engagement
// - writes add_verified_entry on-chain (verifier keypair pays gas)
// - participants sign NOTHING and pay NOTHING
joinRouter.post('/:campaign/join', async (req, res) => {
  const { campaign } = req.params;
  const { handle, wallet } = req.body;

  if (!handle || !wallet) {
    return res.status(400).json({ error: 'handle and wallet required' });
  }

  // TODO Phase 3: call mastodon.verifyEntry(handle, campaign requirements)
  // TODO Phase 3: on pass, call add_verified_entry on-chain with verifier keypair
  res.json({ status: 'pending', message: 'Mastodon verifier not yet wired (Phase 3)' });
});
