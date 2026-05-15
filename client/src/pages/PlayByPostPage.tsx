import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/ui/Navbar';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import CharacterSheetModal from '../components/game/CharacterSheetModal';
import PbpDiceRoller from '../components/dice/PbpDiceRoller';
import { getRaceAvatar, avatarStyle } from '../lib/avatars';
import {
  ArrowLeft, Plus, X, Send, ImageIcon, Trash2,
  BookOpen, Users, Lock, File, RefreshCw, ScrollText,
  Dices, Mail, ChevronDown, KeyRound, ChevronRight, ChevronLeft,
} from 'lucide-react';
import clsx from 'clsx';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PbpSession {
  id: string;
  game_id: string;
  name: string;
  status: 'active' | 'closed';
  created_at: number;
  ended_at?: number;
}

interface PbpPost {
  id: string;
  session_id: string;
  user_id: string;
  username: string;
  content: string;
  image_url: string | null;
  post_type: string;
  created_at: number;
}

interface PartyMember {
  user_id: string;
  username: string;
  character_id: string | null;
  char_name: string | null;
  avatar_url: string | null;
  sheet_data: Record<string, any> | null;
}

interface Allocation {
  id: string;
  session_id: string;
  user_id: string;
  character_id: string | null;
  allocated: number;
  used: number;
  label: string;
}

type SideTab = 'party' | 'dice' | 'handouts';

// ── Small helpers ──────────────────────────────────────────────────────────────

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

// ── Dice roll post card ────────────────────────────────────────────────────────

function RollPostCard({ post, isDM, onDelete }: { post: PbpPost; isDM: boolean; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  let parsed: { notation: string; results: number[]; total: number; label?: string } | null = null;
  try { parsed = JSON.parse(post.content); } catch { /* ignore */ }
  if (!parsed) return null;

  const allMax = parsed.results.length > 0 && parsed.results.every(v => v === Math.max(...parsed!.results));

  return (
    <div className="group relative flex flex-col items-center">
      <div className="w-full max-w-xs bg-[#070c1a] border border-blue-500/40 rounded-lg overflow-hidden shadow-md">
        <div className="px-3 pt-2 pb-1 flex items-center justify-between gap-2">
          <span className="text-xs text-blue-300/70 font-serif">{post.username}</span>
          {parsed.label && <span className="text-xs text-blue-400/80 font-serif italic">{parsed.label}</span>}
          <span className="text-xs text-tavern-muted/50 ml-auto">
            {new Date(post.created_at * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="px-3 pb-1 text-center text-[10px] text-tavern-muted/60 font-mono tracking-wider">{parsed.notation}</div>
        <div className="flex flex-wrap gap-1.5 justify-center px-3 pb-2">
          {parsed.results.map((v, i) => {
            const isTop = allMax && v === Math.max(...parsed!.results);
            return (
              <span key={i} className={clsx(
                'text-xs font-serif font-bold rounded px-2 py-0.5 border',
                isTop ? 'text-yellow-300 border-yellow-500/50 bg-yellow-900/20'
                      : 'text-blue-200 border-blue-600/40 bg-blue-900/20',
              )}>{v}</span>
            );
          })}
        </div>
        <div className="text-center font-serif text-3xl font-bold text-blue-300 pb-3">{parsed.total}</div>
      </div>

      {isDM && (
        <div className="absolute -top-1 right-0 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {confirmDelete ? (
            <div className="flex items-center gap-1 bg-tavern-card border border-red-900/60 rounded px-2 py-1 text-xs shadow-md">
              <span className="text-red-400 mr-0.5">Remove?</span>
              <button onClick={onDelete} className="text-red-400 hover:text-red-300 font-semibold">Yes</button>
              <span className="text-tavern-muted">/</span>
              <button onClick={() => setConfirmDelete(false)} className="text-tavern-muted hover:text-tavern-text">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-1 bg-tavern-card border border-tavern-border rounded text-tavern-muted hover:text-red-400 hover:border-red-900/60 transition-colors shadow">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Text post card ─────────────────────────────────────────────────────────────

function Timestamp({ ts }: { ts: number }) {
  return (
    <span className="text-[10px] text-tavern-muted/40 shrink-0">
      {new Date(ts * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

function DeleteButton({ isDM, onDelete }: { isDM: boolean; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (!isDM) return null;
  return (
    <div className="absolute -top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
      {confirm ? (
        <div className="flex items-center gap-1 bg-[#1a0505] border border-red-900/60 rounded px-2 py-1 text-xs shadow-lg">
          <span className="text-red-400/80">Remove?</span>
          <button onClick={onDelete} className="text-red-400 hover:text-red-300 font-bold ml-1">Yes</button>
          <span className="text-tavern-muted/40">/</span>
          <button onClick={() => setConfirm(false)} className="text-tavern-muted hover:text-tavern-text">No</button>
        </div>
      ) : (
        <button onClick={() => setConfirm(true)} className="p-1 bg-[#0d0805] border border-tavern-border/60 rounded text-tavern-muted/40 hover:text-red-400 hover:border-red-900/60 transition-colors">
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}

function PostCard({ post, isDM, isOwn, dmId, onDelete }: { post: PbpPost; isDM: boolean; isOwn: boolean; dmId: string; onDelete: () => void }) {
  const isFromDM = post.user_id === dmId;

  // ── DM narrative post — full-width parchment block ──
  if (isFromDM) {
    return (
      <div className="group relative">
        <div className="rounded-lg overflow-hidden border border-[#6b4c10]/60 bg-[#1e1100]"
             style={{ borderLeft: '4px solid #c9962a' }}>
          <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-[#3d2a08]/60">
            <div className="w-5 h-5 rounded-full bg-tavern-gold/25 border border-tavern-gold/50 flex items-center justify-center text-[9px] text-tavern-gold font-serif font-bold shrink-0">
              DM
            </div>
            <span className="text-xs font-serif text-tavern-gold tracking-wide">{post.username}</span>
            <Timestamp ts={post.created_at} />
          </div>
          <div className="px-5 py-4">
            {post.content && (
              <p className="font-serif text-[15px] text-[#eeddc0] leading-[1.75] whitespace-pre-wrap italic">
                {post.content}
              </p>
            )}
            {post.image_url && (
              <div className={clsx(post.content && 'mt-3')}>
                <img src={post.image_url} alt="" className="max-w-full max-h-80 rounded border border-[#6b4c10]/40 object-contain" />
              </div>
            )}
          </div>
        </div>
        <DeleteButton isDM={isDM} onDelete={onDelete} />
      </div>
    );
  }

  // ── Player chat bubble ──
  return (
    <div className={clsx('group relative flex items-end gap-2.5', isOwn && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={clsx(
        'w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-serif font-bold border',
        isOwn
          ? 'bg-[#0e1f10] border-[#2d5020] text-[#7ec87e]'
          : 'bg-[#1c1005] border-[#5a3a18] text-tavern-muted',
      )}>
        {post.username[0].toUpperCase()}
      </div>

      <div className={clsx('flex flex-col gap-1 min-w-0 max-w-[78%]', isOwn && 'items-end')}>
        {/* Meta */}
        <div className={clsx('flex items-center gap-2', isOwn && 'flex-row-reverse')}>
          <span className="text-xs font-serif text-tavern-muted">{post.username}</span>
          <Timestamp ts={post.created_at} />
        </div>
        {/* Bubble */}
        <div className={clsx(
          'rounded-2xl px-4 py-2.5',
          isOwn
            ? 'bg-[#111f0d] border border-[#2d5020] text-[#d8eed8] rounded-br-sm'
            : 'bg-[#201206] border border-[#4a2e12] text-tavern-text rounded-bl-sm',
        )}>
          {post.content && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
          )}
          {post.image_url && (
            <div className={clsx(post.content && 'mt-2')}>
              <img src={post.image_url} alt="" className="max-w-full max-h-64 rounded border border-[#4a2e12]/40 object-contain" />
            </div>
          )}
        </div>
      </div>

      <DeleteButton isDM={isDM} onDelete={onDelete} />
    </div>
  );
}

// ── Invitation modal ───────────────────────────────────────────────────────────

function InviteModal({ gameId, gameName, onClose }: { gameId: string; gameName: string; onClose: () => void }) {
  const [list, setList] = useState<{ players: any[]; army: any[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get(`/games/${gameId}/invite-list`).then(({ data }) => {
      setList(data);
      // Pre-select all
      const ids = new Set<string>([
        ...data.players.map((p: any) => `p:${p.id}`),
        ...data.army.map((a: any) => `a:${a.id}`),
      ]);
      setSelected(ids);
    }).catch(() => toast.error('Failed to load invite list'));
  }, [gameId]);

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function sendInvites() {
    if (!list) return;
    const gameUrl = `${window.location.origin}/games/${gameId}/pbp`;
    const recipients: { name: string; email: string }[] = [];
    list.players.forEach((p: any) => {
      if (selected.has(`p:${p.id}`) && p.email) recipients.push({ name: p.username, email: p.email });
    });
    list.army.forEach((a: any) => {
      if (selected.has(`a:${a.id}`) && a.email) recipients.push({ name: a.display_name, email: a.email });
    });
    if (!recipients.length) { toast.error('No recipients selected'); return; }
    setSending(true);
    try {
      const { data } = await api.post(`/games/${gameId}/send-invites`, { recipients, gameName, gameUrl });
      toast.success(`Invitations sent to ${data.sent} adventurer${data.sent !== 1 ? 's' : ''}`);
      onClose();
    } catch {
      toast.error('Failed to send invitations');
    } finally {
      setSending(false);
    }
  }

  const totalSelected = selected.size;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-tavern-card border border-tavern-border rounded-lg w-full max-w-sm p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-serif text-tavern-gold text-lg">Send Invitations</h3>
          <button onClick={onClose} className="text-tavern-muted hover:text-tavern-text"><X size={16} /></button>
        </div>
        <p className="text-xs text-tavern-muted mb-4 leading-relaxed">
          Select who should receive a Play by Post invitation for <span className="text-tavern-text">{gameName}</span>.
        </p>

        {!list ? (
          <div className="text-center py-6 text-tavern-muted text-sm font-serif animate-pulse">Loading...</div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {list.players.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-tavern-muted font-serif mb-2">Party Members</p>
                <div className="space-y-1.5">
                  {list.players.map((p: any) => (
                    <label key={p.id} className={clsx(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded border cursor-pointer transition-colors',
                      selected.has(`p:${p.id}`) ? 'border-tavern-gold/50 bg-tavern-gold/5' : 'border-tavern-border hover:border-tavern-border/80',
                    )}>
                      <input type="checkbox" checked={selected.has(`p:${p.id}`)} onChange={() => toggle(`p:${p.id}`)} className="accent-tavern-gold" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-serif text-tavern-text">{p.username}</p>
                        <p className="text-xs text-tavern-muted truncate">{p.email || <span className="italic">no email</span>}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {list.army.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-tavern-muted font-serif mb-2">Campaign Army</p>
                <div className="space-y-1.5">
                  {list.army.map((a: any) => (
                    <label key={a.id} className={clsx(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded border cursor-pointer transition-colors',
                      selected.has(`a:${a.id}`) ? 'border-tavern-gold/50 bg-tavern-gold/5' : 'border-tavern-border hover:border-tavern-border/80',
                    )}>
                      <input type="checkbox" checked={selected.has(`a:${a.id}`)} onChange={() => toggle(`a:${a.id}`)} className="accent-tavern-gold" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-serif text-tavern-text">{a.display_name}</p>
                        <p className="text-xs text-tavern-muted truncate">{a.email || <span className="italic">no email</span>}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {list.players.length === 0 && list.army.length === 0 && (
              <p className="text-sm text-tavern-muted italic text-center py-4">No players or army members found.</p>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-4 pt-3 border-t border-tavern-border">
          <button onClick={onClose} className="btn-secondary text-sm" disabled={sending}>Skip</button>
          <button
            onClick={sendInvites}
            disabled={sending || totalSelected === 0 || !list}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Mail size={13} /> {sending ? 'Sending...' : `Send (${totalSelected})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Party tab (PBP version) ────────────────────────────────────────────────────

interface AllocInput { count: string; label: string }

function PbpPartyPanel({
  gameId, isDM, members, dmUsername,
  sessionId, allocations, onAllocationsChange,
  hpLocal, onHpAdjust,
}: {
  gameId: string;
  isDM: boolean;
  members: PartyMember[];
  dmUsername: string;
  sessionId: string | null;
  allocations: Record<string, Allocation>;
  onAllocationsChange: (a: Record<string, Allocation>) => void;
  hpLocal: Record<string, { current: number; max: number }>;
  onHpAdjust: (charId: string, delta: number) => void;
}) {
  const { user } = useAuthStore();
  const [sheetViewing, setSheetViewing] = useState<PartyMember | null>(null);
  const [allocInputs, setAllocInputs] = useState<Record<string, AllocInput>>({});
  const [savingAlloc, setSavingAlloc] = useState<string | null>(null);
  const [expandedAlloc, setExpandedAlloc] = useState<string | null>(null);

  function getInput(userId: string): AllocInput {
    return allocInputs[userId] ?? {
      count: String(allocations[userId]?.allocated ?? 0),
      label: allocations[userId]?.label ?? '',
    };
  }

  async function saveAlloc(userId: string) {
    if (!sessionId) return;
    const inp = getInput(userId);
    const allocated = parseInt(inp.count) || 0;
    setSavingAlloc(userId);
    try {
      const { data } = await api.put(`/games/${gameId}/pbp/sessions/${sessionId}/allocations/${userId}`, {
        allocated, label: inp.label,
      });
      onAllocationsChange({ ...allocations, [userId]: data });
      toast.success('Rolls granted');
      setExpandedAlloc(null);
    } catch {
      toast.error('Failed to update allocation');
    } finally {
      setSavingAlloc(null);
    }
  }

  return (
    <div className="space-y-3 overflow-y-auto h-full pr-0.5">
      {/* DM row */}
      <div className="flex items-center gap-2 p-1.5 rounded bg-tavern-bg/50">
        <div className="w-7 h-7 rounded-full bg-tavern-gold/20 border border-tavern-gold/50 flex items-center justify-center flex-shrink-0">
          <span className="text-xs text-tavern-gold font-serif">DM</span>
        </div>
        <span className="text-sm text-tavern-text">{dmUsername}</span>
      </div>

      {members.length === 0 && (
        <p className="text-xs text-tavern-muted italic text-center py-2">No players have joined yet.</p>
      )}

      {members.map((m) => {
        const sheet = m.sheet_data;
        const combat = sheet?.combat || {};
        const hpOverride = m.character_id ? hpLocal[m.character_id] : undefined;
        const currentHp = hpOverride?.current ?? combat.current_hp ?? 0;
        const maxHp = hpOverride?.max ?? combat.max_hp ?? 0;
        const isSelf = m.user_id === user?.id;
        const alloc = allocations[m.user_id];
        const showSheet = isDM || isSelf;
        const isAllocExpanded = expandedAlloc === m.user_id;

        const abilityMods = sheet?.abilities
          ? Object.fromEntries(Object.entries(sheet.abilities as Record<string, number>).map(([k, v]) => [k.slice(0, 3).toUpperCase(), Math.floor((v - 10) / 2)]))
          : {};

        const inp = getInput(m.user_id);

        return (
          <div key={m.user_id} className={clsx('rounded border p-2 text-sm', isSelf ? 'border-tavern-gold/40 bg-tavern-gold/5' : 'border-tavern-border bg-tavern-bg/30')}>
            {/* Header row */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                {m.avatar_url
                  ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                  : (() => {
                      const def = getRaceAvatar(m.sheet_data?.race || '');
                      return <div className="w-full h-full rounded-full flex items-center justify-center text-lg" style={avatarStyle(def)}>{def.emoji}</div>;
                    })()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-tavern-text font-serif truncate">{m.char_name || m.username}</span>
                  {isSelf && <span className="text-[9px] text-tavern-gold/70 uppercase tracking-wide">(you)</span>}
                </div>
                <div className="text-xs text-tavern-muted">{m.username}</div>
              </div>
              {showSheet && sheet && (
                <button onClick={() => setSheetViewing(m)} className="text-tavern-muted hover:text-tavern-gold transition-colors shrink-0" title="Character sheet">
                  <ScrollText size={13} />
                </button>
              )}
            </div>

            {/* Stats for DM or self */}
            {(isDM || isSelf) && sheet && (
              <>
                {maxHp > 0 && <HpBar current={currentHp} max={maxHp} />}

                {/* HP adjust (DM only) */}
                {isDM && m.character_id && maxHp > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {[-5, -1].map(d => (
                      <button key={d} onClick={() => onHpAdjust(m.character_id!, d)}
                        className="flex-1 py-0.5 text-xs rounded border border-red-900/60 text-red-400 hover:bg-red-900/20 transition-colors font-mono">
                        {d}
                      </button>
                    ))}
                    <span className="text-xs text-tavern-muted font-serif px-1">{currentHp}</span>
                    {[+1, +5].map(d => (
                      <button key={d} onClick={() => onHpAdjust(m.character_id!, d)}
                        className="flex-1 py-0.5 text-xs rounded border border-green-900/60 text-green-400 hover:bg-green-900/20 transition-colors font-mono">
                        +{d}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1 mt-2">
                  {combat.ac != null && <StatBadge label="AC" value={combat.ac} />}
                  {combat.speed != null && <StatBadge label="SPD" value={combat.speed} />}
                  {sheet.level != null && <StatBadge label="LVL" value={sheet.level} />}
                  {sheet.class && <StatBadge label="Class" value={sheet.class} />}
                </div>

                {Object.keys(abilityMods).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {Object.entries(abilityMods).map(([abbr, v]) => (
                      <StatBadge key={abbr} label={abbr} value={(v as number) >= 0 ? `+${v}` : `${v}`} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Roll allocation (everyone sees summary; DM can set) */}
            {sessionId && (
              <div className="mt-2 pt-1.5 border-t border-tavern-border/30">
                {isDM ? (
                  <div>
                    <button
                      onClick={() => setExpandedAlloc(isAllocExpanded ? null : m.user_id)}
                      className="flex items-center justify-between w-full text-xs text-tavern-muted hover:text-tavern-text transition-colors"
                    >
                      <span className="flex items-center gap-1">
                        <Dices size={11} />
                        {alloc ? (
                          <span>Rolls: <span className="text-tavern-text font-mono">{alloc.used}/{alloc.allocated}</span>
                            {alloc.label && <span className="text-tavern-muted/60 ml-1">({alloc.label})</span>}
                          </span>
                        ) : (
                          <span className="text-tavern-muted/60">No rolls granted</span>
                        )}
                      </span>
                      <ChevronDown size={11} className={clsx('transition-transform', isAllocExpanded && 'rotate-180')} />
                    </button>

                    {isAllocExpanded && (
                      <div className="mt-2 space-y-1.5">
                        <input
                          className="tavern-input text-xs py-1 w-full"
                          placeholder="Label (e.g. Attack)"
                          value={inp.label}
                          onChange={e => setAllocInputs(prev => ({ ...prev, [m.user_id]: { ...getInput(m.user_id), label: e.target.value } }))}
                        />
                        <div className="flex gap-1.5 items-center">
                          <input
                            type="number"
                            min={0}
                            className="tavern-input text-xs py-1 w-20 text-center"
                            placeholder="Rolls"
                            value={inp.count}
                            onChange={e => setAllocInputs(prev => ({ ...prev, [m.user_id]: { ...getInput(m.user_id), count: e.target.value } }))}
                          />
                          <button
                            onClick={() => saveAlloc(m.user_id)}
                            disabled={savingAlloc === m.user_id}
                            className="btn-primary text-xs py-1 px-3 flex-1 disabled:opacity-50"
                          >
                            {savingAlloc === m.user_id ? '...' : 'Grant'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  isSelf && (
                    <div className="flex items-center gap-1 text-xs text-tavern-muted">
                      <Dices size={11} />
                      {alloc ? (
                        <span>Rolls: <span className={clsx('font-mono', alloc.used >= alloc.allocated ? 'text-red-400' : 'text-green-400')}>{alloc.allocated - alloc.used}</span> left
                          {alloc.label && <span className="text-tavern-muted/60 ml-1">— {alloc.label}</span>}
                        </span>
                      ) : (
                        <span className="text-tavern-muted/60 italic">Awaiting DM</span>
                      )}
                    </div>
                  )
                )}
              </div>
            )}

            {!sheet && <div className="text-xs text-tavern-muted mt-1 italic">No character selected</div>}
          </div>
        );
      })}

      {sheetViewing?.sheet_data && (
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

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PlayByPostPage() {
  const { id: gameId } = useParams<{ id: string }>();
  const { user } = useAuthStore();

  // ── Core state ──
  const [game, setGame] = useState<any>(null);
  const [sessions, setSessions] = useState<PbpSession[]>([]);
  const [viewSession, setViewSession] = useState<PbpSession | null>(null);
  const [posts, setPosts] = useState<PbpPost[]>([]);
  const [handouts, setHandouts] = useState<any[]>([]);
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [allocations, setAllocations] = useState<Record<string, Allocation>>({});
  const [hpLocal, setHpLocal] = useState<Record<string, { current: number; max: number }>>({});
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);

  // ── Sidebar ──
  const [sideTab, setSideTab] = useState<SideTab>('party');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Post form ──
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── Modals ──
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  // ── Join gate ──
  const [notMember, setNotMember] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const isDM = game?.is_dm ?? false;
  const activeSession = sessions.find(s => s.status === 'active') ?? null;
  const canPost = viewSession?.status === 'active';
  const myAlloc = viewSession ? allocations[user?.id ?? ''] : undefined;
  const remainingRolls = isDM ? undefined : (myAlloc ? myAlloc.allocated - myAlloc.used : 0);

  // ── Initial load ──
  useEffect(() => {
    if (!gameId) return;
    (async () => {
      try {
        const gameRes = await api.get(`/games/${gameId}`);
        setGame(gameRes.data);
        const [sessRes, handoutsRes, partyRes] = await Promise.all([
          api.get(`/games/${gameId}/pbp/sessions`),
          api.get(`/games/${gameId}/handouts`),
          api.get(`/games/${gameId}/party`),
        ]);
        const sess: PbpSession[] = sessRes.data;
        setSessions(sess);
        const initial = sess.find(s => s.status === 'active') ?? sess[sess.length - 1] ?? null;
        setViewSession(initial);
        if (initial) { loadPosts(initial.id); loadAllocations(initial.id); }
        const allHandouts: any[] = handoutsRes.data;
        setHandouts(gameRes.data.is_dm ? allHandouts : allHandouts.filter((h: any) => h.shared_with?.includes(user?.id)));
        setPartyMembers(partyRes.data);
      } catch (err: any) {
        if (err?.response?.status === 403) setNotMember(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [gameId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts]);

  async function loadPosts(sessionId: string) {
    setPostsLoading(true);
    try {
      const { data } = await api.get(`/games/${gameId}/pbp/sessions/${sessionId}/posts`);
      setPosts(data);
    } finally {
      setPostsLoading(false);
    }
  }

  async function loadAllocations(sessionId: string) {
    try {
      const { data } = await api.get(`/games/${gameId}/pbp/sessions/${sessionId}/allocations`);
      const map: Record<string, Allocation> = {};
      (data as Allocation[]).forEach(a => { map[a.user_id] = a; });
      setAllocations(map);
    } catch { /* not critical */ }
  }

  function switchSession(s: PbpSession) {
    setViewSession(s);
    loadPosts(s.id);
    loadAllocations(s.id);
  }

  // ── Sessions ──
  async function createSession() {
    if (!newSessionName.trim()) return;
    setCreatingSession(true);
    try {
      const { data } = await api.post(`/games/${gameId}/pbp/sessions`, { name: newSessionName.trim() });
      const isFirst = sessions.length === 0;
      setSessions(prev => [
        ...prev.map(s => s.status === 'active' ? { ...s, status: 'closed' as const } : s),
        data,
      ]);
      setViewSession(data);
      setPosts([]);
      setAllocations({});
      setShowNewSession(false);
      setNewSessionName('');
      toast.success(`"${data.name}" started`);
      if (isFirst) setShowInvite(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create session');
    } finally {
      setCreatingSession(false);
    }
  }

  async function closeSession() {
    if (!viewSession || !isDM || viewSession.status !== 'active') return;
    if (!confirm(`Close "${viewSession.name}"? Players won't be able to post until a new session starts.`)) return;
    try {
      await api.post(`/games/${gameId}/pbp/sessions/${viewSession.id}/close`);
      const closed = { ...viewSession, status: 'closed' as const };
      setSessions(prev => prev.map(s => s.id === viewSession.id ? closed : s));
      setViewSession(closed);
      toast.success('Session closed');
    } catch {
      toast.error('Failed to close session');
    }
  }

  // ── Posts ──
  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if ((!content.trim() && !imageFile) || !viewSession || !canPost) return;
    setPosting(true);
    try {
      const fd = new FormData();
      fd.append('content', content.trim());
      if (imageFile) fd.append('image', imageFile);
      const { data } = await api.post(`/games/${gameId}/pbp/sessions/${viewSession.id}/posts`, fd);
      setPosts(prev => [...prev, data]);
      setContent('');
      setImageFile(null);
      setImagePreview(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to post');
    } finally {
      setPosting(false);
    }
  }

  async function deletePost(postId: string) {
    if (!isDM || !viewSession) return;
    try {
      await api.delete(`/games/${gameId}/pbp/sessions/${viewSession.id}/posts/${postId}`);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch {
      toast.error('Failed to delete post');
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // ── HP adjustment (REST) ──
  async function adjustHp(charId: string, delta: number) {
    try {
      const { data } = await api.patch(`/games/${gameId}/party/${charId}/hp`, { delta });
      setHpLocal(prev => ({ ...prev, [charId]: { current: data.current_hp, max: data.max_hp } }));
    } catch {
      toast.error('HP update failed');
    }
  }

  // ── Join game with code ──
  async function joinGame(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoinError('');
    setJoining(true);
    try {
      await api.post('/games/join', { code });
      setNotMember(false);
      setJoinCode('');
      setLoading(true);
      // Re-trigger the main load
      const gameRes = await api.get(`/games/${gameId}`);
      setGame(gameRes.data);
      const [sessRes, handoutsRes, partyRes] = await Promise.all([
        api.get(`/games/${gameId}/pbp/sessions`),
        api.get(`/games/${gameId}/handouts`),
        api.get(`/games/${gameId}/party`),
      ]);
      const sess: PbpSession[] = sessRes.data;
      setSessions(sess);
      const initial = sess.find(s => s.status === 'active') ?? sess[sess.length - 1] ?? null;
      setViewSession(initial);
      if (initial) { loadPosts(initial.id); loadAllocations(initial.id); }
      setHandouts(gameRes.data.is_dm
        ? handoutsRes.data
        : handoutsRes.data.filter((h: any) => h.shared_with?.includes(user?.id)));
      setPartyMembers(partyRes.data);
    } catch (err: any) {
      setJoinError(err?.response?.data?.error || 'Invalid code. Check with your Dungeon Master.');
    } finally {
      setJoining(false);
      setLoading(false);
    }
  }

  // ── Dice roll submission ──
  async function handleRoll(notation: string, results: number[], total: number): Promise<void> {
    if (!viewSession) throw new Error('No active session');
    const myAllocLabel = myAlloc?.label || '';
    const { data } = await api.post(`/games/${gameId}/pbp/sessions/${viewSession.id}/roll`, {
      notation, results, total, label: myAllocLabel,
    });
    setPosts(prev => [...prev, data.post]);
    if (data.allocation) {
      setAllocations(prev => ({ ...prev, [data.allocation.user_id]: data.allocation }));
    }
  }

  if (loading) return (
    <div className="min-h-screen"><Navbar />
      <div className="text-center py-20 text-tavern-muted font-serif animate-pulse">Loading the chronicle...</div>
    </div>
  );

  if (notMember) return (
    <div className="min-h-screen flex flex-col bg-tavern-bg">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-tavern-card border border-tavern-border rounded-lg w-full max-w-sm p-8 text-center">
          <div className="text-4xl mb-4">📜</div>
          <h2 className="font-serif text-tavern-gold text-xl mb-2">Join the Chronicle</h2>
          <p className="text-sm text-tavern-muted mb-6 leading-relaxed">
            Enter the join code your Dungeon Master shared to access this Play by Post game.
          </p>
          <form onSubmit={joinGame} className="space-y-3">
            <div>
              <input
                className="tavern-input text-center text-xl font-mono tracking-widest uppercase w-full"
                placeholder="ABC123"
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
                maxLength={8}
                autoFocus
              />
              {joinError && <p className="text-xs text-red-400 mt-1.5">{joinError}</p>}
            </div>
            <button
              type="submit"
              disabled={joining || !joinCode.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <KeyRound size={14} /> {joining ? 'Joining...' : 'Enter the Chronicle'}
            </button>
          </form>
          <p className="text-xs text-tavern-muted/60 mt-5">
            No code? Ask your DM — they can send an invitation from the Play by Post page.
          </p>
        </div>
      </div>
    </div>
  );

  if (!game) return (
    <div className="min-h-screen"><Navbar />
      <div className="text-center py-20 text-red-400">Game not found</div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-tavern-bg">
      <Navbar />

      {/* Sub-header */}
      <div className="border-b border-tavern-border bg-tavern-card/50 backdrop-blur sticky top-14 z-40">
        <div className="px-4 h-11 flex items-center justify-between gap-3">
          {/* Left: breadcrumb */}
          <div className="flex items-center gap-2 text-sm overflow-hidden min-w-0">
            <Link to={`/games/${gameId}`} className="text-tavern-muted hover:text-tavern-text flex items-center gap-1 shrink-0">
              <ArrowLeft size={13} /> Lobby
            </Link>
            <span className="text-tavern-border/60">›</span>
            <span className="text-tavern-muted truncate">{game.name}</span>
            <span className="text-tavern-border/60 hidden sm:inline">›</span>
            <span className="text-tavern-gold font-serif shrink-0 hidden sm:inline">Play by Post</span>
          </div>

          {/* Right: DM controls + sidebar toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {isDM && (
              <>
                {sessions.length > 0 && (
                  <button onClick={() => setShowInvite(true)}
                    className="flex items-center gap-1.5 text-xs border border-tavern-border text-tavern-muted hover:text-tavern-gold hover:border-tavern-gold/50 px-2.5 py-1.5 rounded transition-colors">
                    <Mail size={11} /> Invite
                  </button>
                )}
                {viewSession?.status === 'active' && (
                  <button onClick={closeSession}
                    className="flex items-center gap-1.5 text-xs border border-tavern-border text-tavern-muted hover:text-red-400 hover:border-red-900/60 px-2.5 py-1.5 rounded transition-colors">
                    <Lock size={11} /> Close
                  </button>
                )}
                <button
                  onClick={() => { setShowNewSession(true); setNewSessionName(`Chapter ${sessions.length + 1}`); }}
                  className="flex items-center gap-1.5 text-xs btn-primary py-1.5 px-2.5">
                  <Plus size={11} /> New Session
                </button>
              </>
            )}
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              title={sidebarOpen ? 'Hide panel' : 'Show panel'}
              className={clsx(
                'flex items-center gap-1 text-xs border rounded px-2.5 py-1.5 transition-colors',
                sidebarOpen
                  ? 'border-tavern-gold/40 text-tavern-gold bg-tavern-gold/5 hover:bg-tavern-gold/10'
                  : 'border-tavern-border text-tavern-muted hover:text-tavern-text hover:border-tavern-border/80',
              )}>
              {sidebarOpen ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
              <span className="hidden sm:inline">{sidebarOpen ? 'Hide' : 'Party & Dice'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Body — full width, no max-w cap */}
      <div className="flex-1 flex w-full min-h-0 overflow-hidden">

        {/* ── Posts column ── */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden px-4 py-3 gap-2">

          {/* Session tabs */}
          {sessions.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 shrink-0">
              {sessions.map(s => (
                <button key={s.id} onClick={() => switchSession(s)}
                  className={clsx(
                    'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-all shrink-0',
                    viewSession?.id === s.id
                      ? 'border-tavern-gold bg-tavern-gold/15 text-tavern-gold-light font-semibold shadow-[0_0_8px_rgba(201,150,42,0.2)]'
                      : 'border-[#3a2010] bg-[#130a04] text-tavern-muted hover:text-tavern-text hover:border-[#5a3a18]',
                  )}>
                  {s.status === 'active'
                    ? <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
                    : <Lock size={9} className="shrink-0 opacity-50" />}
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {/* Posts feed — distinct dark background, left-aligned content */}
          <div className="flex-1 overflow-y-auto min-h-0 p-5" style={{ background: '#070402' }}>
            {!viewSession ? (
              <div className="flex flex-col items-center justify-center h-full min-h-48 text-center">
                <div className="text-5xl mb-4">📜</div>
                <p className="font-serif text-tavern-muted text-base mb-1">
                  {isDM ? 'No sessions yet. Start the chronicle.' : 'Awaiting your Dungeon Master to open the first session.'}
                </p>
                {isDM && (
                  <button onClick={() => { setShowNewSession(true); setNewSessionName('Chapter 1'); }}
                    className="btn-primary mt-5 text-sm flex items-center gap-2">
                    <Plus size={14} /> Begin the Tale
                  </button>
                )}
              </div>
            ) : postsLoading ? (
              <div className="text-center py-16 text-tavern-muted font-serif animate-pulse">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16">
                <p className="font-serif text-tavern-muted italic text-base">The page is blank, awaiting the first words...</p>
                {isDM && viewSession.status === 'active' && (
                  <p className="text-xs text-tavern-muted/50 mt-2">Write the introductory post below.</p>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {posts.map(post =>
                  post.post_type === 'roll' ? (
                    <div key={post.id} className="flex justify-center">
                      <RollPostCard post={post} isDM={isDM} onDelete={() => deletePost(post.id)} />
                    </div>
                  ) : (
                    <PostCard
                      key={post.id}
                      post={post}
                      isDM={isDM}
                      isOwn={post.user_id === user?.id}
                      dmId={game.dm_id}
                      onDelete={() => deletePost(post.id)}
                    />
                  )
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Post form — sits below the feed, clearly separated */}
          {viewSession && canPost && (
            <form onSubmit={submitPost}
              className="shrink-0 border-t-2 border-[#2a1808] bg-[#0f0804] px-4 py-3 space-y-2">
              <textarea
                className="w-full resize-none rounded-lg border border-[#3a2010] bg-[#160c05] text-tavern-text placeholder-tavern-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:border-tavern-gold/50 focus:ring-1 focus:ring-tavern-gold/15 leading-relaxed"
                rows={3}
                placeholder="Write your post… (Ctrl+Enter to send)"
                value={content}
                onChange={e => setContent(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitPost(e as any); }}
              />
              {imagePreview && (
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="max-h-28 rounded border border-[#3a2010] object-contain" />
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 text-white hover:bg-black/90">
                    <X size={11} />
                  </button>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs text-tavern-muted hover:text-tavern-gold border border-[#3a2010] rounded px-2.5 py-1.5 transition-colors bg-[#0d0703]">
                  <ImageIcon size={12} /> Attach Image
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                <button type="submit" disabled={posting || (!content.trim() && !imageFile)}
                  className="btn-primary text-sm py-1.5 px-5 flex items-center gap-1.5 disabled:opacity-40">
                  <Send size={13} /> {posting ? 'Posting…' : 'Post'}
                </button>
              </div>
            </form>
          )}

          {/* Closed session notice */}
          {viewSession && !canPost && (
            <div className="shrink-0 border-t-2 border-[#2a1808] bg-[#0f0804] px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-tavern-muted/70 font-serif italic flex items-center gap-2">
                <Lock size={13} className="text-tavern-muted/40" />
                {isDM ? `"${viewSession.name}" is closed.` : 'This session is closed. Await the next chapter.'}
              </p>
              {isDM && (
                <button onClick={() => { setShowNewSession(true); setNewSessionName(`Chapter ${sessions.length + 1}`); }}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shrink-0">
                  <Plus size={11} /> New Session
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Right sidebar ── distinctly darker than feed ── */}
        {sidebarOpen && (
          <div className="w-80 shrink-0 flex flex-col border-l border-[#2a1808] h-full overflow-hidden" style={{ background: '#0c0704' }}>

            {/* Tab bar */}
            <div className="flex border-b border-[#2a1808] shrink-0 bg-[#0a0503]">
              {([
                { key: 'party',    icon: Users,    label: 'Party'    },
                { key: 'dice',     icon: Dices,    label: 'Dice'     },
                { key: 'handouts', icon: BookOpen, label: 'Handouts' },
              ] as const).map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setSideTab(key)}
                  className={clsx(
                    'flex-1 flex flex-col items-center gap-1 py-3 text-[10px] uppercase tracking-widest font-serif transition-colors',
                    sideTab === key
                      ? 'text-tavern-gold bg-[#1e1100] border-b-2 border-tavern-gold -mb-px'
                      : 'text-tavern-muted/60 hover:text-tavern-muted hover:bg-[#0f0805]',
                  )}>
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content — scrollable */}
            <div className="flex-1 overflow-y-auto p-3 bg-[#0c0704]">
              {sideTab === 'party' && (
                <PbpPartyPanel
                  gameId={gameId!}
                  isDM={isDM}
                  members={partyMembers}
                  dmUsername={game.dm_username || 'Dungeon Master'}
                  sessionId={viewSession?.id ?? null}
                  allocations={allocations}
                  onAllocationsChange={setAllocations}
                  hpLocal={hpLocal}
                  onHpAdjust={adjustHp}
                />
              )}

              {sideTab === 'dice' && (
                <div className="space-y-3">
                  {!viewSession || viewSession.status === 'closed' ? (
                    <p className="text-xs text-tavern-muted italic text-center py-6">
                      {!viewSession ? 'No active session.' : 'Session is closed. No rolling until a new session begins.'}
                    </p>
                  ) : (
                    <PbpDiceRoller
                      onRoll={handleRoll}
                      canRoll={isDM || (!!myAlloc && myAlloc.used < myAlloc.allocated)}
                      remainingRolls={remainingRolls}
                      rollLabel={myAlloc?.label}
                    />
                  )}
                </div>
              )}

              {sideTab === 'handouts' && (
                <div className="space-y-3">
                  {handouts.length === 0 ? (
                    <p className="text-xs text-tavern-muted italic text-center py-6">
                      {isDM ? 'No handouts yet. Create them in the game lobby.' : 'No handouts shared with you yet.'}
                    </p>
                  ) : (
                    handouts.map((h: any) => (
                      <div key={h.id} className="border-b border-tavern-border/30 last:border-0 pb-3 last:pb-0">
                        <p className="text-sm font-serif text-tavern-text">{h.title}</p>
                        {h.content && <p className="text-xs text-tavern-muted/80 mt-1 leading-relaxed line-clamp-5">{h.content}</p>}
                        {h.file_url && (
                          <a href={h.file_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-tavern-gold hover:underline mt-1.5">
                            <File size={10} /> View attachment
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Footer: session info + refresh */}
            <div className="shrink-0 border-t border-[#2a1808] px-3 py-2.5 flex items-center justify-between gap-2 bg-[#09060380]">
              {viewSession ? (
                <div className="min-w-0">
                  <p className="text-xs font-serif text-tavern-text/80 truncate">{viewSession.name}</p>
                  <p className="text-[10px] text-tavern-muted/60">
                    {posts.length} post{posts.length !== 1 ? 's' : ''} ·{' '}
                    <span className={viewSession.status === 'active' ? 'text-green-400/80' : 'text-tavern-muted/50'}>
                      {viewSession.status}
                    </span>
                  </p>
                </div>
              ) : (
                <span className="text-xs text-tavern-muted/50 italic">No session</span>
              )}
              <button
                onClick={() => api.get(`/games/${gameId}/party`).then(({ data }) => setPartyMembers(data))}
                className="text-tavern-muted/50 hover:text-tavern-muted transition-colors shrink-0" title="Refresh party">
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New session modal */}
      {showNewSession && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-tavern-card border border-tavern-border rounded-lg w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-tavern-gold text-lg">New Session</h3>
              <button onClick={() => setShowNewSession(false)} className="text-tavern-muted hover:text-tavern-text"><X size={16} /></button>
            </div>
            {activeSession && (
              <p className="text-xs text-tavern-muted mb-4 bg-tavern-bg rounded p-2 leading-relaxed">
                This will close <span className="text-tavern-text">"{activeSession.name}"</span> and open a new session.
              </p>
            )}
            <div className="space-y-3">
              <div>
                <label className="label block mb-1">Session Name</label>
                <input
                  className="tavern-input"
                  value={newSessionName}
                  onChange={e => setNewSessionName(e.target.value)}
                  placeholder="Chapter 2: Into the Dark..."
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') createSession(); }}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowNewSession(false)} className="btn-secondary text-sm" disabled={creatingSession}>Cancel</button>
                <button onClick={createSession} disabled={!newSessionName.trim() || creatingSession} className="btn-primary text-sm">
                  {creatingSession ? 'Creating...' : 'Start Session'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {showInvite && (
        <InviteModal gameId={gameId!} gameName={game.name} onClose={() => setShowInvite(false)} />
      )}
    </div>
  );
}
