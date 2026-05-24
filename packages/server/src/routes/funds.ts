import { Router } from 'express';
import db from '../db/connection.js';
import type { Fund } from '@portfolio/shared';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const funds = db.prepare(`
    SELECT f.*, b.name as bucket_name
    FROM funds f
    LEFT JOIN buckets b ON f.bucket_id = b.id AND b.user_id = f.user_id
    WHERE f.user_id = ?
    ORDER BY f.ticker
  `).all(userId);
  res.json(funds);
});

router.get('/:id', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const fund = db.prepare(`
    SELECT f.*, b.name as bucket_name
    FROM funds f
    LEFT JOIN buckets b ON f.bucket_id = b.id AND b.user_id = f.user_id
    WHERE f.id = ? AND f.user_id = ?
  `).get(req.params.id, userId);

  if (!fund) return res.status(404).json({ error: 'Fund not found' });
  res.json(fund);
});

router.post('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { ticker, name, expense_ratio, bucket_id } = req.body;
  if (!ticker || !name) {
    return res.status(400).json({ error: 'ticker and name are required' });
  }

  const bucketId = bucket_id ?? null;
  if (bucketId != null) {
    const bucket = db.prepare('SELECT id FROM buckets WHERE id = ? AND user_id = ?').get(bucketId, userId) as any;
    if (!bucket) return res.status(400).json({ error: 'bucket_id is invalid' });
  }

  const result = db.prepare(`
    INSERT INTO funds (user_id, ticker, name, expense_ratio, bucket_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, ticker.toUpperCase(), name, expense_ratio ?? null, bucketId);

  const fund = db.prepare('SELECT * FROM funds WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, userId);
  res.status(201).json(fund);
});

router.put('/:id', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { ticker, name, expense_ratio, bucket_id } = req.body;

  const existing = db.prepare('SELECT id FROM funds WHERE id = ? AND user_id = ?').get(req.params.id, userId) as any;
  if (!existing) return res.status(404).json({ error: 'Fund not found' });

  const bucketId = bucket_id ?? null;
  if (bucketId != null) {
    const bucket = db.prepare('SELECT id FROM buckets WHERE id = ? AND user_id = ?').get(bucketId, userId) as any;
    if (!bucket) return res.status(400).json({ error: 'bucket_id is invalid' });
  }

  db.prepare(`
    UPDATE funds SET ticker = ?, name = ?, expense_ratio = ?, bucket_id = ?
    WHERE id = ? AND user_id = ?
  `).run(ticker.toUpperCase(), name, expense_ratio ?? null, bucketId, req.params.id, userId);

  const fund = db.prepare('SELECT * FROM funds WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  res.json(fund);
});

router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  db.prepare('DELETE FROM funds WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.status(204).end();
});

export default router;
