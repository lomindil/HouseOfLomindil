import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import db from '../db';
import { generateOTP, sendOTP } from '../utils/mailer';
import { signToken, authenticate, AuthRequest } from '../middleware/auth';

const scryptAsync = promisify(scrypt);
const JWT_SECRET = process.env.JWT_SECRET || 'tavern-secret-change-in-production';

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  const hashBuf = Buffer.from(hash, 'hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(hashBuf, derived);
}

const router = Router();

// ── Login (username or email + password) ──────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/email and password required' });
  }

  const id = identifier.trim().toLowerCase();
  const user = db.prepare(
    'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?'
  ).get(id, id) as any;

  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  if (!user.password_hash) {
    return res.status(401).json({
      error: 'This account has no password set. Use "Register" with your email to set one.',
      noPassword: true,
    });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

  const token = signToken({ id: user.id, email: user.email, username: user.username });
  res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
});

// ── Request OTP (registration / password reset) ───────────────────────────────
router.post('/request-otp', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const existingUser = db.prepare('SELECT password_hash FROM users WHERE LOWER(email) = ?').get(email.toLowerCase()) as any;
  if (existingUser?.password_hash) {
    return res.status(400).json({ error: 'Email already registered. Please sign in.' });
  }

  const code = generateOTP();
  const expiresAt = Math.floor(Date.now() / 1000) + 600;

  db.prepare(`
    INSERT INTO otps (email, code, expires_at, attempts)
    VALUES (?, ?, ?, 0)
    ON CONFLICT(email) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at, attempts=0
  `).run(email.toLowerCase(), code, expiresAt);

  try {
    await sendOTP(email.toLowerCase(), code);
    res.json({ message: 'OTP sent' });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return res.json({ message: 'OTP sent' });
    }
    console.error('Email send failed:', err);
    res.status(500).json({ error: 'Failed to send email. Check server SMTP config.' });
  }
});

// ── Verify OTP + set username/password ────────────────────────────────────────
router.post('/verify-otp', async (req: Request, res: Response) => {
  const { email, code, username, password } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code required' });

  const normalEmail = email.toLowerCase();
  const otp = db.prepare('SELECT * FROM otps WHERE email = ?').get(normalEmail) as any;

  if (!otp) return res.status(400).json({ error: 'No OTP requested for this email' });
  if (otp.attempts >= 5) return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
  if (Math.floor(Date.now() / 1000) > otp.expires_at) {
    db.prepare('DELETE FROM otps WHERE email = ?').run(normalEmail);
    return res.status(400).json({ error: 'Code expired. Request a new one.' });
  }
  if (otp.code !== code) {
    db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE email = ?').run(normalEmail);
    return res.status(400).json({ error: 'Invalid code' });
  }

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalEmail) as any;

  if (!user) {
    // New user — need username + password before creating account
    if (!username || username.trim().length < 2) {
      return res.status(400).json({ error: 'Username required', needDetails: true });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters', needDetails: true });
    }
    const taken = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(username.trim().toLowerCase());
    if (taken) return res.status(400).json({ error: 'Username already taken', needDetails: true });

    const hash = await hashPassword(password);
    const id = uuidv4();
    db.prepare('INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)').run(
      id, normalEmail, username.trim(), hash
    );
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  } else {
    // Existing user — update their password (password reset flow)
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters', needDetails: true });
    }
    const hash = await hashPassword(password);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  }

  // OTP consumed
  db.prepare('DELETE FROM otps WHERE email = ?').run(normalEmail);

  const token = signToken({ id: user.id, email: user.email, username: user.username });
  res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
});

router.post('/change-password', authenticate, async (req: AuthRequest, res: Response) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new password required' });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!user || !user.password_hash) {
    return res.status(400).json({ error: 'No password set for this account' });
  }

  const valid = await verifyPassword(current_password, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  const hash = await hashPassword(new_password);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user!.id);
  res.json({ ok: true });
});

router.get('/me', (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = db.prepare('SELECT id, email, username FROM users WHERE id = ?').get(decoded.id) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
