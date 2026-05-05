import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);

const avatarStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/avatars'),
  filename: (_req, file, cb) => cb(null, `monster-${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage: avatarStorage, limits: { fileSize: 2 * 1024 * 1024 } });

function isDM(gameId: string, userId: string): boolean {
  const g = db.prepare('SELECT dm_id FROM games WHERE id = ?').get(gameId) as any;
  return g?.dm_id === userId;
}
function isMember(gameId: string, userId: string): boolean {
  const g = db.prepare('SELECT dm_id FROM games WHERE id = ?').get(gameId) as any;
  if (!g) return false;
  if (g.dm_id === userId) return true;
  return !!db.prepare('SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?').get(gameId, userId);
}

function parseMonster(m: any) {
  return {
    ...m,
    stats: JSON.parse(m.stats || '{}'),
    saving_throws: JSON.parse(m.saving_throws || '[]'),
    skills: JSON.parse(m.skills || '[]'),
    traits: JSON.parse(m.traits || '[]'),
    actions: JSON.parse(m.actions || '[]'),
    reactions: JSON.parse(m.reactions || '[]'),
    legendary_actions: JSON.parse(m.legendary_actions || '[]'),
  };
}

router.get('/', (req: AuthRequest, res: Response) => {
  if (!isMember(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'Access denied' });
  const monsters = db.prepare('SELECT * FROM game_monsters WHERE game_id = ? ORDER BY name ASC').all(req.params.gameId);
  res.json(monsters.map(parseMonster));
});

router.post('/', (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  const { name, type, size, alignment, cr, xp, ac, ac_type, max_hp, hp_dice, speed,
    stats, saving_throws, skills, damage_vulnerabilities, damage_resistances,
    damage_immunities, condition_immunities, senses, languages,
    traits, actions, reactions, legendary_actions } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO game_monsters (id, game_id, name, type, size, alignment, cr, xp, ac, ac_type,
      max_hp, hp_dice, speed, stats, saving_throws, skills,
      damage_vulnerabilities, damage_resistances, damage_immunities, condition_immunities,
      senses, languages, traits, actions, reactions, legendary_actions)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, req.params.gameId, name,
    type || 'Beast', size || 'Medium', alignment || 'Unaligned',
    cr || '0', xp || 0, ac || 10, ac_type || '',
    max_hp || 10, hp_dice || '2d6', speed || '30 ft.',
    JSON.stringify(stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
    JSON.stringify(saving_throws || []),
    JSON.stringify(skills || []),
    damage_vulnerabilities || '', damage_resistances || '',
    damage_immunities || '', condition_immunities || '',
    senses || 'Passive Perception 10', languages || 'Common',
    JSON.stringify(traits || []),
    JSON.stringify(actions || []),
    JSON.stringify(reactions || []),
    JSON.stringify(legendary_actions || []));
  const m = db.prepare('SELECT * FROM game_monsters WHERE id = ?').get(id) as any;
  res.json(parseMonster(m));
});

router.put('/:mId', (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  const m = db.prepare('SELECT * FROM game_monsters WHERE id = ? AND game_id = ?').get(req.params.mId, req.params.gameId) as any;
  if (!m) return res.status(404).json({ error: 'Not found' });
  const { name, type, size, alignment, cr, xp, ac, ac_type, max_hp, hp_dice, speed,
    stats, saving_throws, skills, damage_vulnerabilities, damage_resistances,
    damage_immunities, condition_immunities, senses, languages,
    traits, actions, reactions, legendary_actions } = req.body;
  db.prepare(`
    UPDATE game_monsters SET name=?,type=?,size=?,alignment=?,cr=?,xp=?,ac=?,ac_type=?,
      max_hp=?,hp_dice=?,speed=?,stats=?,saving_throws=?,skills=?,
      damage_vulnerabilities=?,damage_resistances=?,damage_immunities=?,condition_immunities=?,
      senses=?,languages=?,traits=?,actions=?,reactions=?,legendary_actions=?
    WHERE id=?
  `).run(name ?? m.name, type ?? m.type, size ?? m.size, alignment ?? m.alignment,
    cr ?? m.cr, xp ?? m.xp, ac ?? m.ac, ac_type ?? m.ac_type,
    max_hp ?? m.max_hp, hp_dice ?? m.hp_dice, speed ?? m.speed,
    stats ? JSON.stringify(stats) : m.stats,
    saving_throws ? JSON.stringify(saving_throws) : m.saving_throws,
    skills ? JSON.stringify(skills) : m.skills,
    damage_vulnerabilities ?? m.damage_vulnerabilities,
    damage_resistances ?? m.damage_resistances,
    damage_immunities ?? m.damage_immunities,
    condition_immunities ?? m.condition_immunities,
    senses ?? m.senses, languages ?? m.languages,
    traits ? JSON.stringify(traits) : m.traits,
    actions ? JSON.stringify(actions) : m.actions,
    reactions ? JSON.stringify(reactions) : m.reactions,
    legendary_actions ? JSON.stringify(legendary_actions) : m.legendary_actions,
    req.params.mId);
  const updated = db.prepare('SELECT * FROM game_monsters WHERE id = ?').get(req.params.mId) as any;
  res.json(parseMonster(updated));
});

router.delete('/:mId', (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  db.prepare('DELETE FROM game_monsters WHERE id = ? AND game_id = ?').run(req.params.mId, req.params.gameId);
  res.json({ deleted: true });
});

router.post('/:mId/avatar', upload.single('avatar'), (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE game_monsters SET avatar_url = ? WHERE id = ? AND game_id = ?').run(url, req.params.mId, req.params.gameId);
  res.json({ avatar_url: url });
});

export default router;
