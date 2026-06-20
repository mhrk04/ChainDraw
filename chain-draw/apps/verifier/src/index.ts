import 'dotenv/config';
import express from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cors = require('cors') as (opts?: any) => any;
import { joinRouter } from './routes/join.js';
import { verifyStatusRouter } from './routes/verifyStatus.js';
import { drawRouter } from './routes/draw.js';
import { eventsRouter } from './routes/events.js';
import { campaignsRouter } from './routes/campaigns.js';

const app = express();
app.use(express.json());
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'] }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/events', eventsRouter);
app.use('/api/events', joinRouter);
app.use('/api/events', verifyStatusRouter);
app.use('/api/events', drawRouter);
app.use('/api/campaigns', campaignsRouter);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`ChainDraw verifier running on http://localhost:${PORT}`);
});
