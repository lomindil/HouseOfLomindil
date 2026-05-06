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

// Global library tables
db.exec(`
  CREATE TABLE IF NOT EXISTS monster_templates (
    id TEXT PRIMARY KEY,
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
    source TEXT DEFAULT 'SRD',
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS character_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar_url TEXT,
    sheet_data TEXT NOT NULL DEFAULT '{}',
    source TEXT DEFAULT 'SRD',
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
  db.exec(`ALTER TABLE characters ADD COLUMN claimed_by TEXT REFERENCES users(id) ON DELETE SET NULL`);
} catch { /* already exists */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
} catch { /* already exists */ }
try {
  db.exec(`ALTER TABLE games ADD COLUMN current_session_id TEXT`);
} catch { /* already exists */ }

// ─── SRD Seed Data ────────────────────────────────────────────────────────────
const monsterCount = (db.prepare('SELECT COUNT(*) as cnt FROM monster_templates').get() as any).cnt;
if (monsterCount === 0) {
  const ins = db.prepare(`INSERT INTO monster_templates
    (id,name,type,size,alignment,cr,xp,ac,ac_type,max_hp,hp_dice,speed,stats,
     saving_throws,skills,senses,languages,traits,actions,reactions,legendary_actions,source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const M = (id: string, name: string, type: string, size: string, alignment: string,
    cr: string, xp: number, ac: number, ac_type: string, max_hp: number, hp_dice: string,
    speed: string, stats: object, sv: any[], skills: any[], senses: string, lang: string,
    traits: any[], actions: any[], reactions: any[] = [], legendary: any[] = []) =>
    ins.run(id, name, type, size, alignment, cr, xp, ac, ac_type, max_hp, hp_dice, speed,
      JSON.stringify(stats), JSON.stringify(sv), JSON.stringify(skills), senses, lang,
      JSON.stringify(traits), JSON.stringify(actions), JSON.stringify(reactions), JSON.stringify(legendary), 'SRD');

  M('tmpl-bandit','Bandit','Humanoid','Medium','Neutral Evil','1/8',25,12,'Leather Armor',11,'2d8+2','30 ft.',
    {str:11,dex:12,con:12,int:10,wis:10,cha:10},[],[],
    'Passive Perception 10','Common',[],
    [{name:'Scimitar',action_type:'attack',to_hit:3,damage:'1d6+1',damage_type:'slashing',reach:'5 ft.'},
     {name:'Light Crossbow',action_type:'attack',to_hit:3,damage:'1d8+1',damage_type:'piercing',reach:'80/320 ft.'}]);

  M('tmpl-cultist','Cultist','Humanoid','Medium','Neutral Evil','1/8',25,12,'Leather Armor',9,'2d8','30 ft.',
    {str:11,dex:12,con:10,int:10,wis:11,cha:10},[],[],
    'Passive Perception 11','Any one language',[{name:'Dark Devotion',description:'Advantage on saves vs. being charmed or frightened.'}],
    [{name:'Scimitar',action_type:'attack',to_hit:3,damage:'1d6+1',damage_type:'slashing',reach:'5 ft.'}]);

  M('tmpl-guard','Guard','Humanoid','Medium','Unaligned','1/8',25,16,'Chain Shirt, Shield',11,'2d8+2','30 ft.',
    {str:13,dex:12,con:12,int:10,wis:11,cha:10},[],[{name:'Perception',bonus:2}],
    'Passive Perception 12','Common',[],
    [{name:'Spear',action_type:'attack',to_hit:3,damage:'1d6+1',damage_type:'piercing',reach:'5 ft. or 20/60 ft.'}]);

  M('tmpl-goblin','Goblin','Humanoid','Small','Neutral Evil','1/4',50,15,'Leather Armor, Shield',7,'2d6','30 ft.',
    {str:8,dex:14,con:10,int:10,wis:8,cha:8},[],[{name:'Stealth',bonus:6}],
    'Darkvision 60 ft., Passive Perception 9','Common, Goblin',
    [{name:'Nimble Escape',description:'Can take the Disengage or Hide action as a bonus action each turn.'}],
    [{name:'Scimitar',action_type:'attack',to_hit:4,damage:'1d6+2',damage_type:'slashing',reach:'5 ft.'},
     {name:'Shortbow',action_type:'attack',to_hit:4,damage:'1d6+2',damage_type:'piercing',reach:'80/320 ft.'}]);

  M('tmpl-skeleton','Skeleton','Undead','Medium','Lawful Evil','1/4',50,13,'Armor Scraps',13,'2d8+4','30 ft.',
    {str:10,dex:14,con:15,int:6,wis:8,cha:5},[],[],
    'Darkvision 60 ft., Passive Perception 9','Understands languages it knew in life but cannot speak',
    [],[{name:'Shortsword',action_type:'attack',to_hit:4,damage:'1d6+2',damage_type:'piercing',reach:'5 ft.'},
        {name:'Shortbow',action_type:'attack',to_hit:4,damage:'1d6+2',damage_type:'piercing',reach:'80/320 ft.'}]);

  M('tmpl-wolf','Wolf','Beast','Medium','Unaligned','1/4',50,13,'Natural Armor',11,'2d8+2','40 ft.',
    {str:12,dex:15,con:12,int:3,wis:12,cha:6},[],[{name:'Perception',bonus:3},{name:'Stealth',bonus:4}],
    'Passive Perception 13','—',
    [{name:'Keen Hearing and Smell',description:'Advantage on Perception checks using hearing or smell.'},
     {name:'Pack Tactics',description:'Advantage on attacks if an ally is adjacent to the target and not incapacitated.'}],
    [{name:'Bite',action_type:'attack',to_hit:4,damage:'2d4+2',damage_type:'piercing',reach:'5 ft.',description:'DC 11 Str save or knocked prone.'}]);

  M('tmpl-zombie','Zombie','Undead','Medium','Neutral Evil','1/4',50,8,'',22,'3d8+9','20 ft.',
    {str:13,dex:6,con:16,int:3,wis:6,cha:5},[{name:'Wis',bonus:0}],[],
    'Darkvision 60 ft., Passive Perception 8','Understands languages it knew in life',
    [{name:'Undead Fortitude',description:'If reduced to 0 HP by non-radiant damage, make DC (5 + damage) Con save to drop to 1 HP instead.'}],
    [{name:'Slam',action_type:'attack',to_hit:3,damage:'1d6+1',damage_type:'bludgeoning',reach:'5 ft.'}]);

  M('tmpl-orc','Orc','Humanoid','Medium','Chaotic Evil','1/2',100,13,'Hide Armor',15,'2d8+6','30 ft.',
    {str:16,dex:12,con:16,int:7,wis:11,cha:10},[],[{name:'Intimidation',bonus:2}],
    'Darkvision 60 ft., Passive Perception 10','Common, Orc',
    [{name:'Aggressive',description:'As a bonus action, move up to speed toward a visible hostile creature.'}],
    [{name:'Greataxe',action_type:'attack',to_hit:5,damage:'1d12+3',damage_type:'slashing',reach:'5 ft.'},
     {name:'Javelin',action_type:'attack',to_hit:5,damage:'1d6+3',damage_type:'piercing',reach:'5 ft. or 30/120 ft.'}]);

  M('tmpl-hobgoblin','Hobgoblin','Humanoid','Medium','Lawful Evil','1/2',100,18,'Chain Mail, Shield',11,'2d8+2','30 ft.',
    {str:13,dex:12,con:12,int:10,wis:10,cha:9},[],[],
    'Darkvision 60 ft., Passive Perception 10','Common, Goblin',
    [{name:'Martial Advantage',description:'Once per turn, deal +7 (2d6) damage if an ally is adjacent to the target.'}],
    [{name:'Longsword',action_type:'attack',to_hit:3,damage:'1d8+1',damage_type:'slashing',reach:'5 ft.'},
     {name:'Longbow',action_type:'attack',to_hit:3,damage:'1d8+1',damage_type:'piercing',reach:'150/600 ft.'}]);

  M('tmpl-giant-spider','Giant Spider','Beast','Large','Unaligned','1',200,14,'Natural Armor',26,'4d10+4','30 ft., climb 30 ft.',
    {str:14,dex:16,con:12,int:2,wis:11,cha:4},[],[{name:'Stealth',bonus:7}],
    'Blindsight 10 ft., Darkvision 60 ft., Passive Perception 10','—',
    [{name:'Spider Climb',description:'Can climb difficult surfaces including upside down.'},
     {name:'Web Walker',description:'Ignores movement restrictions from webbing.'}],
    [{name:'Bite',action_type:'attack',to_hit:5,damage:'1d8+3',damage_type:'piercing',reach:'5 ft.',description:'DC 11 Con save or 9 (2d8) poison damage.'},
     {name:'Web',action_type:'save',save_dc:12,save_ability:'DEX',damage:'Restrained',damage_type:'condition',description:'Range 30/60 ft. Target restrained until DC 12 Str check.'}]);

  M('tmpl-ogre','Ogre','Giant','Large','Chaotic Evil','2',450,11,'Hide Armor',59,'7d10+21','40 ft.',
    {str:19,dex:8,con:16,int:5,wis:7,cha:7},[],[],
    'Darkvision 60 ft., Passive Perception 8','Common, Giant',[],
    [{name:'Greatclub',action_type:'attack',to_hit:6,damage:'2d8+4',damage_type:'bludgeoning',reach:'5 ft.'},
     {name:'Javelin',action_type:'attack',to_hit:6,damage:'2d6+4',damage_type:'piercing',reach:'5 ft. or 30/120 ft.'}]);

  M('tmpl-troll','Troll','Giant','Large','Chaotic Evil','5',1800,15,'Natural Armor',84,'8d10+40','30 ft.',
    {str:18,dex:13,con:20,int:7,wis:9,cha:7},[],[{name:'Perception',bonus:2}],
    'Darkvision 60 ft., Passive Perception 12','Giant',
    [{name:'Keen Smell',description:'Advantage on Perception checks using smell.'},
     {name:'Regeneration',description:'Regains 10 HP at start of turn. Suppressed if took acid or fire damage last turn.'}],
    [{name:'Multiattack',action_type:'none',description:'Three attacks: one Bite, two Claws.'},
     {name:'Bite',action_type:'attack',to_hit:7,damage:'1d6+4',damage_type:'piercing',reach:'5 ft.'},
     {name:'Claw',action_type:'attack',to_hit:7,damage:'2d6+4',damage_type:'slashing',reach:'5 ft.'}]);

  M('tmpl-vampire-spawn','Vampire Spawn','Undead','Medium','Neutral Evil','5',1800,15,'Natural Armor',82,'11d8+33','30 ft.',
    {str:16,dex:16,con:16,int:11,wis:10,cha:12},
    [{name:'Dex',bonus:6},{name:'Wis',bonus:3}],
    [{name:'Perception',bonus:3},{name:'Stealth',bonus:6}],
    'Darkvision 60 ft., Passive Perception 13','Languages of its creator',
    [{name:'Regeneration',description:'Regains 10 HP at start of turn if not in sunlight or running water.'},
     {name:'Spider Climb',description:'Can climb difficult surfaces without ability checks.'}],
    [{name:'Multiattack',action_type:'none',description:'Two attacks, only one can be Bite.'},
     {name:'Claws',action_type:'attack',to_hit:6,damage:'2d4+3',damage_type:'slashing',reach:'5 ft.'},
     {name:'Bite',action_type:'attack',to_hit:6,damage:'1d6+3',damage_type:'piercing',reach:'5 ft.',description:'DC 13 Con save or max HP reduced by damage taken.'}]);
}

const charTemplateCount = (db.prepare('SELECT COUNT(*) as cnt FROM character_templates').get() as any).cnt;
if (charTemplateCount === 0) {
  const ins = db.prepare('INSERT INTO character_templates (id,name,sheet_data,source) VALUES (?,?,?,?)');

  const templates = [
    { id:'tmpl-fighter', name:'Aldric — Human Fighter', data:{
      race:'Human',class:'Fighter',level:1,background:'Soldier',
      abilities:{strength:16,dexterity:13,constitution:15,intelligence:10,wisdom:12,charisma:8},
      combat:{max_hp:12,current_hp:12,ac:16,speed:30,initiative:1},
      attacks:[{name:'Longsword',to_hit:'+5',damage:'1d8+3 slashing'},{name:'Handaxe (thrown)',to_hit:'+5',damage:'1d6+3 slashing'}],
      skills:['Athletics +5','Intimidation +1','Perception +3','Survival +3'],
      proficiencies:'All armor, shields, simple weapons, martial weapons',
      features:'Fighting Style: Dueling (+2 damage one-handed)\nSecond Wind: Bonus action regain 1d10+1 HP (1/short rest)',
      equipment:'Chain mail, longsword, shield, two handaxes, explorer\'s pack',
      personality:'I face problems head-on. A simple direct solution is the best path.',
      ideals:'Live and Let Live. Ideals aren\'t worth killing over.',
      bonds:'I fight for those who cannot fight for themselves.',
      flaws:'I have a weakness for the vices of the city.',
      backstory:'Five years in the city guard honed Aldric\'s discipline and tactics before he left to seek adventure.',
      spellcasting:{ability:'',slots:{}},
    }},
    { id:'tmpl-wizard', name:'Sylvara — Elf Wizard', data:{
      race:'Elf',class:'Wizard',level:1,background:'Sage',
      abilities:{strength:8,dexterity:14,constitution:13,intelligence:17,wisdom:12,charisma:10},
      combat:{max_hp:7,current_hp:7,ac:12,speed:30,initiative:2},
      attacks:[{name:'Dagger',to_hit:'+4',damage:'1d4+2 piercing'},{name:'Fire Bolt (cantrip)',to_hit:'+5',damage:'1d10 fire'}],
      spellcasting:{ability:'INT',slots:{1:{max:2,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0}}},
      skills:['Arcana +5','History +5','Investigation +5','Insight +3'],
      proficiencies:'Daggers, darts, slings, quarterstaffs, light crossbows',
      features:'Arcane Recovery: Regain spell slots up to half wizard level (1/long rest)\nDarkvision 60 ft.\nFey Ancestry: Advantage vs. charm, immune to magical sleep',
      equipment:'Spellbook, component pouch, scholar\'s pack, dagger',
      spells_1:'Magic Missile\nBurning Hands\nMage Armor\nSleep',
      cantrips:'Fire Bolt\nPrestidigitation\nMage Hand',
      personality:'I am always calm, no matter the situation.',
      ideals:'Knowledge. The path to power is through knowledge.',
      bonds:'My life\'s work is a series of tomes on a specific field of lore.',
      flaws:'When I see a demon I stop and take notes on its anatomy.',
      backstory:'Sylvara spent decades studying at an elvish academy before her curiosity drew her into the wider world.',
    }},
    { id:'tmpl-cleric', name:'Brother Tomas — Dwarf Cleric', data:{
      race:'Dwarf',class:'Cleric',level:1,background:'Acolyte',
      abilities:{strength:14,dexterity:8,constitution:16,intelligence:10,wisdom:16,charisma:12},
      combat:{max_hp:10,current_hp:10,ac:18,speed:25,initiative:-1},
      attacks:[{name:'Warhammer',to_hit:'+4',damage:'1d8+2 bludgeoning'},{name:'Sacred Flame (cantrip)',to_hit:'DC 13 Dex',damage:'1d8 radiant'}],
      spellcasting:{ability:'WIS',slots:{1:{max:2,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0}}},
      skills:['Insight +5','Medicine +5','Religion +2','Persuasion +3'],
      proficiencies:'Light armor, medium armor, heavy armor, shields, simple weapons, warhammer',
      features:'Life Domain: Healing spells restore +2+spell level HP\nChannel Divinity: Turn Undead\nDarkvision 60 ft.\nDwarven Resilience: Advantage vs. poison',
      equipment:'Scale mail, shield, warhammer, holy symbol, priest\'s pack',
      spells_1:'Healing Word\nCure Wounds\nBless\nGuiding Bolt\nShield of Faith',
      cantrips:'Sacred Flame\nThaumaturgy\nGuidance',
      personality:'I quote sacred texts in almost every situation.',
      ideals:'Charity. I always help those in need.',
      bonds:'I would die to recover a lost relic of my faith.',
      flaws:'I am inflexible in my thinking.',
      backstory:'After clerics healed a grievous wound in his youth, Tomas devoted his life to the temple.',
    }},
    { id:'tmpl-rogue', name:'Swift — Halfling Rogue', data:{
      race:'Halfling',class:'Rogue',level:1,background:'Criminal',
      abilities:{strength:8,dexterity:17,constitution:13,intelligence:12,wisdom:10,charisma:14},
      combat:{max_hp:9,current_hp:9,ac:14,speed:25,initiative:3},
      attacks:[{name:'Shortsword',to_hit:'+5',damage:'1d6+3 piercing'},{name:'Hand Crossbow',to_hit:'+5',damage:'1d6+3 piercing'},{name:'Dagger',to_hit:'+5',damage:'1d4+3 piercing'}],
      skills:['Stealth +7','Thieves\' Tools +7','Sleight of Hand +7','Deception +4','Perception +2'],
      proficiencies:'Light armor, simple weapons, hand crossbows, longswords, rapiers, shortswords, thieves\' tools',
      features:'Sneak Attack: +1d6 damage when you have advantage or an ally flanks\nExpertise: Double proficiency in Stealth and Thieves\' Tools\nHalfling Luck: Reroll 1s\nBrave: Advantage vs. frightened',
      equipment:'Leather armor, two daggers, shortsword, hand crossbow, 20 bolts, thieves\' tools, burglar\'s pack',
      personality:'I always have a plan for when things go wrong.',
      ideals:'Freedom. Chains are meant to be broken.',
      bonds:'I\'m paying off an old debt to a generous benefactor.',
      flaws:'When I see something valuable I can\'t think about anything but stealing it.',
      backstory:'Swift grew up on the streets; quick fingers and quicker feet kept them alive.',
      spellcasting:{ability:'',slots:{}},
    }},
    { id:'tmpl-paladin', name:'Seraphel — Tiefling Paladin', data:{
      race:'Tiefling',class:'Paladin',level:1,background:'Noble',
      abilities:{strength:17,dexterity:10,constitution:14,intelligence:10,wisdom:12,charisma:16},
      combat:{max_hp:12,current_hp:12,ac:18,speed:30,initiative:0},
      attacks:[{name:'Longsword',to_hit:'+5',damage:'1d8+3 slashing'},{name:'Javelin',to_hit:'+5',damage:'1d6+3 piercing'}],
      skills:['Athletics +5','Insight +3','Intimidation +5','Persuasion +5'],
      proficiencies:'All armor, shields, simple weapons, martial weapons',
      features:'Divine Sense: Detect celestials/fiends/undead 60 ft. (4/long rest)\nLay on Hands: 5 HP pool to heal or cure disease\nDarkvision 60 ft.\nHellish Resistance: Fire resistance\nInfernal Legacy: Thaumaturgy cantrip',
      equipment:'Chain mail, longsword, shield, 5 javelins, holy symbol, fine clothes',
      personality:'I take great pains to always look my best.',
      ideals:'Responsibility. I must respect authority above and demand respect below.',
      bonds:'I will face any challenge to win the approval of my family.',
      flaws:'I secretly believe everyone is beneath me.',
      backstory:'Despite her infernal heritage, Seraphel found redemption through devotion to the light.',
      spellcasting:{ability:'CHA',slots:{1:{max:0,used:0}}},
    }},
    { id:'tmpl-ranger', name:'Finn — Wood Elf Ranger', data:{
      race:'Elf',class:'Ranger',level:1,background:'Outlander',
      abilities:{strength:12,dexterity:17,constitution:14,intelligence:10,wisdom:14,charisma:8},
      combat:{max_hp:11,current_hp:11,ac:15,speed:35,initiative:3},
      attacks:[{name:'Longbow',to_hit:'+5',damage:'1d8+3 piercing'},{name:'Shortsword',to_hit:'+5',damage:'1d6+3 piercing'}],
      skills:['Animal Handling +4','Athletics +3','Nature +2','Perception +4','Stealth +5','Survival +4'],
      proficiencies:'Light armor, medium armor, shields, simple weapons, martial weapons',
      features:'Favored Enemy: Undead\nNatural Explorer: Forests\nDarkvision 60 ft.\nFey Ancestry\nFleet of Foot: Speed +5',
      equipment:'Scale mail, two shortswords, longbow, 20 arrows, explorer\'s pack, hunting trap',
      personality:'I watch over my friends as if they were newborn pups.',
      ideals:'Nature over civilization.',
      bonds:'An injury to the wilderness is an injury to me.',
      flaws:'No room for caution in a life lived fully.',
      backstory:'Finn learned to survive in the ancient forests long before he learned to read.',
      spellcasting:{ability:'WIS',slots:{}},
    }},
    { id:'tmpl-barbarian', name:'Korda — Half-Orc Barbarian', data:{
      race:'Half-Orc',class:'Barbarian',level:1,background:'Outlander',
      abilities:{strength:18,dexterity:14,constitution:17,intelligence:8,wisdom:12,charisma:9},
      combat:{max_hp:15,current_hp:15,ac:14,speed:30,initiative:2},
      attacks:[{name:'Greataxe',to_hit:'+6',damage:'1d12+4 slashing'},{name:'Handaxe',to_hit:'+6',damage:'1d6+4 slashing'}],
      skills:['Athletics +6','Intimidation +1','Perception +3','Survival +3'],
      proficiencies:'Light armor, medium armor, shields, simple weapons, martial weapons',
      features:'Rage: Adv on STR, +2 dmg, B/P/S resistance (2/long rest)\nUnarmored Defense: AC = 10+DEX+CON\nRelentless Endurance: Drop to 1 HP once/long rest\nSavage Attacks: Extra die on critical melee hit\nDarkvision 60 ft.',
      equipment:'Greataxe, two handaxes, explorer\'s pack, 4 javelins',
      personality:'I have a lesson for every situation, drawn from nature.',
      ideals:'Glory in battle, for myself and my clan.',
      bonds:'My family and clan are the most important things in my life.',
      flaws:'Slow to trust other races and societies.',
      backstory:'Korda left her tribe after winning an honour duel. She seeks worthy opponents.',
      spellcasting:{ability:'',slots:{}},
    }},
    { id:'tmpl-bard', name:'Lyra — Half-Elf Bard', data:{
      race:'Half-Elf',class:'Bard',level:1,background:'Entertainer',
      abilities:{strength:8,dexterity:14,constitution:12,intelligence:12,wisdom:10,charisma:17},
      combat:{max_hp:8,current_hp:8,ac:13,speed:30,initiative:2},
      attacks:[{name:'Rapier',to_hit:'+4',damage:'1d8+2 piercing'},{name:'Vicious Mockery (cantrip)',to_hit:'DC 13 Wis',damage:'1d4 psychic + disadvantage'}],
      spellcasting:{ability:'CHA',slots:{1:{max:2,used:0},2:{max:0,used:0},3:{max:0,used:0},4:{max:0,used:0},5:{max:0,used:0},6:{max:0,used:0},7:{max:0,used:0},8:{max:0,used:0},9:{max:0,used:0}}},
      skills:['Acrobatics +4','Deception +5','Insight +2','Perception +2','Performance +7','Persuasion +7'],
      proficiencies:'Light armor, simple weapons, hand crossbows, longswords, rapiers, shortswords',
      features:'Bardic Inspiration: Give d6 to ally (3/short rest)\nSpellcasting\nDarkvision 60 ft.\nFey Ancestry\nSkill Versatility: Two extra skill proficiencies',
      equipment:'Leather armor, rapier, lute, diplomat\'s pack, dagger',
      spells_1:'Healing Word\nCharm Person\nDissonant Whispers\nFaerie Fire',
      cantrips:'Vicious Mockery\nMinor Illusion\nPrestidigitation',
      personality:'I love a good insult, even one directed at me.',
      ideals:'Creativity. The world needs new ideas and bold action.',
      bonds:'I measure my deeds against those of a hero from the old tales.',
      flaws:'A scandal prevents me from going home. Trouble follows me around.',
      backstory:'Lyra has performed at royal courts and dingy taverns alike.',
    }},
  ];
  for (const t of templates) ins.run(t.id, t.name, JSON.stringify(t.data), 'SRD');
}

export const stmt = (sql: string) => db.prepare(sql);

export default db;
