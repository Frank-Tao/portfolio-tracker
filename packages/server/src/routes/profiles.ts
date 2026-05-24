import { Router } from 'express';
import db from '../db/connection.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const profiles = db.prepare('SELECT * FROM profiles WHERE user_id = ? ORDER BY name').all(userId);

  const result = (profiles as any[]).map(p => {
    const allocations = db.prepare(`
      SELECT pa.*, b.name as bucket_name, b.color as bucket_color
      FROM profile_allocations pa
      JOIN buckets b ON pa.bucket_id = b.id AND b.user_id = pa.user_id
      WHERE pa.profile_id = ? AND pa.user_id = ?
      ORDER BY pa.target_pct DESC
    `).all(p.id, userId);
    return { ...p, allocations };
  });

  res.json(result);
});

router.post('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { name, description, allocations } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const insertProfile = db.prepare(`
    INSERT INTO profiles (user_id, name, description) VALUES (?, ?, ?)
  `);
  const insertAllocation = db.prepare(`
    INSERT INTO profile_allocations (user_id, profile_id, bucket_id, target_pct) VALUES (?, ?, ?, ?)
  `);

  const txn = db.transaction(() => {
    const result = insertProfile.run(userId, name, description ?? null);
    const profileId = result.lastInsertRowid;

    if (allocations && Array.isArray(allocations)) {
      for (const alloc of allocations) {
        const bucket = db.prepare('SELECT id FROM buckets WHERE id = ? AND user_id = ?').get(alloc.bucket_id, userId) as any;
        if (!bucket) continue;
        insertAllocation.run(userId, profileId, alloc.bucket_id, alloc.target_pct);
      }
    }
    return profileId;
  });

  const profileId = txn();
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(profileId, userId);
  res.status(201).json(profile);
});

router.put('/:id', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { name, description, allocations } = req.body;

  const txn = db.transaction(() => {
    db.prepare('UPDATE profiles SET name = ?, description = ? WHERE id = ? AND user_id = ?')
      .run(name, description ?? null, req.params.id, userId);

    if (allocations && Array.isArray(allocations)) {
      db.prepare('DELETE FROM profile_allocations WHERE profile_id = ? AND user_id = ?').run(req.params.id, userId);
      const insertAlloc = db.prepare(`
        INSERT INTO profile_allocations (user_id, profile_id, bucket_id, target_pct) VALUES (?, ?, ?, ?)
      `);
      for (const alloc of allocations) {
        const bucket = db.prepare('SELECT id FROM buckets WHERE id = ? AND user_id = ?').get(alloc.bucket_id, userId) as any;
        if (!bucket) continue;
        insertAlloc.run(userId, req.params.id, alloc.bucket_id, alloc.target_pct);
      }
    }
  });

  txn();
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  res.json(profile);
});

router.put('/:id/activate', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const txn = db.transaction(() => {
    db.prepare('UPDATE profiles SET is_active = 0 WHERE user_id = ?').run(userId);
    db.prepare('UPDATE profiles SET is_active = 1 WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  });

  txn();
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  res.json(profile);
});

router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  db.prepare('DELETE FROM profile_allocations WHERE profile_id = ? AND user_id = ?').run(req.params.id, userId);
  db.prepare('DELETE FROM profiles WHERE id = ? AND user_id = ?').run(req.params.id, userId);
  res.status(204).end();
});

export default router;
