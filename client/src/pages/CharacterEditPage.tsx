import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/ui/Navbar';
import api from '../lib/api';
import { Save, ChevronDown, ChevronUp, Camera } from 'lucide-react';
import { getRaceAvatar, avatarStyle } from '../lib/avatars';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const ABILITY_NAMES: Record<string, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
const SKILLS: Record<string, string> = {
  acrobatics: 'dex', animal_handling: 'wis', arcana: 'int', athletics: 'str',
  deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
  investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
  performance: 'cha', persuasion: 'cha', religion: 'int', sleight_of_hand: 'dex',
  stealth: 'dex', survival: 'wis',
};
const CLASSES = ['Barbarian','Bard','Cleric','Druid','Fighter','Monk','Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'];
const RACES = ['Dragonborn','Dwarf','Elf','Gnome','Half-Elf','Half-Orc','Halfling','Human','Tiefling','Aarakocra','Genasi','Goliath'];
const ALIGNMENTS = ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'];

function mod(score: number) { return Math.floor((score - 10) / 2); }
function fmtMod(n: number) { return n >= 0 ? `+${n}` : `${n}`; }

interface SectionProps { title: string; children: React.ReactNode; }
function Section({ title, children }: SectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className="tavern-card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="font-serif text-tavern-gold text-sm font-semibold uppercase tracking-widest">{title}</span>
        {open ? <ChevronUp size={16} className="text-tavern-muted" /> : <ChevronDown size={16} className="text-tavern-muted" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function CharacterEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [sheet, setSheet] = useState<any>(null);
  const [charId, setCharId] = useState<string | null>(id || null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const avatarRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id && id !== 'new') {
      api.get(`/characters/${id}`).then(({ data }) => {
        setSheet(data.sheet_data);
        setCharId(data.id);
        setAvatarUrl(data.avatar_url || null);
      }).catch(() => { toast.error('Character not found'); navigate('/characters'); });
    } else {
      // Use quick-built sheet from navigation state if available
      const prebuilt = (location.state as any)?.prebuilt;
      setSheet(prebuilt ?? emptySheet());
    }
  }, [id]);

  function validate(s: any): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!s.name?.trim())            errs.name       = 'Name is required';
    if (!s.race)                    errs.race       = 'Race is required';
    if (!s.class)                   errs.class      = 'Class is required';
    if (!s.background?.trim())      errs.background = 'Background is required';
    if (!s.level || s.level < 1)   errs.level      = 'Level must be at least 1';
    if (!s.combat?.max_hp || s.combat.max_hp < 1) errs.max_hp = 'Max HP must be at least 1';
    if (s.combat?.ac == null || s.combat.ac < 1)  errs.ac     = 'AC is required';
    return errs;
  }

  function set(path: string, value: any) {
    setSheet((prev: any) => {
      const next = { ...prev };
      const parts = path.split('.');
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = { ...cur[parts[i]] };
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      return next;
    });
  }

  async function save() {
    if (!sheet) return;
    const errs = validate(sheet);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast.error('Please fill in all required fields');
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (!charId || id === 'new') {
        const { data } = await api.post('/characters', { name: sheet.name || 'Unnamed', sheet_data: sheet });
        setCharId(data.id);
        navigate(`/characters/${data.id}`, { replace: true });
        toast.success('Character created!');
      } else {
        await api.put(`/characters/${charId}`, { name: sheet.name || 'Unnamed', sheet_data: sheet });
        toast.success('Saved!');
      }
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (!charId) { toast.error('Save character first'); return; }
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      const { data } = await api.post(`/characters/${charId}/avatar`, fd);
      setAvatarUrl(data.avatar_url);
      toast.success('Avatar updated!');
    } catch {
      toast.error('Upload failed');
    }
  }

  if (!sheet) return (
    <div className="min-h-screen">
      <Navbar />
      <div className="flex items-center justify-center py-20 text-tavern-muted font-serif animate-pulse">Loading...</div>
    </div>
  );

  const pb = sheet.proficiency_bonus || 2;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-title truncate">{sheet.name || 'New Character'}</h1>
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            <Save size={16} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column */}
          <div className="space-y-4">
            {/* Avatar */}
            <div className="tavern-card p-4 flex flex-col items-center gap-3">
              <div
                className="w-28 h-28 rounded-full bg-tavern-bg border-2 border-tavern-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-tavern-gold transition-colors relative"
                onClick={() => avatarRef.current?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (() => {
                  const def = getRaceAvatar(sheet.race || '');
                  return (
                    <div className="w-full h-full rounded-full flex items-center justify-center text-4xl" style={avatarStyle(def)}>
                      {def.emoji}
                    </div>
                  );
                })()}
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Camera size={20} className="text-white" />
                </div>
              </div>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
              <p className="text-xs text-tavern-muted">Click to change avatar</p>
            </div>

            {/* Identity */}
            <Section title="Identity">
              <div className="space-y-3">
                <div>
                  <label className="label block mb-1">Name *</label>
                  <input className={`tavern-input ${errors.name ? 'border-red-600' : ''}`} value={sheet.name || ''} placeholder="Thorin Ironfist"
                    onChange={(e) => set('name', e.target.value)} />
                  {errors.name && <p className="text-xs text-red-400 mt-0.5">{errors.name}</p>}
                </div>
                <div>
                  <label className="label block mb-1">Race *</label>
                  <select className={`tavern-input ${errors.race ? 'border-red-600' : ''}`} value={sheet.race || ''} onChange={(e) => set('race', e.target.value)}>
                    <option value="">— Select Race —</option>
                    {RACES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {errors.race && <p className="text-xs text-red-400 mt-0.5">{errors.race}</p>}
                </div>
                <div>
                  <label className="label block mb-1">Class *</label>
                  <select className={`tavern-input ${errors.class ? 'border-red-600' : ''}`} value={sheet.class || ''} onChange={(e) => set('class', e.target.value)}>
                    <option value="">— Select Class —</option>
                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.class && <p className="text-xs text-red-400 mt-0.5">{errors.class}</p>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label block mb-1">Level *</label>
                    <input type="number" min={1} max={20} className={`tavern-input ${errors.level ? 'border-red-600' : ''}`} value={sheet.level || 1}
                      onChange={(e) => set('level', parseInt(e.target.value))} />
                    {errors.level && <p className="text-xs text-red-400 mt-0.5">{errors.level}</p>}
                  </div>
                  <div>
                    <label className="label block mb-1">Prof Bonus</label>
                    <input type="number" className="tavern-input" value={pb}
                      onChange={(e) => set('proficiency_bonus', parseInt(e.target.value))} />
                  </div>
                </div>
                <div>
                  <label className="label block mb-1">Background *</label>
                  <input className={`tavern-input ${errors.background ? 'border-red-600' : ''}`} value={sheet.background || ''} placeholder="Outlander"
                    onChange={(e) => set('background', e.target.value)} />
                  {errors.background && <p className="text-xs text-red-400 mt-0.5">{errors.background}</p>}
                </div>
                <div>
                  <label className="label block mb-1">Alignment</label>
                  <select className="tavern-input" value={sheet.alignment || ''} onChange={(e) => set('alignment', e.target.value)}>
                    <option value="">— Alignment —</option>
                    {ALIGNMENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label block mb-1">Experience</label>
                  <input type="number" min={0} className="tavern-input" value={sheet.experience || 0}
                    onChange={(e) => set('experience', parseInt(e.target.value))} />
                </div>
              </div>
            </Section>
          </div>

          {/* Middle column */}
          <div className="space-y-4">
            {/* Ability Scores */}
            <Section title="Ability Scores">
              <div className="grid grid-cols-3 gap-3">
                {ABILITIES.map((ab) => {
                  const score = sheet.stats?.[ab] ?? 10;
                  const m = mod(score);
                  return (
                    <div key={ab} className="stat-box">
                      <span className="label">{ABILITY_NAMES[ab]}</span>
                      <input
                        type="number" min={1} max={30}
                        className="w-full text-center bg-transparent text-tavern-text text-xl font-bold font-serif outline-none border-b border-tavern-border/50 focus:border-tavern-gold pb-1"
                        value={score}
                        onChange={(e) => set(`stats.${ab}`, parseInt(e.target.value) || 10)}
                      />
                      <span className="text-tavern-gold text-sm font-bold">{fmtMod(m)}</span>
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Saving Throws */}
            <Section title="Saving Throws">
              <div className="grid grid-cols-2 gap-1">
                {ABILITIES.map((ab) => {
                  const proficient = sheet.saving_throws?.[ab] ?? false;
                  const bonus = mod(sheet.stats?.[ab] ?? 10) + (proficient ? pb : 0);
                  return (
                    <label key={ab} className="flex items-center gap-2 cursor-pointer py-1">
                      <input type="checkbox" checked={proficient}
                        onChange={(e) => set(`saving_throws.${ab}`, e.target.checked)}
                        className="accent-yellow-500" />
                      <span className="text-tavern-gold text-xs w-7">{fmtMod(bonus)}</span>
                      <span className="text-tavern-text text-sm capitalize">{ABILITY_NAMES[ab]}</span>
                    </label>
                  );
                })}
              </div>
            </Section>

            {/* Skills */}
            <Section title="Skills">
              <div className="space-y-0.5">
                {Object.entries(SKILLS).map(([skill, attr]) => {
                  const proficient = sheet.skills?.[skill] ?? false;
                  const bonus = mod(sheet.stats?.[attr] ?? 10) + (proficient ? pb : 0);
                  return (
                    <label key={skill} className="flex items-center gap-2 cursor-pointer py-0.5">
                      <input type="checkbox" checked={proficient}
                        onChange={(e) => set(`skills.${skill}`, e.target.checked)}
                        className="accent-yellow-500 flex-shrink-0" />
                      <span className="text-tavern-gold text-xs w-7">{fmtMod(bonus)}</span>
                      <span className="text-tavern-text text-xs capitalize">{skill.replace(/_/g, ' ')}</span>
                      <span className="text-tavern-muted text-xs ml-auto">{ABILITY_NAMES[attr]}</span>
                    </label>
                  );
                })}
              </div>
            </Section>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Combat */}
            <Section title="Combat">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'AC *', path: 'combat.ac', errKey: 'ac' },
                  { label: 'Initiative', path: 'combat.initiative', errKey: '' },
                  { label: 'Speed', path: 'combat.speed', errKey: '' },
                  { label: 'Max HP *', path: 'combat.max_hp', errKey: 'max_hp' },
                  { label: 'Current HP', path: 'combat.current_hp', errKey: '' },
                  { label: 'Temp HP', path: 'combat.temp_hp', errKey: '' },
                ].map(({ label, path, errKey }) => (
                  <div key={path} className={`stat-box ${errKey && errors[errKey] ? 'border-red-600' : ''}`}>
                    <label className="label text-center">{label}</label>
                    <input
                      type="number"
                      className="w-full text-center bg-transparent text-tavern-text font-bold font-serif outline-none text-lg"
                      value={path.split('.').reduce((o: any, k: string) => o?.[k], sheet) ?? 0}
                      onChange={(e) => set(path, parseInt(e.target.value) || 0)}
                    />
                  </div>
                ))}
              </div>
              {(errors.ac || errors.max_hp) && (
                <div className="mt-1 space-y-0.5">
                  {errors.ac    && <p className="text-xs text-red-400">{errors.ac}</p>}
                  {errors.max_hp && <p className="text-xs text-red-400">{errors.max_hp}</p>}
                </div>
              )}
              <div className="mt-2">
                <label className="label block mb-1">Hit Dice</label>
                <input className="tavern-input" value={sheet.combat?.hit_dice || '1d8'} placeholder="1d8"
                  onChange={(e) => set('combat.hit_dice', e.target.value)} />
              </div>
              {/* Death saves */}
              <div className="mt-3">
                <label className="label block mb-2">Death Saves</label>
                <div className="flex gap-4">
                  <div>
                    <span className="text-xs text-green-400 block mb-1">Successes</span>
                    <div className="flex gap-1">
                      {[1, 2, 3].map((n) => (
                        <input key={n} type="checkbox"
                          checked={(sheet.combat?.death_saves?.successes ?? 0) >= n}
                          onChange={(e) => set('combat.death_saves.successes', e.target.checked ? n : n - 1)}
                          className="accent-green-500 w-4 h-4" />
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-red-400 block mb-1">Failures</span>
                    <div className="flex gap-1">
                      {[1, 2, 3].map((n) => (
                        <input key={n} type="checkbox"
                          checked={(sheet.combat?.death_saves?.failures ?? 0) >= n}
                          onChange={(e) => set('combat.death_saves.failures', e.target.checked ? n : n - 1)}
                          className="accent-red-500 w-4 h-4" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* Attacks */}
            <Section title="Attacks">
              <div className="space-y-2">
                {(sheet.attacks || []).map((atk: any, i: number) => (
                  <div key={i} className="grid grid-cols-3 gap-1 text-xs">
                    <input className="tavern-input text-xs py-1 px-2" value={atk.name || ''} placeholder="Name"
                      onChange={(e) => { const a = [...sheet.attacks]; a[i] = { ...a[i], name: e.target.value }; set('attacks', a); }} />
                    <input className="tavern-input text-xs py-1 px-2" value={atk.bonus || ''} placeholder="+0"
                      onChange={(e) => { const a = [...sheet.attacks]; a[i] = { ...a[i], bonus: e.target.value }; set('attacks', a); }} />
                    <input className="tavern-input text-xs py-1 px-2" value={atk.damage || ''} placeholder="1d6"
                      onChange={(e) => { const a = [...sheet.attacks]; a[i] = { ...a[i], damage: e.target.value }; set('attacks', a); }} />
                  </div>
                ))}
                <button className="btn-secondary w-full text-xs py-1"
                  onClick={() => set('attacks', [...(sheet.attacks || []), { name: '', bonus: '', damage: '' }])}>
                  + Add Attack
                </button>
              </div>
            </Section>

            {/* Spellcasting */}
            <Section title="Spellcasting">
              <div className="mb-3">
                <label className="label block mb-1">Spellcasting Ability</label>
                <select className="tavern-input" value={sheet.spellcasting?.ability || ''}
                  onChange={(e) => set('spellcasting.ability', e.target.value)}>
                  <option value="">— None —</option>
                  <option value="int">Intelligence (INT)</option>
                  <option value="wis">Wisdom (WIS)</option>
                  <option value="cha">Charisma (CHA)</option>
                </select>
              </div>
              {sheet.spellcasting?.ability && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="stat-box">
                    <span className="label">Spell Save DC</span>
                    <span className="text-tavern-text text-xl font-bold font-serif">
                      {8 + pb + mod(sheet.stats?.[sheet.spellcasting.ability] ?? 10)}
                    </span>
                  </div>
                  <div className="stat-box">
                    <span className="label">Spell Attack</span>
                    <span className="text-tavern-gold text-xl font-bold font-serif">
                      {fmtMod(pb + mod(sheet.stats?.[sheet.spellcasting.ability] ?? 10))}
                    </span>
                  </div>
                </div>
              )}
              <div>
                <label className="label block mb-2">Spell Slots (Max / Used)</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {([1,2,3,4,5,6,7,8,9] as const).map(lvl => {
                    const slot = sheet.spellcasting?.slots?.[lvl] || { max: 0, used: 0 };
                    return (
                      <div key={lvl} className="stat-box gap-0.5 py-1.5">
                        <span className="label text-[9px]">Level {lvl}</span>
                        <div className="flex items-center gap-1">
                          <input type="number" min={0} max={9}
                            className="w-7 text-center bg-transparent text-tavern-text font-bold font-serif outline-none border-b border-tavern-border/50 focus:border-tavern-gold text-sm"
                            value={slot.max}
                            onChange={(e) => set(`spellcasting.slots.${lvl}.max`, parseInt(e.target.value) || 0)} />
                          <span className="text-tavern-muted text-xs">/</span>
                          <input type="number" min={0} max={9}
                            className="w-7 text-center bg-transparent text-tavern-muted outline-none border-b border-tavern-border/50 focus:border-tavern-gold text-sm"
                            value={slot.used}
                            onChange={(e) => set(`spellcasting.slots.${lvl}.used`, parseInt(e.target.value) || 0)} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Section>

          </div>
        </div>

        {/* Full-width text sections */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="Features & Traits">
            <textarea rows={10} className="tavern-input resize-y text-sm w-full" value={sheet.features || ''} placeholder="Class features, racial traits..."
              onChange={(e) => set('features', e.target.value)} />
          </Section>
          <Section title="Equipment">
            <textarea rows={10} className="tavern-input resize-y text-sm w-full" value={sheet.equipment || ''} placeholder="List your items..."
              onChange={(e) => set('equipment', e.target.value)} />
          </Section>
          <Section title="Backstory">
            <textarea rows={10} className="tavern-input resize-y text-sm w-full" value={sheet.backstory || ''} placeholder="Your character's history..."
              onChange={(e) => set('backstory', e.target.value)} />
          </Section>
          <Section title="Notes">
            <textarea rows={10} className="tavern-input resize-y text-sm w-full" value={sheet.notes || ''} placeholder="Anything else..."
              onChange={(e) => set('notes', e.target.value)} />
          </Section>
          <Section title="Personality">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Personality Traits', path: 'traits.personality' },
                { label: 'Ideals',             path: 'traits.ideals' },
                { label: 'Bonds',              path: 'traits.bonds' },
                { label: 'Flaws',              path: 'traits.flaws' },
              ].map(({ label, path }) => (
                <div key={path}>
                  <label className="label block mb-1">{label}</label>
                  <textarea rows={4} className="tavern-input resize-y text-sm w-full"
                    value={path.split('.').reduce((o: any, k: string) => o?.[k], sheet) || ''}
                    placeholder={label}
                    onChange={(e) => set(path, e.target.value)} />
                </div>
              ))}
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}

function emptySheet() {
  return {
    name: '', race: '', class: '', background: '', alignment: '', level: 1, experience: 0,
    proficiency_bonus: 2,
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
    spellcasting: {
      ability: '',
      slots: {
        1: {max:0,used:0}, 2:{max:0,used:0}, 3:{max:0,used:0},
        4:{max:0,used:0}, 5:{max:0,used:0}, 6:{max:0,used:0},
        7:{max:0,used:0}, 8:{max:0,used:0}, 9:{max:0,used:0},
      },
    },
    equipment: '', features: '',
    traits: { personality: '', ideals: '', bonds: '', flaws: '' },
    backstory: '', notes: '',
  };
}
