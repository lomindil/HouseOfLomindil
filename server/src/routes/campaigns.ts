import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { optionalAuth, authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

function computeStatus(g: any) {
  if (g.game_status === 'active') return 'live';
  if (g.ended_sessions === 0) return 'not_started';
  if (g.total_encounters > 0 && g.completed_encounters === g.total_encounters) return 'finished';
  return 'in_progress';
}

// List all approved campaigns — public
router.get('/', optionalAuth, (_req: AuthRequest, res: Response) => {
  const rows = db.prepare(`
    SELECT
      g.id, g.name, g.description, g.status AS game_status, g.created_at,
      u.username AS dm_username,
      (SELECT COUNT(*) FROM game_players WHERE game_id = g.id) AS player_count,
      (SELECT COUNT(*) FROM game_sessions WHERE game_id = g.id AND status = 'ended') AS ended_sessions,
      (SELECT COUNT(*) FROM encounters WHERE game_id = g.id AND status = 'completed') AS completed_encounters,
      (SELECT COUNT(*) FROM encounters WHERE game_id = g.id) AS total_encounters,
      (SELECT COUNT(*) FROM campaign_army WHERE game_id = g.id) AS army_count
    FROM games g
    JOIN users u ON u.id = g.dm_id
    WHERE g.approved = 1
    ORDER BY g.created_at DESC
  `).all() as any[];

  res.json(rows.map(g => ({ ...g, status: computeStatus(g) })));
});

// Single campaign detail — public
router.get('/:id', optionalAuth, (req: AuthRequest, res: Response) => {
  const g = db.prepare(`
    SELECT
      g.id, g.name, g.description, g.join_code, g.status AS game_status, g.created_at,
      u.username AS dm_username,
      (SELECT COUNT(*) FROM game_players WHERE game_id = g.id) AS player_count,
      (SELECT COUNT(*) FROM game_sessions WHERE game_id = g.id AND status = 'ended') AS ended_sessions,
      (SELECT COUNT(*) FROM encounters WHERE game_id = g.id AND status = 'completed') AS completed_encounters,
      (SELECT COUNT(*) FROM encounters WHERE game_id = g.id) AS total_encounters,
      (SELECT COUNT(*) FROM campaign_army WHERE game_id = g.id) AS army_count
    FROM games g
    JOIN users u ON u.id = g.dm_id
    WHERE g.id = ? AND g.approved = 1
  `).get(req.params.id) as any;

  if (!g) return res.status(404).json({ error: 'Campaign not found' });

  // Only expose join_code to logged-in users who are already members
  const isMember = req.user && (
    db.prepare('SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?').get(g.id, req.user.id) ||
    db.prepare('SELECT 1 FROM games WHERE id = ? AND dm_id = ?').get(g.id, req.user.id)
  );

  res.json({
    ...g,
    join_code: isMember ? g.join_code : undefined,
    status: computeStatus(g),
  });
});

// Sign up for campaign army — public (optional auth)
router.post('/:id/army', optionalAuth, (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT id FROM games WHERE id = ? AND approved = 1').get(req.params.id) as any;
  if (!game) return res.status(404).json({ error: 'Campaign not found' });

  const { display_name, email, phone, message } = req.body;

  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
  if (!display_name?.trim()) return res.status(400).json({ error: 'Name required' });

  // Check for duplicate by email in this campaign
  const existing = db.prepare('SELECT id FROM campaign_army WHERE game_id = ? AND email = ?').get(req.params.id, email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'You have already joined the Campaign Army for this game.' });

  const id = uuidv4();
  db.prepare(
    'INSERT INTO campaign_army (id, game_id, user_id, display_name, email, phone, message) VALUES (?,?,?,?,?,?,?)'
  ).run(id, req.params.id, req.user?.id || null, display_name.trim(), email.toLowerCase().trim(), phone?.trim() || '', message?.trim() || '');

  res.json({ success: true });
});

// Get campaign army — authenticated
router.get('/:id/army', authenticate, (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT id, dm_id FROM games WHERE id = ? AND approved = 1').get(req.params.id) as any;
  if (!game) return res.status(404).json({ error: 'Campaign not found' });

  const isDM = game.dm_id === req.user!.id;

  if (isDM) {
    // DM sees full details
    const rows = db.prepare(`
      SELECT ca.id, ca.display_name, ca.email, ca.phone, ca.message, ca.created_at,
             ca.user_id, u.username
      FROM campaign_army ca
      LEFT JOIN users u ON u.id = ca.user_id
      WHERE ca.game_id = ?
      ORDER BY ca.created_at ASC
    `).all(req.params.id);
    return res.json(rows);
  }

  // Other authenticated users see only names (no email/phone)
  const rows = db.prepare(`
    SELECT ca.id, ca.user_id,
           CASE WHEN ca.user_id IS NOT NULL THEN COALESCE(u.username, ca.display_name) ELSE 'Guest' END AS display_name,
           ca.created_at
    FROM campaign_army ca
    LEFT JOIN users u ON u.id = ca.user_id
    WHERE ca.game_id = ?
    ORDER BY ca.created_at ASC
  `).all(req.params.id);
  res.json(rows);
});

export default router;
