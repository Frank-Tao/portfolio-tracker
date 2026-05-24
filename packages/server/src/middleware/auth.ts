import { Request, Response, NextFunction } from 'express';
import db from '../db/connection.js';
import { ensureTenantBaseData } from '../db/connection.js';

export interface AuthenticatedRequest extends Request {
  user?: { id: number; email: string; name: string | null; is_admin: number };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authDisabled =
    process.env.PORTFOLIO_DISABLE_AUTH === 'true' ||
    (process.env.VERCEL === '1' && process.env.PORTFOLIO_DISABLE_AUTH !== 'false');
  if (authDisabled) {
    const demoUser = db.prepare('SELECT id, email, name, is_admin FROM users ORDER BY id LIMIT 1').get() as any;
    req.user = demoUser
      ? { id: demoUser.id, email: demoUser.email, name: demoUser.name, is_admin: demoUser.is_admin ?? 0 }
      : { id: 0, email: 'demo@portfolio.local', name: 'Demo User', is_admin: 1 };
    if (req.user.id > 0) {
      ensureTenantBaseData(req.user.id);
    }
    next();
    return;
  }

  const sessionToken = req.cookies?.session;
  if (!sessionToken) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const now = new Date().toISOString();
  const session = db.prepare(
    "SELECT u.id, u.email, u.name, u.is_admin FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = ? AND s.expires_at > ?"
  ).get(sessionToken, now) as any;

  if (!session) {
    res.clearCookie('session');
    res.status(401).json({ error: 'Session expired' });
    return;
  }

  req.user = { id: session.id, email: session.email, name: session.name, is_admin: session.is_admin ?? 0 };
  ensureTenantBaseData(req.user.id);
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!req.user.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
