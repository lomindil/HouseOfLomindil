import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { Sword, Shield, Map, Dices, MessageSquare, ScrollText, Users } from 'lucide-react';


const FEATURES = [
  { icon: <ScrollText size={22} />, label: 'D&D 5e Sheets', desc: 'Full character management with stats, spells & inventory' },
  { icon: <Map size={22} />, label: 'Battle Maps', desc: 'Import maps, place tokens, draw, and paint fog of war' },
  { icon: <Dices size={22} />, label: 'Animated Dice', desc: 'Roll any notation — d4 through d100 — seen by all' },
  { icon: <Shield size={22} />, label: 'Token Control', desc: 'Players move their own tokens, DM controls the rest' },
  { icon: <MessageSquare size={22} />, label: 'Live Chat', desc: 'In-session chat with dice results woven in' },
  { icon: <Users size={22} />, label: 'Party Panel', desc: 'See every hero\'s HP, AC, and stats at a glance' },
];

export default function LandingPage() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-tavern-bg flex flex-col overflow-x-hidden">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-tavern-border/60 bg-tavern-card/40 backdrop-blur sticky top-0 z-50">
        <div className="font-serif text-tavern-gold font-bold text-lg tracking-widest flex items-center gap-2">
          <span className="text-xl">⚔</span> HOUSE OF LOMINDIL
        </div>
        <nav className="flex gap-2">
          {user ? (
            <Link to="/dashboard" className="btn-primary text-sm py-1.5 px-5">Enter the Hall</Link>
          ) : (
            <>
              <Link to="/login" className="btn-secondary text-sm py-1.5 px-4">Sign In</Link>
              <Link to="/login" className="btn-primary text-sm py-1.5 px-4">Register</Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-24 text-center relative">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-tavern-gold/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 border border-tavern-gold/30 rounded-full px-4 py-1.5 text-xs text-tavern-gold/80 font-serif tracking-widest mb-8 bg-tavern-gold/5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Virtual Tabletop · D&amp;D 5e
          </div>

          <h1 className="font-serif font-black tracking-widest mb-3 leading-none">
            <span className="block text-4xl md:text-6xl lg:text-7xl text-tavern-text/80">HOUSE OF</span>
            <span className="block text-5xl md:text-7xl lg:text-8xl text-tavern-gold-light" style={{ textShadow: '0 0 60px rgba(184,134,11,0.4)' }}>
              LOMINDIL
            </span>
          </h1>

          <p className="text-lg md:text-xl text-tavern-muted font-serif italic mt-4 mb-3">
            Where legends are forged and dice decide fate.
          </p>
          <p className="text-tavern-muted/70 max-w-lg mx-auto mb-10 font-body text-sm leading-relaxed">
            A private virtual tabletop for your D&amp;D 5e campaigns. Battle maps, animated dice,
            live character sheets, fog of war — all in your browser. No subscriptions.
          </p>

          <div className="flex gap-3 flex-wrap justify-center">
            {user ? (
              <Link to="/dashboard" className="btn-primary text-base py-3 px-10">
                Enter the Hall
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-primary text-base py-3 px-10">
                  Begin Your Journey
                </Link>
                <Link to="/login" className="btn-secondary text-base py-3 px-8">
                  Sign In
                </Link>
              </>
            )}
            <Link to="/campaigns" className="btn-secondary text-base py-3 px-8">
              Browse Campaigns
            </Link>
          </div>
        </div>
      </main>

      {/* Divider */}
      <div className="w-full flex items-center gap-4 px-10 opacity-30">
        <div className="flex-1 h-px bg-tavern-gold/40" />
        <Sword size={14} className="text-tavern-gold" />
        <div className="flex-1 h-px bg-tavern-gold/40" />
      </div>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-serif text-center text-tavern-muted uppercase tracking-[0.3em] text-xs mb-10">
            Everything you need at the table
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.label} className="tavern-card p-5 group hover:border-tavern-gold/40 transition-all hover:-translate-y-0.5">
                <div className="text-tavern-gold mb-3 group-hover:scale-110 transition-transform inline-block">{f.icon}</div>
                <div className="font-serif text-tavern-text font-semibold text-sm mb-1">{f.label}</div>
                <div className="text-xs text-tavern-muted leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-tavern-border/50 py-5 text-center font-body">
        <p className="text-tavern-muted/50 text-xs tracking-widest uppercase font-serif">
          House of Lomindil &mdash; Private Tabletop
        </p>
      </footer>
    </div>
  );
}
