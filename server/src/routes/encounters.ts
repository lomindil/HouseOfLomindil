import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate);

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

function parseEncounter(e: any) {
  const combatants = db.prepare(
    'SELECT * FROM encounter_combatants WHERE encounter_id = ? ORDER BY sort_order ASC, initiative DESC'
  ).all(e.id).map((c: any) => ({
    ...c,
    stats: JSON.parse(c.stats || '{}'),
    actions: JSON.parse(c.actions || '[]'),
  }));
  return { ...e, combatants };
}

// GET all encounters for a game (DM only - hidden from players)
router.get('/', (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  const encounters = db.prepare('SELECT * FROM encounters WHERE game_id = ? ORDER BY created_at ASC').all(req.params.gameId);
  res.json(encounters.map(parseEncounter));
});

// GET single encounter (DM only for full data; members can see active encounter basic info)
router.get('/:eId', (req: AuthRequest, res: Response) => {
  if (!isMember(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'Access denied' });
  const e = db.prepare('SELECT * FROM encounters WHERE id = ? AND game_id = ?').get(req.params.eId, req.params.gameId) as any;
  if (!e) return res.status(404).json({ error: 'Not found' });
  if (!isDM(req.params.gameId, req.user!.id) && e.status !== 'active') return res.status(403).json({ error: 'DM only' });
  res.json(parseEncounter(e));
});

// POST create encounter
router.post('/', (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = uuidv4();
  db.prepare('INSERT INTO encounters (id, game_id, name, description) VALUES (?,?,?,?)').run(
    id, req.params.gameId, name, description || ''
  );
  const e = db.prepare('SELECT * FROM encounters WHERE id = ?').get(id) as any;
  res.json(parseEncounter(e));
});

// PUT update encounter (start, end, update notes, advance round)
router.put('/:eId', (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  const e = db.prepare('SELECT * FROM encounters WHERE id = ? AND game_id = ?').get(req.params.eId, req.params.gameId) as any;
  if (!e) return res.status(404).json({ error: 'Not found' });
  const { status, round, notes, name, description } = req.body;
  db.prepare('UPDATE encounters SET name=?,description=?,status=?,round=?,notes=? WHERE id=?').run(
    name ?? e.name, description ?? e.description,
    status ?? e.status, round ?? e.round, notes ?? e.notes, e.id
  );
  const updated = db.prepare('SELECT * FROM encounters WHERE id = ?').get(e.id) as any;
  res.json(parseEncounter(updated));
});

// DELETE encounter
router.delete('/:eId', (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  db.prepare('DELETE FROM encounters WHERE id = ? AND game_id = ?').run(req.params.eId, req.params.gameId);
  res.json({ deleted: true });
});

// POST add combatant (from monster or player character)
router.post('/:eId/combatants', (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  const encounter = db.prepare('SELECT * FROM encounters WHERE id = ? AND game_id = ?').get(req.params.eId, req.params.gameId) as any;
  if (!encounter) return res.status(404).json({ error: 'Encounter not found' });

  const { type, ref_id, name, current_hp, max_hp, ac, avatar_url, stats, actions } = req.body;
  if (!type || !name) return res.status(400).json({ error: 'type and name required' });

  const id = uuidv4();
  const count = (db.prepare('SELECT COUNT(*) as c FROM encounter_combatants WHERE encounter_id = ?').get(req.params.eId) as any).c;
  db.prepare(`
    INSERT INTO encounter_combatants (id, encounter_id, name, type, ref_id, current_hp, max_hp, ac, avatar_url, stats, actions, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, req.params.eId, name, type, ref_id || null,
    current_hp ?? max_hp ?? 10, max_hp ?? 10, ac ?? 10,
    avatar_url || null,
    JSON.stringify(stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
    JSON.stringify(actions || []),
    count);
  const c = db.prepare('SELECT * FROM encounter_combatants WHERE id = ?').get(id) as any;
  res.json({ ...c, stats: JSON.parse(c.stats), actions: JSON.parse(c.actions) });
});

// PUT update combatant (HP, initiative, status)
router.put('/:eId/combatants/:cId', (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  const c = db.prepare('SELECT * FROM encounter_combatants WHERE id = ? AND encounter_id = ?').get(req.params.cId, req.params.eId) as any;
  if (!c) return res.status(404).json({ error: 'Not found' });
  const { initiative, current_hp, status, sort_order } = req.body;
  db.prepare('UPDATE encounter_combatants SET initiative=?,current_hp=?,status=?,sort_order=? WHERE id=?').run(
    initiative ?? c.initiative, current_hp ?? c.current_hp,
    status ?? c.status, sort_order ?? c.sort_order, c.id
  );
  const updated = db.prepare('SELECT * FROM encounter_combatants WHERE id = ?').get(c.id) as any;
  res.json({ ...updated, stats: JSON.parse(updated.stats), actions: JSON.parse(updated.actions) });
});

// DELETE combatant
router.delete('/:eId/combatants/:cId', (req: AuthRequest, res: Response) => {
  if (!isDM(req.params.gameId, req.user!.id)) return res.status(403).json({ error: 'DM only' });
  db.prepare('DELETE FROM encounter_combatants WHERE id = ? AND encounter_id = ?').run(req.params.cId, req.params.eId);
  res.json({ deleted: true });
});

export default router;
