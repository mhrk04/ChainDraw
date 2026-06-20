import 'dotenv/config';
import express from 'express';
import { joinRouter } from './routes/join.js';
import { verifyStatusRouter } from './routes/verifyStatus.js';
import { drawRouter } from './routes/draw.js';
import { eventsRouter } from './routes/events.js';

const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/events', eventsRouter);
app.use('/api/events', joinRouter);
app.use('/api/events', verifyStatusRouter);
app.use('/api/events', drawRouter);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`ChainDraw verifier running on http://localhost:${PORT}`);
});
