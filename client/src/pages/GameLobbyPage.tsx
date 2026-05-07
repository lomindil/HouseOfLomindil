import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/ui/Navbar';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import {
  Play, Copy, Users, Map, Plus, Trash2, Upload, BookOpen, Hammer,
  Pencil, Skull, Swords, History, X, Camera, ChevronDown, ChevronUp,
  Library, Download,
} from 'lucide-react';
import MapBuilderModal from '../components/map/MapBuilderModal';
import GameCharacterModal from '../components/game/GameCharacterModal';
import MonsterFormModal from '../components/game/MonsterFormModal';
import clsx from 'clsx';

interface Game {
  id: string; name: string; description: string; status: string;
  join_code: string; dm_id: string; dm_username: string; is_dm: boolean;
  approved: number;
  players: any[]; maps: any[]; current_map_id?: string;
}

function Section({ title, icon, children, defaultOpen = true }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="tavern-card overflow-hidden">
      <button className="w-full flex items-center justify-between px-4 py-3" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          <span className="text-tavern-gold">{icon}</span>
          <span className="font-serif text-tavern-gold text-sm uppercase tracking-widest">{title}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-tavern-muted" /> : <ChevronDown size={14} className="text-tavern-muted" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function GameLobbyPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [sessionName, setSessionName] = useState('');

  const [showMapForm, setShowMapForm] = useState(false);
  const [mapName, setMapName] = useState('');
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [mapGrid, setMapGrid] = useState(50);
  const [uploadingMap, setUploadingMap] = useState(false);
  const [showMapBuilder, setShowMapBuilder] = useState(false);
  const [editingMap, setEditingMap] = useState<{ id: string; name: string; imageUrl: string; gridSize: number } | null>(null);

  const [characters, setCharacters] = useState<any[]>([]);
  const [selectedChar, setSelectedChar] = useState('');
  const [gameCharacters, setGameCharacters] = useState<any[]>([]);
  const [showGCModal, setShowGCModal] = useState(false);
  const [editingGC, setEditingGC] = useState<any>(null);
  const gcAvatarRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [monsters, setMonsters] = useState<any[]>([]);
  const [showMonsterModal, setShowMonsterModal] = useState(false);
  const [editingMonster, setEditingMonster] = useState<any>(null);

  const [libraryMonsters, setLibraryMonsters] = useState<any[]>([]);
  const [libraryChars, setLibraryChars] = useState<any[]>([]);
  const [showLibraryMonsters, setShowLibraryMonsters] = useState(false);
  const [showLibraryChars, setShowLibraryChars] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  const [encounters, setEncounters] = useState<any[]>([]);
  const [showEncForm, setShowEncForm] = useState(false);
  const [encName, setEncName] = useState('');
  const [encDesc, setEncDesc] = useState('');
  const [expandedEnc, setExpandedEnc] = useState<string | null>(null);
  const [addingCombatantTo, setAddingCombatantTo] = useState<string | null>(null);

  const [sessions, setSessions] = useState<any[]>([]);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endNotes, setEndNotes] = useState('');
  const [endingSession, setEndingSession] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingGame, setDeletingGame] = useState(false);

  useEffect(() => {
    const calls: Promise<any>[] = [
      api.get(`/games/${id}`),
      api.get('/characters'),
      api.get(`/games/${id}/game-characters`),
      api.get(`/games/${id}/sessions`),
    ];
    Promise.all(calls).then(([gameRes, charRes, gcRes, sessRes]) => {
      setGame(gameRes.data);
      setCharacters(charRes.data);
      setGameCharacters(gcRes.data);
      setSessions(sessRes.data);
      const existingPlayer = gameRes.data.players.find((p: any) => p.id === user?.id);
      if (existingPlayer?.character_id) setSelectedChar(existingPlayer.character_id);
      const n = sessRes.data.length + 1;
      setSessionName(`Session ${n}`);
    }).finally(() => setLoading(false));
    // Load DM-only data
    if (user) {
      api.get(`/games/${id}/monsters`).then(({ data }) => setMonsters(data)).catch(() => {});
      api.get(`/games/${id}/encounters`).then(({ data }) => setEncounters(data)).catch(() => {});
      api.get('/library/monsters').then(({ data }) => setLibraryMonsters(data)).catch(() => {});
      api.get('/library/characters').then(({ data }) => setLibraryChars(data)).catch(() => {});
    }
  }, [id]);

  // ── Launch / End ─────────────────────────────────────────────────────────────
  async function launch() {
    setLaunching(true);
    try {
      await api.post(`/games/${id}/launch`, { session_name: sessionName || `Session ${sessions.length + 1}` });
      toast.success('Session started!');
      navigate(`/games/${id}/play`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Cannot launch');
    } finally { setLaunching(false); }
  }

  async function endSession() {
    setEndingSession(true);
    try {
      await api.post(`/games/${id}/end`, { footnotes: endNotes });
      toast.success('Session ended');
      setGame(g => g ? { ...g, status: 'lobby' } : g);
      const { data } = await api.get(`/games/${id}/sessions`);
      setSessions(data);
      const n = data.length + 1;
      setSessionName(`Session ${n}`);
      setShowEndDialog(false);
      setEndNotes('');
    } catch { toast.error('Failed to end session'); }
    finally { setEndingSession(false); }
  }

  // ── Maps ─────────────────────────────────────────────────────────────────────
  async function uploadMap(e: React.FormEvent) {
    e.preventDefault();
    if (!mapFile || !mapName.trim()) return;
    setUploadingMap(true);
    const fd = new FormData();
    fd.append('image', mapFile); fd.append('name', mapName.trim()); fd.append('grid_size', mapGrid.toString());
    try {
      const { data } = await api.post(`/games/${id}/maps`, fd);
      toast.success('Map added!');
      setGame(g => g ? { ...g, maps: [...g.maps, data] } : g);
      setShowMapForm(false); setMapName(''); setMapFile(null);
    } catch { toast.error('Map upload failed'); }
    finally { setUploadingMap(false); }
  }

  async function saveBuiltMap(blob: Blob, name: string, gridSize: number) {
    const fd = new FormData();
    fd.append('image', blob, `${name.replace(/\s+/g, '-')}.png`);
    fd.append('name', name); fd.append('grid_size', gridSize.toString());
    try {
      if (editingMap) {
        await api.patch(`/games/${id}/maps/${editingMap.id}/image`, fd);
        toast.success(`Map "${name}" updated!`);
        setGame(g => g ? { ...g, maps: g.maps.map(m => m.id === editingMap.id ? { ...m, name, grid_size: gridSize } : m) } : g);
      } else {
        const { data } = await api.post(`/games/${id}/maps`, fd);
        toast.success(`Map "${name}" added!`);
        setGame(g => g ? { ...g, maps: [...g.maps, data] } : g);
      }
      setShowMapBuilder(false); setEditingMap(null);
    } catch { toast.error('Failed to save map'); }
  }

  async function deleteMap(mapId: string, mapName: string) {
    if (!confirm(`Delete map "${mapName}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/games/${id}/maps/${mapId}`);
      toast.success(`Map "${mapName}" deleted`);
      setGame(g => g ? { ...g, maps: g.maps.filter(m => m.id !== mapId) } : g);
    } catch { toast.error('Failed to delete map'); }
  }

  // ── Characters ───────────────────────────────────────────────────────────────
  async function selectCharacter(charId: string) {
    setSelectedChar(charId);
    await api.post('/games/join', { code: game!.join_code, character_id: charId || undefined });
    toast.success('Character selected');
  }

  async function claimGameCharacter(gcId: string) {
    try {
      const { data } = await api.post(`/games/${id}/game-characters/${gcId}/claim`);
      setSelectedChar(data.id);
      setCharacters(prev => [...prev.filter(c => c.name !== data.name), data]);
      toast.success(`${data.name} claimed!`);
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Could not claim'); }
  }

  function handleGCSaved(char: any) {
    setGameCharacters(prev => {
      const i = prev.findIndex(c => c.id === char.id);
      if (i >= 0) { const n = [...prev]; n[i] = char; return n; }
      return [...prev, char];
    });
  }

  async function deleteGameCharacter(gcId: string) {
    await api.delete(`/games/${id}/game-characters/${gcId}`);
    setGameCharacters(prev => prev.filter(c => c.id !== gcId));
    toast.success('Character removed');
  }

  async function importLibraryChar(templateId: string) {
    setImportingId(templateId);
    try {
      const { data } = await api.post(`/library/characters/${templateId}/import/${id}`);
      setGameCharacters(prev => [...prev, data]);
      toast.success('Character added from library!');
      setShowLibraryChars(false);
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Import failed'); }
    finally { setImportingId(null); }
  }

  async function importLibraryMonster(templateId: string) {
    setImportingId(templateId);
    try {
      const { data } = await api.post(`/library/monsters/${templateId}/import/${id}`);
      setMonsters(prev => [...prev, data]);
      toast.success('Monster added from library!');
      setShowLibraryMonsters(false);
    } catch (err: any) { toast.error(err?.response?.data?.error || 'Import failed'); }
    finally { setImportingId(null); }
  }

  async function uploadGCAvatar(gcId: string, file: File) {
    const fd = new FormData(); fd.append('avatar', file);
    try {
      const { data } = await api.post(`/games/${id}/game-characters/${gcId}/avatar`, fd);
      setGameCharacters(prev => prev.map(c => c.id === gcId ? { ...c, avatar_url: data.avatar_url } : c));
      toast.success('Avatar updated!');
    } catch { toast.error('Upload failed'); }
  }

  // ── Monsters ─────────────────────────────────────────────────────────────────
  function handleMonsterSaved(m: any) {
    setMonsters(prev => {
      const i = prev.findIndex(x => x.id === m.id);
      if (i >= 0) { const n = [...prev]; n[i] = m; return n; }
      return [...prev, m];
    });
  }

  async function deleteMonster(mId: string) {
    await api.delete(`/games/${id}/monsters/${mId}`);
    setMonsters(prev => prev.filter(m => m.id !== mId));
    toast.success('Monster deleted');
  }

  // ── Encounters ───────────────────────────────────────────────────────────────
  async function createEncounter(e: React.FormEvent) {
    e.preventDefault();
    if (!encName.trim()) return;
    try {
      const { data } = await api.post(`/games/${id}/encounters`, { name: encName, description: encDesc });
      setEncounters(prev => [...prev, data]);
      setEncName(''); setEncDesc(''); setShowEncForm(false);
      toast.success('Encounter created!');
    } catch { toast.error('Failed'); }
  }

  async function deleteEncounter(eId: string) {
    await api.delete(`/games/${id}/encounters/${eId}`);
    setEncounters(prev => prev.filter(e => e.id !== eId));
  }

  async function addMonsterCombatant(encId: string, monster: any) {
    try {
      const { data } = await api.post(`/games/${id}/encounters/${encId}/combatants`, {
        type: 'monster', ref_id: monster.id, name: monster.name,
        current_hp: monster.max_hp, max_hp: monster.max_hp, ac: monster.ac,
        avatar_url: monster.avatar_url || null,
        stats: monster.stats, actions: monster.actions,
      });
      setEncounters(prev => prev.map(e => e.id === encId ? { ...e, combatants: [...(e.combatants || []), data] } : e));
    } catch { toast.error('Failed to add'); }
  }

  async function removeCombatant(encId: string, cId: string) {
    await api.delete(`/games/${id}/encounters/${encId}/combatants/${cId}`);
    setEncounters(prev => prev.map(e => e.id === encId ? { ...e, combatants: e.combatants.filter((c: any) => c.id !== cId) } : e));
  }

  async function deleteGame() {
    setDeletingGame(true);
    try {
      await api.delete(`/games/${id}`);
      toast.success('Campaign deleted');
      navigate('/games');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Delete failed');
    } finally {
      setDeletingGame(false);
    }
  }

  function copyJoinLink() {
    navigator.clipboard.writeText(`${window.location.origin}/join/${game!.join_code}`);
    toast.success('Join link copied!');
  }
  function copyCode() {
    navigator.clipboard.writeText(game!.join_code);
    toast.success('Code copied!');
  }

  if (loading) return <div className="min-h-screen"><Navbar /><div className="text-center py-20 text-tavern-muted font-serif animate-pulse">Loading...</div></div>;
  if (!game) return <div className="min-h-screen"><Navbar /><div className="text-center py-20 text-red-400">Game not found</div></div>;

  const isDM = game.is_dm;

  return (
    <>
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Pending approval banner */}
        {isDM && game.approved === 0 && (
          <div className="mb-6 flex items-start gap-3 bg-amber-900/20 border border-amber-700/50 rounded-lg px-4 py-3 text-sm text-amber-300">
            <span className="text-amber-400 mt-0.5">⏳</span>
            <div>
              <span className="font-serif font-semibold">Awaiting Hall Administrator Approval</span>
              <p className="text-amber-300/70 text-xs mt-0.5">
                This campaign is not yet visible in the public campaign listing. The Hall Administrator (lomindil) will review and approve it shortly.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="page-title">{game.name}</h1>
            {game.description && <p className="text-tavern-muted mt-1">{game.description}</p>}
            <p className="text-xs text-tavern-muted mt-1">DM: {game.dm_username}</p>
          </div>
          {isDM && (
            <div className="flex gap-2 flex-wrap items-start">
              {game.status === 'active' ? (
                <>
                  <button onClick={() => navigate(`/games/${id}/play`)} className="btn-primary flex items-center gap-2"><Play size={16} /> Enter Session</button>
                  <button onClick={() => setShowEndDialog(true)} className="btn-danger text-sm py-2 px-4">End Session</button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <input className="tavern-input text-sm py-1.5 w-44" placeholder="Session name..." value={sessionName} onChange={(e) => setSessionName(e.target.value)} />
                  <button onClick={launch} disabled={launching} className="btn-primary flex items-center gap-2">
                    <Play size={16} /> {launching ? 'Starting...' : 'Launch Session'}
                  </button>
                </div>
              )}
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="text-xs text-red-400/60 hover:text-red-400 border border-red-900/30 hover:border-red-800 px-3 py-2 rounded transition-colors"
                title="Delete campaign"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
          {!isDM && game.status === 'active' && (
            <button onClick={() => navigate(`/games/${id}/play`)} className="btn-primary flex items-center gap-2"><Play size={16} /> Enter Game</button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Join Code — only shown during active session */}
          {game.status === 'active' ? (
            <div className="tavern-card p-4 border-green-900/40">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <h2 className="font-serif text-green-400 text-sm uppercase tracking-widest">Join Code · Live</h2>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-serif text-3xl tracking-widest text-tavern-text font-bold">{game.join_code}</span>
                <button onClick={copyCode} className="text-tavern-muted hover:text-tavern-gold p-1"><Copy size={16} /></button>
              </div>
              <button onClick={copyJoinLink} className="btn-secondary w-full text-xs py-1.5 flex items-center justify-center gap-1">
                <Copy size={12} /> Copy Join Link
              </button>
            </div>
          ) : (
            <div className="tavern-card p-4">
              <h2 className="font-serif text-tavern-muted text-sm uppercase tracking-widest mb-2">Join Code</h2>
              <p className="text-sm text-tavern-muted">Join code is only available during an active session.</p>
            </div>
          )}

          {/* Players */}
          <div className="tavern-card p-4">
            <div className="flex items-center gap-2 mb-3"><Users size={16} className="text-tavern-gold" /><h2 className="font-serif text-tavern-gold text-sm uppercase tracking-widest">Players</h2></div>
            {game.players.length === 0 ? <p className="text-tavern-muted text-sm">No players yet</p> : (
              <div className="space-y-2">
                {game.players.map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-tavern-bg border border-tavern-border overflow-hidden flex-shrink-0">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs flex items-center justify-center h-full">👤</span>}
                    </div>
                    <div>
                      <span className="text-sm text-tavern-text">{p.username}</span>
                      {p.char_name && <span className="text-xs text-tavern-muted ml-1">({p.char_name})</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Player: character selection */}
          {!isDM && (
            <div className="tavern-card p-4 md:col-span-2">
              <h2 className="font-serif text-tavern-gold mb-3 text-sm uppercase tracking-widest">Your Character</h2>
              {gameCharacters.length > 0 && (
                <div className="mb-3">
                  <p className="label mb-2">Pre-built by DM — claim one to play:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    {gameCharacters.map(gc => {
                      const claimedByMe = gc.claimed_by === user?.id;
                      const claimedByOther = gc.claimed_by && !claimedByMe;
                      return (
                        <button key={gc.id}
                          onClick={() => !claimedByOther ? claimGameCharacter(gc.id) : undefined}
                          disabled={!!claimedByOther}
                          className={clsx('border rounded p-2 text-left flex items-start gap-2 transition-colors',
                            claimedByMe ? 'border-tavern-gold/60 bg-tavern-gold/5 hover:border-tavern-gold' :
                            claimedByOther ? 'border-tavern-border/30 opacity-50 cursor-not-allowed' :
                            'border-tavern-border hover:border-tavern-gold'
                          )}
                        >
                          {gc.avatar_url && <img src={gc.avatar_url} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />}
                          <div>
                            <div className="text-sm font-serif text-tavern-text">{gc.name}</div>
                            <div className="text-xs text-tavern-muted">{gc.sheet_data?.race} {gc.sheet_data?.class}</div>
                            <div className="text-xs text-tavern-muted">HP {gc.sheet_data?.combat?.max_hp} · AC {gc.sheet_data?.combat?.ac}</div>
                            {claimedByMe && <div className="text-xs text-tavern-gold mt-0.5">✓ Your character</div>}
                            {claimedByOther && <div className="text-xs text-tavern-muted mt-0.5">Claimed by {gc.claimed_by_username}</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="border-t border-tavern-border mb-3" />
                </div>
              )}
              <p className="label mb-2">Your characters:</p>
              {characters.length === 0 ? (
                <div><p className="text-tavern-muted text-sm mb-2">No characters yet</p><Link to="/characters" className="btn-secondary text-xs py-1.5 px-3">Create Character</Link></div>
              ) : (
                <div className="space-y-1">
                  {characters.map(c => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-tavern-bg/50">
                      <input type="radio" name="char" checked={selectedChar === c.id} onChange={() => selectCharacter(c.id)} className="accent-yellow-500" />
                      <span className="text-sm">{c.name}</span>
                      <span className="text-xs text-tavern-muted">{c.sheet_data?.race} {c.sheet_data?.class}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DM: Pre-built Characters */}
          {isDM && (
            <Section title="Pre-built Characters" icon={<BookOpen size={15} />} defaultOpen={true}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-tavern-muted">Players claim these when joining.</p>
                <div className="flex gap-1.5">
                  <button onClick={() => setShowLibraryChars(v => !v)} title="Import from SRD Library"
                    className={clsx('flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
                      showLibraryChars ? 'border-tavern-gold text-tavern-gold' : 'border-tavern-border text-tavern-muted hover:text-tavern-gold')}>
                    <Library size={11} /> Library
                  </button>
                  <button onClick={() => { setEditingGC(null); setShowGCModal(true); }} className="text-tavern-gold hover:text-tavern-gold-light"><Plus size={15} /></button>
                </div>
              </div>

              {/* Library picker */}
              {showLibraryChars && (
                <div className="mb-3 p-2 bg-tavern-bg rounded border border-tavern-border">
                  <p className="label text-xs mb-2">SRD Pre-built Characters — click to add to game:</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {libraryChars.map(lc => (
                      <button key={lc.id} onClick={() => importLibraryChar(lc.id)}
                        disabled={importingId === lc.id}
                        className="w-full flex items-center justify-between text-left px-2 py-1.5 rounded hover:bg-tavern-card border border-transparent hover:border-tavern-border transition-colors">
                        <div>
                          <span className="text-sm text-tavern-text">{lc.name}</span>
                          <span className="text-xs text-tavern-muted ml-2">{lc.sheet_data?.race} {lc.sheet_data?.class} · HP {lc.sheet_data?.combat?.max_hp}</span>
                        </div>
                        <Download size={12} className="text-tavern-muted flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {gameCharacters.length === 0 ? <p className="text-tavern-muted text-sm">None yet.</p> : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {gameCharacters.map(gc => (
                    <div key={gc.id} className="border border-tavern-border rounded p-2 relative group">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="relative flex-shrink-0 cursor-pointer" onClick={() => gcAvatarRefs.current[gc.id]?.click()}>
                          {gc.avatar_url
                            ? <img src={gc.avatar_url} className="w-8 h-8 rounded-full object-cover border border-tavern-border" alt="" />
                            : <div className="w-8 h-8 rounded-full bg-tavern-bg border border-tavern-border flex items-center justify-center text-sm">🧙</div>}
                          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"><Camera size={10} className="text-white" /></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-serif text-tavern-text truncate">{gc.name}</div>
                          <div className="text-xs text-tavern-muted">{gc.sheet_data?.race} {gc.sheet_data?.class}</div>
                          <div className="text-xs text-tavern-muted">HP {gc.sheet_data?.combat?.max_hp} · AC {gc.sheet_data?.combat?.ac}</div>
                          {gc.claimed_by && <div className="text-xs text-tavern-gold/70 mt-0.5">Claimed: {gc.claimed_by_username}</div>}
                        </div>
                      </div>
                      <input type="file" accept="image/*" className="hidden"
                        ref={el => { gcAvatarRefs.current[gc.id] = el; }}
                        onChange={(e) => e.target.files?.[0] && uploadGCAvatar(gc.id, e.target.files[0])} />
                      <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                        <button onClick={() => { setEditingGC(gc); setShowGCModal(true); }} className="text-tavern-muted hover:text-tavern-gold"><Pencil size={11} /></button>
                        <button onClick={() => deleteGameCharacter(gc.id)} className="text-tavern-muted hover:text-red-400"><Trash2 size={11} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* DM: Monsters */}
          {isDM && (
            <Section title="Monsters" icon={<Skull size={15} />} defaultOpen={false}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-tavern-muted">Monsters usable in encounters & as tokens.</p>
                <div className="flex gap-1.5">
                  <button onClick={() => setShowLibraryMonsters(v => !v)} title="Import from SRD Library"
                    className={clsx('flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors',
                      showLibraryMonsters ? 'border-tavern-gold text-tavern-gold' : 'border-tavern-border text-tavern-muted hover:text-tavern-gold')}>
                    <Library size={11} /> Library
                  </button>
                  <button onClick={() => { setEditingMonster(null); setShowMonsterModal(true); }} className="text-tavern-gold hover:text-tavern-gold-light"><Plus size={15} /></button>
                </div>
              </div>

              {/* SRD Monster library picker */}
              {showLibraryMonsters && (
                <div className="mb-3 p-2 bg-tavern-bg rounded border border-tavern-border">
                  <p className="label text-xs mb-2">SRD Monsters — click to add to game:</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {libraryMonsters.map(lm => (
                      <button key={lm.id} onClick={() => importLibraryMonster(lm.id)}
                        disabled={importingId === lm.id}
                        className="w-full flex items-center justify-between text-left px-2 py-1.5 rounded hover:bg-tavern-card border border-transparent hover:border-tavern-border transition-colors">
                        <div>
                          <span className="text-sm text-tavern-text">{lm.name}</span>
                          <span className="text-xs text-tavern-muted ml-2">CR {lm.cr} · {lm.size} {lm.type} · HP {lm.max_hp} AC {lm.ac}</span>
                        </div>
                        <Download size={12} className="text-tavern-muted flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {monsters.length === 0 ? <p className="text-tavern-muted text-sm">No monsters yet.</p> : (
                <div className="space-y-1">
                  {monsters.map(m => (
                    <div key={m.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-tavern-bg/50 group">
                      {m.avatar_url
                        ? <img src={m.avatar_url} className="w-7 h-7 rounded-full object-cover border border-tavern-border flex-shrink-0" alt="" />
                        : <div className="w-7 h-7 rounded-full bg-tavern-bg border border-tavern-border flex items-center justify-center text-sm flex-shrink-0">👹</div>}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-tavern-text">{m.name}</span>
                        <span className="text-xs text-tavern-muted ml-2">{m.size} {m.type}</span>
                      </div>
                      <span className="text-xs text-tavern-muted">CR {m.cr}</span>
                      <span className="text-xs text-tavern-muted">AC {m.ac}</span>
                      <span className="text-xs text-tavern-muted">HP {m.max_hp}</span>
                      <div className="hidden group-hover:flex gap-1">
                        <button onClick={() => { setEditingMonster(m); setShowMonsterModal(true); }} className="text-tavern-muted hover:text-tavern-gold"><Pencil size={11} /></button>
                        <button onClick={() => deleteMonster(m.id)} className="text-tavern-muted hover:text-red-400"><Trash2 size={11} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* DM: Encounters */}
          {isDM && (
            <Section title="Encounters" icon={<Swords size={15} />} defaultOpen={false}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-tavern-muted">Plan combat encounters. Start them in-session.</p>
                <button onClick={() => setShowEncForm(f => !f)} className="text-tavern-gold hover:text-tavern-gold-light"><Plus size={15} /></button>
              </div>

              {showEncForm && (
                <form onSubmit={createEncounter} className="mb-3 p-3 bg-tavern-bg rounded border border-tavern-border space-y-2">
                  <input className="tavern-input text-sm py-1.5" placeholder="Encounter name *" value={encName} onChange={(e) => setEncName(e.target.value)} required autoFocus />
                  <input className="tavern-input text-sm py-1.5" placeholder="Description (optional)" value={encDesc} onChange={(e) => setEncDesc(e.target.value)} />
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary text-xs py-1 px-3">Create</button>
                    <button type="button" onClick={() => setShowEncForm(false)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
                  </div>
                </form>
              )}

              {encounters.length === 0 ? <p className="text-tavern-muted text-sm">No encounters yet.</p> : (
                <div className="space-y-2">
                  {encounters.map(enc => (
                    <div key={enc.id} className="border border-tavern-border rounded overflow-hidden">
                      <div className="flex items-center justify-between p-2 hover:bg-tavern-bg/30">
                        <button className="flex items-center gap-2 flex-1 text-left" onClick={() => setExpandedEnc(expandedEnc === enc.id ? null : enc.id)}>
                          <span className={clsx('text-[10px] px-1.5 py-0.5 rounded', enc.status === 'active' ? 'bg-green-900/40 text-green-400' : enc.status === 'completed' ? 'bg-tavern-bg text-tavern-muted' : 'bg-tavern-bg/50 text-tavern-muted')}>
                            {enc.status}
                          </span>
                          <span className="font-serif text-sm text-tavern-text">{enc.name}</span>
                          <span className="text-xs text-tavern-muted">{(enc.combatants || []).length} combatants</span>
                        </button>
                        <div className="flex gap-1">
                          <button onClick={() => setAddingCombatantTo(addingCombatantTo === enc.id ? null : enc.id)} className="text-xs border border-tavern-border rounded px-2 py-0.5 text-tavern-muted hover:text-tavern-gold">
                            <Plus size={11} />
                          </button>
                          <button onClick={() => deleteEncounter(enc.id)} className="text-tavern-muted hover:text-red-400 p-1"><Trash2 size={11} /></button>
                        </div>
                      </div>

                      {/* Add combatant picker */}
                      {addingCombatantTo === enc.id && (
                        <div className="p-2 bg-tavern-bg border-t border-tavern-border">
                          <p className="label text-xs mb-2">Add monster from your list:</p>
                          {monsters.length === 0 ? <p className="text-tavern-muted text-xs">Create monsters first.</p> : (
                            <div className="flex flex-wrap gap-1">
                              {monsters.map(m => (
                                <button key={m.id} onClick={() => addMonsterCombatant(enc.id, m)}
                                  className="text-xs border border-tavern-border rounded px-2 py-0.5 hover:border-tavern-gold transition-colors flex items-center gap-1">
                                  {m.avatar_url && <img src={m.avatar_url} className="w-4 h-4 rounded-full object-cover" alt="" />}
                                  {m.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Combatant list */}
                      {expandedEnc === enc.id && (
                        <div className="border-t border-tavern-border">
                          {(enc.combatants || []).length === 0 ? (
                            <p className="text-xs text-tavern-muted p-2 italic">No combatants yet.</p>
                          ) : (
                            (enc.combatants || []).map((c: any) => (
                              <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-tavern-border/40 last:border-0 group">
                                {c.avatar_url
                                  ? <img src={c.avatar_url} className="w-5 h-5 rounded-full object-cover" alt="" />
                                  : <span className="text-sm">{c.type === 'monster' ? '👹' : '🧙'}</span>}
                                <span className="flex-1 text-xs text-tavern-text">{c.name}</span>
                                <span className="text-xs text-tavern-muted">HP {c.max_hp}</span>
                                <span className="text-xs text-tavern-muted">AC {c.ac}</span>
                                <button onClick={() => removeCombatant(enc.id, c.id)} className="opacity-0 group-hover:opacity-100 text-tavern-muted hover:text-red-400"><X size={11} /></button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Maps (DM) */}
          {isDM && (
            <Section title="Battle Maps" icon={<Map size={15} />} defaultOpen={false}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-tavern-muted">Upload or build maps for the session.</p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setShowMapBuilder(true)} title="Map Builder" className="text-tavern-muted hover:text-tavern-gold"><Hammer size={14} /></button>
                  <button onClick={() => setShowMapForm(f => !f)} className="text-tavern-gold hover:text-tavern-gold-light"><Plus size={15} /></button>
                </div>
              </div>
              {showMapForm && (
                <form onSubmit={uploadMap} className="mb-3 space-y-2 p-3 bg-tavern-bg rounded border border-tavern-border">
                  <input className="tavern-input text-sm py-1.5" placeholder="Map name" value={mapName} onChange={(e) => setMapName(e.target.value)} required />
                  <div><label className="label block mb-1">Grid Size (px)</label>
                    <input type="number" min={20} max={200} className="tavern-input text-sm py-1.5" value={mapGrid} onChange={(e) => setMapGrid(parseInt(e.target.value))} /></div>
                  <label className="flex items-center gap-2 cursor-pointer border border-dashed border-tavern-border rounded p-2 hover:border-tavern-gold transition-colors">
                    <Upload size={14} className="text-tavern-muted" />
                    <span className="text-sm text-tavern-muted">{mapFile ? mapFile.name : 'Upload map image'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setMapFile(e.target.files?.[0] || null)} required />
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" disabled={uploadingMap} className="btn-primary text-xs py-1 px-3">{uploadingMap ? 'Uploading...' : 'Add Map'}</button>
                    <button type="button" onClick={() => setShowMapForm(false)} className="btn-secondary text-xs py-1 px-3">Cancel</button>
                  </div>
                </form>
              )}
              <div className="space-y-1">
                {game.maps.length === 0 ? <p className="text-tavern-muted text-sm">No maps yet</p> : game.maps.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-1.5 rounded hover:bg-tavern-bg/50 group">
                    <span className="text-sm text-tavern-text">{m.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-tavern-muted">Grid: {m.grid_size}px</span>
                      <button onClick={() => { setEditingMap({ id: m.id, name: m.name, imageUrl: m.image_url, gridSize: m.grid_size }); setShowMapBuilder(true); }}
                        className="opacity-0 group-hover:opacity-100 text-tavern-muted hover:text-tavern-gold" title="Edit"><Pencil size={12} /></button>
                      <button onClick={() => deleteMap(m.id, m.name)}
                        className="opacity-0 group-hover:opacity-100 text-tavern-muted hover:text-red-400" title="Delete map"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Session History */}
          <div className={clsx('tavern-card p-4', isDM ? '' : 'md:col-span-2')}>
            <div className="flex items-center gap-2 mb-3">
              <History size={15} className="text-tavern-gold" />
              <h2 className="font-serif text-tavern-gold text-sm uppercase tracking-widest">Session History</h2>
            </div>
            {sessions.length === 0 ? <p className="text-tavern-muted text-sm">No sessions yet.</p> : (
              <div className="space-y-2">
                {[...sessions].reverse().map(s => (
                  <div key={s.id} className="border border-tavern-border rounded p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded', s.status === 'active' ? 'bg-green-900/40 text-green-400' : 'bg-tavern-bg text-tavern-muted')}>{s.status}</span>
                        <span className="font-serif text-sm text-tavern-text">{s.name}</span>
                      </div>
                      <span className="text-xs text-tavern-muted">{new Date(s.started_at * 1000).toLocaleDateString()}</span>
                    </div>
                    {s.footnotes && <p className="text-xs text-tavern-muted mt-1 italic pl-1 border-l-2 border-tavern-border">{s.footnotes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>

    {/* Modals */}
    {showMapBuilder && (
      <MapBuilderModal onClose={() => { setShowMapBuilder(false); setEditingMap(null); }} onSave={saveBuiltMap} editMap={editingMap || undefined} />
    )}
    {showGCModal && (
      <GameCharacterModal gameId={id!} character={editingGC} onClose={() => { setShowGCModal(false); setEditingGC(null); }} onSaved={handleGCSaved} />
    )}
    {showMonsterModal && (
      <MonsterFormModal gameId={id!} monster={editingMonster} onClose={() => { setShowMonsterModal(false); setEditingMonster(null); }} onSaved={handleMonsterSaved} />
    )}

    {/* Delete campaign dialog */}
    {showDeleteDialog && (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-tavern-card border border-red-900/50 rounded-lg w-full max-w-md p-6">
          <h3 className="font-serif text-red-400 text-lg mb-2">Delete Campaign</h3>
          {encounters.some(e => e.status === 'pending' || e.status === 'active') && (
            <div className="bg-yellow-900/20 border border-yellow-800/40 rounded p-3 mb-4 text-sm text-yellow-300">
              Warning: this campaign has unfinished encounters. All encounter data will be permanently lost.
            </div>
          )}
          <p className="text-tavern-muted text-sm mb-6">
            This will permanently delete <span className="text-tavern-text font-semibold">{game.name}</span> along with all maps, characters, monsters, encounters, and session history. This cannot be undone.
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowDeleteDialog(false)} className="btn-secondary text-sm" disabled={deletingGame}>Cancel</button>
            <button onClick={deleteGame} disabled={deletingGame}
              className="px-4 py-2 text-sm rounded bg-red-900 hover:bg-red-800 text-red-100 border border-red-700 transition-colors disabled:opacity-50">
              {deletingGame ? 'Deleting...' : 'Delete Forever'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* End session dialog */}
    {showEndDialog && (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-tavern-card border border-tavern-border rounded-lg w-full max-w-md p-6">
          <h3 className="font-serif text-tavern-gold text-lg mb-2">End Session</h3>
          <p className="text-tavern-muted text-sm mb-4">Write any footnotes, summary, or notes for this session.</p>
          <textarea
            className="tavern-input resize-none mb-4"
            rows={5}
            placeholder="What happened this session? Any cliffhangers, XP awarded, items found..."
            value={endNotes}
            onChange={(e) => setEndNotes(e.target.value)}
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowEndDialog(false)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
            <button onClick={endSession} disabled={endingSession} className="btn-danger text-sm py-2 px-4">
              {endingSession ? 'Ending...' : 'End Session'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
