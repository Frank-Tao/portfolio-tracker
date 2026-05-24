import { Router } from 'express';
import db from '../db/connection.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { fund_id, from, to, type } = req.query;
  let sql = `
    SELECT t.*, f.ticker
    FROM transactions t
    JOIN funds f ON t.fund_id = f.id AND f.user_id = t.user_id
    WHERE t.user_id = ?
  `;
  const params: any[] = [userId];

  if (fund_id) {
    sql += ' AND t.fund_id = ?';
    params.push(fund_id);
  }
  if (from) {
    sql += ' AND t.date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND t.date <= ?';
    params.push(to);
  }
  if (type) {
    sql += ' AND t.type = ?';
    params.push(type);
  }

  sql += ' ORDER BY t.date DESC';
  const transactions = db.prepare(sql).all(...params);
  res.json(transactions);
});

router.post('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { fund_id, date, type, quantity, price, amount, notes } = req.body;

  if (!fund_id || !date || !type || quantity == null || price == null) {
    return res.status(400).json({ error: 'fund_id, date, type, quantity, and price are required' });
  }

  const fund = db.prepare('SELECT id FROM funds WHERE id = ? AND user_id = ?').get(fund_id, userId) as any;
  if (!fund) {
    return res.status(400).json({ error: 'fund_id is invalid' });
  }

  const calculatedAmount = amount ?? quantity * price;

  const result = db.prepare(`
    INSERT INTO transactions (user_id, fund_id, date, type, quantity, price, amount, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, fund_id, date, type, Math.abs(quantity), price, calculatedAmount, notes ?? null);

  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, userId);
  res.status(201).json(transaction);
});

router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.status(204).end();
});

export default router;
