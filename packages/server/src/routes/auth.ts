import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import db from '../db/connection.js';

const router = Router();

function generateToken(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function sendTokenEmail(email: string, token: string): Promise<boolean> {
  if (!process.env.SMTP_HOST) {
    console.log(`[Auth] No SMTP configured. Login token for ${email}: ${token}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  } as any);

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'portfolio-tracker@localhost',
    to: email,
    subject: 'Portfolio Tracker - Login Code',
    text: `Your login code is: ${token}\n\nThis code expires in 5 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1f2937;">Portfolio Tracker</h2>
        <p style="color: #4b5563;">Your login code is:</p>
        <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center; margin: 16px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1f2937;">${token}</span>
        </div>
        <p style="color: #6b7280; font-size: 14px;">This code expires in 5 minutes.</p>
      </div>
    `,
  });
  return true;
}

// POST /api/auth/request-token — send login code to email
router.post('/request-token', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Invalidate any existing unused tokens for this email
  db.prepare("UPDATE auth_tokens SET used = 1 WHERE email = ? AND used = 0").run(normalizedEmail);

  db.prepare("INSERT INTO auth_tokens (email, token, expires_at) VALUES (?, ?, ?)").run(normalizedEmail, token, expiresAt);

  try {
    const emailSent = await sendTokenEmail(normalizedEmail, token);
    if (emailSent) {
      res.json({ success: true, message: 'Login code sent to your email' });
    } else {
      res.json({ success: true, message: 'Login code sent to your email', dev_token: token });
    }
  } catch (err: any) {
    console.error(`[Auth] Failed to send email to ${normalizedEmail}:`, err.message);
    console.log(`[Auth] Login token for ${normalizedEmail}: ${token}`);
    res.json({ success: true, message: 'Login code sent to your email', dev_token: token });
  }
});

// POST /api/auth/verify-token — verify code and create session
router.post('/verify-token', (req: Request, res: Response) => {
  const { email, token } = req.body;
  if (!email || !token) {
    return res.status(400).json({ error: 'Email and token are required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date().toISOString();

  const authToken = db.prepare(
    "SELECT * FROM auth_tokens WHERE email = ? AND token = ? AND used = 0 AND expires_at > ?"
  ).get(normalizedEmail, token, now) as any;

  if (!authToken) {
    return res.status(401).json({ error: 'Invalid or expired code' });
  }

  // Mark token as used
  db.prepare("UPDATE auth_tokens SET used = 1 WHERE id = ?").run(authToken.id);

  // Create or get user
  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail) as any;
  if (!user) {
    db.prepare("INSERT INTO users (email) VALUES (?)").run(normalizedEmail);
    user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail) as any;
  }

  // Update last login
  db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(now, user.id);

  // Create session (30 days)
  const sessionToken = generateSessionToken();
  const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)").run(user.id, sessionToken, sessionExpires);

  // Set cookie
  res.cookie('session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  });

  res.json({
    success: true,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

// GET /api/auth/me — get current user from session
router.get('/me', (req: Request, res: Response) => {
  const sessionToken = req.cookies?.session;
  if (!sessionToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const now = new Date().toISOString();
  const session = db.prepare(
    "SELECT s.*, u.id as user_id, u.email, u.name, u.created_at as user_created_at, u.last_login FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.session_token = ? AND s.expires_at > ?"
  ).get(sessionToken, now) as any;

  if (!session) {
    res.clearCookie('session');
    return res.status(401).json({ error: 'Session expired' });
  }

  res.json({
    user: { id: session.user_id, email: session.email, name: session.name, created_at: session.user_created_at, last_login: session.last_login },
  });
});

// POST /api/auth/logout — destroy session
router.post('/logout', (req: Request, res: Response) => {
  const sessionToken = req.cookies?.session;
  if (sessionToken) {
    db.prepare("DELETE FROM sessions WHERE session_token = ?").run(sessionToken);
  }
  res.clearCookie('session');
  res.json({ success: true });
});

// PUT /api/auth/profile — update user profile
router.put('/profile', (req: Request, res: Response) => {
  const sessionToken = req.cookies?.session;
  if (!sessionToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const now = new Date().toISOString();
  const session = db.prepare(
    "SELECT s.user_id FROM sessions s WHERE s.session_token = ? AND s.expires_at > ?"
  ).get(sessionToken, now) as any;

  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }

  const { name } = req.body;
  if (name !== undefined) {
    db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, session.user_id);
  }

  const user = db.prepare("SELECT id, email, name, created_at, last_login FROM users WHERE id = ?").get(session.user_id) as any;
  res.json({ user });
});

export default router;
