import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);

const handoutStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/handouts'),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage: handoutStorage, limits: { fileSize: 10 * 1024 * 1024 } });

function canAccess(gameId: string, userId: string): boolean {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as any;
  if (!game) return false;
  return game.dm_id === userId ||
    !!db.prepare('SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?').get(gameId, userId);
}

function isDM(gameId: string, userId: string): boolean {
  const game = db.prepare('SELECT dm_id FROM games WHERE id = ?').get(gameId) as any;
  return game?.dm_id === userId;
}

router.get('/messages', (req: AuthRequest, res: Response) => {
  if (!canAccess(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'Access denied' });

  const limit = parseInt(req.query.limit as string) || 50;
  const before = req.query.before as string;

  let query = 'SELECT * FROM chat_messages WHERE game_id = ?';
  const params: any[] = [req.params.gameId];

  if (before) {
    query += ' AND id < ?';
    params.push(before);
  }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const messages = db.prepare(query).all(...params).reverse();
  res.json(messages.map((m: any) => ({ ...m, metadata: JSON.parse(m.metadata) })));
});

router.get('/handouts', (req: AuthRequest, res: Response) => {
  if (!canAccess(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'Access denied' });

  const handouts = db.prepare('SELECT * FROM handouts WHERE game_id = ? ORDER BY created_at DESC').all(req.params.gameId);
  res.json(handouts.map((h: any) => ({ ...h, shared_with: JSON.parse(h.shared_with) })));
});

router.post('/handouts', upload.single('file'), (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });

  const { title, content, shared_with } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const id = uuidv4();
  const fileUrl = req.file ? `/uploads/handouts/${req.file.filename}` : null;
  const sharedWith = shared_with ? JSON.parse(shared_with) : [];

  db.prepare('INSERT INTO handouts (id, game_id, title, content, file_url, shared_with) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, req.params.gameId, title, content || '', fileUrl, JSON.stringify(sharedWith)
  );

  const handout = db.prepare('SELECT * FROM handouts WHERE id = ?').get(id) as any;
  res.json({ ...handout, shared_with: JSON.parse(handout.shared_with) });
});

router.put('/handouts/:handoutId', (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });

  const { title, content, shared_with } = req.body;
  const handout = db.prepare('SELECT * FROM handouts WHERE id = ? AND game_id = ?').get(req.params.handoutId, req.params.gameId) as any;
  if (!handout) return res.status(404).json({ error: 'Not found' });

  db.prepare('UPDATE handouts SET title = ?, content = ?, shared_with = ? WHERE id = ?').run(
    title ?? handout.title,
    content ?? handout.content,
    shared_with !== undefined ? JSON.stringify(shared_with) : handout.shared_with,
    req.params.handoutId
  );

  const updated = db.prepare('SELECT * FROM handouts WHERE id = ?').get(req.params.handoutId) as any;
  res.json({ ...updated, shared_with: JSON.parse(updated.shared_with) });
});

router.delete('/handouts/:handoutId', (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  db.prepare('DELETE FROM handouts WHERE id = ? AND game_id = ?').run(req.params.handoutId, req.params.gameId);
  res.json({ success: true });
});

export default router;
