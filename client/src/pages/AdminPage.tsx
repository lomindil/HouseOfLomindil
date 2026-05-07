import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import Navbar from '../components/ui/Navbar';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { ShieldCheck, CheckCircle, Trash2, RefreshCw, Clock, Users } from 'lucide-react';

interface GameRow {
  id: string;
  name: string;
  description: string;
  status: string;
  approved: number;
  dm_username: string;
  dm_email?: string;
  player_count: number;
  ended_sessions?: number;
  created_at: number;
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const [pending, setPending] = useState<GameRow[]>([]);
  const [all, setAll] = useState<GameRow[]>([]);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  if (user?.username !== 'lomindil') return <Navigate to="/dashboard" replace />;

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([
        api.get('/admin/pending'),
        api.get('/admin/games'),
      ]);
      setPending(p.data);
      setAll(a.data);
    } catch {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: string) {
    setActionId(id);
    try {
      await api.post(`/admin/games/${id}/approve`);
      toast.success('Campaign approved and now publicly visible.');
      await fetchData();
    } catch {
      toast.error('Failed to approve');
    } finally {
      setActionId(null);
    }
  }

  async function reject(id: string, name: string) {
    if (!confirm(`Delete campaign "${name}"? This is permanent.`)) return;
    setActionId(id);
    try {
      await api.delete(`/admin/games/${id}`);
      toast.success('Campaign removed.');
      await fetchData();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setActionId(null);
    }
  }

  const displayed = tab === 'pending' ? pending : all;

  return (
    <div className="min-h-screen bg-tavern-bg">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-7">
          <ShieldCheck size={20} className="text-tavern-gold" />
          <div>
            <h1 className="font-serif text-tavern-gold text-xl font-bold tracking-wide">Hall Administrator</h1>
            <p className="text-xs text-tavern-muted mt-0.5">Review and approve campaigns submitted by DMs</p>
          </div>
          <button onClick={fetchData} disabled={loading}
            className="ml-auto p-2 rounded border border-tavern-border text-tavern-muted hover:text-tavern-text transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-tavern-border">
          <button onClick={() => setTab('pending')}
            className={clsx('px-4 py-2 text-sm font-serif transition-colors border-b-2 -mb-px',
              tab === 'pending' ? 'border-tavern-gold text-tavern-gold' : 'border-transparent text-tavern-muted hover:text-tavern-text')}>
            Pending Approval
            {pending.length > 0 && (
              <span className="ml-2 text-xs bg-amber-900/60 text-amber-300 border border-amber-700/50 rounded-full px-1.5 py-0.5">
                {pending.length}
              </span>
            )}
          </button>
          <button onClick={() => setTab('all')}
            className={clsx('px-4 py-2 text-sm font-serif transition-colors border-b-2 -mb-px',
              tab === 'all' ? 'border-tavern-gold text-tavern-gold' : 'border-transparent text-tavern-muted hover:text-tavern-text')}>
            All Campaigns ({all.length})
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-tavern-muted text-sm animate-pulse font-serif">Loading...</p>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-tavern-muted">
            <CheckCircle size={32} className="mx-auto opacity-20 mb-3" />
            <p className="font-serif">{tab === 'pending' ? 'No campaigns awaiting approval.' : 'No campaigns yet.'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(g => (
              <div key={g.id} className={clsx('tavern-card p-4 flex flex-col sm:flex-row sm:items-start gap-4',
                g.approved === 0 && 'border-amber-800/40')}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-serif text-tavern-text font-semibold">{g.name}</h3>
                    <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border font-serif',
                      g.approved
                        ? 'bg-green-900/30 text-green-400 border-green-800/50'
                        : 'bg-amber-900/30 text-amber-400 border-amber-800/50')}>
                      {g.approved ? '✓ Approved' : '⏳ Pending'}
                    </span>
                    <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border',
                      g.status === 'active'
                        ? 'bg-green-900/40 text-green-300 border-green-700/50 animate-pulse'
                        : 'bg-tavern-bg text-tavern-muted border-tavern-border')}>
                      {g.status === 'active' ? '⚡ Live' : g.status}
                    </span>
                  </div>
                  <p className="text-xs text-tavern-muted mt-1">
                    DM: <span className="text-tavern-text">{g.dm_username}</span>
                    {g.dm_email && <span className="text-tavern-muted/60 ml-1">({g.dm_email})</span>}
                  </p>
                  {g.description && (
                    <p className="text-xs text-tavern-muted/70 mt-1.5 line-clamp-2">{g.description}</p>
                  )}
                  <div className="flex gap-3 mt-2 text-xs text-tavern-muted">
                    <span className="flex items-center gap-1"><Users size={10} /> {g.player_count} players</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {new Date(g.created_at * 1000).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex gap-2 sm:flex-col sm:items-end flex-shrink-0">
                  {g.approved === 0 && (
                    <button
                      onClick={() => approve(g.id)}
                      disabled={actionId === g.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-green-700/50 text-green-400 hover:bg-green-900/20 text-xs transition-colors disabled:opacity-50">
                      <CheckCircle size={12} /> Approve
                    </button>
                  )}
                  <button
                    onClick={() => reject(g.id, g.name)}
                    disabled={actionId === g.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-red-900/50 text-red-400/70 hover:text-red-400 hover:bg-red-900/10 text-xs transition-colors disabled:opacity-50">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
