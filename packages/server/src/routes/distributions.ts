import { Router } from 'express';
import db from '../db/connection.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { fund_id } = req.query;
  let sql = `
    SELECT d.*, f.ticker
    FROM distributions d
    JOIN funds f ON d.fund_id = f.id AND f.user_id = d.user_id
    WHERE d.user_id = ?
  `;
  const params: any[] = [userId];

  if (fund_id) {
    sql += ' AND d.fund_id = ?';
    params.push(fund_id);
  }

  sql += ' ORDER BY d.date DESC';
  const distributions = db.prepare(sql).all(...params);
  res.json(distributions);
});

router.post('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { fund_id, date, amount, label } = req.body;

  if (!fund_id || !date || amount == null) {
    return res.status(400).json({ error: 'fund_id, date, and amount are required' });
  }

  const fund = db.prepare('SELECT id FROM funds WHERE id = ? AND user_id = ?').get(fund_id, userId) as any;
  if (!fund) {
    return res.status(400).json({ error: 'fund_id is invalid' });
  }

  const result = db.prepare(`
    INSERT INTO distributions (user_id, fund_id, date, amount, label)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, fund_id, date, amount, label ?? null);

  const distribution = db.prepare('SELECT * FROM distributions WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, userId);
  res.status(201).json(distribution);
});

router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  db.prepare('DELETE FROM distributions WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.status(204).end();
});

export default router;
