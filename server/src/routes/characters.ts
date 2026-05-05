import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import db from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const avatarStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/avatars'),
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage: avatarStorage, limits: { fileSize: 2 * 1024 * 1024 } });

router.use(authenticate);

router.get('/', (req: AuthRequest, res: Response) => {
  const chars = db.prepare('SELECT * FROM characters WHERE user_id = ? ORDER BY created_at DESC').all(req.user!.id);
  res.json(chars.map((c: any) => ({ ...c, sheet_data: JSON.parse(c.sheet_data) })));
});

router.post('/', (req: AuthRequest, res: Response) => {
  const { name, sheet_data } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const id = uuidv4();
  const data = JSON.stringify(sheet_data || defaultSheet(name));
  db.prepare('INSERT INTO characters (id, user_id, name, sheet_data) VALUES (?, ?, ?, ?)').run(id, req.user!.id, name, data);
  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as any;
  res.json({ ...char, sheet_data: JSON.parse(char.sheet_data) });
});

router.get('/:id', (req: AuthRequest, res: Response) => {
  const char = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id) as any;
  if (!char) return res.status(404).json({ error: 'Not found' });
  res.json({ ...char, sheet_data: JSON.parse(char.sheet_data) });
});

router.put('/:id', (req: AuthRequest, res: Response) => {
  const char = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id) as any;
  if (!char) return res.status(404).json({ error: 'Not found' });

  const { name, sheet_data } = req.body;
  db.prepare(`
    UPDATE characters SET name = ?, sheet_data = ?, updated_at = unixepoch() WHERE id = ?
  `).run(name || char.name, JSON.stringify(sheet_data || JSON.parse(char.sheet_data)), req.params.id);

  const updated = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.id) as any;
  res.json({ ...updated, sheet_data: JSON.parse(updated.sheet_data) });
});

router.post('/:id/avatar', upload.single('avatar'), (req: AuthRequest, res: Response) => {
  const char = db.prepare('SELECT * FROM characters WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id) as any;
  if (!char) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'No file' });

  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  db.prepare('UPDATE characters SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.params.id);
  res.json({ avatar_url: avatarUrl });
});

router.delete('/:id', (req: AuthRequest, res: Response) => {
  db.prepare('DELETE FROM characters WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  res.json({ success: true });
});

function defaultSheet(name: string) {
  return {
    name,
    race: '', class: '', subclass: '', background: '', alignment: '', level: 1,
    experience: 0, inspiration: false,
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saving_throws: { str: false, dex: false, con: false, int: false, wis: false, cha: false },
    skills: {
      acrobatics: false, animal_handling: false, arcana: false, athletics: false,
      deception: false, history: false, insight: false, intimidation: false,
      investigation: false, medicine: false, nature: false, perception: false,
      performance: false, persuasion: false, religion: false, sleight_of_hand: false,
      stealth: false, survival: false,
    },
    combat: { ac: 10, initiative: 0, speed: 30, max_hp: 10, current_hp: 10, temp_hp: 0, hit_dice: '1d8', death_saves: { successes: 0, failures: 0 } },
    attacks: [],
    equipment: '',
    features: '',
    traits: { personality: '', ideals: '', bonds: '', flaws: '' },
    backstory: '',
    notes: '',
    spell_slots: {},
    spells: [],
    proficiency_bonus: 2,
  };
}

export default router;
