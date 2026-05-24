import { Router } from 'express';
import db from '../db/connection.js';
import type { CashSummary } from '@portfolio/shared';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { type, from, to } = req.query;

  let sql = `
    SELECT cm.*, f.ticker
    FROM cash_movements cm
    LEFT JOIN funds f ON cm.related_fund_id = f.id AND f.user_id = cm.user_id
    WHERE cm.user_id = ?
  `;
  const params: any[] = [userId];

  if (type) { sql += ' AND cm.type = ?'; params.push(type); }
  if (from) { sql += ' AND cm.date >= ?'; params.push(from); }
  if (to) { sql += ' AND cm.date <= ?'; params.push(to); }
  sql += ' ORDER BY cm.date DESC';

  const movements = db.prepare(sql).all(...params) as any[];

  const balance = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM cash_movements WHERE user_id = ?').get(userId) as any;

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposits,
      COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN ABS(amount) ELSE 0 END), 0) as total_withdrawals,
      COALESCE(SUM(CASE WHEN type = 'dividend' THEN amount ELSE 0 END), 0) as total_dividends,
      COALESCE(SUM(CASE WHEN type = 'buy' THEN ABS(amount) ELSE 0 END), 0) as total_buys,
      COALESCE(SUM(CASE WHEN type = 'sell' THEN amount ELSE 0 END), 0) as total_sells
    FROM cash_movements
    WHERE user_id = ?
  `).get(userId) as any;

  const summary: CashSummary = {
    balance: balance.total,
    total_deposits: totals.total_deposits,
    total_withdrawals: totals.total_withdrawals,
    total_dividends: totals.total_dividends,
    total_buys: totals.total_buys,
    total_sells: totals.total_sells,
    movements: movements.map(m => ({ ...m, ticker: m.ticker ?? undefined })),
  };

  res.json(summary);
});

router.post('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { date, type, amount, notes } = req.body;

  if (!date || amount == null) {
    return res.status(400).json({ error: 'date and amount are required' });
  }

  const movementType = type || (amount >= 0 ? 'deposit' : 'withdrawal');

  const result = db.prepare(`
    INSERT INTO cash_movements (user_id, date, type, amount, notes, related_fund_id)
    VALUES (?, ?, ?, ?, ?, NULL)
  `).run(userId, date, movementType, amount, notes ?? null);

  const movement = db.prepare('SELECT * FROM cash_movements WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, userId);
  res.status(201).json(movement);
});

router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  db.prepare('DELETE FROM cash_movements WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.status(204).end();
});

export default router;
