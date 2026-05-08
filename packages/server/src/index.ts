import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { initializeDatabase } from './db/connection.js';
import { requireAuth } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import fundsRouter from './routes/funds.js';
import transactionsRouter from './routes/transactions.js';
import distributionsRouter from './routes/distributions.js';
import cashRouter from './routes/cash.js';
import bucketsRouter from './routes/buckets.js';
import profilesRouter from './routes/profiles.js';
import pricesRouter from './routes/prices.js';
import portfolioRouter from './routes/portfolio.js';
import importRouter from './routes/import.js';
import snapshotsRouter from './routes/snapshots.js';
import exportRouter from './routes/export.js';
import performanceRouter from './routes/performance.js';

const app = express();
const PORT = 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Initialize DB on startup
initializeDatabase();
console.log('Database initialized');

// Public routes (no auth required)
app.use('/api/auth', authRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected routes (require authentication)
app.use('/api/funds', requireAuth, fundsRouter);
app.use('/api/transactions', requireAuth, transactionsRouter);
app.use('/api/distributions', requireAuth, distributionsRouter);
app.use('/api/cash', requireAuth, cashRouter);
app.use('/api/buckets', requireAuth, bucketsRouter);
app.use('/api/profiles', requireAuth, profilesRouter);
app.use('/api/prices', requireAuth, pricesRouter);
app.use('/api/portfolio', requireAuth, portfolioRouter);
app.use('/api/import', requireAuth, importRouter);
app.use('/api/snapshots', requireAuth, snapshotsRouter);
app.use('/api/export', requireAuth, exportRouter);
app.use('/api/performance', requireAuth, performanceRouter);

app.listen(PORT, () => {
  console.log(`Portfolio Tracker API running on http://localhost:${PORT}`);
});
