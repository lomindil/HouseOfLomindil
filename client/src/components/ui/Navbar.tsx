import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { LogOut, User, Sword, Home, KeyRound, X, Map, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) { toast.error('New passwords do not match'); return; }
    if (next.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { current_password: current, new_password: next });
      toast.success('Password changed successfully');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-tavern-card border border-tavern-border rounded-lg w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-tavern-gold text-lg">Change Password</h2>
          <button onClick={onClose} className="text-tavern-muted hover:text-tavern-text"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label block mb-1">Current Password</label>
            <input type="password" className="tavern-input" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label block mb-1">New Password</label>
            <input type="password" className="tavern-input" value={next} onChange={(e) => setNext(e.target.value)} required />
          </div>
          <div>
            <label className="label block mb-1">Confirm New Password</label>
            <input type="password" className="tavern-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-sm" disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary text-sm" disabled={saving}>
              {saving ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  function handleLogout() {
    logout();
    navigate('/');
  }

  const navLink = (to: string, icon: React.ReactNode, label: string) => {
    const active = pathname === to || pathname.startsWith(to + '/');
    return (
      <Link
        to={to}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-serif transition-colors',
          active
            ? 'text-tavern-gold bg-tavern-gold/10 border border-tavern-gold/20'
            : 'text-tavern-muted hover:text-tavern-text hover:bg-tavern-border/20'
        )}
      >
        {icon} {label}
      </Link>
    );
  };

  return (
    <>
      <header className="border-b border-tavern-border bg-tavern-card/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <Link to="/dashboard" className="font-serif text-tavern-gold font-bold tracking-widest flex items-center gap-2 shrink-0">
            <span className="text-lg">⚔</span>
            <span className="hidden sm:block text-sm">HOUSE OF LOMINDIL</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLink('/dashboard', <Home size={13} />, 'Hall')}
            {navLink('/characters', <User size={13} />, 'Characters')}
            {navLink('/games', <Sword size={13} />, 'Games')}
            {navLink('/campaigns', <Map size={13} />, 'Campaigns')}
            {user?.username === 'lomindil' && navLink('/admin', <ShieldCheck size={13} />, 'Admin')}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-6 h-6 rounded-full bg-tavern-gold/20 border border-tavern-gold/40 flex items-center justify-center">
                  <span className="text-xs font-serif text-tavern-gold font-bold">
                    {user?.username?.[0]?.toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-tavern-muted hidden sm:block font-body">{user?.username}</span>
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-44 bg-tavern-card border border-tavern-border rounded-lg shadow-xl z-50 overflow-hidden">
                    <button
                      onClick={() => { setShowUserMenu(false); setShowChangePassword(true); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-tavern-muted hover:text-tavern-text hover:bg-tavern-bg transition-colors"
                    >
                      <KeyRound size={13} /> Change Password
                    </button>
                    <div className="border-t border-tavern-border" />
                    <button
                      onClick={() => { setShowUserMenu(false); handleLogout(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-900/10 transition-colors"
                    >
                      <LogOut size={13} /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </>
  );
}
