import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { Sword, Shield, Map, Dices, MessageSquare } from 'lucide-react';

export default function LandingPage() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-tavern-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-tavern-border">
        <div className="font-serif text-tavern-gold text-2xl font-bold tracking-widest">⚔ THE TAVERN</div>
        <nav className="flex gap-4">
          {user ? (
            <Link to="/dashboard" className="btn-primary text-sm py-1.5 px-4">Enter</Link>
          ) : (
            <>
              <Link to="/login" className="btn-secondary text-sm py-1.5 px-4">Sign In</Link>
              <Link to="/login?signup=1" className="btn-primary text-sm py-1.5 px-4">Join</Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="text-8xl mb-6">⚔</div>
        <h1 className="font-serif text-5xl md:text-7xl font-black text-tavern-gold-light tracking-widest mb-4">
          THE TAVERN
        </h1>
        <p className="text-xl text-tavern-muted font-serif italic mb-2">Virtual Tabletop for D&D 5e</p>
        <p className="text-tavern-muted max-w-md mb-10 font-body">
          Roll dice, move tokens, explore maps, and forge legends — all from your browser.
          No subscriptions. No installs.
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          {user ? (
            <Link to="/dashboard" className="btn-primary text-lg py-3 px-8">Enter the Tavern</Link>
          ) : (
            <>
              <Link to="/login?signup=1" className="btn-primary text-lg py-3 px-8">Start Your Journey</Link>
              <Link to="/login" className="btn-secondary text-lg py-3 px-8">Sign In</Link>
            </>
          )}
        </div>
      </main>

      {/* Features */}
      <section className="border-t border-tavern-border py-16 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {[
            { icon: <Sword size={28} />, label: 'D&D 5e Sheets', desc: 'Full character sheets' },
            { icon: <Map size={28} />, label: 'Battle Maps', desc: 'Grid & fog of war' },
            { icon: <Dices size={28} />, label: 'Dice Roller', desc: 'Animated rolls' },
            { icon: <Shield size={28} />, label: 'Tokens', desc: 'Move your hero' },
            { icon: <MessageSquare size={28} />, label: 'Chat & Handouts', desc: 'Share info' },
          ].map((f) => (
            <div key={f.label} className="tavern-card p-4 text-center">
              <div className="text-tavern-gold flex justify-center mb-2">{f.icon}</div>
              <div className="font-serif text-tavern-text font-semibold text-sm">{f.label}</div>
              <div className="text-xs text-tavern-muted mt-1">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-tavern-border py-4 text-center text-tavern-muted text-xs font-body">
        The Tavern VTT — Made for adventurers, by adventurers
      </footer>
    </div>
  );
}
