import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useGameStore } from '../../store/game';
import { Swords, Play, CheckCircle, ChevronDown, ChevronUp, Dices, Shield, Heart, Plus, Minus, SkipForward } from 'lucide-react';
import clsx from 'clsx';

function rollDie(sides: number) { return Math.floor(Math.random() * sides) + 1; }
function rollNotation(notation: string): { total: number } {
  const m = notation.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return { total: 0 };
  const count = parseInt(m[1]), sides = parseInt(m[2]), bonus = m[3] ? parseInt(m[3]) : 0;
  return { total: Math.max(0, Array.from({ length: count }, () => rollDie(sides)).reduce((a, b) => a + b, 0) + bonus) };
}
function mod(s: number) { return Math.floor((s - 10) / 2); }

interface Combatant {
  id: string; name: string; type: string; initiative: number;
  current_hp: number; max_hp: number; ac: number; avatar_url?: string;
  stats: Record<string, number>; actions: any[]; status: string;
}
interface Encounter {
  id: string; name: string; description: string; status: string;
  round: number; notes: string; combatants: Combatant[];
}
interface Props { gameId: string; isDM: boolean }

// ─── CombatantRow: has its own state so hooks are legal ──────────────────────
interface CombatantRowProps {
  c: Combatant;
  encounterId: string;
  gameId: string;
  onApplyHp: (c: Combatant, delta: number) => void;
  onSetInitiative: (c: Combatant, val: number) => void;
  onRollAttack: (c: Combatant, action: any, targetAC: number) => void;
}

function CombatantRow({ c, onApplyHp, onSetInitiative, onRollAttack }: CombatantRowProps) {
  const [showActions, setShowActions] = useState(false);
  const [targetAc, setTargetAc] = useState(10);
  const [hpDelta, setHpDelta] = useState('');

  const hpPct   = c.max_hp > 0 ? c.current_hp / c.max_hp : 0;
  const hpColor = hpPct > 0.5 ? 'bg-green-500' : hpPct > 0.25 ? 'bg-yellow-500' : 'bg-red-500';

  function applyDelta() {
    const v = parseInt(hpDelta);
    if (!isNaN(v)) { onApplyHp(c, v); setHpDelta(''); }
  }

  return (
    <div className={clsx(
      'bg-tavern-bg border rounded p-2 text-xs',
      c.status === 'unconscious' ? 'border-red-900/40 opacity-60' : 'border-tavern-border'
    )}>
      <div className="flex items-center gap-2">
        {/* Initiative input */}
        <input
          type="number"
          className="w-9 text-center bg-transparent border border-tavern-border rounded text-tavern-gold font-bold text-sm"
          value={c.initiative}
          onChange={e => onSetInitiative(c, parseInt(e.target.value) || 0)}
        />
        {/* Avatar */}
        {c.avatar_url
          ? <img src={c.avatar_url} className="w-6 h-6 rounded-full object-cover border border-tavern-border flex-shrink-0" alt="" />
          : <div className="w-6 h-6 rounded-full bg-tavern-card border border-tavern-border flex-shrink-0 flex items-center justify-center">{c.type === 'monster' ? '👹' : '🧙'}</div>}
        <span className="flex-1 font-serif text-tavern-text truncate">{c.name}</span>
        {/* AC */}
        <span className="flex items-center gap-0.5 text-tavern-muted"><Shield size={9}/>{c.ac}</span>
        {/* HP */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => onApplyHp(c, -1)} className="w-4 h-4 rounded bg-red-900/30 hover:bg-red-800/40 text-red-400 flex items-center justify-center"><Minus size={9}/></button>
          <span className={clsx('font-bold w-14 text-center', hpPct < 0.25 ? 'text-red-400' : 'text-tavern-text')}>
            {c.current_hp}/{c.max_hp}
          </span>
          <button onClick={() => onApplyHp(c, 1)} className="w-4 h-4 rounded bg-green-900/30 hover:bg-green-800/40 text-green-400 flex items-center justify-center"><Plus size={9}/></button>
        </div>
        {c.actions.some((a: any) => a.is_attack) && (
          <button onClick={() => setShowActions(x => !x)} className="text-tavern-muted hover:text-tavern-gold">
            <Swords size={11}/>
          </button>
        )}
      </div>

      {/* HP bar */}
      <div className="mt-1 h-1 bg-tavern-border rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', hpColor)} style={{ width: `${hpPct * 100}%` }}/>
      </div>

      {/* Quick delta */}
      <div className="mt-1 flex gap-1">
        <input
          type="text" className="flex-1 bg-tavern-card border border-tavern-border rounded px-1 py-0.5 text-xs text-tavern-text"
          placeholder="±hp" value={hpDelta}
          onChange={e => setHpDelta(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applyDelta()}
        />
        <button onClick={applyDelta} className="text-xs border border-tavern-border rounded px-1.5 text-tavern-muted hover:text-tavern-text">
          Apply
        </button>
      </div>

      {/* Attack actions */}
      {showActions && c.actions.filter((a: any) => a.is_attack).map((action: any, ai: number) => (
        <div key={ai} className="mt-1 flex items-center gap-1 pl-2 border-l-2 border-tavern-gold/30">
          <span className="flex-1 text-tavern-muted">{action.name}</span>
          <span className="text-tavern-gold text-[10px]">+{action.attack_bonus} · {action.damage} {action.damage_type}</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-tavern-muted">vs AC</span>
            <input type="number" className="w-9 text-center bg-transparent border border-tavern-border rounded text-xs"
              value={targetAc} onChange={e => setTargetAc(parseInt(e.target.value) || 10)}/>
            <button onClick={() => onRollAttack(c, action, targetAc)}
              className="text-[10px] border border-tavern-border rounded px-1.5 py-0.5 text-tavern-gold hover:text-tavern-text flex items-center gap-0.5">
              <Dices size={9}/> Roll
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── EncounterPanel ─────────────────────────────────────────────────────────────
export default function EncounterPanel({ gameId, isDM }: Props) {
  const { socket } = useGameStore();
  const [encounters,       setEncounters]       = useState<Encounter[]>([]);
  const [activeEncounter,  setActiveEncounter]  = useState<Encounter | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [expandedId,       setExpandedId]       = useState<string | null>(null);

  useEffect(() => {
    if (!isDM) return;
    api.get(`/games/${gameId}/encounters`).then(({ data }) => {
      setEncounters(data);
      const active = data.find((e: Encounter) => e.status === 'active');
      if (active) setActiveEncounter(active);
    }).finally(() => setLoading(false));
  }, [gameId, isDM]);

  useEffect(() => {
    if (!socket) return;
    socket.on('encounter_started', ({ encounterId, combatants, round }: any) => {
      setEncounters(prev => prev.map(e => e.id === encounterId ? { ...e, status: 'active', round, combatants } : e));
      setActiveEncounter(prev => prev?.id === encounterId ? { ...prev, status: 'active', round, combatants } : prev);
    });
    socket.on('encounter_combatant_updated', ({ encounterId, combatantId, current_hp, initiative, status: cStatus }: any) => {
      const update = (combs: Combatant[]) =>
        combs.map(c => c.id === combatantId ? {
          ...c,
          current_hp:  current_hp  ?? c.current_hp,
          initiative:  initiative  ?? c.initiative,
          status:      cStatus     ?? c.status,
        } : c).sort((a, b) => b.initiative - a.initiative);
      setEncounters(prev => prev.map(e => e.id === encounterId ? { ...e, combatants: update(e.combatants) } : e));
      setActiveEncounter(prev => prev?.id === encounterId ? { ...prev, combatants: update(prev.combatants) } : prev);
    });
    socket.on('encounter_round', ({ encounterId, round }: any) => {
      setEncounters(prev => prev.map(e => e.id === encounterId ? { ...e, round } : e));
      setActiveEncounter(prev => prev?.id === encounterId ? { ...prev, round } : prev);
    });
    socket.on('encounter_ended', ({ encounterId }: any) => {
      setEncounters(prev => prev.map(e => e.id === encounterId ? { ...e, status: 'completed' } : e));
      setActiveEncounter(prev => prev?.id === encounterId ? null : prev);
    });
    return () => {
      socket.off('encounter_started');
      socket.off('encounter_combatant_updated');
      socket.off('encounter_round');
      socket.off('encounter_ended');
    };
  }, [socket]);

  function startEncounter(enc: Encounter) {
    socket?.emit('encounter_start', { encounterId: enc.id });
    setActiveEncounter({ ...enc, status: 'active', round: 1 });
    setEncounters(prev => prev.map(e => e.id === enc.id ? { ...e, status: 'active', round: 1 } : e));
  }

  function endEncounter() {
    if (!activeEncounter) return;
    socket?.emit('encounter_end', { encounterId: activeEncounter.id });
    setActiveEncounter(null);
  }

  function nextRound() {
    if (!activeEncounter) return;
    socket?.emit('encounter_next_round', { encounterId: activeEncounter.id });
  }

  function rollInitiativeAll() {
    if (!activeEncounter) return;
    activeEncounter.combatants.forEach(c => {
      const dexMod = mod(c.stats?.dex ?? 10);
      const r = rollDie(20) + dexMod;
      socket?.emit('encounter_update', { encounterId: activeEncounter.id, combatantId: c.id, initiative: r });
      api.put(`/games/${gameId}/encounters/${activeEncounter.id}/combatants/${c.id}`, { initiative: r });
    });
    toast.success('Initiative rolled!');
  }

  function applyHpDelta(c: Combatant, delta: number) {
    if (!activeEncounter) return;
    const newHp = Math.max(0, Math.min(c.max_hp, c.current_hp + delta));
    const newStatus = newHp === 0 ? 'unconscious' : 'active';
    socket?.emit('encounter_update', { encounterId: activeEncounter.id, combatantId: c.id, current_hp: newHp, status: newStatus });
    api.put(`/games/${gameId}/encounters/${activeEncounter.id}/combatants/${c.id}`, { current_hp: newHp, status: newStatus });
  }

  function setInitiative(c: Combatant, val: number) {
    if (!activeEncounter) return;
    socket?.emit('encounter_update', { encounterId: activeEncounter.id, combatantId: c.id, initiative: val });
    api.put(`/games/${gameId}/encounters/${activeEncounter.id}/combatants/${c.id}`, { initiative: val });
  }

  function rollAttack(c: Combatant, action: any, targetAC: number) {
    if (!activeEncounter) return;
    const attackRoll = rollDie(20) + (action.attack_bonus || 0);
    const hit = attackRoll >= targetAC;
    const damageTotal = hit && action.damage ? rollNotation(action.damage).total : 0;
    socket?.emit('encounter_attack_roll', {
      encounterId: activeEncounter.id,
      attackerName: c.name, targetName: `AC ${targetAC}`,
      notation: `d20+${action.attack_bonus || 0}`,
      attackBonus: action.attack_bonus || 0,
      damageDice: action.damage || '',
      attackTotal: attackRoll, damageTotal, hit,
    });
    toast(hit ? `💥 Hit! ${attackRoll} → ${damageTotal} ${action.damage_type || 'dmg'}` : `Miss (${attackRoll})`, { duration: 3000 });
  }

  if (!isDM) return (
    <div className="p-4 text-center text-tavern-muted text-sm font-serif italic">
      Encounter info visible to DM only
    </div>
  );
  if (loading) return <div className="p-4 text-tavern-muted text-sm animate-pulse">Loading encounters...</div>;

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ── Active encounter banner ── */}
      {activeEncounter && (
        <div className="border-b border-tavern-gold/30 bg-tavern-gold/5 p-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
            <div>
              <span className="font-serif text-tavern-gold text-sm font-semibold">{activeEncounter.name}</span>
              <span className="ml-2 text-xs text-tavern-muted">Round {activeEncounter.round}</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              <button onClick={rollInitiativeAll}
                className="text-xs border border-tavern-border rounded px-2 py-1 text-tavern-muted hover:text-tavern-gold flex items-center gap-1">
                <Dices size={11}/> Init
              </button>
              <button onClick={nextRound}
                className="text-xs border border-tavern-border rounded px-2 py-1 text-tavern-muted hover:text-tavern-gold flex items-center gap-1">
                <SkipForward size={11}/> Next Round
              </button>
              <button onClick={endEncounter}
                className="text-xs border border-red-900/40 rounded px-2 py-1 text-red-400 hover:text-red-300 flex items-center gap-1">
                <CheckCircle size={11}/> End
              </button>
            </div>
          </div>

          <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
            {[...activeEncounter.combatants]
              .sort((a, b) => b.initiative - a.initiative)
              .map(c => (
                <CombatantRow
                  key={c.id}
                  c={c}
                  encounterId={activeEncounter.id}
                  gameId={gameId}
                  onApplyHp={applyHpDelta}
                  onSetInitiative={setInitiative}
                  onRollAttack={rollAttack}
                />
              ))}
          </div>
        </div>
      )}

      {/* ── Encounter list ── */}
      <div className="flex-1 overflow-y-auto p-3">
        <p className="label mb-2">All Encounters</p>
        {encounters.length === 0 ? (
          <p className="text-tavern-muted text-xs italic text-center py-4">No encounters yet — create them in the lobby.</p>
        ) : (
          <div className="space-y-2">
            {encounters.map(enc => (
              <div key={enc.id} className={clsx(
                'border rounded p-2 text-xs',
                enc.status === 'active' ? 'border-tavern-gold/50 bg-tavern-gold/5' :
                enc.status === 'completed' ? 'border-tavern-border opacity-50' : 'border-tavern-border'
              )}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button onClick={() => setExpandedId(expandedId === enc.id ? null : enc.id)} className="text-tavern-muted flex-shrink-0">
                      {expandedId === enc.id ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                    </button>
                    <span className="font-serif text-tavern-text truncate">{enc.name}</span>
                    <span className={clsx(
                      'text-[10px] px-1.5 py-0.5 rounded flex-shrink-0',
                      enc.status === 'active' ? 'bg-green-900/40 text-green-400' : 'bg-tavern-bg text-tavern-muted'
                    )}>{enc.status}</span>
                    <span className="text-tavern-muted flex-shrink-0">{enc.combatants.length} fighters</span>
                  </div>
                  {/* Start button — centered with flex */}
                  {enc.status === 'pending' && !activeEncounter && (
                    <button
                      onClick={() => startEncounter(enc)}
                      className="flex-shrink-0 flex items-center justify-center gap-1 text-xs border border-tavern-gold/40 rounded px-2 py-1 text-tavern-gold hover:bg-tavern-gold/10 transition-colors"
                    >
                      <Play size={10}/> Start
                    </button>
                  )}
                  {enc.status === 'active' && (
                    <span className="flex-shrink-0 text-xs text-green-400">Round {enc.round}</span>
                  )}
                </div>

                {expandedId === enc.id && (
                  <div className="mt-2 pl-5 space-y-1">
                    {enc.combatants.map(c => (
                      <div key={c.id} className="flex items-center gap-2 text-tavern-muted">
                        <span>{c.type === 'monster' ? '👹' : '🧙'}</span>
                        <span className="flex-1 text-tavern-text">{c.name}</span>
                        <span className="flex items-center gap-0.5"><Shield size={9}/> {c.ac}</span>
                        <span className="flex items-center gap-0.5"><Heart size={9}/> {c.max_hp}</span>
                      </div>
                    ))}
                    {enc.description && <p className="text-tavern-muted italic mt-1">{enc.description}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
