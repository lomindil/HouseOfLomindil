import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DB_DIR, 'tavern.db'));

db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA foreign_keys = ON`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS otps (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    avatar_url TEXT,
    sheet_data TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    dm_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'lobby',
    join_code TEXT UNIQUE NOT NULL,
    current_map_id TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS game_players (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
    joined_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (game_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS maps (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    grid_size INTEGER DEFAULT 50,
    grid_color TEXT DEFAULT '#ffffff',
    grid_opacity REAL DEFAULT 0.3,
    fog_data TEXT DEFAULT '{}',
    drawings TEXT DEFAULT '[]',
    tokens TEXT DEFAULT '[]',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    username TEXT NOT NULL,
    type TEXT DEFAULT 'chat',
    content TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS handouts (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    file_url TEXT,
    shared_with TEXT DEFAULT '[]',
    created_at INTEGER DEFAULT (unixepoch())
  );
`);

// New tables
db.exec(`
  CREATE TABLE IF NOT EXISTS game_monsters (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'Beast',
    size TEXT DEFAULT 'Medium',
    alignment TEXT DEFAULT 'Unaligned',
    cr TEXT DEFAULT '0',
    xp INTEGER DEFAULT 10,
    ac INTEGER DEFAULT 10,
    ac_type TEXT DEFAULT '',
    max_hp INTEGER DEFAULT 10,
    hp_dice TEXT DEFAULT '2d6',
    speed TEXT DEFAULT '30 ft.',
    avatar_url TEXT,
    stats TEXT DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
    saving_throws TEXT DEFAULT '[]',
    skills TEXT DEFAULT '[]',
    damage_vulnerabilities TEXT DEFAULT '',
    damage_resistances TEXT DEFAULT '',
    damage_immunities TEXT DEFAULT '',
    condition_immunities TEXT DEFAULT '',
    senses TEXT DEFAULT 'Passive Perception 10',
    languages TEXT DEFAULT 'Common',
    traits TEXT DEFAULT '[]',
    actions TEXT DEFAULT '[]',
    reactions TEXT DEFAULT '[]',
    legendary_actions TEXT DEFAULT '[]',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS encounters (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    round INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS encounter_combatants (
    id TEXT PRIMARY KEY,
    encounter_id TEXT NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    ref_id TEXT,
    initiative INTEGER DEFAULT 0,
    current_hp INTEGER DEFAULT 0,
    max_hp INTEGER DEFAULT 0,
    ac INTEGER DEFAULT 10,
    avatar_url TEXT,
    stats TEXT DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
    actions TEXT DEFAULT '[]',
    status TEXT DEFAULT 'active',
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS game_sessions (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    session_number INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    footnotes TEXT DEFAULT '',
    started_at INTEGER DEFAULT (unixepoch()),
    ended_at INTEGER
  );
`);

// Migrations
try {
  db.exec(`ALTER TABLE characters ADD COLUMN game_id TEXT REFERENCES games(id) ON DELETE CASCADE`);
} catch { /* already exists */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
} catch { /* already exists */ }
try {
  db.exec(`ALTER TABLE games ADD COLUMN current_session_id TEXT`);
} catch { /* already exists */ }

export const stmt = (sql: string) => db.prepare(sql);

export default db;
