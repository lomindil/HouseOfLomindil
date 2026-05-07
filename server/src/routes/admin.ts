import { Router, Response } from 'express';
import db from '../db';
import { authenticate, adminOnly, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate, adminOnly);

// List all games pending approval
router.get('/pending', (_req: AuthRequest, res: Response) => {
  const rows = db.prepare(`
    SELECT g.id, g.name, g.description, g.status, g.created_at, g.approved,
           u.username AS dm_username, u.email AS dm_email,
           (SELECT COUNT(*) FROM game_players WHERE game_id = g.id) AS player_count
    FROM games g
    JOIN users u ON u.id = g.dm_id
    WHERE g.approved = 0
    ORDER BY g.created_at ASC
  `).all();
  res.json(rows);
});

// List all games (for overview)
router.get('/games', (_req: AuthRequest, res: Response) => {
  const rows = db.prepare(`
    SELECT g.id, g.name, g.description, g.status, g.approved, g.created_at,
           u.username AS dm_username,
           (SELECT COUNT(*) FROM game_players WHERE game_id = g.id) AS player_count,
           (SELECT COUNT(*) FROM game_sessions WHERE game_id = g.id AND status = 'ended') AS ended_sessions
    FROM games g
    JOIN users u ON u.id = g.dm_id
    ORDER BY g.approved ASC, g.created_at DESC
  `).all();
  res.json(rows);
});

// Approve a game
router.post('/games/:id/approve', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT id FROM games WHERE id = ?').get(req.params.id) as any;
  if (!game) return res.status(404).json({ error: 'Game not found' });
  db.prepare('UPDATE games SET approved = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Reject (delete) a game
router.delete('/games/:id', (req: AuthRequest, res: Response) => {
  db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
