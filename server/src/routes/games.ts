import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendPbpInvite } from '../utils/mailer';

const avatarStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/avatars'),
  filename: (_req, file, cb) => cb(null, `gc-${uuidv4()}${path.extname(file.originalname)}`),
});
const gcUpload = multer({ storage: avatarStorage, limits: { fileSize: 2 * 1024 * 1024 } });

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
  const autoApproved = req.user!.username === 'lomindil' ? 1 : 0;
  db.prepare('INSERT INTO games (id, dm_id, name, description, join_code, approved) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, req.user!.id, name, description || '', joinCode, autoApproved
  );

  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  res.json(game);
});

// Public listing of active games (no join_code exposed)
router.get('/discover', (_req: AuthRequest, res: Response) => {
  const games = db.prepare(`
    SELECT g.id, g.name, g.description, g.status, u.username as dm_username,
           (SELECT COUNT(*) FROM game_players WHERE game_id = g.id) as player_count
    FROM games g
    JOIN users u ON u.id = g.dm_id
    WHERE g.status = 'active'
    ORDER BY g.created_at DESC
  `).all();
  res.json(games);
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
    SELECT u.id, u.username, gp.character_id, c.name as char_name, c.avatar_url,
           json_extract(c.sheet_data, '$.race') as char_race
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
  if (game.dm_id === req.user!.id) return res.status(400).json({ error: 'DM cannot join as a player' });

  if (character_id) {
    const ownChar = db.prepare('SELECT id FROM characters WHERE id = ? AND user_id = ?').get(character_id, req.user!.id);
    const gameChar = !ownChar && db.prepare('SELECT id FROM characters WHERE id = ? AND game_id = ?').get(character_id, game.id);
    if (!ownChar && !gameChar) return res.status(400).json({ error: 'Character not found' });
    if (gameChar) {
      const inUse = db.prepare('SELECT 1 FROM game_players WHERE game_id = ? AND character_id = ? AND user_id != ?').get(game.id, character_id, req.user!.id);
      if (inUse) return res.status(409).json({ error: 'Character already in use by another player' });
    }
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
    SELECT u.id, u.username, gp.character_id, c.name as char_name, c.avatar_url,
           json_extract(c.sheet_data, '$.race') as char_race
    FROM game_players gp
    JOIN users u ON u.id = gp.user_id
    LEFT JOIN characters c ON c.id = gp.character_id
    WHERE gp.game_id = ?
  `).all(req.params.id);

  const maps = db.prepare('SELECT id, name, grid_size, grid_color, image_url FROM maps WHERE game_id = ?').all(req.params.id);

  res.json({ ...game, dm_username: dm?.username, players, maps, is_dm: game.dm_id === req.user!.id });
});

router.post('/:id/launch', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND dm_id = ?').get(req.params.id, req.user!.id) as any;
  if (!game) return res.status(403).json({ error: 'Not authorized' });

  // If already active, just return success so the client can navigate in
  if (game.status === 'active') {
    return res.json({ status: 'active', join_code: game.join_code, session_id: game.current_session_id });
  }

  const activeCount = (db.prepare("SELECT COUNT(*) as cnt FROM games WHERE status = 'active' AND id != ?").get(req.params.id) as any).cnt;
  if (activeCount >= 3) return res.status(409).json({ error: 'Maximum of 3 games can be active simultaneously' });

  const sessionCount = (db.prepare('SELECT COUNT(*) as cnt FROM game_sessions WHERE game_id = ?').get(req.params.id) as any).cnt;
  const sessionId = uuidv4();
  const sessionName = req.body.session_name || `Session ${sessionCount + 1}`;
  db.prepare('INSERT INTO game_sessions (id, game_id, name, session_number) VALUES (?,?,?,?)').run(
    sessionId, req.params.id, sessionName, sessionCount + 1
  );
  db.prepare("UPDATE games SET status = 'active', current_session_id = ? WHERE id = ?").run(sessionId, req.params.id);
  res.json({ status: 'active', join_code: game.join_code, session_id: sessionId });
});

router.post('/:id/end', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND dm_id = ?').get(req.params.id, req.user!.id) as any;
  if (!game) return res.status(403).json({ error: 'Not authorized' });

  const { footnotes } = req.body;
  if (game.current_session_id) {
    db.prepare('UPDATE game_sessions SET status = ?, footnotes = ?, ended_at = unixepoch() WHERE id = ?').run(
      'ended', footnotes || '', game.current_session_id
    );
  }
  db.prepare("UPDATE games SET status = 'lobby', current_session_id = NULL WHERE id = ?").run(req.params.id);
  // Release any prebuilt character selections so they're available for the next session
  db.prepare(`
    UPDATE game_players SET character_id = NULL
    WHERE game_id = ? AND character_id IN (SELECT id FROM characters WHERE game_id = ?)
  `).run(req.params.id, req.params.id);
  (req.app.locals.io as any).to(`game:${req.params.id}`).emit('session_ended');
  res.json({ status: 'lobby' });
});

router.get('/:id/sessions', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as any;
  if (!game) return res.status(404).json({ error: 'Not found' });
  const isMember = game.dm_id === req.user!.id ||
    db.prepare('SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!isMember) return res.status(403).json({ error: 'Not a member' });
  const sessions = db.prepare('SELECT * FROM game_sessions WHERE game_id = ? ORDER BY session_number ASC').all(req.params.id);
  res.json(sessions);
});

// Pre-built game characters (DM creates, players can claim)
router.get('/:id/game-characters', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as any;
  if (!game) return res.status(404).json({ error: 'Not found' });
  const isMember = game.dm_id === req.user!.id ||
    db.prepare('SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!isMember) return res.status(403).json({ error: 'Not a member' });

  const chars = db.prepare(`
    SELECT c.*, gp.user_id as used_by_id, u.username as used_by_username
    FROM characters c
    LEFT JOIN game_players gp ON gp.character_id = c.id AND gp.game_id = c.game_id
    LEFT JOIN users u ON u.id = gp.user_id
    WHERE c.game_id = ?
    ORDER BY c.created_at ASC
  `).all(req.params.id);
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

router.put('/:id/game-characters/:charId', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND dm_id = ?').get(req.params.id, req.user!.id) as any;
  if (!game) return res.status(403).json({ error: 'DM only' });
  const { name, sheet_data } = req.body;
  db.prepare('UPDATE characters SET name = ?, sheet_data = ? WHERE id = ? AND game_id = ?').run(
    name, JSON.stringify(sheet_data || {}), req.params.charId, req.params.id
  );
  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.charId) as any;
  res.json({ ...char, sheet_data: JSON.parse(char.sheet_data) });
});

router.post('/:id/game-characters/:charId/avatar', gcUpload.single('avatar'), (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND dm_id = ?').get(req.params.id, req.user!.id) as any;
  if (!game) return res.status(403).json({ error: 'DM only' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE characters SET avatar_url = ? WHERE id = ? AND game_id = ?').run(url, req.params.charId, req.params.id);
  res.json({ avatar_url: url });
});

router.delete('/:id/game-characters/:charId', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND dm_id = ?').get(req.params.id, req.user!.id) as any;
  if (!game) return res.status(403).json({ error: 'DM only' });
  db.prepare('DELETE FROM characters WHERE id = ? AND game_id = ?').run(req.params.charId, req.params.id);
  res.json({ deleted: true });
});

// Select a pre-built game character for this session (session-scoped, no permanent claim)
router.post('/:id/game-characters/:charId/claim', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as any;
  if (!game) return res.status(404).json({ error: 'Not found' });
  if (game.dm_id === req.user!.id) return res.status(400).json({ error: 'DM cannot play a character' });

  const char = db.prepare('SELECT * FROM characters WHERE id = ? AND game_id = ?').get(req.params.charId, req.params.id) as any;
  if (!char) return res.status(404).json({ error: 'Character not found' });

  // Block if another player already has this character selected for this game
  const inUse = db.prepare(
    'SELECT user_id FROM game_players WHERE game_id = ? AND character_id = ? AND user_id != ?'
  ).get(req.params.id, req.params.charId, req.user!.id) as any;
  if (inUse) return res.status(409).json({ error: 'Another player is already using this character' });

  db.prepare(`
    INSERT INTO game_players (game_id, user_id, character_id)
    VALUES (?, ?, ?)
    ON CONFLICT(game_id, user_id) DO UPDATE SET character_id = excluded.character_id
  `).run(req.params.id, req.user!.id, req.params.charId);

  res.json({ ...char, sheet_data: JSON.parse(char.sheet_data || '{}') });
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

// PATCH /:id/party/:characterId/hp — DM adjusts HP directly in sheet (PBP context)
router.patch('/:id/party/:characterId/hp', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT dm_id FROM games WHERE id = ?').get(req.params.id) as any;
  if (!game || game.dm_id !== req.user!.id) return res.status(403).json({ error: 'DM only' });

  const { delta } = req.body;
  if (typeof delta !== 'number') return res.status(400).json({ error: 'delta required' });

  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.characterId) as any;
  if (!char) return res.status(404).json({ error: 'Character not found' });

  const sheet = JSON.parse(char.sheet_data || '{}');
  const combat = sheet.combat || {};
  const maxHp = combat.max_hp || 0;
  const newHp = Math.max(0, Math.min(maxHp || 999, (combat.current_hp || 0) + delta));
  sheet.combat = { ...combat, current_hp: newHp };
  db.prepare('UPDATE characters SET sheet_data = ? WHERE id = ?').run(JSON.stringify(sheet), req.params.characterId);
  res.json({ character_id: req.params.characterId, current_hp: newHp, max_hp: maxHp });
});

// GET /:id/invite-list — players + campaign army emails (DM only)
router.get('/:id/invite-list', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT dm_id FROM games WHERE id = ?').get(req.params.id) as any;
  if (!game || game.dm_id !== req.user!.id) return res.status(403).json({ error: 'DM only' });

  const players = db.prepare(`
    SELECT u.id, u.username, u.email FROM game_players gp
    JOIN users u ON u.id = gp.user_id WHERE gp.game_id = ?
  `).all(req.params.id);

  const army = db.prepare(
    'SELECT id, display_name, email FROM campaign_army WHERE game_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);

  res.json({ players, army });
});

// POST /:id/send-invites — queue PBP invitation emails (DM only); responds immediately
router.post('/:id/send-invites', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND dm_id = ?').get(req.params.id, req.user!.id) as any;
  if (!game) return res.status(403).json({ error: 'DM only' });

  const { recipients } = req.body; // [{ name: string, email: string }]
  if (!Array.isArray(recipients) || recipients.length === 0) return res.status(400).json({ error: 'No recipients' });

  const gameUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/games/${req.params.id}/pbp`;
  const toSend = (recipients as { name: string; email: string }[]).filter(r => !!r.email);

  // Respond immediately — do not block on email delivery
  res.json({ sent: toSend.length });

  // Fire and forget — log failures but don't surface them to the client
  for (const r of toSend) {
    sendPbpInvite(r.email, r.name || r.email, game.name, gameUrl, game.join_code)
      .catch(err => console.error('[mailer] invite failed →', r.email, err?.message));
  }
});

// POST /:id/regenerate-code — DM generates a new join code
router.post('/:id/regenerate-code', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT dm_id FROM games WHERE id = ?').get(req.params.id) as any;
  if (!game || game.dm_id !== req.user!.id) return res.status(403).json({ error: 'DM only' });

  let newCode = generateJoinCode();
  while (db.prepare('SELECT id FROM games WHERE join_code = ?').get(newCode)) {
    newCode = generateJoinCode();
  }
  db.prepare('UPDATE games SET join_code = ? WHERE id = ?').run(newCode, req.params.id);
  res.json({ join_code: newCode });
});

// DELETE /:id/leave — player voluntarily leaves the campaign
router.delete('/:id/leave', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.id) as any;
  if (!game) return res.status(404).json({ error: 'Not found' });
  if (game.dm_id === req.user!.id) return res.status(400).json({ error: 'DM cannot leave their own campaign' });
  db.prepare('DELETE FROM game_players WHERE game_id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  res.json({ ok: true });
});

// DELETE /:id/players/:userId — DM kicks a player
router.delete('/:id/players/:userId', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT dm_id FROM games WHERE id = ?').get(req.params.id) as any;
  if (!game || game.dm_id !== req.user!.id) return res.status(403).json({ error: 'DM only' });
  if (req.params.userId === req.user!.id) return res.status(400).json({ error: 'Cannot kick yourself' });
  db.prepare('DELETE FROM game_players WHERE game_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ ok: true });
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

router.delete('/:id', (req: AuthRequest, res: Response) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND dm_id = ?').get(req.params.id, req.user!.id) as any;
  if (!game) return res.status(403).json({ error: 'Not authorized' });

  const gid = req.params.id;
  // Delete all related data in dependency order
  db.prepare('DELETE FROM encounter_combatants WHERE encounter_id IN (SELECT id FROM encounters WHERE game_id = ?)').run(gid);
  db.prepare('DELETE FROM encounters WHERE game_id = ?').run(gid);
  db.prepare('DELETE FROM game_monsters WHERE game_id = ?').run(gid);
  db.prepare('DELETE FROM game_sessions WHERE game_id = ?').run(gid);
  db.prepare('DELETE FROM chat_messages WHERE game_id = ?').run(gid);
  db.prepare('DELETE FROM handouts WHERE game_id = ?').run(gid);
  db.prepare('DELETE FROM maps WHERE game_id = ?').run(gid);
  db.prepare('DELETE FROM game_players WHERE game_id = ?').run(gid);
  db.prepare('DELETE FROM characters WHERE game_id = ?').run(gid);
  db.prepare('DELETE FROM games WHERE id = ?').run(gid);

  res.json({ ok: true });
});

export default router;
