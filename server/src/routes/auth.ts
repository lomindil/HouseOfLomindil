import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import db from '../db';
import { generateOTP, sendOTP } from '../utils/mailer';
import { signToken } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'tavern-secret-change-in-production';

const router = Router();

router.post('/request-otp', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
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
      // sendOTP already printed the code to console; just return success
      return res.json({ message: 'OTP sent' });
    }
    console.error('Email send failed:', err);
    res.status(500).json({ error: 'Failed to send email. Check server SMTP config.' });
  }
});

router.post('/verify-otp', (req: Request, res: Response) => {
  const { email, code, username } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code required' });

  const normalEmail = email.toLowerCase();
  const otp = db.prepare('SELECT * FROM otps WHERE email = ?').get(normalEmail) as any;

  if (!otp) return res.status(400).json({ error: 'No OTP requested' });
  if (otp.attempts >= 5) return res.status(429).json({ error: 'Too many attempts' });
  if (Math.floor(Date.now() / 1000) > otp.expires_at) {
    db.prepare('DELETE FROM otps WHERE email = ?').run(normalEmail);
    return res.status(400).json({ error: 'OTP expired' });
  }

  if (otp.code !== code) {
    db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE email = ?').run(normalEmail);
    return res.status(400).json({ error: 'Invalid code' });
  }

  // New user — ask for username before deleting the OTP
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalEmail) as any;
  if (!user) {
    if (!username || username.trim().length < 2) {
      return res.status(400).json({ error: 'Username required for new accounts', needUsername: true });
    }
    const id = uuidv4();
    db.prepare('INSERT INTO users (id, email, username) VALUES (?, ?, ?)').run(id, normalEmail, username.trim());
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  }

  // OTP fully consumed — delete it now
  db.prepare('DELETE FROM otps WHERE email = ?').run(normalEmail);

  const token = signToken({ id: user.id, email: user.email, username: user.username });
  res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
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
