import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

router.get('/', (_req, res) => {
  const buckets = db.prepare(`
    SELECT b.*,
      json_group_array(json_object('id', f.id, 'ticker', f.ticker, 'name', f.name)) as funds_json
    FROM buckets b
    LEFT JOIN funds f ON f.bucket_id = b.id
    GROUP BY b.id
    ORDER BY b.name
  `).all();

  const result = (buckets as any[]).map(b => ({
    ...b,
    funds: JSON.parse(b.funds_json).filter((f: any) => f.id !== null),
    funds_json: undefined,
  }));

  res.json(result);
});

router.post('/', (req, res) => {
  const { name, color } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const result = db.prepare(`
    INSERT INTO buckets (name, color) VALUES (?, ?)
  `).run(name, color ?? null);

  const bucket = db.prepare('SELECT * FROM buckets WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(bucket);
});

router.put('/:id', (req, res) => {
  const { name, color } = req.body;
  db.prepare('UPDATE buckets SET name = ?, color = ? WHERE id = ?')
    .run(name, color ?? null, req.params.id);

  const bucket = db.prepare('SELECT * FROM buckets WHERE id = ?').get(req.params.id);
  res.json(bucket);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM buckets WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
