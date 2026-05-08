import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

router.get('/', (req, res) => {
  const { fund_id, from, to, type } = req.query;
  let sql = `
    SELECT t.*, f.ticker
    FROM transactions t
    JOIN funds f ON t.fund_id = f.id
    WHERE 1=1
  `;
  const params: any[] = [];

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

router.post('/', (req, res) => {
  const { fund_id, date, type, quantity, price, amount, notes } = req.body;

  if (!fund_id || !date || !type || quantity == null || price == null) {
    return res.status(400).json({ error: 'fund_id, date, type, quantity, and price are required' });
  }

  const calculatedAmount = amount ?? quantity * price;

  const result = db.prepare(`
    INSERT INTO transactions (fund_id, date, type, quantity, price, amount, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(fund_id, date, type, Math.abs(quantity), price, calculatedAmount, notes ?? null);

  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(transaction);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
