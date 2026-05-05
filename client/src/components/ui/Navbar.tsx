import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { LogOut, User, Sword, Map, Home } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="border-b border-tavern-border bg-tavern-card/50 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/dashboard" className="font-serif text-tavern-gold font-bold text-lg tracking-widest">
          ⚔ THE TAVERN
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link to="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 text-tavern-muted hover:text-tavern-text text-sm font-serif transition-colors">
            <Home size={14} /> Home
          </Link>
          <Link to="/characters" className="flex items-center gap-1.5 px-3 py-1.5 text-tavern-muted hover:text-tavern-text text-sm font-serif transition-colors">
            <User size={14} /> Characters
          </Link>
          <Link to="/games" className="flex items-center gap-1.5 px-3 py-1.5 text-tavern-muted hover:text-tavern-text text-sm font-serif transition-colors">
            <Sword size={14} /> Games
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-sm text-tavern-muted hidden sm:block font-body">{user?.username}</span>
          <button onClick={handleLogout} className="text-tavern-muted hover:text-tavern-red-light transition-colors p-1" title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
