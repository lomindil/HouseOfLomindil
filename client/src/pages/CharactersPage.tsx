import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/ui/Navbar';
import api from '../lib/api';
import { Plus, User, Trash2, Edit3, Zap, X, Dices, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

interface Character {
  id: string; name: string; avatar_url?: string;
  sheet_data: any; updated_at: number;
}
interface PremadeChar {
  id: string; name: string; avatar_url?: string;
  sheet_data: any; game_id: string; game_name: string;
  claimed_by: string | null; claimed_by_username: string | null;
}

// ── D&D 5e Quick Builder data ─────────────────────────────────────────────────
const CLASSES = ['Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'];
const RACES   = ['Dragonborn','Dwarf','Elf','Gnome','Half-Elf','Half-Orc','Halfling','Human','Tiefling','Aarakocra','Genasi','Goliath'];
const BACKGROUNDS = ['Acolyte','Charlatan','Criminal','Entertainer','Folk Hero','Guild Artisan','Hermit','Noble','Outlander','Sage','Sailor','Soldier','Urchin'];

const HIT_DIE: Record<string, number> = {
  Barbarian:12, Fighter:10, Paladin:10, Ranger:10,
  Bard:8, Cleric:8, Druid:8, Monk:8, Rogue:8, Warlock:8,
  Sorcerer:6, Wizard:6,
};
const STAT_PRIORITY: Record<string, string[]> = {
  Barbarian:['str','con','dex','wis','cha','int'], Bard:['cha','dex','con','wis','str','int'],
  Cleric:['wis','con','str','cha','dex','int'],    Druid:['wis','con','dex','int','cha','str'],
  Fighter:['str','con','dex','wis','cha','int'],   Monk:['dex','wis','con','str','int','cha'],
  Paladin:['str','cha','con','wis','dex','int'],   Ranger:['dex','wis','con','str','int','cha'],
  Rogue:['dex','cha','con','wis','str','int'],     Sorcerer:['cha','con','dex','wis','int','str'],
  Warlock:['cha','con','dex','wis','int','str'],   Wizard:['int','con','dex','wis','cha','str'],
};
const CLASS_SAVES: Record<string, string[]> = {
  Barbarian:['str','con'], Bard:['dex','cha'], Cleric:['wis','cha'], Druid:['int','wis'],
  Fighter:['str','con'], Monk:['str','dex'], Paladin:['wis','cha'], Ranger:['str','dex'],
  Rogue:['dex','int'], Sorcerer:['con','cha'], Warlock:['wis','cha'], Wizard:['int','wis'],
};
const CLASS_SKILLS: Record<string, string[]> = {
  Barbarian:['animal_handling','athletics','intimidation','nature','perception','survival'],
  Bard:['acrobatics','deception','history','insight','intimidation','investigation','perception','performance','persuasion','sleight_of_hand','stealth'],
  Cleric:['history','insight','medicine','persuasion','religion'],
  Druid:['arcana','animal_handling','insight','medicine','nature','perception','religion','survival'],
  Fighter:['acrobatics','animal_handling','athletics','history','insight','intimidation','perception','survival'],
  Monk:['acrobatics','athletics','history','insight','religion','stealth'],
  Paladin:['athletics','insight','intimidation','medicine','persuasion','religion'],
  Ranger:['animal_handling','athletics','insight','investigation','nature','perception','stealth','survival'],
  Rogue:['acrobatics','athletics','deception','insight','intimidation','investigation','perception','sleight_of_hand','stealth'],
  Sorcerer:['arcana','deception','insight','intimidation','persuasion','religion'],
  Warlock:['arcana','deception','history','intimidation','investigation','nature','religion'],
  Wizard:['arcana','history','insight','investigation','medicine','religion'],
};
const SKILL_COUNT: Record<string, number> = {
  Barbarian:2, Bard:3, Cleric:2, Druid:2, Fighter:2, Monk:2,
  Paladin:2, Ranger:3, Rogue:4, Sorcerer:2, Warlock:2, Wizard:2,
};
const RACE_BONUSES: Record<string, Partial<Record<string,number>>> = {
  Dragonborn:{str:2,cha:1}, Dwarf:{con:2}, Elf:{dex:2}, Gnome:{int:2},
  'Half-Elf':{cha:2,wis:1}, 'Half-Orc':{str:2,con:1}, Halfling:{dex:2},
  Human:{str:1,dex:1,con:1,int:1,wis:1,cha:1}, Tiefling:{int:1,cha:2},
  Aarakocra:{dex:2,wis:1}, Genasi:{con:2}, Goliath:{str:2,con:1},
};
const RACE_SPEED: Record<string, number> = { Dwarf:25, Halfling:25 };
const SPELL_ABILITY: Record<string, string> = {
  Bard:'cha', Cleric:'wis', Druid:'wis', Paladin:'cha',
  Ranger:'wis', Sorcerer:'cha', Warlock:'cha', Wizard:'int',
};
const EMPTY_SLOTS = Object.fromEntries([1,2,3,4,5,6,7,8,9].map(n => [n, {max:0,used:0}]));
const ALL_SKILLS = ['acrobatics','animal_handling','arcana','athletics','deception','history','insight','intimidation','investigation','medicine','nature','perception','performance','persuasion','religion','sleight_of_hand','stealth','survival'];

function pb(level: number) { return Math.ceil(level / 4) + 1; }
function modOf(s: number) { return Math.floor((s - 10) / 2); }

function quickBuild(name: string, race: string, cls: string, background: string, level: number) {
  const arr = [15, 14, 13, 12, 10, 8];
  const priority = STAT_PRIORITY[cls] || ['str','dex','con','int','wis','cha'];
  const stats: Record<string,number> = {};
  priority.forEach((s, i) => { stats[s] = arr[i]; });
  const bonuses = RACE_BONUSES[race] || {};
  Object.entries(bonuses).forEach(([s, b]) => { stats[s] = (stats[s] || 10) + (b as number); });

  const hd = HIT_DIE[cls] || 8;
  const conMod = modOf(stats.con || 10);
  const dexMod = modOf(stats.dex || 10);
  const profB = pb(level);
  const maxHp = Math.max(1, hd + conMod + (level - 1) * (Math.floor(hd / 2) + 1 + conMod));

  const saving_throws: Record<string,boolean> = {};
  ['str','dex','con','int','wis','cha'].forEach(s => { saving_throws[s] = (CLASS_SAVES[cls] || []).includes(s); });

  const pool = [...(CLASS_SKILLS[cls] || [])].sort(() => Math.random() - 0.5);
  const chosen = pool.slice(0, SKILL_COUNT[cls] || 2);
  const skills: Record<string,boolean> = {};
  ALL_SKILLS.forEach(s => { skills[s] = chosen.includes(s); });

  const spellAbility = SPELL_ABILITY[cls] || '';

  return {
    name, race, class: cls, background, alignment: '', level,
    experience: 0, inspiration: false, proficiency_bonus: profB,
    stats,
    saving_throws,
    skills,
    combat: {
      ac: 10 + dexMod, initiative: dexMod,
      speed: RACE_SPEED[race] || 30,
      max_hp: maxHp, current_hp: maxHp, temp_hp: 0,
      hit_dice: `${level}d${hd}`,
      death_saves: { successes: 0, failures: 0 },
    },
    attacks: [], equipment: '',
    features: `${race} racial traits\n${cls} class features`,
    traits: { personality: '', ideals: '', bonds: '', flaws: '' },
    backstory: '', notes: '',
    spellcasting: { ability: spellAbility, slots: EMPTY_SLOTS },
  };
}

// ── Quick Build modal ─────────────────────────────────────────────────────────
function QuickBuildModal({ onClose, onBuild }: { onClose: () => void; onBuild: (sheet: any) => void }) {
  const [name, setName]       = useState('');
  const [race, setRace]       = useState(RACES[0]);
  const [cls, setCls]         = useState(CLASSES[4]); // Fighter default
  const [bg, setBg]           = useState(BACKGROUNDS[0]);
  const [level, setLevel]     = useState(1);
  const [errors, setErrors]   = useState<string[]>([]);

  function generate() {
    const errs: string[] = [];
    if (!name.trim()) errs.push('Character name is required');
    if (errs.length) { setErrors(errs); return; }
    onBuild(quickBuild(name.trim(), race, cls, bg, level));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-tavern-card border border-tavern-border rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-tavern-border">
          <div className="flex items-center gap-2">
            <Dices size={16} className="text-tavern-gold" />
            <h2 className="font-serif text-tavern-gold font-semibold">Quick Character Builder</h2>
          </div>
          <button onClick={onClose} className="text-tavern-muted hover:text-tavern-text"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-tavern-muted">Generates a ready-to-play character using the D&D 5e standard array and class defaults. You can edit everything afterwards.</p>

          {errors.length > 0 && (
            <div className="bg-red-900/20 border border-red-800/40 rounded p-3 text-xs text-red-300 space-y-0.5">
              {errors.map(e => <p key={e}>• {e}</p>)}
            </div>
          )}

          <div>
            <label className="label block mb-1">Character Name *</label>
            <input className="tavern-input" placeholder="Thorin Ironfist" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1">Race</label>
              <select className="tavern-input" value={race} onChange={e => setRace(e.target.value)}>
                {RACES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label block mb-1">Class</label>
              <select className="tavern-input" value={cls} onChange={e => setCls(e.target.value)}>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label block mb-1">Background</label>
              <select className="tavern-input" value={bg} onChange={e => setBg(e.target.value)}>
                {BACKGROUNDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="label block mb-1">Level</label>
              <input type="number" min={1} max={20} className="tavern-input" value={level}
                onChange={e => setLevel(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))} />
            </div>
          </div>
          <div className="pt-1">
            <p className="text-xs text-tavern-muted/60 mb-3">
              Stats assigned from standard array [15,14,13,12,10,8] optimised for {cls}.
              Racial bonuses applied for {race}.
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary flex-1 text-sm py-2">Cancel</button>
              <button onClick={generate} className="btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-2">
                <Zap size={14} /> Generate & Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CharactersPage() {
  const [chars, setChars]         = useState<Character[]>([]);
  const [premade, setPremade]     = useState<PremadeChar[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/characters'),
      api.get('/characters/premade').catch(() => ({ data: [] })),
    ]).then(([own, pre]) => {
      setChars(own.data);
      setPremade(pre.data);
    }).finally(() => setLoading(false));
  }, []);

  async function deleteChar(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    await api.delete(`/characters/${id}`);
    setChars(prev => prev.filter(c => c.id !== id));
    toast.success(`${name} has left the party`);
  }

  function handleQuickBuild(sheet: any) {
    setShowBuilder(false);
    navigate('/characters/new', { state: { prebuilt: sheet } });
  }

  // Group premade by game
  const premadeByGame = premade.reduce<Record<string, { gameName: string; chars: PremadeChar[] }>>(
    (acc, c) => {
      if (!acc[c.game_id]) acc[c.game_id] = { gameName: c.game_name, chars: [] };
      acc[c.game_id].chars.push(c);
      return acc;
    }, {}
  );

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 gap-3 flex-wrap">
          <h1 className="page-title">My Characters</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowBuilder(true)} className="btn-secondary flex items-center gap-2 text-sm">
              <Dices size={15} /> Quick Build
            </button>
            <button onClick={() => navigate('/characters/new')} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={15} /> New Character
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-tavern-muted font-serif animate-pulse">Loading...</div>
        ) : (
          <>
            {/* Own characters */}
            {chars.length === 0 ? (
              <div className="tavern-card p-12 text-center mb-8">
                <div className="text-5xl mb-4">🧙</div>
                <p className="font-serif text-lg text-tavern-muted mb-2">No characters yet</p>
                <p className="text-xs text-tavern-muted/60 mb-5">Start from scratch or use Quick Build for a ready-to-play hero.</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => setShowBuilder(true)} className="btn-secondary flex items-center gap-2 text-sm">
                    <Dices size={14} /> Quick Build
                  </button>
                  <button onClick={() => navigate('/characters/new')} className="btn-primary flex items-center gap-2 text-sm">
                    <Plus size={14} /> Blank Sheet
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                {chars.map((char) => {
                  const sheet = char.sheet_data;
                  return (
                    <div key={char.id} className="tavern-card p-4 hover:border-tavern-gold/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-full bg-tavern-bg border border-tavern-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {char.avatar_url
                            ? <img src={char.avatar_url} alt="" className="w-full h-full object-cover" />
                            : <User size={24} className="text-tavern-muted" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="font-serif text-tavern-text font-semibold truncate">{char.name}</h2>
                          <p className="text-xs text-tavern-muted mt-0.5">
                            {[sheet?.race, sheet?.class].filter(Boolean).join(' ') || 'Unknown'}
                            {sheet?.level ? ` — Level ${sheet.level}` : ''}
                          </p>
                          {sheet?.background && <p className="text-xs text-tavern-muted/60">{sheet.background}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Link to={`/characters/${char.id}`} className="btn-secondary flex-1 text-center text-xs py-1.5 flex items-center justify-center gap-1">
                          <Edit3 size={12} /> Edit
                        </Link>
                        <button onClick={() => deleteChar(char.id, char.name)}
                          className="p-1.5 text-tavern-muted hover:text-red-400 transition-colors border border-tavern-border rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Premade characters from games */}
            {Object.keys(premadeByGame).length > 0 && (
              <div>
                <div className="flex items-center gap-4 mb-5">
                  <div className="flex-1 h-px bg-tavern-border/50" />
                  <h2 className="font-serif text-tavern-muted text-xs uppercase tracking-widest whitespace-nowrap">Pre-built Characters from Your Games</h2>
                  <div className="flex-1 h-px bg-tavern-border/50" />
                </div>
                <div className="space-y-6">
                  {Object.entries(premadeByGame).map(([gameId, { gameName, chars: gameChars }]) => (
                    <div key={gameId}>
                      <div className="flex items-center gap-2 mb-3">
                        <Link to={`/games/${gameId}`} className="font-serif text-tavern-gold text-sm hover:underline flex items-center gap-1">
                          {gameName} <ExternalLink size={11} />
                        </Link>
                        <span className="text-xs text-tavern-muted">({gameChars.length} characters)</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {gameChars.map(gc => {
                          const sheet = gc.sheet_data;
                          const isMine = gc.claimed_by !== null && gc.claimed_by === gc.claimed_by; // will refine below
                          const myChar = chars.find(c => c.name === gc.name && c.sheet_data?.class === sheet?.class);
                          const isClaimedByMe = myChar !== undefined;
                          const isClaimedByOther = gc.claimed_by !== null && !isClaimedByMe;

                          return (
                            <div key={gc.id} className={clsx(
                              'border rounded p-3 transition-colors',
                              isClaimedByOther ? 'border-tavern-border/40 opacity-60' :
                              isClaimedByMe   ? 'border-tavern-gold/40 bg-tavern-gold/5' :
                                               'border-tavern-border hover:border-tavern-gold/40'
                            )}>
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-9 h-9 rounded-full bg-tavern-bg border border-tavern-border flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {gc.avatar_url
                                    ? <img src={gc.avatar_url} alt="" className="w-full h-full object-cover" />
                                    : <span className="text-base">🧙</span>}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-serif text-sm text-tavern-text truncate">{gc.name}</p>
                                  <p className="text-xs text-tavern-muted">{sheet?.race} {sheet?.class}{sheet?.level ? ` · Lv${sheet.level}` : ''}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                {isClaimedByMe ? (
                                  <>
                                    <span className="text-xs text-tavern-gold">✓ Claimed by you</span>
                                    {myChar && (
                                      <Link to={`/characters/${myChar.id}`} className="text-xs border border-tavern-border rounded px-2 py-0.5 hover:border-tavern-gold text-tavern-muted hover:text-tavern-gold transition-colors flex items-center gap-1">
                                        <Edit3 size={10} /> Edit
                                      </Link>
                                    )}
                                  </>
                                ) : isClaimedByOther ? (
                                  <span className="text-xs text-tavern-muted italic">Claimed by {gc.claimed_by_username || 'another player'}</span>
                                ) : (
                                  <>
                                    <span className="text-xs text-green-400/80">Available</span>
                                    <Link to={`/games/${gameId}`} className="text-xs border border-tavern-border rounded px-2 py-0.5 hover:border-tavern-gold text-tavern-muted hover:text-tavern-gold transition-colors">
                                      Claim in game →
                                    </Link>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {showBuilder && <QuickBuildModal onClose={() => setShowBuilder(false)} onBuild={handleQuickBuild} />}
    </div>
  );
}
