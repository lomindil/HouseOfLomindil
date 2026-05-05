import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/ui/Navbar';
import { useAuthStore } from '../store/auth';
import api from '../lib/api';
import { User, Sword, PlusCircle, LogIn, Zap } from 'lucide-react';

interface ActiveGame {
  id: string;
  name: string;
  description: string;
  dm_username: string;
  player_count: number;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/games/discover').then(({ data }) => setActiveGames(data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-10">

        {/* Welcome */}
        <div className="mb-10">
          <p className="text-tavern-muted/60 font-serif text-xs uppercase tracking-widest mb-1">Welcome back</p>
          <h1 className="font-serif text-3xl font-bold text-tavern-gold-light tracking-wide">
            {user?.username}
          </h1>
        </div>

        {/* Live sessions banner */}
        {activeGames.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <h2 className="font-serif text-sm uppercase tracking-widest text-green-400">Live Sessions</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeGames.map((g) => (
                <div key={g.id} className="tavern-card p-4 border-green-900/40 hover:border-green-600/40 transition-all group">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-serif text-tavern-text font-semibold text-sm">{g.name}</div>
                      <div className="text-xs text-tavern-muted mt-0.5">DM: {g.dm_username} · {g.player_count} players</div>
                    </div>
                    <Zap size={14} className="text-green-400 shrink-0 mt-0.5" />
                  </div>
                  {g.description && (
                    <p className="text-xs text-tavern-muted/70 mb-3 line-clamp-1">{g.description}</p>
                  )}
                  {joiningId === g.id ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        try {
                          const { data } = await api.post('/games/join', { code: joinCode.trim() });
                          window.location.href = `/games/${data.game_id}`;
                        } catch {
                          setJoiningId(null);
                        }
                      }}
                      className="flex gap-1.5"
                    >
                      <input
                        autoFocus
                        className="tavern-input py-1 text-xs flex-1"
                        placeholder="Join code"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                        maxLength={6}
                      />
                      <button type="submit" className="btn-primary text-xs py-1 px-3">Join</button>
                      <button type="button" onClick={() => setJoiningId(null)} className="btn-secondary text-xs py-1 px-2">✕</button>
                    </form>
                  ) : (
                    <button
                      onClick={() => { setJoiningId(g.id); setJoinCode(''); }}
                      className="w-full text-xs border border-green-900/60 text-green-400/80 hover:bg-green-900/20 hover:text-green-300 rounded py-1.5 font-serif transition-colors"
                    >
                      Enter with Code
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <h2 className="font-serif text-xs uppercase tracking-widest text-tavern-muted/60 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              to: '/characters',
              icon: <User size={24} />,
              label: 'Characters',
              desc: 'Manage your heroes',
            },
            {
              to: '/games',
              icon: <Sword size={24} />,
              label: 'My Games',
              desc: 'View all campaigns',
            },
            {
              to: '/games?create=1',
              icon: <PlusCircle size={24} />,
              label: 'New Campaign',
              desc: 'Start as Dungeon Master',
            },
            {
              to: '/games?join=1',
              icon: <LogIn size={24} />,
              label: 'Join Game',
              desc: 'Enter a join code',
            },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="tavern-card p-5 hover:border-tavern-gold/50 transition-all group hover:-translate-y-0.5"
            >
              <div className="text-tavern-gold mb-3 group-hover:scale-110 transition-transform inline-block">
                {item.icon}
              </div>
              <div className="font-serif text-tavern-text font-semibold text-sm">{item.label}</div>
              <div className="text-xs text-tavern-muted mt-1">{item.desc}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
