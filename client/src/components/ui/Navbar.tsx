import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { LogOut, User, Sword, Home } from 'lucide-react';
import clsx from 'clsx';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

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
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-tavern-gold/20 border border-tavern-gold/40 flex items-center justify-center">
              <span className="text-xs font-serif text-tavern-gold font-bold">
                {user?.username?.[0]?.toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-tavern-muted hidden sm:block font-body">{user?.username}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-tavern-muted hover:text-red-400 transition-colors p-1.5 rounded hover:bg-red-900/20"
            title="Sign Out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
