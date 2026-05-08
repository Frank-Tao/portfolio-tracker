import { Router } from 'express';
import db from '../db/connection.js';
import type { Fund } from '@portfolio/shared';

const router = Router();

router.get('/', (_req, res) => {
  const funds = db.prepare(`
    SELECT f.*, b.name as bucket_name
    FROM funds f
    LEFT JOIN buckets b ON f.bucket_id = b.id
    ORDER BY f.ticker
  `).all();
  res.json(funds);
});

router.get('/:id', (req, res) => {
  const fund = db.prepare(`
    SELECT f.*, b.name as bucket_name
    FROM funds f
    LEFT JOIN buckets b ON f.bucket_id = b.id
    WHERE f.id = ?
  `).get(req.params.id);

  if (!fund) return res.status(404).json({ error: 'Fund not found' });
  res.json(fund);
});

router.post('/', (req, res) => {
  const { ticker, name, expense_ratio, bucket_id } = req.body;
  if (!ticker || !name) {
    return res.status(400).json({ error: 'ticker and name are required' });
  }

  const result = db.prepare(`
    INSERT INTO funds (ticker, name, expense_ratio, bucket_id)
    VALUES (?, ?, ?, ?)
  `).run(ticker.toUpperCase(), name, expense_ratio ?? null, bucket_id ?? null);

  const fund = db.prepare('SELECT * FROM funds WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(fund);
});

router.put('/:id', (req, res) => {
  const { ticker, name, expense_ratio, bucket_id } = req.body;
  db.prepare(`
    UPDATE funds SET ticker = ?, name = ?, expense_ratio = ?, bucket_id = ?
    WHERE id = ?
  `).run(ticker, name, expense_ratio ?? null, bucket_id ?? null, req.params.id);

  const fund = db.prepare('SELECT * FROM funds WHERE id = ?').get(req.params.id);
  res.json(fund);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM funds WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
