import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

router.get('/users', (_req, res) => {
  const users = db.prepare(`
    SELECT
      u.id,
      u.email,
      u.name,
      u.is_admin,
      u.created_at,
      u.last_login,
      (SELECT COUNT(*) FROM funds f WHERE f.user_id = u.id) as funds_count,
      (SELECT COUNT(*) FROM transactions t WHERE t.user_id = u.id) as transactions_count,
      (SELECT COUNT(*) FROM distributions d WHERE d.user_id = u.id) as distributions_count,
      (SELECT COUNT(*) FROM cash_movements c WHERE c.user_id = u.id) as cash_movements_count,
      (SELECT COUNT(*) FROM snapshots s WHERE s.user_id = u.id) as snapshots_count,
      (SELECT MAX(created_at) FROM activity_logs a WHERE a.actor_user_id = u.id) as last_activity_at
    FROM users u
    ORDER BY u.created_at DESC
  `).all();

  res.json(users);
});

router.get('/activities', (req, res) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '200'), 10), 1), 1000);
  const userId = req.query.user_id ? Number(req.query.user_id) : null;

  let sql = `
    SELECT
      a.id,
      a.actor_user_id,
      a.actor_email,
      a.method,
      a.path,
      a.status_code,
      a.duration_ms,
      a.ip,
      a.user_agent,
      a.created_at,
      u.name as actor_name,
      u.is_admin as actor_is_admin
    FROM activity_logs a
    LEFT JOIN users u ON u.id = a.actor_user_id
    WHERE 1 = 1
  `;
  const params: any[] = [];

  if (userId) {
    sql += ' AND a.actor_user_id = ?';
    params.push(userId);
  }

  sql += ' ORDER BY a.created_at DESC LIMIT ?';
  params.push(limit);

  const activities = db.prepare(sql).all(...params);
  res.json(activities);
});

export default router;
