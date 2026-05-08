import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

router.get('/', (_req, res) => {
  const profiles = db.prepare('SELECT * FROM profiles ORDER BY name').all();

  const result = (profiles as any[]).map(p => {
    const allocations = db.prepare(`
      SELECT pa.*, b.name as bucket_name, b.color as bucket_color
      FROM profile_allocations pa
      JOIN buckets b ON pa.bucket_id = b.id
      WHERE pa.profile_id = ?
      ORDER BY pa.target_pct DESC
    `).all(p.id);
    return { ...p, allocations };
  });

  res.json(result);
});

router.post('/', (req, res) => {
  const { name, description, allocations } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const insertProfile = db.prepare(`
    INSERT INTO profiles (name, description) VALUES (?, ?)
  `);
  const insertAllocation = db.prepare(`
    INSERT INTO profile_allocations (profile_id, bucket_id, target_pct) VALUES (?, ?, ?)
  `);

  const txn = db.transaction(() => {
    const result = insertProfile.run(name, description ?? null);
    const profileId = result.lastInsertRowid;

    if (allocations && Array.isArray(allocations)) {
      for (const alloc of allocations) {
        insertAllocation.run(profileId, alloc.bucket_id, alloc.target_pct);
      }
    }
    return profileId;
  });

  const profileId = txn();
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
  res.status(201).json(profile);
});

router.put('/:id', (req, res) => {
  const { name, description, allocations } = req.body;

  const txn = db.transaction(() => {
    db.prepare('UPDATE profiles SET name = ?, description = ? WHERE id = ?')
      .run(name, description ?? null, req.params.id);

    if (allocations && Array.isArray(allocations)) {
      db.prepare('DELETE FROM profile_allocations WHERE profile_id = ?').run(req.params.id);
      const insertAlloc = db.prepare(`
        INSERT INTO profile_allocations (profile_id, bucket_id, target_pct) VALUES (?, ?, ?)
      `);
      for (const alloc of allocations) {
        insertAlloc.run(req.params.id, alloc.bucket_id, alloc.target_pct);
      }
    }
  });

  txn();
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);
  res.json(profile);
});

router.put('/:id/activate', (req, res) => {
  const txn = db.transaction(() => {
    db.prepare('UPDATE profiles SET is_active = 0').run();
    db.prepare('UPDATE profiles SET is_active = 1 WHERE id = ?').run(req.params.id);
  });

  txn();
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.id);
  res.json(profile);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM profile_allocations WHERE profile_id = ?').run(req.params.id);
  db.prepare('DELETE FROM profiles WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

export default router;
