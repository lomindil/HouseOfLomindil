import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

function parseMonster(r: any) {
  return {
    ...r,
    stats: JSON.parse(r.stats),
    saving_throws: JSON.parse(r.saving_throws),
    skills: JSON.parse(r.skills),
    traits: JSON.parse(r.traits),
    actions: JSON.parse(r.actions),
    reactions: JSON.parse(r.reactions),
    legendary_actions: JSON.parse(r.legendary_actions),
  };
}

router.get('/monsters', (_req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM monster_templates ORDER BY name ASC').all() as any[];
  res.json(rows.map(parseMonster));
});

router.get('/characters', (_req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM character_templates ORDER BY name ASC').all() as any[];
  res.json(rows.map((r: any) => ({ ...r, sheet_data: JSON.parse(r.sheet_data) })));
});

router.post('/monsters/:id/import/:gameId', (req: AuthRequest, res: Response) => {
  const tmpl = db.prepare('SELECT * FROM monster_templates WHERE id = ?').get(req.params.id) as any;
  if (!tmpl) return res.status(404).json({ error: 'Not found' });
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND dm_id = ?').get(req.params.gameId, req.user!.id) as any;
  if (!game) return res.status(403).json({ error: 'DM only' });

  const id = uuidv4();
  db.prepare(`INSERT INTO game_monsters
    (id,game_id,name,type,size,alignment,cr,xp,ac,ac_type,max_hp,hp_dice,speed,stats,
     saving_throws,skills,damage_vulnerabilities,damage_resistances,damage_immunities,
     condition_immunities,senses,languages,traits,actions,reactions,legendary_actions)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, req.params.gameId, tmpl.name, tmpl.type, tmpl.size, tmpl.alignment,
    tmpl.cr, tmpl.xp, tmpl.ac, tmpl.ac_type, tmpl.max_hp, tmpl.hp_dice, tmpl.speed,
    tmpl.stats, tmpl.saving_throws, tmpl.skills,
    tmpl.damage_vulnerabilities || '', tmpl.damage_resistances || '',
    tmpl.damage_immunities || '', tmpl.condition_immunities || '',
    tmpl.senses, tmpl.languages, tmpl.traits, tmpl.actions,
    tmpl.reactions || '[]', tmpl.legendary_actions || '[]');

  const m = db.prepare('SELECT * FROM game_monsters WHERE id = ?').get(id) as any;
  res.json({ ...m, stats: JSON.parse(m.stats), actions: JSON.parse(m.actions), traits: JSON.parse(m.traits) });
});

router.post('/characters/:id/import/:gameId', (req: AuthRequest, res: Response) => {
  const tmpl = db.prepare('SELECT * FROM character_templates WHERE id = ?').get(req.params.id) as any;
  if (!tmpl) return res.status(404).json({ error: 'Not found' });
  const game = db.prepare('SELECT * FROM games WHERE id = ? AND dm_id = ?').get(req.params.gameId, req.user!.id) as any;
  if (!game) return res.status(403).json({ error: 'DM only' });

  const id = uuidv4();
  db.prepare('INSERT INTO characters (id,user_id,game_id,name,sheet_data) VALUES (?,?,?,?,?)').run(
    id, req.user!.id, req.params.gameId, tmpl.name, tmpl.sheet_data
  );
  const c = db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as any;
  res.json({ ...c, sheet_data: JSON.parse(c.sheet_data) });
});

export default router;
