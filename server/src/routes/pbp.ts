import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);

const pbpStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/pbp'),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage: pbpStorage, limits: { fileSize: 8 * 1024 * 1024 } });

function canAccess(gameId: string, userId: string): boolean {
  const game = db.prepare('SELECT dm_id FROM games WHERE id = ?').get(gameId) as any;
  if (!game) return false;
  if (game.dm_id === userId) return true;
  return !!db.prepare('SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?').get(gameId, userId);
}

function isDMUser(gameId: string, userId: string): boolean {
  const game = db.prepare('SELECT dm_id FROM games WHERE id = ?').get(gameId) as any;
  return game?.dm_id === userId;
}

// GET /sessions — list all sessions for a game
router.get('/sessions', (req: AuthRequest, res: Response) => {
  const { gameId } = req.params;
  if (!canAccess(gameId, req.user!.id)) return res.status(403).json({ error: 'Not a member' });
  const sessions = db.prepare('SELECT * FROM pbp_sessions WHERE game_id = ? ORDER BY created_at ASC').all(gameId);
  res.json(sessions);
});

// POST /sessions — create new session (DM only); auto-closes any currently active session
router.post('/sessions', (req: AuthRequest, res: Response) => {
  const { gameId } = req.params;
  if (!isDMUser(gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Session name required' });

  db.prepare(`UPDATE pbp_sessions SET status = 'closed', ended_at = unixepoch()
              WHERE game_id = ? AND status = 'active'`).run(gameId);

  const id = uuidv4();
  db.prepare('INSERT INTO pbp_sessions (id, game_id, name) VALUES (?, ?, ?)').run(id, gameId, name.trim());
  const session = db.prepare('SELECT * FROM pbp_sessions WHERE id = ?').get(id);
  res.json(session);
});

// POST /sessions/:sessionId/close — close the active session (DM only)
router.post('/sessions/:sessionId/close', (req: AuthRequest, res: Response) => {
  const { gameId, sessionId } = req.params;
  if (!isDMUser(gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  db.prepare(`UPDATE pbp_sessions SET status = 'closed', ended_at = unixepoch()
              WHERE id = ? AND game_id = ?`).run(sessionId, gameId);
  res.json({ ok: true });
});

// GET /sessions/:sessionId/posts — all non-deleted posts in a session
router.get('/sessions/:sessionId/posts', (req: AuthRequest, res: Response) => {
  const { gameId, sessionId } = req.params;
  if (!canAccess(gameId, req.user!.id)) return res.status(403).json({ error: 'Not a member' });
  const posts = db.prepare(
    'SELECT * FROM pbp_posts WHERE session_id = ? AND deleted = 0 ORDER BY created_at ASC'
  ).all(sessionId);
  res.json(posts);
});

// POST /sessions/:sessionId/posts — create a post (text + optional image)
router.post('/sessions/:sessionId/posts', upload.single('image'), (req: AuthRequest, res: Response) => {
  const { gameId, sessionId } = req.params;
  if (!canAccess(gameId, req.user!.id)) return res.status(403).json({ error: 'Not a member' });

  const session = db.prepare('SELECT * FROM pbp_sessions WHERE id = ? AND game_id = ?').get(sessionId, gameId) as any;
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status === 'closed') return res.status(400).json({ error: 'Session is closed' });

  const content = (req.body.content || '').trim();
  const imageUrl = req.file ? `/uploads/pbp/${req.file.filename}` : null;
  if (!content && !imageUrl) return res.status(400).json({ error: 'Post must have content or an image' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO pbp_posts (id, session_id, game_id, user_id, username, content, image_url, post_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, gameId, req.user!.id, req.user!.username, content, imageUrl, req.body.post_type || 'post');

  const post = db.prepare('SELECT * FROM pbp_posts WHERE id = ?').get(id);
  res.json(post);
});

// DELETE /sessions/:sessionId/posts/:postId — soft-delete (DM only)
router.delete('/sessions/:sessionId/posts/:postId', (req: AuthRequest, res: Response) => {
  const { gameId, sessionId, postId } = req.params;
  if (!isDMUser(gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  db.prepare('UPDATE pbp_posts SET deleted = 1 WHERE id = ? AND session_id = ?').run(postId, sessionId);
  res.json({ ok: true });
});

// ── Roll allocation ───────────────────────────────────────────────────────────

// GET /sessions/:sessionId/allocations — get all allocations for session
router.get('/sessions/:sessionId/allocations', (req: AuthRequest, res: Response) => {
  const { gameId, sessionId } = req.params;
  if (!canAccess(gameId, req.user!.id)) return res.status(403).json({ error: 'Not a member' });
  const allocs = db.prepare(
    'SELECT * FROM pbp_roll_allocations WHERE session_id = ? AND game_id = ?'
  ).all(sessionId, gameId);
  res.json(allocs);
});

// PUT /sessions/:sessionId/allocations/:userId — DM sets allocation for a player
router.put('/sessions/:sessionId/allocations/:userId', (req: AuthRequest, res: Response) => {
  const { gameId, sessionId, userId } = req.params;
  if (!isDMUser(gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  const { allocated, label, character_id } = req.body;
  if (typeof allocated !== 'number' || allocated < 0) return res.status(400).json({ error: 'Valid allocated count required' });

  const existing = db.prepare(
    'SELECT * FROM pbp_roll_allocations WHERE session_id = ? AND user_id = ?'
  ).get(sessionId, userId) as any;

  if (existing) {
    db.prepare(
      'UPDATE pbp_roll_allocations SET allocated = ?, label = ?, character_id = ? WHERE session_id = ? AND user_id = ?'
    ).run(allocated, label || '', character_id || null, sessionId, userId);
  } else {
    db.prepare(
      'INSERT INTO pbp_roll_allocations (id, session_id, game_id, user_id, character_id, allocated, used, label) VALUES (?,?,?,?,?,?,0,?)'
    ).run(uuidv4(), sessionId, gameId, userId, character_id || null, allocated, label || '');
  }

  const alloc = db.prepare(
    'SELECT * FROM pbp_roll_allocations WHERE session_id = ? AND user_id = ?'
  ).get(sessionId, userId);
  res.json(alloc);
});

// POST /sessions/:sessionId/roll — player submits a dice roll (allocation-gated)
router.post('/sessions/:sessionId/roll', (req: AuthRequest, res: Response) => {
  const { gameId, sessionId } = req.params;
  if (!canAccess(gameId, req.user!.id)) return res.status(403).json({ error: 'Not a member' });

  const session = db.prepare('SELECT * FROM pbp_sessions WHERE id = ? AND game_id = ?').get(sessionId, gameId) as any;
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status === 'closed') return res.status(400).json({ error: 'Session is closed' });

  // Non-DM players must have allocation
  const isUserDM = isDMUser(gameId, req.user!.id);
  if (!isUserDM) {
    const alloc = db.prepare(
      'SELECT * FROM pbp_roll_allocations WHERE session_id = ? AND user_id = ?'
    ).get(sessionId, req.user!.id) as any;
    if (!alloc || alloc.used >= alloc.allocated) {
      return res.status(403).json({ error: 'No rolls remaining. Wait for the DM to grant more.' });
    }
    db.prepare(
      'UPDATE pbp_roll_allocations SET used = used + 1 WHERE session_id = ? AND user_id = ?'
    ).run(sessionId, req.user!.id);
  }

  const { notation, results, total, label } = req.body;
  if (!notation || !Array.isArray(results) || typeof total !== 'number') {
    return res.status(400).json({ error: 'notation, results[], and total required' });
  }

  const content = JSON.stringify({ notation, results, total, label: label || '' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO pbp_posts (id, session_id, game_id, user_id, username, content, post_type)
    VALUES (?, ?, ?, ?, ?, ?, 'roll')
  `).run(id, sessionId, gameId, req.user!.id, req.user!.username, content);

  // Return updated allocation so client can update immediately
  const updatedAlloc = isUserDM ? null : db.prepare(
    'SELECT * FROM pbp_roll_allocations WHERE session_id = ? AND user_id = ?'
  ).get(sessionId, req.user!.id);

  const post = db.prepare('SELECT * FROM pbp_posts WHERE id = ?').get(id);
  res.json({ post, allocation: updatedAlloc });
});

export default router;
