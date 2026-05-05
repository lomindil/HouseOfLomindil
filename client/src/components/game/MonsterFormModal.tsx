import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { X, Save, Plus, Trash2, Camera, ChevronDown, ChevronUp } from 'lucide-react';

const SIZES = ['Tiny','Small','Medium','Large','Huge','Gargantuan'];
const TYPES = ['Aberration','Beast','Celestial','Construct','Dragon','Elemental','Fey','Fiend','Giant','Humanoid','Monstrosity','Ooze','Plant','Undead'];
const ALIGNMENTS = ['Unaligned','Any Alignment','Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'];
const ABILITIES = ['str','dex','con','int','wis','cha'] as const;
const ABILITY_NAMES: Record<string, string> = { str:'STR', dex:'DEX', con:'CON', int:'INT', wis:'WIS', cha:'CHA' };
const CR_LIST = ['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30'];
const CR_XP: Record<string, number> = {'0':10,'1/8':25,'1/4':50,'1/2':100,'1':200,'2':450,'3':700,'4':1100,'5':1800,'6':2300,'7':2900,'8':3900,'9':5000,'10':5900,'11':7200,'12':8400,'13':10000,'14':11500,'15':13000,'16':15000,'17':18000,'18':20000,'19':22000,'20':25000,'21':33000,'22':41000,'23':50000,'24':62000,'25':75000,'26':90000,'27':105000,'28':120000,'29':135000,'30':155000};

function mod(s: number) { return Math.floor((s - 10) / 2); }
function fmtMod(n: number) { return n >= 0 ? `+${n}` : `${n}`; }

function emptyMonster() {
  return {
    name: '', type: 'Beast', size: 'Medium', alignment: 'Unaligned', cr: '1', xp: 200,
    ac: 13, ac_type: '', max_hp: 26, hp_dice: '4d8+8', speed: '30 ft.',
    stats: { str: 15, dex: 11, con: 14, int: 5, wis: 12, cha: 6 },
    saving_throws: [] as string[],
    skills: [] as string[],
    damage_vulnerabilities: '', damage_resistances: '', damage_immunities: '',
    condition_immunities: '', senses: 'Passive Perception 11', languages: 'Common',
    traits: [] as { name: string; desc: string }[],
    actions: [] as { name: string; desc: string; attack_bonus?: number; damage?: string; damage_type?: string; reach?: string; is_attack?: boolean }[],
    reactions: [] as { name: string; desc: string }[],
    legendary_actions: [] as { name: string; desc: string }[],
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-tavern-border rounded overflow-hidden mb-3">
      <button className="w-full flex items-center justify-between px-3 py-2 bg-tavern-bg/50 text-left" onClick={() => setOpen(!open)}>
        <span className="font-serif text-tavern-gold text-xs font-semibold uppercase tracking-widest">{title}</span>
        {open ? <ChevronUp size={13} className="text-tavern-muted" /> : <ChevronDown size={13} className="text-tavern-muted" />}
      </button>
      {open && <div className="px-3 pb-3 pt-2">{children}</div>}
    </div>
  );
}

interface Props {
  gameId: string;
  monster?: any;
  onClose: () => void;
  onSaved: (m: any) => void;
}

export default function MonsterFormModal({ gameId, monster, onClose, onSaved }: Props) {
  const [data, setData] = useState<any>(monster ? {
    ...monster,
    stats: monster.stats || { str:10,dex:10,con:10,int:10,wis:10,cha:10 },
    saving_throws: monster.saving_throws || [],
    skills: monster.skills || [],
    traits: monster.traits || [],
    actions: monster.actions || [],
    reactions: monster.reactions || [],
    legendary_actions: monster.legendary_actions || [],
  } : emptyMonster());
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(monster?.avatar_url || '');
  const avatarRef = useRef<HTMLInputElement>(null);

  function set(key: string, value: any) { setData((p: any) => ({ ...p, [key]: value })); }
  function setStat(ab: string, v: number) { setData((p: any) => ({ ...p, stats: { ...p.stats, [ab]: v } })); }
  function toggleList(key: string, val: string) {
    setData((p: any) => {
      const arr: string[] = p[key] || [];
      return { ...p, [key]: arr.includes(val) ? arr.filter((x: string) => x !== val) : [...arr, val] };
    });
  }

  function addEntry(key: string) {
    setData((p: any) => ({ ...p, [key]: [...(p[key] || []), { name: '', desc: '' }] }));
  }
  function updateEntry(key: string, idx: number, field: string, val: any) {
    setData((p: any) => {
      const arr = [...(p[key] || [])];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...p, [key]: arr };
    });
  }
  function removeEntry(key: string, idx: number) {
    setData((p: any) => ({ ...p, [key]: (p[key] || []).filter((_: any, i: number) => i !== idx) }));
  }

  async function uploadAvatar(file: File) {
    if (!monster?.id) { toast.error('Save monster first to upload avatar'); return; }
    const fd = new FormData();
    fd.append('avatar', file);
    try {
      const { data: res } = await api.post(`/games/${gameId}/monsters/${monster.id}/avatar`, fd);
      setAvatarUrl(res.avatar_url);
      toast.success('Avatar updated!');
    } catch { toast.error('Upload failed'); }
  }

  async function save() {
    if (!data.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      const payload = { ...data };
      let result;
      if (monster) {
        const { data: res } = await api.put(`/games/${gameId}/monsters/${monster.id}`, payload);
        result = res;
      } else {
        const { data: res } = await api.post(`/games/${gameId}/monsters`, payload);
        result = res;
      }
      onSaved(result);
      toast.success(monster ? 'Monster updated!' : 'Monster created!');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-tavern-card border border-tavern-border rounded-lg w-full max-w-4xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-tavern-border sticky top-0 bg-tavern-card z-10">
          <h2 className="font-serif text-tavern-gold font-semibold">{monster ? `Edit: ${monster.name}` : 'New Monster'}</h2>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={saving} className="btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5">
              <Save size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={onClose} className="text-tavern-muted hover:text-tavern-text p-1"><X size={18} /></button>
          </div>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Left col */}
          <div>
            {/* Avatar */}
            <div className="flex flex-col items-center mb-4">
              <div
                className="w-24 h-24 rounded-full bg-tavern-bg border-2 border-tavern-border overflow-hidden cursor-pointer hover:border-tavern-gold transition-colors relative"
                onClick={() => avatarRef.current?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">👹</div>
                )}
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Camera size={18} className="text-white" />
                </div>
              </div>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
              <p className="text-xs text-tavern-muted mt-1">{monster ? 'Click to change' : 'Save first to upload'}</p>
            </div>

            <Section title="Identity">
              <div className="space-y-2">
                <div>
                  <label className="label block mb-1">Name *</label>
                  <input className="tavern-input text-sm" value={data.name} onChange={(e) => set('name', e.target.value)} placeholder="Cave Bear" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label block mb-1">Size</label>
                    <select className="tavern-input text-sm" value={data.size} onChange={(e) => set('size', e.target.value)}>
                      {SIZES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label block mb-1">Type</label>
                    <select className="tavern-input text-sm" value={data.type} onChange={(e) => set('type', e.target.value)}>
                      {TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label block mb-1">Alignment</label>
                  <select className="tavern-input text-sm" value={data.alignment} onChange={(e) => set('alignment', e.target.value)}>
                    {ALIGNMENTS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label block mb-1">CR</label>
                    <select className="tavern-input text-sm" value={data.cr}
                      onChange={(e) => { set('cr', e.target.value); set('xp', CR_XP[e.target.value] || 0); }}>
                      {CR_LIST.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label block mb-1">XP</label>
                    <input type="number" className="tavern-input text-sm" value={data.xp} onChange={(e) => set('xp', parseInt(e.target.value) || 0)} />
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Defenses">
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label block mb-1">AC</label>
                    <input type="number" className="tavern-input text-sm" value={data.ac} onChange={(e) => set('ac', parseInt(e.target.value) || 10)} />
                  </div>
                  <div>
                    <label className="label block mb-1">AC Type</label>
                    <input className="tavern-input text-sm" value={data.ac_type} onChange={(e) => set('ac_type', e.target.value)} placeholder="natural armor" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label block mb-1">Max HP</label>
                    <input type="number" className="tavern-input text-sm" value={data.max_hp} onChange={(e) => set('max_hp', parseInt(e.target.value) || 1)} />
                  </div>
                  <div>
                    <label className="label block mb-1">HP Dice</label>
                    <input className="tavern-input text-sm" value={data.hp_dice} onChange={(e) => set('hp_dice', e.target.value)} placeholder="4d8+8" />
                  </div>
                </div>
                <div>
                  <label className="label block mb-1">Speed</label>
                  <input className="tavern-input text-sm" value={data.speed} onChange={(e) => set('speed', e.target.value)} placeholder="30 ft., swim 30 ft." />
                </div>
                <div>
                  <label className="label block mb-1">Senses</label>
                  <input className="tavern-input text-sm" value={data.senses} onChange={(e) => set('senses', e.target.value)} />
                </div>
                <div>
                  <label className="label block mb-1">Languages</label>
                  <input className="tavern-input text-sm" value={data.languages} onChange={(e) => set('languages', e.target.value)} />
                </div>
              </div>
            </Section>

            <Section title="Damage & Conditions">
              <div className="space-y-2">
                {([['damage_vulnerabilities','Vulnerabilities'],['damage_resistances','Resistances'],['damage_immunities','Immunities'],['condition_immunities','Condition Immunities']] as const).map(([k, label]) => (
                  <div key={k}>
                    <label className="label block mb-1">{label}</label>
                    <input className="tavern-input text-xs py-1" value={data[k]} onChange={(e) => set(k, e.target.value)} placeholder="fire, poison..." />
                  </div>
                ))}
              </div>
            </Section>
          </div>

          {/* Middle col */}
          <div>
            <Section title="Ability Scores">
              <div className="grid grid-cols-3 gap-2">
                {ABILITIES.map(ab => {
                  const score = data.stats?.[ab] ?? 10;
                  return (
                    <div key={ab} className="flex flex-col items-center bg-tavern-bg border border-tavern-border rounded p-2 gap-1">
                      <span className="label text-xs">{ABILITY_NAMES[ab]}</span>
                      <input type="number" min={1} max={30}
                        className="w-full text-center bg-transparent text-tavern-text text-lg font-bold font-serif outline-none border-b border-tavern-border/50 focus:border-tavern-gold"
                        value={score} onChange={(e) => setStat(ab, parseInt(e.target.value) || 10)} />
                      <span className="text-tavern-gold text-sm font-bold">{fmtMod(mod(score))}</span>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="Saving Throws (proficient)">
              <div className="grid grid-cols-3 gap-1">
                {ABILITIES.map(ab => (
                  <label key={ab} className="flex items-center gap-1.5 cursor-pointer py-1">
                    <input type="checkbox" className="accent-yellow-500"
                      checked={(data.saving_throws || []).includes(ab)}
                      onChange={() => toggleList('saving_throws', ab)} />
                    <span className="text-xs text-tavern-text">{ABILITY_NAMES[ab]}</span>
                    <span className="text-tavern-gold text-xs">{fmtMod(mod(data.stats?.[ab] ?? 10) + 2)}</span>
                  </label>
                ))}
              </div>
            </Section>

            <Section title="Skills (proficient)">
              <div className="flex flex-wrap gap-1">
                {['Athletics','Acrobatics','Stealth','Perception','Insight','Persuasion','Intimidation','Arcana','History','Nature','Religion','Investigation','Medicine','Animal Handling','Survival','Deception','Performance','Sleight of Hand'].map(sk => (
                  <label key={sk} className="flex items-center gap-1 cursor-pointer text-xs border border-tavern-border rounded px-1.5 py-0.5 hover:border-tavern-gold/50 transition-colors"
                    style={{ background: (data.skills || []).includes(sk) ? 'rgba(184,134,11,0.15)' : undefined }}>
                    <input type="checkbox" className="accent-yellow-500"
                      checked={(data.skills || []).includes(sk)}
                      onChange={() => toggleList('skills', sk)} />
                    {sk}
                  </label>
                ))}
              </div>
            </Section>
          </div>

          {/* Right col */}
          <div>
            <Section title="Traits">
              {(data.traits || []).map((t: any, i: number) => (
                <div key={i} className="mb-2 p-2 bg-tavern-bg rounded border border-tavern-border relative">
                  <button onClick={() => removeEntry('traits', i)} className="absolute top-1 right-1 text-tavern-muted hover:text-red-400"><Trash2 size={11} /></button>
                  <input className="tavern-input text-xs py-0.5 mb-1 font-semibold" placeholder="Trait name" value={t.name} onChange={(e) => updateEntry('traits', i, 'name', e.target.value)} />
                  <textarea className="tavern-input text-xs py-0.5 resize-none" rows={2} placeholder="Description..." value={t.desc} onChange={(e) => updateEntry('traits', i, 'desc', e.target.value)} />
                </div>
              ))}
              <button onClick={() => addEntry('traits')} className="text-xs text-tavern-gold hover:text-tavern-text flex items-center gap-1 mt-1"><Plus size={12} /> Add Trait</button>
            </Section>

            <Section title="Actions">
              {(data.actions || []).map((a: any, i: number) => (
                <div key={i} className="mb-2 p-2 bg-tavern-bg rounded border border-tavern-border relative">
                  <button onClick={() => removeEntry('actions', i)} className="absolute top-1 right-1 text-tavern-muted hover:text-red-400"><Trash2 size={11} /></button>
                  <input className="tavern-input text-xs py-0.5 mb-1 font-semibold" placeholder="Action name" value={a.name} onChange={(e) => updateEntry('actions', i, 'name', e.target.value)} />
                  <textarea className="tavern-input text-xs py-0.5 resize-none mb-1" rows={2} placeholder="Description..." value={a.desc} onChange={(e) => updateEntry('actions', i, 'desc', e.target.value)} />
                  <label className="flex items-center gap-1.5 text-xs text-tavern-muted cursor-pointer mb-1">
                    <input type="checkbox" className="accent-yellow-500" checked={!!a.is_attack} onChange={(e) => updateEntry('actions', i, 'is_attack', e.target.checked)} />
                    Attack action
                  </label>
                  {a.is_attack && (
                    <div className="grid grid-cols-3 gap-1">
                      <div>
                        <label className="label text-[9px]">To Hit</label>
                        <input type="number" className="tavern-input text-xs py-0.5" placeholder="+5" value={a.attack_bonus ?? ''} onChange={(e) => updateEntry('actions', i, 'attack_bonus', parseInt(e.target.value))} />
                      </div>
                      <div>
                        <label className="label text-[9px]">Damage</label>
                        <input className="tavern-input text-xs py-0.5" placeholder="2d6+4" value={a.damage || ''} onChange={(e) => updateEntry('actions', i, 'damage', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-[9px]">Type</label>
                        <input className="tavern-input text-xs py-0.5" placeholder="piercing" value={a.damage_type || ''} onChange={(e) => updateEntry('actions', i, 'damage_type', e.target.value)} />
                      </div>
                      <div className="col-span-3">
                        <label className="label text-[9px]">Reach / Range</label>
                        <input className="tavern-input text-xs py-0.5" placeholder="5 ft. or 80/320 ft." value={a.reach || ''} onChange={(e) => updateEntry('actions', i, 'reach', e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={() => addEntry('actions')} className="text-xs text-tavern-gold hover:text-tavern-text flex items-center gap-1 mt-1"><Plus size={12} /> Add Action</button>
            </Section>

            <Section title="Reactions">
              {(data.reactions || []).map((r: any, i: number) => (
                <div key={i} className="mb-2 p-2 bg-tavern-bg rounded border border-tavern-border relative">
                  <button onClick={() => removeEntry('reactions', i)} className="absolute top-1 right-1 text-tavern-muted hover:text-red-400"><Trash2 size={11} /></button>
                  <input className="tavern-input text-xs py-0.5 mb-1" placeholder="Reaction name" value={r.name} onChange={(e) => updateEntry('reactions', i, 'name', e.target.value)} />
                  <textarea className="tavern-input text-xs py-0.5 resize-none" rows={2} placeholder="Description..." value={r.desc} onChange={(e) => updateEntry('reactions', i, 'desc', e.target.value)} />
                </div>
              ))}
              <button onClick={() => addEntry('reactions')} className="text-xs text-tavern-gold hover:text-tavern-text flex items-center gap-1 mt-1"><Plus size={12} /> Add Reaction</button>
            </Section>

            <Section title="Legendary Actions">
              {(data.legendary_actions || []).map((la: any, i: number) => (
                <div key={i} className="mb-2 p-2 bg-tavern-bg rounded border border-tavern-border relative">
                  <button onClick={() => removeEntry('legendary_actions', i)} className="absolute top-1 right-1 text-tavern-muted hover:text-red-400"><Trash2 size={11} /></button>
                  <input className="tavern-input text-xs py-0.5 mb-1" placeholder="Action name" value={la.name} onChange={(e) => updateEntry('legendary_actions', i, 'name', e.target.value)} />
                  <textarea className="tavern-input text-xs py-0.5 resize-none" rows={2} placeholder="Description..." value={la.desc} onChange={(e) => updateEntry('legendary_actions', i, 'desc', e.target.value)} />
                </div>
              ))}
              <button onClick={() => addEntry('legendary_actions')} className="text-xs text-tavern-gold hover:text-tavern-text flex items-center gap-1 mt-1"><Plus size={12} /> Add Legendary Action</button>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
