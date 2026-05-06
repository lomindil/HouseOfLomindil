import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { X, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { getRaceAvatar, avatarStyle } from '../../lib/avatars';

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

function emptySheet() {
  return {
    name: '', race: '', class: '', level: 1, proficiency_bonus: 2, background: '', alignment: '', experience: 0,
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    combat: { ac: 10, initiative: 0, speed: 30, max_hp: 10, current_hp: 10, temp_hp: 0, hit_dice: '1d8', death_saves: { successes: 0, failures: 0 } },
    saving_throws: {}, skills: {},
    features: [] as string[], equipment: [] as string[],
    spellcasting: {
      ability: '',
      slots: {
        1:{max:0,used:0}, 2:{max:0,used:0}, 3:{max:0,used:0},
        4:{max:0,used:0}, 5:{max:0,used:0}, 6:{max:0,used:0},
        7:{max:0,used:0}, 8:{max:0,used:0}, 9:{max:0,used:0},
      },
    },
    spells: { cantrips: [], level1: [], level2: [], level3: [], level4: [], level5: [], level6: [], level7: [], level8: [], level9: [] },
    notes: '', backstory: '',
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-tavern-border rounded overflow-hidden">
      <button className="w-full flex items-center justify-between px-3 py-2 text-left bg-tavern-bg/50" onClick={() => setOpen(!open)}>
        <span className="font-serif text-tavern-gold text-xs font-semibold uppercase tracking-widest">{title}</span>
        {open ? <ChevronUp size={14} className="text-tavern-muted" /> : <ChevronDown size={14} className="text-tavern-muted" />}
      </button>
      {open && <div className="px-3 pb-3 pt-2">{children}</div>}
    </div>
  );
}

interface Props {
  gameId: string;
  character?: any;
  onClose: () => void;
  onSaved: (char: any) => void;
}

export default function GameCharacterModal({ gameId, character, onClose, onSaved }: Props) {
  const [sheet, setSheet] = useState<any>(character ? { ...character.sheet_data } : emptySheet());
  const [saving, setSaving] = useState(false);

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
    if (!sheet.name?.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      if (character) {
        const { data } = await api.put(`/games/${gameId}/game-characters/${character.id}`, { name: sheet.name, sheet_data: sheet });
        onSaved(data);
        toast.success('Character updated!');
      } else {
        const { data } = await api.post(`/games/${gameId}/game-characters`, { name: sheet.name, sheet_data: sheet });
        onSaved(data);
        toast.success('Character created!');
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const pb = sheet.proficiency_bonus || 2;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-tavern-card border border-tavern-border rounded-lg w-full max-w-4xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-tavern-border sticky top-0 bg-tavern-card z-10">
          <h2 className="font-serif text-tavern-gold font-semibold">
            {character ? `Edit: ${character.sheet_data?.name || 'Character'}` : 'New Game Character'}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving} className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5">
              <Save size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={onClose} className="text-tavern-muted hover:text-tavern-text transition-colors p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left */}
          <div className="space-y-3">
            <Section title="Identity">
              <div className="space-y-2">
                {/* Race-based avatar preview */}
                {(() => {
                  const def = getRaceAvatar(sheet.race || '');
                  return (
                    <div className="flex justify-center mb-1">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl" style={avatarStyle(def)}>
                        {def.emoji}
                      </div>
                    </div>
                  );
                })()}
                <div>
                  <label className="label block mb-1">Name *</label>
                  <input className="tavern-input text-sm" placeholder="Thorin Ironfist" value={sheet.name || ''} onChange={(e) => set('name', e.target.value)} />
                </div>
                <div>
                  <label className="label block mb-1">Race</label>
                  <select className="tavern-input text-sm" value={sheet.race || ''} onChange={(e) => set('race', e.target.value)}>
                    <option value="">— Select —</option>
                    {RACES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label block mb-1">Class</label>
                  <select className="tavern-input text-sm" value={sheet.class || ''} onChange={(e) => set('class', e.target.value)}>
                    <option value="">— Select —</option>
                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label block mb-1">Level</label>
                    <input type="number" min={1} max={20} className="tavern-input text-sm" value={sheet.level || 1} onChange={(e) => set('level', parseInt(e.target.value) || 1)} />
                  </div>
                  <div>
                    <label className="label block mb-1">Prof Bonus</label>
                    <input type="number" className="tavern-input text-sm" value={pb} onChange={(e) => set('proficiency_bonus', parseInt(e.target.value) || 2)} />
                  </div>
                </div>
                <div>
                  <label className="label block mb-1">Background</label>
                  <input className="tavern-input text-sm" placeholder="Outlander" value={sheet.background || ''} onChange={(e) => set('background', e.target.value)} />
                </div>
                <div>
                  <label className="label block mb-1">Alignment</label>
                  <select className="tavern-input text-sm" value={sheet.alignment || ''} onChange={(e) => set('alignment', e.target.value)}>
                    <option value="">— Alignment —</option>
                    {ALIGNMENTS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label block mb-1">Experience</label>
                  <input type="number" min={0} className="tavern-input text-sm" value={sheet.experience || 0} onChange={(e) => set('experience', parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </Section>

            <Section title="Notes & Backstory">
              <textarea className="tavern-input text-sm resize-none" rows={4} placeholder="Backstory..." value={sheet.backstory || ''} onChange={(e) => set('backstory', e.target.value)} />
              <textarea className="tavern-input text-sm resize-none mt-2" rows={3} placeholder="Session notes..." value={sheet.notes || ''} onChange={(e) => set('notes', e.target.value)} />
            </Section>
          </div>

          {/* Middle */}
          <div className="space-y-3">
            <Section title="Ability Scores">
              <div className="grid grid-cols-3 gap-2">
                {ABILITIES.map((ab) => {
                  const score = sheet.stats?.[ab] ?? 10;
                  const m = mod(score);
                  return (
                    <div key={ab} className="flex flex-col items-center bg-tavern-bg border border-tavern-border rounded p-2 gap-1">
                      <span className="label text-xs">{ABILITY_NAMES[ab]}</span>
                      <input
                        type="number" min={1} max={30}
                        className="w-full text-center bg-transparent text-tavern-text text-lg font-bold font-serif outline-none border-b border-tavern-border/50 focus:border-tavern-gold pb-0.5"
                        value={score}
                        onChange={(e) => set(`stats.${ab}`, parseInt(e.target.value) || 10)}
                      />
                      <span className="text-tavern-gold text-sm font-bold">{fmtMod(m)}</span>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="Saving Throws">
              <div className="grid grid-cols-2 gap-0.5">
                {ABILITIES.map((ab) => {
                  const proficient = sheet.saving_throws?.[ab] ?? false;
                  const bonus = mod(sheet.stats?.[ab] ?? 10) + (proficient ? pb : 0);
                  return (
                    <label key={ab} className="flex items-center gap-2 cursor-pointer py-1">
                      <input type="checkbox" checked={proficient} onChange={(e) => set(`saving_throws.${ab}`, e.target.checked)} className="accent-yellow-500" />
                      <span className="text-tavern-gold text-xs w-6">{fmtMod(bonus)}</span>
                      <span className="text-tavern-text text-xs">{ABILITY_NAMES[ab]}</span>
                    </label>
                  );
                })}
              </div>
            </Section>

            <Section title="Skills">
              <div className="space-y-0.5">
                {Object.entries(SKILLS).map(([skill, attr]) => {
                  const proficient = sheet.skills?.[skill] ?? false;
                  const bonus = mod(sheet.stats?.[attr] ?? 10) + (proficient ? pb : 0);
                  return (
                    <label key={skill} className="flex items-center gap-1.5 cursor-pointer py-0.5">
                      <input type="checkbox" checked={proficient} onChange={(e) => set(`skills.${skill}`, e.target.checked)} className="accent-yellow-500 flex-shrink-0" />
                      <span className="text-tavern-gold text-xs w-6">{fmtMod(bonus)}</span>
                      <span className="text-tavern-text text-xs capitalize flex-1">{skill.replace(/_/g, ' ')}</span>
                      <span className="text-tavern-muted text-xs">{ABILITY_NAMES[attr]}</span>
                    </label>
                  );
                })}
              </div>
            </Section>
          </div>

          {/* Right */}
          <div className="space-y-3">
            <Section title="Combat">
              <div className="grid grid-cols-3 gap-2">
                {([
                  { label: 'AC', path: 'combat.ac' },
                  { label: 'Initiative', path: 'combat.initiative' },
                  { label: 'Speed', path: 'combat.speed' },
                  { label: 'Max HP', path: 'combat.max_hp' },
                  { label: 'Curr HP', path: 'combat.current_hp' },
                  { label: 'Temp HP', path: 'combat.temp_hp' },
                ] as const).map(({ label, path }) => (
                  <div key={path} className="flex flex-col items-center bg-tavern-bg border border-tavern-border rounded p-2 gap-1">
                    <label className="label text-center text-xs">{label}</label>
                    <input
                      type="number"
                      className="w-full text-center bg-transparent text-tavern-text font-bold font-serif outline-none text-lg"
                      value={(path as string).split('.').reduce((o: any, k: string) => o?.[k], sheet) ?? 0}
                      onChange={(e) => set(path as string, parseInt(e.target.value) || 0)}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2">
                <label className="label block mb-1">Hit Dice</label>
                <input className="tavern-input text-sm" placeholder="1d8" value={sheet.combat?.hit_dice || ''} onChange={(e) => set('combat.hit_dice', e.target.value)} />
              </div>
            </Section>

            <Section title="Features & Traits">
              <textarea
                className="tavern-input text-sm resize-none"
                rows={4}
                placeholder="One per line..."
                value={(sheet.features || []).join('\n')}
                onChange={(e) => set('features', e.target.value.split('\n').filter(Boolean))}
              />
            </Section>

            <Section title="Equipment">
              <textarea
                className="tavern-input text-sm resize-none"
                rows={4}
                placeholder="One per line..."
                value={(sheet.equipment || []).join('\n')}
                onChange={(e) => set('equipment', e.target.value.split('\n').filter(Boolean))}
              />
            </Section>

            <Section title="Spellcasting">
              <div className="mb-3">
                <label className="label block mb-1">Spellcasting Ability</label>
                <select className="tavern-input text-sm" value={sheet.spellcasting?.ability || ''}
                  onChange={(e) => set('spellcasting.ability', e.target.value)}>
                  <option value="">— None —</option>
                  <option value="int">Intelligence (INT)</option>
                  <option value="wis">Wisdom (WIS)</option>
                  <option value="cha">Charisma (CHA)</option>
                </select>
              </div>
              {sheet.spellcasting?.ability && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="flex flex-col items-center bg-tavern-bg border border-tavern-border rounded p-2 gap-1">
                    <span className="label text-[10px]">Spell Save DC</span>
                    <span className="text-tavern-text text-lg font-bold font-serif">
                      {8 + pb + Math.floor(((sheet.stats?.[sheet.spellcasting.ability] ?? 10) - 10) / 2)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center bg-tavern-bg border border-tavern-border rounded p-2 gap-1">
                    <span className="label text-[10px]">Spell Attack</span>
                    <span className="text-tavern-gold text-lg font-bold font-serif">
                      {(() => { const m = Math.floor(((sheet.stats?.[sheet.spellcasting.ability] ?? 10) - 10) / 2); return (pb + m) >= 0 ? `+${pb + m}` : `${pb + m}`; })()}
                    </span>
                  </div>
                </div>
              )}
              <label className="label block mb-1">Spell Slots (Max / Used)</label>
              <div className="grid grid-cols-3 gap-1 mb-3">
                {([1,2,3,4,5,6,7,8,9] as const).map(lvl => {
                  const slot = sheet.spellcasting?.slots?.[lvl] || { max: 0, used: 0 };
                  return (
                    <div key={lvl} className="flex flex-col items-center bg-tavern-bg border border-tavern-border rounded p-1.5 gap-0.5">
                      <span className="label text-[9px]">Lv {lvl}</span>
                      <div className="flex items-center gap-1">
                        <input type="number" min={0} max={9}
                          className="w-6 text-center bg-transparent text-tavern-text font-bold outline-none border-b border-tavern-border/50 text-sm"
                          value={slot.max}
                          onChange={(e) => set(`spellcasting.slots.${lvl}.max`, parseInt(e.target.value) || 0)} />
                        <span className="text-tavern-muted text-xs">/</span>
                        <input type="number" min={0} max={9}
                          className="w-6 text-center bg-transparent text-tavern-muted outline-none border-b border-tavern-border/50 text-sm"
                          value={slot.used}
                          onChange={(e) => set(`spellcasting.slots.${lvl}.used`, parseInt(e.target.value) || 0)} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {(['cantrips', 'level1', 'level2', 'level3', 'level4', 'level5', 'level6', 'level7', 'level8', 'level9'] as const).map((lvl) => (
                <div key={lvl} className="mb-2">
                  <label className="label block mb-1 capitalize">{lvl === 'cantrips' ? 'Cantrips' : `Level ${lvl.slice(5)} Spells`}</label>
                  <input
                    className="tavern-input text-xs py-1"
                    placeholder="Comma separated..."
                    value={(sheet.spells?.[lvl] || []).join(', ')}
                    onChange={(e) => set(`spells.${lvl}`, e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean))}
                  />
                </div>
              ))}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
