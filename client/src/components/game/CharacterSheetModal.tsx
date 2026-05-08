import { X } from 'lucide-react';
import { getRaceAvatar, avatarStyle } from '../../lib/avatars';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const ABILITY_LABELS: Record<string, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };
const SKILLS: Record<string, string> = {
  acrobatics: 'dex', animal_handling: 'wis', arcana: 'int', athletics: 'str',
  deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
  investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
  performance: 'cha', persuasion: 'cha', religion: 'int', sleight_of_hand: 'dex',
  stealth: 'dex', survival: 'wis',
};

function mod(score: number) { return Math.floor((score - 10) / 2); }
function fmt(n: number) { return n >= 0 ? `+${n}` : `${n}`; }

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center bg-tavern-bg border border-tavern-border rounded px-2 py-1.5 min-w-[48px]">
      <span className="text-base font-bold font-serif text-tavern-gold leading-none">{value}</span>
      <span className="text-[9px] text-tavern-muted uppercase tracking-wide mt-0.5">{label}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-serif text-tavern-gold text-xs uppercase tracking-widest mb-2 border-b border-tavern-border pb-1">{title}</h3>
      {children}
    </div>
  );
}

interface Props {
  sheet: Record<string, any>;
  charName: string;
  avatarUrl?: string | null;
  onClose: () => void;
}

export default function CharacterSheetModal({ sheet, charName, avatarUrl, onClose }: Props) {
  const pb = sheet.proficiency_bonus || 2;
  const stats = sheet.stats || {};
  const combat = sheet.combat || {};
  const spellcasting = sheet.spellcasting || {};

  const hpPct = combat.max_hp > 0 ? Math.max(0, Math.min(100, (combat.current_hp / combat.max_hp) * 100)) : 0;
  const hpColor = hpPct > 60 ? 'bg-green-500' : hpPct > 30 ? 'bg-yellow-500' : 'bg-red-500';

  const spellAbilityMod = spellcasting.ability ? mod(stats[spellcasting.ability] ?? 10) : 0;
  const hasSpellcasting = !!spellcasting.ability;
  const hasSlots = hasSpellcasting && Object.values(spellcasting.slots || {}).some((s: any) => s.max > 0);

  const avatarDef = getRaceAvatar(sheet.race || '');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-tavern-card border border-tavern-border rounded-lg w-full max-w-2xl my-4">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-tavern-border">
          <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border border-tavern-border">
            {avatarUrl
              ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-2xl" style={avatarStyle(avatarDef)}>{avatarDef.emoji}</div>}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-tavern-gold text-lg font-bold leading-tight truncate">{charName}</h2>
            <p className="text-xs text-tavern-muted">
              {[sheet.race, sheet.class, sheet.level ? `Level ${sheet.level}` : null, sheet.background].filter(Boolean).join(' · ')}
            </p>
            {sheet.alignment && <p className="text-xs text-tavern-muted/60 italic">{sheet.alignment}</p>}
          </div>
          <button onClick={onClose} className="text-tavern-muted hover:text-tavern-text transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Combat bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-tavern-muted mb-0.5">
              <span className="font-serif">HP</span>
              <span className="font-serif font-bold text-tavern-text">{combat.current_hp ?? 0} / {combat.max_hp ?? 0}{(combat.temp_hp ?? 0) > 0 ? ` (+${combat.temp_hp} temp)` : ''}</span>
            </div>
            <div className="h-2 bg-tavern-bg rounded-full overflow-hidden border border-tavern-border/40">
              <div className={`h-full rounded-full transition-all ${hpColor}`} style={{ width: `${hpPct}%` }} />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Stat label="AC" value={combat.ac ?? 0} />
              <Stat label="Init" value={fmt(combat.initiative ?? 0)} />
              <Stat label="Speed" value={`${combat.speed ?? 30}ft`} />
              <Stat label="Prof" value={fmt(pb)} />
              <Stat label="Hit Die" value={combat.hit_dice || '1d8'} />
              {(combat.death_saves?.successes || combat.death_saves?.failures) ? (
                <div className="flex flex-col justify-center px-2">
                  <span className="text-[9px] text-tavern-muted uppercase tracking-wide mb-0.5">Death Saves</span>
                  <div className="flex gap-1.5">
                    <span className="text-green-400 text-xs">✓ {combat.death_saves.successes}</span>
                    <span className="text-red-400 text-xs">✗ {combat.death_saves.failures}</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Abilities + Saves + Skills */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

            {/* Ability scores */}
            <Block title="Ability Scores">
              <div className="grid grid-cols-3 gap-2">
                {ABILITIES.map((ab) => {
                  const score = stats[ab] ?? 10;
                  const m = mod(score);
                  return (
                    <div key={ab} className="flex flex-col items-center bg-tavern-bg border border-tavern-border rounded py-2 gap-0.5">
                      <span className="text-[9px] text-tavern-muted uppercase tracking-wide">{ABILITY_LABELS[ab]}</span>
                      <span className="text-xl font-bold font-serif text-tavern-text">{score}</span>
                      <span className="text-sm font-bold font-serif text-tavern-gold">{fmt(m)}</span>
                    </div>
                  );
                })}
              </div>
            </Block>

            {/* Saving throws */}
            <Block title="Saving Throws">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {ABILITIES.map((ab) => {
                  const proficient = sheet.saving_throws?.[ab] ?? false;
                  const bonus = mod(stats[ab] ?? 10) + (proficient ? pb : 0);
                  return (
                    <div key={ab} className="flex items-center gap-1.5 py-0.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${proficient ? 'bg-tavern-gold' : 'bg-tavern-border'}`} />
                      <span className="text-tavern-gold text-xs w-7 font-serif">{fmt(bonus)}</span>
                      <span className="text-tavern-text text-xs">{ABILITY_LABELS[ab]}</span>
                    </div>
                  );
                })}
              </div>
            </Block>
          </div>

          {/* Skills */}
          <Block title="Skills">
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
              {Object.entries(SKILLS).map(([skill, attr]) => {
                const proficient = sheet.skills?.[skill] ?? false;
                const bonus = mod(stats[attr] ?? 10) + (proficient ? pb : 0);
                return (
                  <div key={skill} className="flex items-center gap-1.5 py-0.5">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${proficient ? 'bg-tavern-gold' : 'bg-tavern-border'}`} />
                    <span className="text-tavern-gold text-xs w-7 font-serif">{fmt(bonus)}</span>
                    <span className="text-tavern-text text-xs capitalize flex-1">{skill.replace(/_/g, ' ')}</span>
                    <span className="text-tavern-muted text-[9px]">{ABILITY_LABELS[attr]}</span>
                  </div>
                );
              })}
            </div>
          </Block>

          {/* Attacks */}
          {(sheet.attacks || []).length > 0 && (
            <Block title="Attacks">
              <div className="space-y-1">
                <div className="grid grid-cols-3 gap-2 text-[9px] text-tavern-muted uppercase tracking-wide px-1 mb-1">
                  <span>Name</span><span>Bonus</span><span>Damage</span>
                </div>
                {(sheet.attacks as any[]).map((atk, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2 bg-tavern-bg rounded px-2 py-1.5 border border-tavern-border/50">
                    <span className="text-sm text-tavern-text font-serif truncate">{atk.name || '—'}</span>
                    <span className="text-sm text-tavern-gold font-serif">{atk.bonus || '—'}</span>
                    <span className="text-sm text-tavern-text font-serif">{atk.damage || '—'}</span>
                  </div>
                ))}
              </div>
            </Block>
          )}

          {/* Spellcasting */}
          {hasSpellcasting && (
            <Block title="Spellcasting">
              <div className="flex flex-wrap gap-2 mb-3">
                <Stat label="Ability" value={ABILITY_LABELS[spellcasting.ability] || '—'} />
                <Stat label="Save DC" value={8 + pb + spellAbilityMod} />
                <Stat label="Attack" value={fmt(pb + spellAbilityMod)} />
              </div>
              {hasSlots && (
                <div>
                  <p className="text-[9px] text-tavern-muted uppercase tracking-wide mb-1.5">Spell Slots (used / max)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {([1,2,3,4,5,6,7,8,9] as const).map(lvl => {
                      const slot = spellcasting.slots?.[lvl] || { max: 0, used: 0 };
                      if (slot.max === 0) return null;
                      return (
                        <div key={lvl} className="flex flex-col items-center bg-tavern-bg border border-tavern-border rounded px-2 py-1">
                          <span className="text-[9px] text-tavern-muted">Lvl {lvl}</span>
                          <span className="text-sm font-serif font-bold text-tavern-text">{slot.used}/{slot.max}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Block>
          )}

          {/* Text sections */}
          {sheet.features && (
            <Block title="Features & Traits">
              <p className="text-sm text-tavern-text whitespace-pre-wrap leading-relaxed">{sheet.features}</p>
            </Block>
          )}
          {sheet.equipment && (
            <Block title="Equipment">
              <p className="text-sm text-tavern-text whitespace-pre-wrap leading-relaxed">{sheet.equipment}</p>
            </Block>
          )}
          {(sheet.traits?.personality || sheet.traits?.ideals || sheet.traits?.bonds || sheet.traits?.flaws) && (
            <Block title="Personality">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Personality', sheet.traits?.personality],
                  ['Ideals', sheet.traits?.ideals],
                  ['Bonds', sheet.traits?.bonds],
                  ['Flaws', sheet.traits?.flaws],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label as string}>
                    <p className="text-[9px] text-tavern-muted uppercase tracking-wide mb-1">{label}</p>
                    <p className="text-xs text-tavern-text leading-relaxed">{value}</p>
                  </div>
                ))}
              </div>
            </Block>
          )}
          {sheet.backstory && (
            <Block title="Backstory">
              <p className="text-sm text-tavern-text whitespace-pre-wrap leading-relaxed">{sheet.backstory}</p>
            </Block>
          )}
          {sheet.notes && (
            <Block title="Notes">
              <p className="text-sm text-tavern-text whitespace-pre-wrap leading-relaxed">{sheet.notes}</p>
            </Block>
          )}

        </div>
      </div>
    </div>
  );
}
