import { Link } from 'react-router-dom';
import Navbar from '../components/ui/Navbar';
import { useAuthStore } from '../store/auth';
import { User, Sword, PlusCircle, LogIn } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="text-5xl mb-4">🏰</div>
          <h1 className="page-title">Welcome back, {user?.username}</h1>
          <p className="text-tavern-muted mt-2 font-body">What shall we do today, adventurer?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link to="/characters" className="tavern-card p-6 hover:border-tavern-gold/60 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-tavern-gold group-hover:scale-110 transition-transform">
                <User size={28} />
              </div>
              <h2 className="font-serif text-xl text-tavern-text">My Characters</h2>
            </div>
            <p className="text-tavern-muted text-sm">Create and manage your D&D 5e characters. Build your hero's story.</p>
          </Link>

          <Link to="/games" className="tavern-card p-6 hover:border-tavern-gold/60 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-tavern-gold group-hover:scale-110 transition-transform">
                <Sword size={28} />
              </div>
              <h2 className="font-serif text-xl text-tavern-text">My Games</h2>
            </div>
            <p className="text-tavern-muted text-sm">Create a new campaign as DM, or manage your existing games.</p>
          </Link>

          <Link to="/games?create=1" className="tavern-card p-6 hover:border-tavern-gold/60 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-tavern-gold group-hover:scale-110 transition-transform">
                <PlusCircle size={28} />
              </div>
              <h2 className="font-serif text-xl text-tavern-text">Create Campaign</h2>
            </div>
            <p className="text-tavern-muted text-sm">Start a new adventure as Dungeon Master.</p>
          </Link>

          <Link to="/games?join=1" className="tavern-card p-6 hover:border-tavern-gold/60 transition-colors group">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-tavern-gold group-hover:scale-110 transition-transform">
                <LogIn size={28} />
              </div>
              <h2 className="font-serif text-xl text-tavern-text">Join Game</h2>
            </div>
            <p className="text-tavern-muted text-sm">Enter a join code to join your party's adventure.</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
