import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { initializeDatabase } from './db/connection.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { logActivity } from './middleware/activity.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
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
const PORT = Number(process.env.PORT) || 8001;

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
app.use('/api', requireAuth, logActivity);
app.use('/api/funds', fundsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/distributions', distributionsRouter);
app.use('/api/cash', cashRouter);
app.use('/api/buckets', bucketsRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/import', importRouter);
app.use('/api/snapshots', snapshotsRouter);
app.use('/api/export', exportRouter);
app.use('/api/performance', performanceRouter);
app.use('/api/admin', requireAdmin, adminRouter);

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Portfolio Tracker API running on http://localhost:${PORT}`);
  });
}

export default app;
