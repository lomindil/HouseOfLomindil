import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../store/auth';
import Navbar from '../components/ui/Navbar';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Sword, Users, ChevronRight, X, Scroll, Clock, CheckCircle2, Zap, Shield, Share2 } from 'lucide-react';

type CampaignStatus = 'not_started' | 'in_progress' | 'live' | 'finished';

interface Campaign {
  id: string;
  name: string;
  description: string;
  dm_username: string;
  status: CampaignStatus;
  game_status: string;
  player_count: number;
  ended_sessions: number;
  completed_encounters: number;
  total_encounters: number;
  army_count: number;
  created_at: number;
}

interface CampaignDetail extends Campaign {
  join_code?: string;
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const cfg = {
    live:        { label: '⚡ Session Live', cls: 'bg-green-900/60 text-green-300 border-green-700/50 animate-pulse' },
    in_progress: { label: '⚔ In Progress',  cls: 'bg-amber-900/50 text-amber-300 border-amber-700/50' },
    not_started: { label: '📜 Not Started',  cls: 'bg-tavern-bg text-tavern-muted border-tavern-border' },
    finished:    { label: '✦ Finished',      cls: 'bg-purple-900/40 text-purple-300 border-purple-700/50' },
  }[status];
  return (
    <span className={clsx('text-[11px] font-serif tracking-wide px-2.5 py-0.5 rounded-full border', cfg.cls)}>
      {cfg.label}
    </span>
  );
}

function ArmySignupForm({ campaignId, onSuccess }: { campaignId: string; onSuccess: () => void }) {
  const { user } = useAuthStore();
  const [name, setName] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/campaigns/${campaignId}/army`, { display_name: name, email, phone, message });
      toast.success("You've joined the Campaign Army! The DM will be in touch.");
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to sign up');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label block mb-1 text-xs">Name *</label>
          <input className="tavern-input text-sm" value={name} onChange={e => setName(e.target.value)} required
            placeholder="Your name" disabled={!!user} />
        </div>
        <div>
          <label className="label block mb-1 text-xs">Email *</label>
          <input type="email" className="tavern-input text-sm" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="your@email.com" disabled={!!user} />
        </div>
      </div>
      <div>
        <label className="label block mb-1 text-xs">Phone <span className="text-tavern-muted/60">(optional)</span></label>
        <input type="tel" className="tavern-input text-sm" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="+91 98765 43210" />
      </div>
      <div>
        <label className="label block mb-1 text-xs">Message <span className="text-tavern-muted/60">(optional)</span></label>
        <textarea className="tavern-input text-sm resize-none h-16" value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Your experience level, availability, preferred role..." />
      </div>
      <button type="submit" disabled={submitting} className="btn-primary w-full text-sm">
        {submitting ? 'Enrolling...' : '⚔ Join Campaign Army'}
      </button>
      {!user && (
        <p className="text-xs text-tavern-muted/70 text-center">
          <Link to="/login" className="text-tavern-gold hover:underline">Sign in</Link> to pre-fill your details.
        </p>
      )}
    </form>
  );
}

function CampaignModal({ campaign, onClose }: { campaign: CampaignDetail; onClose: () => void }) {
  const { user } = useAuthStore();
  const [armyList, setArmyList] = useState<any[]>([]);
  const [showArmy, setShowArmy] = useState(false);
  const [armySigned, setArmySigned] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (showArmy && user) {
      api.get(`/campaigns/${campaign.id}/army`).then(r => setArmyList(r.data)).catch(() => {});
    }
  }, [showArmy, user, campaign.id]);

  // Sync URL param when modal opens
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('c', campaign.id);
    window.history.replaceState({}, '', url.toString());
    return () => {
      const url2 = new URL(window.location.href);
      url2.searchParams.delete('c');
      window.history.replaceState({}, '', url2.toString());
    };
  }, [campaign.id]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    try {
      await api.post('/games/join', { code: joinCode.toUpperCase() });
      toast.success('Joined! Head to your Games page.');
      setShowJoinForm(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to join');
    } finally {
      setJoining(false);
    }
  }

  function shareLink() {
    const url = `${window.location.origin}/campaigns?c=${campaign.id}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied to clipboard!')).catch(() => toast.error('Could not copy link'));
  }

  const statusInfo: Record<CampaignStatus, string> = {
    live:        'A session is currently running.',
    in_progress: `${campaign.ended_sessions} session${campaign.ended_sessions !== 1 ? 's' : ''} completed · ${campaign.completed_encounters} encounter${campaign.completed_encounters !== 1 ? 's' : ''} cleared`,
    not_started: 'Campaign has not yet begun.',
    finished:    `Campaign concluded after ${campaign.ended_sessions} session${campaign.ended_sessions !== 1 ? 's' : ''}.`,
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-tavern-card border border-tavern-border rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-tavern-card border-b border-tavern-border px-6 py-4 flex items-start justify-between rounded-t-xl z-10">
          <div>
            <h2 className="font-serif text-tavern-gold text-xl font-bold tracking-wide">{campaign.name}</h2>
            <p className="text-xs text-tavern-muted mt-0.5">DM: <span className="text-tavern-text">{campaign.dm_username}</span></p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={shareLink} title="Copy shareable link"
              className="text-tavern-muted hover:text-tavern-gold transition-colors">
              <Share2 size={15} />
            </button>
            <button onClick={onClose} className="text-tavern-muted hover:text-tavern-text">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Status + stats */}
          <div className="flex flex-wrap gap-2 items-center">
            <StatusBadge status={campaign.status} />
            <span className="text-xs text-tavern-muted flex items-center gap-1"><Users size={11} /> {campaign.player_count} player{campaign.player_count !== 1 ? 's' : ''}</span>
            <span className="text-xs text-tavern-muted flex items-center gap-1"><Shield size={11} /> {campaign.army_count} in army</span>
          </div>

          <p className="text-sm text-tavern-muted italic border-l-2 border-tavern-gold/30 pl-3">
            {statusInfo[campaign.status]}
          </p>

          {campaign.description && (
            <div>
              <p className="text-xs text-tavern-muted uppercase tracking-widest font-serif mb-1.5">About</p>
              <p className="text-sm text-tavern-text/90 leading-relaxed">{campaign.description}</p>
            </div>
          )}

          {/* Join with code — logged-in only */}
          {user && !showJoinForm && (
            <button onClick={() => setShowJoinForm(true)}
              className="w-full text-sm border border-tavern-gold/40 text-tavern-gold hover:bg-tavern-gold/10 rounded-lg py-2 font-serif tracking-wide transition-colors">
              Enter Join Code
            </button>
          )}
          {!user && (
            <p className="text-xs text-tavern-muted/70 text-center border border-tavern-border rounded-lg py-2">
              <Link to="/login" className="text-tavern-gold hover:underline">Sign in</Link> to join this campaign with a code from your DM.
            </p>
          )}
          {showJoinForm && (
            <form onSubmit={handleJoin} className="flex gap-2">
              <input className="tavern-input flex-1 text-sm uppercase tracking-widest" placeholder="XXXXXX"
                value={joinCode} onChange={e => setJoinCode(e.target.value)} maxLength={6} required />
              <button type="submit" disabled={joining} className="btn-primary text-sm px-4">{joining ? '...' : 'Join'}</button>
              <button type="button" onClick={() => setShowJoinForm(false)} className="btn-secondary text-sm px-3">✕</button>
            </form>
          )}

          {/* Campaign Army */}
          <div className="border-t border-tavern-border/60 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-serif text-tavern-text text-sm font-semibold tracking-wide">Campaign Army</h3>
                <p className="text-xs text-tavern-muted/70 mt-0.5">
                  Register your interest. The DM will notify you when a session starts or a spot opens.
                </p>
              </div>
              {user && (
                <button onClick={() => setShowArmy(v => !v)}
                  className="text-xs text-tavern-muted hover:text-tavern-text border border-tavern-border rounded px-2 py-1 transition-colors">
                  {showArmy ? 'Hide' : `View (${campaign.army_count})`}
                </button>
              )}
            </div>

            {showArmy && (
              <div className="mb-3 max-h-32 overflow-y-auto space-y-1 bg-tavern-bg/60 rounded-lg p-2">
                {armyList.length === 0
                  ? <p className="text-xs text-tavern-muted text-center py-2">No one enrolled yet.</p>
                  : armyList.map((a, i) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <span className="text-tavern-border/50 font-mono w-4 text-right">{i + 1}.</span>
                      <span className="text-tavern-text">{a.display_name || 'Guest'}</span>
                      {a.email && <span className="text-tavern-muted/60 truncate">{a.email}</span>}
                    </div>
                  ))
                }
              </div>
            )}

            {!armySigned ? (
              <ArmySignupForm campaignId={campaign.id} onSuccess={() => setArmySigned(true)} />
            ) : (
              <div className="text-center py-4 border border-green-800/40 rounded-lg bg-green-900/20">
                <CheckCircle2 size={20} className="text-green-400 mx-auto mb-1" />
                <p className="text-sm text-green-300 font-serif">You're in the Campaign Army!</p>
                <p className="text-xs text-tavern-muted mt-1">The DM will reach out when it's time.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CampaignDetail | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CampaignStatus | 'all'>('all');

  useEffect(() => {
    api.get('/campaigns').then(async r => {
      const list: Campaign[] = r.data;
      setCampaigns(list);

      // Auto-open campaign from ?c= param
      const cId = searchParams.get('c');
      if (cId) {
        const match = list.find(c => c.id === cId);
        if (match) {
          try {
            const { data } = await api.get(`/campaigns/${cId}`);
            setSelected(data);
          } catch {
            setSelected(match as CampaignDetail);
          }
        }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function openDetail(c: Campaign) {
    try {
      const { data } = await api.get(`/campaigns/${c.id}`);
      setSelected(data);
    } catch {
      setSelected(c as CampaignDetail);
    }
  }

  function shareCard(e: React.MouseEvent, c: Campaign) {
    e.stopPropagation();
    const url = `${window.location.origin}/campaigns?c=${c.id}`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Campaign link copied!'))
      .catch(() => toast.error('Could not copy link'));
  }

  const filtered = campaigns.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.dm_username.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || c.status === filter;
    return matchSearch && matchFilter;
  });

  const statusCounts = campaigns.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-tavern-bg flex flex-col overflow-x-hidden">
      {/* Logged-in users get the full Navbar; guests get a minimal header */}
      {user ? (
        <Navbar />
      ) : (
        <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-tavern-border/60 bg-tavern-card/40 backdrop-blur sticky top-0 z-40">
          <Link to="/" className="font-serif text-tavern-gold font-bold tracking-widest flex items-center gap-2 text-sm">
            <span className="text-base">⚔</span> HOUSE OF LOMINDIL
          </Link>
          <nav className="flex gap-2">
            <Link to="/login" className="btn-secondary text-sm py-1.5 px-4">Sign In</Link>
            <Link to="/login" className="btn-primary text-sm py-1.5 px-4">Register</Link>
          </nav>
        </header>
      )}

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-10">
        {/* Page header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 border border-tavern-gold/30 rounded-full px-4 py-1.5 text-xs text-tavern-gold/80 font-serif tracking-widest mb-5 bg-tavern-gold/5">
            <Scroll size={11} /> Campaign Registry
          </div>
          <h1 className="font-serif font-black tracking-widest mb-2">
            <span className="text-3xl md:text-4xl text-tavern-gold" style={{ textShadow: '0 0 40px rgba(184,134,11,0.3)' }}>
              OPEN CAMPAIGNS
            </span>
          </h1>
          <p className="text-tavern-muted text-sm max-w-lg mx-auto">
            Campaigns seeking adventurers. Register your interest — the DM will reach out when your seat is ready.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-7">
          <input
            className="tavern-input flex-1 text-sm"
            placeholder="Search by name or DM..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'live', 'in_progress', 'not_started', 'finished'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={clsx('px-3 py-1.5 rounded border text-xs font-serif transition-colors',
                  filter === f ? 'border-tavern-gold text-tavern-gold bg-tavern-gold/10' : 'border-tavern-border text-tavern-muted hover:text-tavern-text')}>
                {f === 'all' ? `All (${campaigns.length})` :
                 f === 'live' ? `Live (${statusCounts.live || 0})` :
                 f === 'in_progress' ? `In Progress (${statusCounts.in_progress || 0})` :
                 f === 'not_started' ? `Not Started (${statusCounts.not_started || 0})` :
                 `Finished (${statusCounts.finished || 0})`}
              </button>
            ))}
          </div>
        </div>

        {/* Campaign grid */}
        {loading ? (
          <div className="text-center py-20 text-tavern-muted font-serif animate-pulse">Consulting the registry...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-tavern-muted">
            <Scroll size={40} className="mx-auto opacity-20 mb-3" />
            <p className="font-serif">No campaigns found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => (
              <div key={c.id}
                className="tavern-card p-5 hover:border-tavern-gold/40 hover:-translate-y-0.5 transition-all cursor-pointer group flex flex-col gap-3"
                onClick={() => openDetail(c)}>
                {/* Status row */}
                <div className="flex items-start justify-between gap-2">
                  <StatusBadge status={c.status} />
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {c.status === 'live' && <Zap size={13} className="text-green-400" />}
                    <button
                      onClick={e => shareCard(e, c)}
                      title="Copy shareable link"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-tavern-muted hover:text-tavern-gold p-0.5">
                      <Share2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <h3 className="font-serif text-tavern-gold font-bold text-base leading-snug group-hover:text-tavern-gold-light transition-colors">
                    {c.name}
                  </h3>
                  <p className="text-xs text-tavern-muted mt-0.5">DM: {c.dm_username}</p>
                </div>

                {c.description && (
                  <p className="text-xs text-tavern-muted/80 leading-relaxed line-clamp-2">{c.description}</p>
                )}

                {/* Meta row */}
                <div className="flex items-center gap-3 text-xs text-tavern-muted mt-auto pt-1 border-t border-tavern-border/50">
                  <span className="flex items-center gap-1"><Users size={10} /> {c.player_count}</span>
                  {c.status === 'in_progress' && c.completed_encounters > 0 && (
                    <span className="flex items-center gap-1"><CheckCircle2 size={10} /> {c.completed_encounters} encounter{c.completed_encounters !== 1 ? 's' : ''}</span>
                  )}
                  {c.army_count > 0 && (
                    <span className="flex items-center gap-1"><Shield size={10} /> {c.army_count} in army</span>
                  )}
                  <span className="ml-auto flex items-center gap-0.5 text-tavern-gold/60 group-hover:text-tavern-gold transition-colors">
                    Details <ChevronRight size={11} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-16 text-center border-t border-tavern-border/40 pt-10">
          <p className="text-tavern-muted/60 text-sm font-serif">Want to run your own campaign?</p>
          <Link to={user ? '/games' : '/login'} className="btn-primary text-sm mt-3 inline-flex items-center gap-2">
            <Sword size={14} /> {user ? 'Manage Your Games' : 'Sign Up as DM'}
          </Link>
        </div>
      </main>

      <footer className="border-t border-tavern-border/50 py-5 text-center">
        <p className="text-tavern-muted/50 text-xs tracking-widest uppercase font-serif">
          House of Lomindil &mdash; Private Tabletop
        </p>
      </footer>

      {selected && <CampaignModal campaign={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
