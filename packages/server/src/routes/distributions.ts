import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

router.get('/', (req, res) => {
  const { fund_id } = req.query;
  let sql = `
    SELECT d.*, f.ticker
    FROM distributions d
    JOIN funds f ON d.fund_id = f.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (fund_id) {
    sql += ' AND d.fund_id = ?';
    params.push(fund_id);
  }

  sql += ' ORDER BY d.date DESC';
  const distributions = db.prepare(sql).all(...params);
  res.json(distributions);
});

router.post('/', (req, res) => {
  const { fund_id, date, amount, label } = req.body;

  if (!fund_id || !date || amount == null) {
    return res.status(400).json({ error: 'fund_id, date, and amount are required' });
  }

  const result = db.prepare(`
    INSERT INTO distributions (fund_id, date, amount, label)
    VALUES (?, ?, ?, ?)
  `).run(fund_id, date, amount, label ?? null);

  const distribution = db.prepare('SELECT * FROM distributions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(distribution);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM distributions WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
