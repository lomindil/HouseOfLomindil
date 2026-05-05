import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useGameStore } from '../store/game';
import { useAuthStore } from '../store/auth';
import { useGameSocket } from '../hooks/useSocket';
import BattleMap from '../components/map/BattleMap';
import ChatPanel from '../components/chat/ChatPanel';
import DiceRoller from '../components/dice/DiceRoller';
import HandoutsPanel from '../components/game/HandoutsPanel';
import { Dices, MessageSquare, Map, Users, FileText, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

type Tab = 'chat' | 'dice' | 'handouts' | 'players';

export default function GameSessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { game, currentMap, setGame, setMap, setMessages, socket } = useGameStore();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mapsList, setMapsList] = useState<any[]>([]);

  useGameSocket(id!);

  useEffect(() => {
    Promise.all([
      api.get(`/games/${id}`),
      api.get(`/games/${id}/messages`),
    ]).then(async ([gameRes, msgsRes]) => {
      const g = gameRes.data;
      setGame(g);

      // Load history
      setMessages(msgsRes.data);

      // Load current map
      if (g.current_map_id) {
        const { data: mapData } = await api.get(`/games/${id}/maps/${g.current_map_id}`);
        setMap(mapData);
      } else if (g.maps?.length > 0) {
        const { data: mapData } = await api.get(`/games/${id}/maps/${g.maps[0].id}`);
        setMap(mapData);
      }

      if (g.maps) setMapsList(g.maps);
    }).catch((err) => {
      console.error('Game session load error:', err);
      toast.error(err?.response?.data?.error || 'Failed to load game');
      navigate(`/games/${id}`);
    }).finally(() => setLoading(false));
  }, [id]);

  async function switchMap(mapId: string) {
    if (!game?.is_dm) return;
    const { data } = await api.get(`/games/${id}/maps/${mapId}`);
    setMap(data);
    socket?.emit('change_map', { mapId });
    await api.put(`/games/${id}`, { current_map_id: mapId });
  }

  if (loading) return (
    <div className="h-screen bg-tavern-bg flex items-center justify-center">
      <p className="text-tavern-muted font-serif animate-pulse">Loading adventure...</p>
    </div>
  );

  const isDM = game?.is_dm || false;

  return (
    <div className="h-screen flex flex-col bg-tavern-bg overflow-hidden">
      {/* Top bar */}
      <header className="h-10 flex items-center justify-between px-3 border-b border-tavern-border bg-tavern-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to={`/games/${id}`} className="text-tavern-muted hover:text-tavern-text transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <span className="font-serif text-tavern-gold text-sm font-semibold">{game?.name}</span>
          {isDM && <span className="text-xs text-tavern-muted bg-tavern-gold/20 px-2 py-0.5 rounded font-serif">DM</span>}
        </div>

        {/* Map switcher (DM) */}
        {isDM && mapsList.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-tavern-muted">Map:</span>
            <select
              className="bg-tavern-bg border border-tavern-border text-tavern-text text-xs px-2 py-1 rounded"
              value={currentMap?.id || ''}
              onChange={(e) => switchMap(e.target.value)}
            >
              {mapsList.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-tavern-muted">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Online
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map area */}
        <div className="flex-1 overflow-hidden">
          {currentMap ? (
            <BattleMap map={currentMap} isDM={isDM} />
          ) : (
            <div className="h-full flex items-center justify-center flex-col gap-4 text-tavern-muted">
              <Map size={48} className="opacity-30" />
              <p className="font-serif text-lg">No map loaded</p>
              {isDM && (
                <Link to={`/games/${id}`} className="btn-secondary text-sm">
                  Add Maps in Game Lobby
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex-shrink-0 w-5 bg-tavern-card border-l border-tavern-border flex items-center justify-center text-tavern-muted hover:text-tavern-text transition-colors"
        >
          {sidebarOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-72 flex flex-col border-l border-tavern-border bg-tavern-card flex-shrink-0">
            {/* Tabs */}
            <div className="flex border-b border-tavern-border">
              {([
                { id: 'chat', icon: <MessageSquare size={14} />, label: 'Chat' },
                { id: 'dice', icon: <Dices size={14} />, label: 'Dice' },
                { id: 'handouts', icon: <FileText size={14} />, label: 'Notes' },
                { id: 'players', icon: <Users size={14} />, label: 'Party' },
              ] as Array<{ id: Tab; icon: React.ReactNode; label: string }>).map(({ id: tid, icon, label }) => (
                <button
                  key={tid}
                  onClick={() => setTab(tid)}
                  className={clsx(
                    'flex-1 flex flex-col items-center py-2 text-xs transition-colors gap-0.5',
                    tab === tid ? 'text-tavern-gold border-b-2 border-tavern-gold' : 'text-tavern-muted hover:text-tavern-text'
                  )}
                >
                  {icon}
                  <span className="hidden sm:block">{label}</span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {tab === 'chat' && <div className="h-full flex flex-col"><ChatPanel /></div>}
              {tab === 'dice' && <div className="p-3 overflow-y-auto h-full"><DiceRoller /></div>}
              {tab === 'handouts' && <div className="h-full"><HandoutsPanel isDM={isDM} /></div>}
              {tab === 'players' && (
                <div className="p-3 space-y-2 overflow-y-auto">
                  <h3 className="label mb-2">Party Members</h3>
                  {/* DM */}
                  <div className="flex items-center gap-2 p-1.5 rounded">
                    <div className="w-7 h-7 rounded-full bg-tavern-gold/20 border border-tavern-gold/50 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs text-tavern-gold font-serif">DM</span>
                    </div>
                    <span className="text-sm text-tavern-text">{game?.dm_username}</span>
                  </div>
                  {/* Players */}
                  {game?.players.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 p-1.5 rounded">
                      <div className="w-7 h-7 rounded-full bg-tavern-bg border border-tavern-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs">👤</span>}
                      </div>
                      <div>
                        <div className="text-sm text-tavern-text">{p.username}</div>
                        {p.char_name && <div className="text-xs text-tavern-muted">{p.char_name}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
