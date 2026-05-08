import { Request, Response, NextFunction } from 'express';
import db from '../db/connection.js';

export interface AuthenticatedRequest extends Request {
  user?: { id: number; email: string; name: string | null };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const sessionToken = req.cookies?.session;
  if (!sessionToken) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const now = new Date().toISOString();
  const session = db.prepare(
    "SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = ? AND s.expires_at > ?"
  ).get(sessionToken, now) as any;

  if (!session) {
    res.clearCookie('session');
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  req.user = { id: session.id, email: session.email, name: session.name };
  next();
}
