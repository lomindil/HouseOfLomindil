import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/ui/Navbar';
import api from '../lib/api';
import { Plus, LogIn, Sword, Clock, AlertCircle, Zap } from 'lucide-react';
import clsx from 'clsx';

interface Game {
  id: string;
  name: string;
  description: string;
  status: string;
  join_code: string;
  dm_username?: string;
  player_count?: number;
  created_at: number;
}

export default function GamesPage() {
  const [dmGames, setDmGames] = useState<Game[]>([]);
  const [playerGames, setPlayerGames] = useState<Game[]>([]);
  const [liveGames, setLiveGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [liveJoinCode, setLiveJoinCode] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('create')) setShowCreate(true);
    if (searchParams.get('join')) setShowJoin(true);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/games'),
      api.get('/games/discover'),
    ]).then(([myRes, liveRes]) => {
      setDmGames(myRes.data.dm_games);
      setPlayerGames(myRes.data.player_games);
      setLiveGames(liveRes.data);
    }).finally(() => setLoading(false));
  }, []);

  async function createGame(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/games', { name: newName.trim(), description: newDesc.trim() });
      toast.success('Campaign created!');
      navigate(`/games/${data.id}`);
    } catch {
      toast.error('Failed to create game');
    } finally {
      setCreating(false);
    }
  }

  async function joinGame(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      const { data } = await api.post('/games/join', { code: joinCode.trim() });
      toast.success('Joined the party!');
      navigate(`/games/${data.game_id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid code');
    }
  }

  async function joinLiveGame(e: React.FormEvent, gameId: string) {
    e.preventDefault();
    try {
      const { data } = await api.post('/games/join', { code: liveJoinCode.trim() });
      toast.success('Joined!');
      navigate(`/games/${data.game_id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid code');
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      lobby:  { color: 'text-tavern-muted',  icon: <Clock size={11} />,  label: 'Lobby' },
      active: { color: 'text-green-400',     icon: <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />, label: 'Live' },
      ended:  { color: 'text-red-400/70',    icon: <AlertCircle size={11} />, label: 'Ended' },
    };
    const s = map[status] || map.lobby;
    return (
      <span className={clsx('flex items-center gap-1 text-xs font-serif', s.color)}>
        {s.icon} {s.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="page-title">Games</h1>
          <div className="flex gap-2">
            <button onClick={() => { setShowJoin(!showJoin); setShowCreate(false); }} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
              <LogIn size={14} /> Join
            </button>
            <button onClick={() => { setShowCreate(!showCreate); setShowJoin(false); }} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
              <Plus size={14} /> New Campaign
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="tavern-card p-5 mb-6 border-tavern-gold/30">
            <h2 className="font-serif text-tavern-gold mb-4 text-sm uppercase tracking-widest">New Campaign</h2>
            <form onSubmit={createGame} className="space-y-3">
              <input className="tavern-input" placeholder="Campaign name" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
              <textarea className="tavern-input resize-none" rows={2} placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              <div className="flex gap-2">
                <button type="submit" disabled={creating} className="btn-primary text-sm">{creating ? 'Creating...' : 'Create'}</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Join form */}
        {showJoin && (
          <div className="tavern-card p-5 mb-6 border-tavern-gold/30">
            <h2 className="font-serif text-tavern-gold mb-4 text-sm uppercase tracking-widest">Join a Game</h2>
            <form onSubmit={joinGame} className="flex gap-2">
              <input
                className="tavern-input text-center tracking-widest text-lg font-serif"
                placeholder="AB12CD"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                required
                autoFocus
              />
              <button type="submit" className="btn-primary whitespace-nowrap">Join</button>
              <button type="button" onClick={() => setShowJoin(false)} className="btn-secondary">✕</button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-tavern-muted font-serif animate-pulse">Loading...</div>
        ) : (
          <div className="space-y-8">

            {/* Live sessions */}
            {liveGames.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <h2 className="font-serif text-xs uppercase tracking-widest text-green-400">Live Sessions</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {liveGames.map((g) => (
                    <div key={g.id} className="tavern-card p-4 border-green-900/30 hover:border-green-600/30 transition-all">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-serif text-tavern-text font-semibold text-sm">{g.name}</span>
                        <Zap size={13} className="text-green-400 shrink-0" />
                      </div>
                      <p className="text-xs text-tavern-muted mb-1">DM: {g.dm_username} · {g.player_count} players</p>
                      {g.description && <p className="text-xs text-tavern-muted/60 mb-3 line-clamp-1">{g.description}</p>}
                      {joiningId === g.id ? (
                        <form onSubmit={(e) => joinLiveGame(e, g.id)} className="flex gap-1.5">
                          <input
                            autoFocus
                            className="tavern-input py-1 text-xs flex-1 text-center tracking-widest"
                            placeholder="Join code"
                            value={liveJoinCode}
                            onChange={(e) => setLiveJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                            maxLength={6}
                          />
                          <button type="submit" className="btn-primary text-xs py-1 px-3">Join</button>
                          <button type="button" onClick={() => setJoiningId(null)} className="btn-secondary text-xs py-1 px-2">✕</button>
                        </form>
                      ) : (
                        <button
                          onClick={() => { setJoiningId(g.id); setLiveJoinCode(''); }}
                          className="w-full text-xs border border-green-900/50 text-green-400/80 hover:bg-green-900/20 rounded py-1.5 font-serif transition-colors"
                        >
                          Enter with Code
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* My DM games */}
            {dmGames.length > 0 && (
              <section>
                <h2 className="font-serif text-xs uppercase tracking-widest text-tavern-muted/60 mb-3">As Dungeon Master</h2>
                <div className="grid gap-2">
                  {dmGames.map((g) => (
                    <Link key={g.id} to={`/games/${g.id}`}
                      className="tavern-card p-4 hover:border-tavern-gold/40 transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <Sword size={15} className="text-tavern-gold/60 shrink-0" />
                        <div>
                          <span className="font-serif text-tavern-text group-hover:text-tavern-gold-light transition-colors">{g.name}</span>
                          {g.description && <p className="text-xs text-tavern-muted mt-0.5">{g.description}</p>}
                        </div>
                      </div>
                      {statusBadge(g.status)}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* My player games */}
            {playerGames.length > 0 && (
              <section>
                <h2 className="font-serif text-xs uppercase tracking-widest text-tavern-muted/60 mb-3">As Player</h2>
                <div className="grid gap-2">
                  {playerGames.map((g) => (
                    <Link key={g.id} to={`/games/${g.id}`}
                      className="tavern-card p-4 hover:border-tavern-gold/40 transition-all flex items-center justify-between group"
                    >
                      <span className="font-serif text-tavern-text group-hover:text-tavern-gold-light transition-colors">{g.name}</span>
                      {statusBadge(g.status)}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {dmGames.length === 0 && playerGames.length === 0 && liveGames.length === 0 && (
              <div className="tavern-card p-16 text-center">
                <div className="text-5xl mb-4">🗺️</div>
                <p className="font-serif text-lg text-tavern-muted mb-6">No adventures yet</p>
                <button onClick={() => setShowCreate(true)} className="btn-primary">Create Your First Campaign</button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
