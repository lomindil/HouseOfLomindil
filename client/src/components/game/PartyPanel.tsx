import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useGameStore } from '../../store/game';
import { useAuthStore } from '../../store/auth';
import clsx from 'clsx';
import { RefreshCw, ScrollText } from 'lucide-react';
import { getRaceAvatar, avatarStyle } from '../../lib/avatars';
import CharacterSheetModal from './CharacterSheetModal';

interface PartyMember {
  user_id: string;
  username: string;
  character_id: string | null;
  char_name: string | null;
  avatar_url: string | null;
  sheet_data: Record<string, any> | null;
}

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  const color = pct > 60 ? 'bg-green-500' : pct > 30 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs text-tavern-muted mb-0.5">
        <span>HP</span>
        <span className="font-serif">{current}/{max}</span>
      </div>
      <div className="h-1.5 bg-tavern-bg rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center bg-tavern-bg rounded border border-tavern-border px-1.5 py-1 min-w-[38px]">
      <span className="text-xs font-bold font-serif text-tavern-gold">{value}</span>
      <span className="text-[9px] text-tavern-muted uppercase tracking-wide">{label}</span>
    </div>
  );
}

export default function PartyPanel({ gameId, isDM }: { gameId: string; isDM: boolean }) {
  const { hpOverrides, onlinePlayers, game } = useGameStore();
  const { user } = useAuthStore();
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetViewing, setSheetViewing] = useState<PartyMember | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(`/games/${gameId}/party`);
      setMembers(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [gameId]);

  // Re-fetch when HP overrides change so new values are reflected
  useEffect(() => {
    if (Object.keys(hpOverrides).length > 0) load();
  }, [JSON.stringify(hpOverrides)]);

  return (
    <div className="p-3 space-y-3 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-1">
        <h3 className="label">Party</h3>
        <button onClick={load} className="text-tavern-muted hover:text-tavern-text transition-colors" title="Refresh">
          <RefreshCw size={12} />
        </button>
      </div>

      {/* DM row */}
      <div className="flex items-center gap-2 p-1.5 rounded bg-tavern-bg/50">
        <div className="w-7 h-7 rounded-full bg-tavern-gold/20 border border-tavern-gold/50 flex items-center justify-center flex-shrink-0">
          <span className="text-xs text-tavern-gold font-serif">DM</span>
        </div>
        <span className="text-sm text-tavern-text">{game?.dm_username}</span>
        <span className="ml-auto w-2 h-2 rounded-full bg-green-400 opacity-70" title="Online" />
      </div>

      {loading && <p className="text-xs text-tavern-muted text-center py-2">Loading...</p>}

      {members.map((m) => {
        const sheet = m.sheet_data;
        const combat = sheet?.combat || {};
        // Use live HP override if available, otherwise fall back to sheet
        const hpLive = m.character_id ? hpOverrides[m.character_id] : undefined;
        const currentHp = hpLive?.current_hp ?? combat.current_hp ?? 0;
        const maxHp = hpLive?.max_hp ?? combat.max_hp ?? 0;
        const isOnline = onlinePlayers.has(m.user_id);
        const isSelf = m.user_id === user?.id;

        const abilityMods = sheet?.abilities
          ? Object.fromEntries(
              Object.entries(sheet.abilities as Record<string, number>).map(([k, v]) => [
                k.slice(0, 3).toUpperCase(),
                Math.floor((v - 10) / 2),
              ])
            )
          : {};

        return (
          <div
            key={m.user_id}
            className={clsx('rounded border p-2 text-sm', isSelf ? 'border-tavern-gold/40 bg-tavern-gold/5' : 'border-tavern-border bg-tavern-bg/30')}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                {m.avatar_url
                  ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                  : (() => {
                      const def = getRaceAvatar(m.sheet_data?.race || '');
                      return (
                        <div className="w-full h-full rounded-full flex items-center justify-center text-lg" style={avatarStyle(def)}>
                          {def.emoji}
                        </div>
                      );
                    })()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-tavern-text font-serif truncate">{m.char_name || m.username}</span>
                  {isSelf && <span className="text-[9px] text-tavern-gold/70 uppercase tracking-wide">(you)</span>}
                </div>
                <div className="text-xs text-tavern-muted">{m.username}</div>
              </div>
              <div className="flex items-center gap-1.5">
                {(isDM || isSelf) && sheet && (
                  <button
                    onClick={() => setSheetViewing(m)}
                    className="text-tavern-muted hover:text-tavern-gold transition-colors"
                    title="View character sheet"
                  >
                    <ScrollText size={13} />
                  </button>
                )}
                <div className={clsx('w-2 h-2 rounded-full', isOnline ? 'bg-green-400' : 'bg-tavern-border')} title={isOnline ? 'Online' : 'Offline'} />
              </div>
            </div>

            {sheet && (
              <>
                {maxHp > 0 && <HpBar current={currentHp} max={maxHp} />}

                <div className="flex flex-wrap gap-1 mt-2">
                  {combat.ac != null && <StatBadge label="AC" value={combat.ac} />}
                  {combat.speed != null && <StatBadge label="SPD" value={combat.speed} />}
                  {sheet.level != null && <StatBadge label="LVL" value={sheet.level} />}
                  {sheet.class && <StatBadge label="Class" value={sheet.class} />}
                </div>

                {Object.keys(abilityMods).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {Object.entries(abilityMods).map(([abbr, mod]) => (
                      <StatBadge key={abbr} label={abbr} value={mod >= 0 ? `+${mod}` : `${mod}`} />
                    ))}
                  </div>
                )}

                {sheet.race && (
                  <div className="text-xs text-tavern-muted mt-1.5 font-serif italic">
                    {[sheet.race, sheet.background].filter(Boolean).join(' · ')}
                  </div>
                )}
              </>
            )}

            {!sheet && (
              <div className="text-xs text-tavern-muted mt-1 italic">No character selected</div>
            )}
          </div>
        );
      })}

      {!loading && members.length === 0 && (
        <p className="text-xs text-tavern-muted text-center italic py-2">No players have joined yet.</p>
      )}

      {sheetViewing && sheetViewing.sheet_data && (
        <CharacterSheetModal
          sheet={sheetViewing.sheet_data}
          charName={sheetViewing.char_name || sheetViewing.username}
          avatarUrl={sheetViewing.avatar_url}
          onClose={() => setSheetViewing(null)}
        />
      )}
    </div>
  );
}
