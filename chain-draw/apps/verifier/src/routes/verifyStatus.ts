import { Router } from 'express';

export const verifyStatusRouter = Router();

// GET /api/events/:campaign/verify-status?handle=user@instance
// Polls Mastodon again and returns current per-rule pass/fail breakdown
verifyStatusRouter.get('/:campaign/verify-status', async (req, res) => {
  const { campaign } = req.params;
  const { handle } = req.query;

  if (!handle) {
    return res.status(400).json({ error: 'handle query param required' });
  }

  // TODO Phase 3: re-check Mastodon endpoints and return per-rule status
  res.json({
    campaign,
    handle,
    rules: {
      favourite: 'pending',
      boost: 'pending',
      follow: 'pending',
    },
    overall: 'pending',
  });
});
