import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';

export default function JoinGamePage() {
  const { code } = useParams<{ code: string }>();
  const { user, loading } = useAuthStore();
  const navigate = useNavigate();
  const [game, setGame] = useState<any>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!code) return;
    api.get(`/games/join/${code}`).then(({ data }) => setGame(data))
      .catch(() => setGame(null)).finally(() => setFetching(false));
  }, [code]);

  async function join() {
    try {
      const { data } = await api.post('/games/join', { code });
      navigate(`/games/${data.game_id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to join');
    }
  }

  if (loading || fetching) return (
    <div className="min-h-screen bg-tavern-bg flex items-center justify-center">
      <p className="text-tavern-muted font-serif animate-pulse">Loading...</p>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-tavern-bg flex items-center justify-center px-4">
      <div className="tavern-card p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">🏰</div>
        <h2 className="font-serif text-xl text-tavern-gold mb-2">Sign in to Join</h2>
        {game && <p className="text-tavern-muted text-sm mb-4">You've been invited to: <strong>{game.name}</strong></p>}
        <Link to={`/login?redirect=/join/${code}`} className="btn-primary block">Sign In / Register</Link>
      </div>
    </div>
  );

  if (!game) return (
    <div className="min-h-screen bg-tavern-bg flex items-center justify-center px-4">
      <div className="tavern-card p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">❌</div>
        <h2 className="font-serif text-xl text-red-400 mb-4">Game Not Found</h2>
        <p className="text-tavern-muted text-sm mb-4">The code <strong>{code}</strong> doesn't match any game.</p>
        <Link to="/dashboard" className="btn-primary">Go Home</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-tavern-bg flex items-center justify-center px-4">
      <div className="tavern-card p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">🗺️</div>
        <h2 className="font-serif text-2xl text-tavern-gold mb-1">{game.name}</h2>
        <p className="text-tavern-muted text-sm mb-1">DM: {game.dm_username}</p>
        <p className="text-tavern-muted text-sm mb-6">{game.players?.length || 0} players</p>
        <button onClick={join} className="btn-primary w-full text-lg py-3">Join Adventure</button>
        <Link to="/dashboard" className="block mt-3 text-tavern-muted text-sm hover:text-tavern-text transition-colors">Maybe later</Link>
      </div>
    </div>
  );
}
