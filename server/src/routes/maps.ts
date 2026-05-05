import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);

const mapStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/maps'),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage: mapStorage, limits: { fileSize: 20 * 1024 * 1024 } });

function canAccess(gameId: string, userId: string): any {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as any;
  if (!game) return null;
  const isMember = game.dm_id === userId ||
    db.prepare('SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?').get(gameId, userId);
  return isMember ? game : null;
}

function isDM(gameId: string, userId: string): boolean {
  const game = db.prepare('SELECT dm_id FROM games WHERE id = ?').get(gameId) as any;
  return game?.dm_id === userId;
}

router.get('/', (req: AuthRequest, res: Response) => {
  const game = canAccess(req.params.gameId, req.user!.id);
  if (!game) return res.status(403).json({ error: 'Access denied' });

  const maps = db.prepare('SELECT * FROM maps WHERE game_id = ?').all(req.params.gameId);
  res.json(maps.map((m: any) => ({
    ...m,
    fog_data: JSON.parse(m.fog_data),
    drawings: JSON.parse(m.drawings),
    tokens: JSON.parse(m.tokens),
  })));
});

router.post('/', upload.single('image'), (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  if (!req.file) return res.status(400).json({ error: 'Image required' });

  const { name, grid_size, grid_color, grid_opacity } = req.body;
  const id = uuidv4();
  const imageUrl = `/uploads/maps/${req.file.filename}`;

  db.prepare(`
    INSERT INTO maps (id, game_id, name, image_url, grid_size, grid_color, grid_opacity)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.gameId, name || 'New Map', imageUrl,
    parseInt(grid_size) || 50, grid_color || '#ffffff', parseFloat(grid_opacity) || 0.3);

  const map = db.prepare('SELECT * FROM maps WHERE id = ?').get(id) as any;
  res.json({ ...map, fog_data: JSON.parse(map.fog_data), drawings: JSON.parse(map.drawings), tokens: JSON.parse(map.tokens) });
});

router.get('/:mapId', (req: AuthRequest, res: Response) => {
  const game = canAccess(req.params.gameId, req.user!.id);
  if (!game) return res.status(403).json({ error: 'Access denied' });

  const map = db.prepare('SELECT * FROM maps WHERE id = ? AND game_id = ?').get(req.params.mapId, req.params.gameId) as any;
  if (!map) return res.status(404).json({ error: 'Not found' });

  res.json({ ...map, fog_data: JSON.parse(map.fog_data), drawings: JSON.parse(map.drawings), tokens: JSON.parse(map.tokens) });
});

router.put('/:mapId', (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });

  const map = db.prepare('SELECT * FROM maps WHERE id = ? AND game_id = ?').get(req.params.mapId, req.params.gameId) as any;
  if (!map) return res.status(404).json({ error: 'Not found' });

  const { name, grid_size, grid_color, grid_opacity, fog_data, drawings, tokens } = req.body;
  db.prepare(`
    UPDATE maps SET
      name = ?, grid_size = ?, grid_color = ?, grid_opacity = ?,
      fog_data = ?, drawings = ?, tokens = ?
    WHERE id = ?
  `).run(
    name ?? map.name,
    grid_size ?? map.grid_size,
    grid_color ?? map.grid_color,
    grid_opacity ?? map.grid_opacity,
    fog_data !== undefined ? JSON.stringify(fog_data) : map.fog_data,
    drawings !== undefined ? JSON.stringify(drawings) : map.drawings,
    tokens !== undefined ? JSON.stringify(tokens) : map.tokens,
    req.params.mapId
  );

  const updated = db.prepare('SELECT * FROM maps WHERE id = ?').get(req.params.mapId) as any;
  res.json({ ...updated, fog_data: JSON.parse(updated.fog_data), drawings: JSON.parse(updated.drawings), tokens: JSON.parse(updated.tokens) });
});

router.delete('/:mapId', (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  db.prepare('DELETE FROM maps WHERE id = ? AND game_id = ?').run(req.params.mapId, req.params.gameId);
  res.json({ success: true });
});

export default router;
