import { Router } from 'express';
import db from '../db/connection.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const buckets = db.prepare(`
    SELECT b.*,
      json_group_array(json_object('id', f.id, 'ticker', f.ticker, 'name', f.name)) as funds_json
    FROM buckets b
    LEFT JOIN funds f ON f.bucket_id = b.id AND f.user_id = b.user_id
    WHERE b.user_id = ?
    GROUP BY b.id
    ORDER BY b.name
  `).all(userId);

  const result = (buckets as any[]).map(b => ({
    ...b,
    funds: JSON.parse(b.funds_json).filter((f: any) => f.id !== null),
    funds_json: undefined,
  }));

  res.json(result);
});

router.post('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { name, color } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const result = db.prepare(`
    INSERT INTO buckets (user_id, name, color) VALUES (?, ?, ?)
  `).run(userId, name, color ?? null);

  const bucket = db.prepare('SELECT * FROM buckets WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, userId);
  res.status(201).json(bucket);
});

router.put('/:id', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { name, color } = req.body;
  db.prepare('UPDATE buckets SET name = ?, color = ? WHERE id = ? AND user_id = ?')
    .run(name, color ?? null, req.params.id, userId);

  const bucket = db.prepare('SELECT * FROM buckets WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  res.json(bucket);
});

router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  db.prepare('DELETE FROM buckets WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.status(204).end();
});

export default router;
