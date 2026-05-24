import { Router } from 'express';
import db from '../db/connection.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/refresh', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  try {
    const { refreshPrices } = await import('../services/price-fetcher.js');
    const result = await refreshPrices(userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/refresh/historical', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  try {
    const { refreshHistoricalMonthEnd } = await import('../services/price-fetcher.js');
    const result = await refreshHistoricalMonthEnd(userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/manual', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { ticker, price, date } = req.body;
  if (!ticker || price == null) {
    return res.status(400).json({ error: 'ticker and price are required' });
  }
  try {
    const { manualPriceUpdate } = await import('../services/price-fetcher.js');
    await manualPriceUpdate(userId, ticker, price, date);
    res.json({ ok: true, ticker, price, date: date || new Date().toISOString().split('T')[0] });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/manual/bulk', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { prices } = req.body;
  if (!Array.isArray(prices)) {
    return res.status(400).json({ error: 'prices array is required' });
  }

  const date = new Date().toISOString().split('T')[0];
  const insert = db.prepare(`
    INSERT OR REPLACE INTO price_history (user_id, fund_id, date, price, source)
    VALUES (?, (SELECT id FROM funds WHERE ticker = ? AND user_id = ?), ?, ?, 'manual')
  `);

  const results: any[] = [];
  for (const { ticker, price } of prices) {
    try {
      insert.run(userId, ticker.toUpperCase(), userId, date, price);
      results.push({ ticker, price, ok: true });
    } catch (err: any) {
      results.push({ ticker, error: err.message });
    }
  }
  res.json({ date, results });
});

router.get('/latest', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const prices = db.prepare(`
    SELECT ph.*, f.ticker
    FROM price_history ph
    JOIN funds f ON ph.fund_id = f.id AND f.user_id = ph.user_id
    WHERE ph.user_id = ?
      AND ph.date = (
      SELECT MAX(ph2.date) FROM price_history ph2 WHERE ph2.user_id = ph.user_id AND ph2.fund_id = ph.fund_id
    )
    ORDER BY f.ticker
  `).all(userId);
  res.json(prices);
});

router.get('/coverage', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const funds = db.prepare('SELECT id, ticker FROM funds WHERE user_id = ?').all(userId) as any[];
  const coverage = funds.map(f => {
    const stats = db.prepare(`
      SELECT MIN(date) as first_date, MAX(date) as last_date, COUNT(*) as count
      FROM price_history WHERE user_id = ? AND fund_id = ?
    `).get(userId, f.id) as any;

    const monthEndCount = db.prepare(`
      SELECT COUNT(*) as count FROM price_history
      WHERE user_id = ? AND fund_id = ? AND source IN ('yahoo-historical', 'excel')
    `).get(userId, f.id) as any;

    return {
      ticker: f.ticker,
      first_date: stats.first_date,
      last_date: stats.last_date,
      total_records: stats.count,
      month_end_records: monthEndCount.count,
    };
  });
  res.json(coverage);
});

router.get('/:ticker', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const fund = db.prepare('SELECT id FROM funds WHERE ticker = ? AND user_id = ?').get(req.params.ticker.toUpperCase(), userId) as any;
  if (!fund) return res.status(404).json({ error: 'Fund not found' });

  const prices = db.prepare(`
    SELECT * FROM price_history
    WHERE user_id = ? AND fund_id = ?
    ORDER BY date DESC
    LIMIT 100
  `).all(userId, fund.id);
  res.json(prices);
});

export default router;
