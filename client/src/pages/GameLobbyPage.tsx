import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/ui/Navbar';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import { Play, Copy, Users, Map, Plus, Trash2, AlertTriangle, Upload } from 'lucide-react';

interface Game {
  id: string;
  name: string;
  description: string;
  status: string;
  join_code: string;
  dm_id: string;
  dm_username: string;
  is_dm: boolean;
  players: any[];
  maps: any[];
  current_map_id?: string;
}

export default function GameLobbyPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [showMapForm, setShowMapForm] = useState(false);
  const [mapName, setMapName] = useState('');
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [mapGrid, setMapGrid] = useState(50);
  const [uploadingMap, setUploadingMap] = useState(false);
  const [characters, setCharacters] = useState<any[]>([]);
  const [selectedChar, setSelectedChar] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/games/${id}`),
      api.get('/characters'),
    ]).then(([gameRes, charRes]) => {
      setGame(gameRes.data);
      setCharacters(charRes.data);
      const existingPlayer = gameRes.data.players.find((p: any) => p.id === user?.id);
      if (existingPlayer?.character_id) setSelectedChar(existingPlayer.character_id);
    }).finally(() => setLoading(false));
  }, [id]);

  async function launch() {
    setLaunching(true);
    try {
      await api.post(`/games/${id}/launch`);
      toast.success('Game launched!');
      navigate(`/games/${id}/play`);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Cannot launch';
      if (msg.includes('active')) {
        toast.error(`${msg}: "${err.response?.data?.active_game}" is currently running`);
      } else {
        toast.error(msg);
      }
    } finally {
      setLaunching(false);
    }
  }

  async function endGame() {
    if (!confirm('End this game session?')) return;
    await api.post(`/games/${id}/end`);
    toast.success('Game ended');
    setGame((g) => g ? { ...g, status: 'ended' } : g);
  }

  async function uploadMap(e: React.FormEvent) {
    e.preventDefault();
    if (!mapFile || !mapName.trim()) return;
    setUploadingMap(true);
    const fd = new FormData();
    fd.append('image', mapFile);
    fd.append('name', mapName.trim());
    fd.append('grid_size', mapGrid.toString());
    try {
      const { data } = await api.post(`/games/${id}/maps`, fd);
      toast.success('Map added!');
      setGame((g) => g ? { ...g, maps: [...g.maps, data] } : g);
      setShowMapForm(false);
      setMapName(''); setMapFile(null);
    } catch {
      toast.error('Map upload failed');
    } finally {
      setUploadingMap(false);
    }
  }

  async function selectCharacter(charId: string) {
    setSelectedChar(charId);
    await api.post('/games/join', { code: game!.join_code, character_id: charId || undefined });
    toast.success('Character selected');
  }

  function copyJoinLink() {
    const url = `${window.location.origin}/join/${game!.join_code}`;
    navigator.clipboard.writeText(url);
    toast.success('Join link copied!');
  }

  function copyCode() {
    navigator.clipboard.writeText(game!.join_code);
    toast.success('Code copied!');
  }

  if (loading) return (
    <div className="min-h-screen"><Navbar />
      <div className="text-center py-20 text-tavern-muted font-serif animate-pulse">Loading...</div>
    </div>
  );

  if (!game) return <div className="min-h-screen"><Navbar />
    <div className="text-center py-20 text-red-400">Game not found</div>
  </div>;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="page-title">{game.name}</h1>
            {game.description && <p className="text-tavern-muted mt-1">{game.description}</p>}
            <p className="text-xs text-tavern-muted mt-1">DM: {game.dm_username}</p>
          </div>

          {game.is_dm && (
            <div className="flex gap-2 flex-wrap">
              {game.status === 'active' ? (
                <>
                  <button onClick={() => navigate(`/games/${id}/play`)} className="btn-primary flex items-center gap-2">
                    <Play size={16} /> Enter Game
                  </button>
                  <button onClick={endGame} className="btn-danger text-sm py-2 px-4">End Session</button>
                </>
              ) : game.status === 'lobby' ? (
                <button onClick={launch} disabled={launching} className="btn-primary flex items-center gap-2">
                  <Play size={16} /> {launching ? 'Checking...' : 'Launch Game'}
                </button>
              ) : (
                <span className="text-tavern-muted font-serif text-sm">Session Ended</span>
              )}
            </div>
          )}

          {!game.is_dm && game.status === 'active' && (
            <button onClick={() => navigate(`/games/${id}/play`)} className="btn-primary flex items-center gap-2">
              <Play size={16} /> Enter Game
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Join Info */}
          <div className="tavern-card p-4">
            <h2 className="font-serif text-tavern-gold mb-3 text-sm uppercase tracking-widest">Join Code</h2>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-serif text-3xl tracking-widest text-tavern-text font-bold">{game.join_code}</span>
              <button onClick={copyCode} className="text-tavern-muted hover:text-tavern-gold transition-colors p-1">
                <Copy size={16} />
              </button>
            </div>
            <button onClick={copyJoinLink} className="btn-secondary w-full text-xs py-1.5 flex items-center justify-center gap-1">
              <Copy size={12} /> Copy Join Link
            </button>
            {game.status !== 'lobby' && (
              <div className={`mt-2 flex items-center gap-1.5 text-xs ${game.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>
                {game.status === 'active' ? '● Game in progress' : '● Session ended'}
              </div>
            )}
          </div>

          {/* Players */}
          <div className="tavern-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-tavern-gold" />
              <h2 className="font-serif text-tavern-gold text-sm uppercase tracking-widest">Players</h2>
            </div>
            <div className="space-y-2">
              {game.players.length === 0 ? (
                <p className="text-tavern-muted text-sm">No players yet</p>
              ) : (
                game.players.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-tavern-bg border border-tavern-border overflow-hidden flex-shrink-0">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs flex items-center justify-center h-full">👤</span>}
                    </div>
                    <div>
                      <span className="text-sm text-tavern-text">{p.username}</span>
                      {p.char_name && <span className="text-xs text-tavern-muted ml-1">({p.char_name})</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Character selection for players */}
          {!game.is_dm && (
            <div className="tavern-card p-4">
              <h2 className="font-serif text-tavern-gold mb-3 text-sm uppercase tracking-widest">Your Character</h2>
              {characters.length === 0 ? (
                <div>
                  <p className="text-tavern-muted text-sm mb-2">No characters yet</p>
                  <Link to="/characters" className="btn-secondary text-xs py-1.5 px-3">Create Character</Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {characters.map((c) => (
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

          {/* Maps (DM only) */}
          {game.is_dm && (
            <div className="tavern-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Map size={16} className="text-tavern-gold" />
                  <h2 className="font-serif text-tavern-gold text-sm uppercase tracking-widest">Battle Maps</h2>
                </div>
                <button onClick={() => setShowMapForm(!showMapForm)} className="text-tavern-gold hover:text-tavern-gold-light transition-colors">
                  <Plus size={16} />
                </button>
              </div>

              {showMapForm && (
                <form onSubmit={uploadMap} className="mb-3 space-y-2 p-3 bg-tavern-bg rounded border border-tavern-border">
                  <input className="tavern-input text-sm py-1.5" placeholder="Map name" value={mapName} onChange={(e) => setMapName(e.target.value)} required />
                  <div>
                    <label className="label block mb-1">Grid Size (px)</label>
                    <input type="number" min={20} max={200} className="tavern-input text-sm py-1.5" value={mapGrid}
                      onChange={(e) => setMapGrid(parseInt(e.target.value))} />
                  </div>
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
                {game.maps.length === 0 ? (
                  <p className="text-tavern-muted text-sm">No maps yet</p>
                ) : (
                  game.maps.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-1.5 rounded hover:bg-tavern-bg/50">
                      <span className="text-sm text-tavern-text">{m.name}</span>
                      <span className="text-xs text-tavern-muted">Grid: {m.grid_size}px</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
