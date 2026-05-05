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
import PartyPanel from '../components/game/PartyPanel';
import EncounterPanel from '../components/game/EncounterPanel';
import { Dices, MessageSquare, Map, Users, FileText, ArrowLeft, ChevronLeft, ChevronRight, Swords } from 'lucide-react';
import clsx from 'clsx';

type Tab = 'chat' | 'dice' | 'handouts' | 'players' | 'encounters';

export default function GameSessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { game, currentMap, setGame, setMap, setMessages, socket } = useGameStore();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mapsList, setMapsList] = useState<any[]>([]);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endNotes, setEndNotes] = useState('');
  const [endingSession, setEndingSession] = useState(false);

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

  async function handleEndSession() {
    if (!id) return;
    setEndingSession(true);
    try {
      await api.post(`/games/${id}/end`, { footnotes: endNotes });
      toast.success('Session ended');
      navigate(`/games/${id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to end session');
    } finally {
      setEndingSession(false);
    }
  }

  async function switchMap(mapId: string) {
    if (!game?.is_dm) return;
    const { data } = await api.get(`/games/${id}/maps/${mapId}`);
    setMap(data);
    socket?.emit('change_map', { mapId });
    await api.put(`/games/${id}`, { current_map_id: mapId });
  }

  if (loading) return (
    <div className="h-screen bg-tavern-bg flex items-center justify-center">
      <p className="text-tavern-muted font-serif animate-pulse">Entering the Hall...</p>
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

        <div className="flex items-center gap-3">
          {isDM && (
            <button
              onClick={() => setShowEndDialog(true)}
              className="text-xs text-red-400 hover:text-red-300 border border-red-900 hover:border-red-700 px-2 py-1 rounded transition-colors"
            >
              End Session
            </button>
          )}
          <div className="flex items-center gap-2 text-xs text-tavern-muted">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Online
          </div>
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
                ...(isDM ? [{ id: 'encounters' as Tab, icon: <Swords size={14} />, label: 'Combat' }] : []),
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
                <div className="h-full overflow-hidden">
                  <PartyPanel gameId={id!} isDM={isDM} />
                </div>
              )}
              {tab === 'encounters' && isDM && (
                <div className="h-full overflow-y-auto">
                  <EncounterPanel gameId={id!} isDM={isDM} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* End Session dialog */}
      {showEndDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-tavern-card border border-tavern-border rounded-lg p-6 w-full max-w-md">
            <h2 className="font-serif text-tavern-gold text-lg mb-1">End Session</h2>
            <p className="text-tavern-muted text-sm mb-4">Optionally write footnotes for this session before closing.</p>
            <textarea
              className="w-full bg-tavern-bg border border-tavern-border rounded p-3 text-tavern-text text-sm resize-none h-32 mb-4 focus:outline-none focus:border-tavern-gold"
              placeholder="Session notes, key moments, cliffhangers..."
              value={endNotes}
              onChange={(e) => setEndNotes(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowEndDialog(false)}
                className="btn-secondary text-sm"
                disabled={endingSession}
              >
                Cancel
              </button>
              <button
                onClick={handleEndSession}
                disabled={endingSession}
                className="px-4 py-2 text-sm rounded bg-red-900 hover:bg-red-800 text-red-100 border border-red-700 transition-colors disabled:opacity-50"
              >
                {endingSession ? 'Ending...' : 'End Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
