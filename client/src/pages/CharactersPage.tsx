import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/ui/Navbar';
import api from '../lib/api';
import { Plus, User, Trash2, Edit3 } from 'lucide-react';

interface Character {
  id: string;
  name: string;
  avatar_url?: string;
  sheet_data: any;
  updated_at: number;
}

export default function CharactersPage() {
  const [chars, setChars] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/characters').then(({ data }) => setChars(data)).finally(() => setLoading(false));
  }, []);

  async function deleteChar(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    await api.delete(`/characters/${id}`);
    setChars((prev) => prev.filter((c) => c.id !== id));
    toast.success(`${name} has left the party`);
  }

  async function createNew() {
    const name = prompt('Character name?');
    if (!name?.trim()) return;
    try {
      const { data } = await api.post('/characters', { name: name.trim() });
      navigate(`/characters/${data.id}`);
    } catch {
      toast.error('Failed to create character');
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="page-title">My Characters</h1>
          <button onClick={createNew} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Character
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-tavern-muted font-serif animate-pulse">Loading...</div>
        ) : chars.length === 0 ? (
          <div className="tavern-card p-12 text-center">
            <div className="text-5xl mb-4">🧙</div>
            <p className="font-serif text-lg text-tavern-muted mb-4">No characters yet</p>
            <button onClick={createNew} className="btn-primary">Create Your Hero</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chars.map((char) => {
              const sheet = char.sheet_data;
              return (
                <div key={char.id} className="tavern-card p-4 hover:border-tavern-gold/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-full bg-tavern-bg border border-tavern-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {char.avatar_url ? (
                        <img src={char.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User size={24} className="text-tavern-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-serif text-tavern-text font-semibold truncate">{char.name}</h2>
                      <p className="text-xs text-tavern-muted mt-0.5">
                        {[sheet.race, sheet.class].filter(Boolean).join(' ') || 'Unknown'}
                        {sheet.level ? ` — Level ${sheet.level}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Link to={`/characters/${char.id}`} className="btn-secondary flex-1 text-center text-xs py-1.5 flex items-center justify-center gap-1">
                      <Edit3 size={12} /> Edit
                    </Link>
                    <button
                      onClick={() => deleteChar(char.id, char.name)}
                      className="p-1.5 text-tavern-muted hover:text-tavern-red-light transition-colors border border-tavern-border rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
