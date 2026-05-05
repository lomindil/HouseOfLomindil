import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/ui/Navbar';
import api from '../lib/api';
import { Plus, LogIn, Sword, Clock, AlertCircle } from 'lucide-react';

interface Game {
  id: string;
  name: string;
  description: string;
  status: string;
  join_code: string;
  created_at: number;
}

export default function GamesPage() {
  const [dmGames, setDmGames] = useState<Game[]>([]);
  const [playerGames, setPlayerGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('create')) setShowCreate(true);
    if (searchParams.get('join')) setShowJoin(true);
  }, []);

  useEffect(() => {
    api.get('/games').then(({ data }) => {
      setDmGames(data.dm_games);
      setPlayerGames(data.player_games);
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

  const statusColor: Record<string, string> = {
    lobby: 'text-tavern-muted',
    active: 'text-green-400',
    ended: 'text-red-400',
  };
  const statusIcon: Record<string, React.ReactNode> = {
    lobby: <Clock size={12} />,
    active: <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />,
    ended: <AlertCircle size={12} />,
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="page-title">My Games</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowJoin(!showJoin)} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
              <LogIn size={14} /> Join Game
            </button>
            <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
              <Plus size={14} /> New Campaign
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="tavern-card p-5 mb-6">
            <h2 className="font-serif text-tavern-gold mb-4">New Campaign</h2>
            <form onSubmit={createGame} className="space-y-3">
              <input className="tavern-input" placeholder="Campaign Name" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
              <textarea className="tavern-input resize-none" rows={2} placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              <div className="flex gap-2">
                <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Creating...' : 'Create Campaign'}</button>
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Join form */}
        {showJoin && (
          <div className="tavern-card p-5 mb-6">
            <h2 className="font-serif text-tavern-gold mb-4">Join a Game</h2>
            <form onSubmit={joinGame} className="flex gap-2">
              <input className="tavern-input" placeholder="Enter 6-character code (e.g. AB12CD)" value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))} required autoFocus />
              <button type="submit" className="btn-primary whitespace-nowrap">Join</button>
              <button type="button" onClick={() => setShowJoin(false)} className="btn-secondary">Cancel</button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-tavern-muted font-serif animate-pulse">Loading...</div>
        ) : (
          <>
            {dmGames.length > 0 && (
              <div className="mb-8">
                <h2 className="font-serif text-tavern-muted uppercase tracking-widest text-xs mb-3">As Dungeon Master</h2>
                <div className="grid gap-3">
                  {dmGames.map((g) => (
                    <Link key={g.id} to={`/games/${g.id}`} className="tavern-card p-4 hover:border-tavern-gold/50 transition-colors flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Sword size={16} className="text-tavern-gold" />
                          <span className="font-serif text-tavern-text">{g.name}</span>
                        </div>
                        {g.description && <p className="text-xs text-tavern-muted mt-0.5 ml-6">{g.description}</p>}
                      </div>
                      <div className={`flex items-center gap-1.5 text-xs ${statusColor[g.status] || 'text-tavern-muted'}`}>
                        {statusIcon[g.status]} {g.status}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {playerGames.length > 0 && (
              <div>
                <h2 className="font-serif text-tavern-muted uppercase tracking-widest text-xs mb-3">As Player</h2>
                <div className="grid gap-3">
                  {playerGames.map((g) => (
                    <Link key={g.id} to={`/games/${g.id}`} className="tavern-card p-4 hover:border-tavern-gold/50 transition-colors flex items-center justify-between">
                      <span className="font-serif text-tavern-text">{g.name}</span>
                      <div className={`flex items-center gap-1.5 text-xs ${statusColor[g.status] || 'text-tavern-muted'}`}>
                        {statusIcon[g.status]} {g.status}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {dmGames.length === 0 && playerGames.length === 0 && (
              <div className="tavern-card p-12 text-center">
                <div className="text-5xl mb-4">🗺️</div>
                <p className="font-serif text-lg text-tavern-muted mb-4">No adventures yet</p>
                <button onClick={() => setShowCreate(true)} className="btn-primary">Create Your First Campaign</button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
