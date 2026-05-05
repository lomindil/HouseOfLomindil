import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

function generateJoinCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

router.get('/', (req: AuthRequest, res: Response) => {
  const dmGames = db.prepare('SELECT * FROM games WHERE dm_id = ? ORDER BY created_at DESC').all(req.user!.id);
  const playerGames = db.prepare(`
    SELECT g.* FROM games g
    JOIN game_players gp ON gp.game_id = g.id
    WHERE gp.user_id = ?
    ORDER BY g.created_at DESC
  `).all(req.user!.id);
  res.json({ dm_games: dmGames, player_games: playerGames });
});

router.post('/', (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  let joinCode = generateJoinCode();
  while (db.prepare('SELECT id FROM games WHERE join_code = ?').get(joinCode)) {
    joinCode = generateJoinCode();
  }

  const id = uuidv4();
  db.prepare('INSERT INTO games (id, dm_id, name, description, join_code) VALUES (?, ?, ?, ?, ?)').run(
    id, req.user!.id, name, description || '', joinCode
  );

  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  res.json(game);
});

router.get('/active', (_req: AuthRequest, res: Response) => {
  const active = db.prepare("SELECT * FROM games WHERE status = 'active'").all();
  res.json({ active: (active as any[]).length > 0, games: active });
});

router.get('/join/:code', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE join_code = ?').get(req.params.code.toUpperCase()) as any;
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const dm = db.prepare('SELECT username FROM users WHERE id = ?').get(game.dm_id) as any;
  const players = db.prepare(`
    SELECT u.id, u.username, gp.character_id, c.name as char_name, c.avatar_url
    FROM game_players gp
    JOIN users u ON u.id = gp.user_id
    LEFT JOIN characters c ON c.id = gp.character_id
    WHERE gp.game_id = ?
  `).all(game.id);

  res.json({ ...game, dm_username: dm?.username, players });
});

router.post('/join', (req: AuthRequest, res: Response) => {
  const { code, character_id } = req.body;
  if (!code) return res.status(400).json({ error: 'Join code required' });

  const game = db.prepare('SELECT * FROM games WHERE join_code = ?').get(code.toUpperCase()) as any;
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.status === 'ended') return res.status(400).json({ error: 'Game has ended' });
  if (game.dm_id === req.user!.id) return res.status(400).json({ error: 'You are the DM of this game' });

  if (character_id) {
    const char = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(character_id, req.user!.id);
    if (!char) return res.status(400).json({ error: 'Character not found' });
  }

  db.prepare(`
    INSERT INTO game_players (game_id, user_id, character_id)
    VALUES (?, ?, ?)
    ON CONFLICT(game_id, user_id) DO UPDATE SET character_id = excluded.character_id
  `).run(game.id, req.user!.id, character_id || null);

  res.json({ game_id: game.id, join_code: game.join_code });
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as any;
  if (!game) return res.status(404).json({ error: 'Not found' });

  const isMember = game.dm_id === req.user!.id ||
    db.prepare('SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!isMember) return res.status(403).json({ error: 'Not a member' });

  const dm = db.prepare('SELECT id, username FROM users WHERE id = ?').get(game.dm_id) as any;
  const players = db.prepare(`
    SELECT u.id, u.username, gp.character_id, c.name as char_name, c.avatar_url
    FROM game_players gp
    JOIN users u ON u.id = gp.user_id
    LEFT JOIN characters c ON c.id = gp.character_id
    WHERE gp.game_id = ?
  `).all(req.params.id);

  const maps = db.prepare('SELECT id, name, grid_size, grid_color FROM maps WHERE game_id = ?').all(req.params.id);

  res.json({ ...game, dm_username: dm?.username, players, maps, is_dm: game.dm_id === req.user!.id });
});

router.post('/:id/launch', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND dm_id = ?').get(req.params.id, req.user!.id) as any;
  if (!game) return res.status(403).json({ error: 'Not authorized' });

  const activeCount = (db.prepare("SELECT COUNT(*) as cnt FROM games WHERE status = 'active' AND id != ?").get(req.params.id) as any).cnt;
  if (activeCount >= 3) return res.status(409).json({ error: 'Maximum of 3 games can be active simultaneously' });

  db.prepare("UPDATE games SET status = 'active' WHERE id = ?").run(req.params.id);
  res.json({ status: 'active', join_code: game.join_code });
});

router.post('/:id/end', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND dm_id = ?').get(req.params.id, req.user!.id) as any;
  if (!game) return res.status(403).json({ error: 'Not authorized' });

  db.prepare("UPDATE games SET status = 'ended' WHERE id = ?").run(req.params.id);
  res.json({ status: 'ended' });
});

// Pre-built game characters (DM creates, players can claim)
router.get('/:id/game-characters', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as any;
  if (!game) return res.status(404).json({ error: 'Not found' });
  const isMember = game.dm_id === req.user!.id ||
    db.prepare('SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!isMember) return res.status(403).json({ error: 'Not a member' });

  const chars = db.prepare('SELECT * FROM characters WHERE game_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json(chars.map((c: any) => ({ ...c, sheet_data: JSON.parse(c.sheet_data) })));
});

router.post('/:id/game-characters', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND dm_id = ?').get(req.params.id, req.user!.id) as any;
  if (!game) return res.status(403).json({ error: 'DM only' });

  const { name, sheet_data } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const id = uuidv4();
  db.prepare('INSERT INTO characters (id, user_id, game_id, name, sheet_data) VALUES (?, ?, ?, ?, ?)').run(
    id, req.user!.id, req.params.id, name, JSON.stringify(sheet_data || {})
  );
  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as any;
  res.json({ ...char, sheet_data: JSON.parse(char.sheet_data) });
});

router.delete('/:id/game-characters/:charId', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND dm_id = ?').get(req.params.id, req.user!.id) as any;
  if (!game) return res.status(403).json({ error: 'DM only' });
  db.prepare('DELETE FROM characters WHERE id = ? AND game_id = ?').run(req.params.charId, req.params.id);
  res.json({ deleted: true });
});

// Claim a pre-built game character (player copies it to their account)
router.post('/:id/game-characters/:charId/claim', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as any;
  if (!game) return res.status(404).json({ error: 'Not found' });
  if (game.dm_id === req.user!.id) return res.status(400).json({ error: 'DM cannot claim characters' });

  const template = db.prepare('SELECT * FROM characters WHERE id = ? AND game_id = ?').get(req.params.charId, req.params.id) as any;
  if (!template) return res.status(404).json({ error: 'Game character not found' });

  const newId = uuidv4();
  db.prepare('INSERT INTO characters (id, user_id, name, sheet_data) VALUES (?, ?, ?, ?)').run(
    newId, req.user!.id, template.name, template.sheet_data
  );

  // Assign to the player in this game
  db.prepare('INSERT INTO game_players (game_id, user_id, character_id) VALUES (?, ?, ?) ON CONFLICT(game_id, user_id) DO UPDATE SET character_id = excluded.character_id')
    .run(req.params.id, req.user!.id, newId);

  const newChar = db.prepare('SELECT * FROM characters WHERE id = ?').get(newId) as any;
  res.json({ ...newChar, sheet_data: JSON.parse(newChar.sheet_data) });
});

// Party characters — readable by all game members
router.get('/:id/party', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as any;
  if (!game) return res.status(404).json({ error: 'Not found' });

  const isMember = game.dm_id === req.user!.id ||
    db.prepare('SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!isMember) return res.status(403).json({ error: 'Not a member' });

  const rows = db.prepare(`
    SELECT u.id as user_id, u.username, c.id as character_id, c.name as char_name,
           c.avatar_url, c.sheet_data
    FROM game_players gp
    JOIN users u ON u.id = gp.user_id
    LEFT JOIN characters c ON c.id = gp.character_id
    WHERE gp.game_id = ?
  `).all(req.params.id) as any[];

  res.json(rows.map((r) => ({
    user_id: r.user_id,
    username: r.username,
    character_id: r.character_id,
    char_name: r.char_name,
    avatar_url: r.avatar_url,
    sheet_data: r.sheet_data ? JSON.parse(r.sheet_data) : null,
  })));
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND dm_id = ?').get(req.params.id, req.user!.id) as any;
  if (!game) return res.status(403).json({ error: 'Not authorized' });

  const { name, description, current_map_id } = req.body;
  db.prepare('UPDATE games SET name = ?, description = ?, current_map_id = ? WHERE id = ?').run(
    name || game.name,
    description !== undefined ? description : game.description,
    current_map_id !== undefined ? current_map_id : game.current_map_id,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id));
});

export default router;
