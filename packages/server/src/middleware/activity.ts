import type { NextFunction, Response } from 'express';
import db from '../db/connection.js';
import type { AuthenticatedRequest } from './auth.js';

export function logActivity(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const startedAt = Date.now();

  res.on('finish', () => {
    if (!req.user) return;
    if (req.path === '/api/health') return;

    const durationMs = Date.now() - startedAt;
    db.prepare(`
      INSERT INTO activity_logs (
        actor_user_id,
        actor_email,
        method,
        path,
        status_code,
        duration_ms,
        ip,
        user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      req.user.email,
      req.method,
      req.originalUrl,
      res.statusCode,
      durationMs,
      req.ip || null,
      req.get('user-agent') || null
    );
  });

  next();
}
