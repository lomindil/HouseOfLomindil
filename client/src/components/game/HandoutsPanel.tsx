import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useGameStore } from '../../store/game';
import { Plus, File, Trash2, Share2, Upload } from 'lucide-react';

interface Handout {
  id: string;
  title: string;
  content: string;
  file_url?: string;
  shared_with: string[];
  created_at: number;
}

export default function HandoutsPanel({ isDM }: { isDM: boolean }) {
  const { id: gameId } = useParams<{ id: string }>();
  const { game, socket } = useGameStore();
  const [handouts, setHandouts] = useState<Handout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<Handout | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/games/${gameId}/handouts`).then(({ data }) => setHandouts(data)).finally(() => setLoading(false));
  }, [gameId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('content', content);
    if (file) fd.append('file', file);

    try {
      const { data } = await api.post(`/games/${gameId}/handouts`, fd);
      setHandouts((h) => [data, ...h]);
      toast.success('Handout created');
      setShowForm(false);
      setTitle(''); setContent(''); setFile(null);
    } catch {
      toast.error('Failed to create handout');
    } finally {
      setSaving(false);
    }
  }

  async function deleteHandout(id: string) {
    if (!confirm('Delete this handout?')) return;
    await api.delete(`/games/${gameId}/handouts/${id}`);
    setHandouts((h) => h.filter((x) => x.id !== id));
    if (selected?.id === id) setSelected(null);
    toast.success('Deleted');
  }

  async function shareWithAll(handout: Handout) {
    const allIds = game?.players.map((p) => p.id) || [];
    try {
      const { data } = await api.put(`/games/${gameId}/handouts/${handout.id}`, { shared_with: allIds });
      setHandouts((h) => h.map((x) => x.id === data.id ? data : x));
      socket?.emit('share_handout', { handoutId: handout.id, userIds: allIds });
      toast.success('Shared with all players');
    } catch {
      toast.error('Share failed');
    }
  }

  return (
    <div className="flex h-full">
      {/* List */}
      <div className="w-48 border-r border-tavern-border flex flex-col">
        <div className="flex items-center justify-between p-2 border-b border-tavern-border">
          <span className="text-xs font-serif text-tavern-gold uppercase tracking-widest">Handouts</span>
          {isDM && (
            <button onClick={() => setShowForm(!showForm)} className="text-tavern-muted hover:text-tavern-gold transition-colors">
              <Plus size={14} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-xs text-tavern-muted animate-pulse">Loading...</div>
          ) : handouts.length === 0 ? (
            <div className="p-3 text-xs text-tavern-muted italic">No handouts yet</div>
          ) : (
            handouts.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelected(h)}
                className={`w-full text-left p-2 text-xs hover:bg-tavern-bg/50 transition-colors border-b border-tavern-border/30 ${selected?.id === h.id ? 'bg-tavern-bg/70 text-tavern-gold' : 'text-tavern-text'}`}
              >
                <div className="flex items-center gap-1.5">
                  <File size={10} className="flex-shrink-0" />
                  <span className="truncate">{h.title}</span>
                </div>
                {h.shared_with.length > 0 && (
                  <span className="text-green-400/60 text-xs ml-4">shared</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {showForm && isDM ? (
          <form onSubmit={create} className="space-y-3">
            <h3 className="font-serif text-tavern-gold text-sm">New Handout</h3>
            <input className="tavern-input text-sm py-1.5" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
            <textarea className="tavern-input resize-none text-sm" rows={5} placeholder="Content (optional)" value={content} onChange={(e) => setContent(e.target.value)} />
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-tavern-border rounded p-2 hover:border-tavern-gold/50 transition-colors text-sm text-tavern-muted">
              <Upload size={14} />
              {file ? file.name : 'Attach file (optional)'}
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="btn-primary text-xs py-1.5 px-3">{saving ? 'Creating...' : 'Create'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
            </div>
          </form>
        ) : selected ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-tavern-gold">{selected.title}</h3>
              {isDM && (
                <div className="flex gap-2">
                  <button onClick={() => shareWithAll(selected)} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1">
                    <Share2 size={10} /> Share All
                  </button>
                  <button onClick={() => deleteHandout(selected.id)} className="text-tavern-muted hover:text-red-400 transition-colors p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
            {selected.content && (
              <p className="text-sm text-tavern-text whitespace-pre-wrap mb-4">{selected.content}</p>
            )}
            {selected.file_url && (
              <a href={selected.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-tavern-gold hover:text-tavern-gold-light text-sm">
                <File size={14} /> Download Attachment
              </a>
            )}
            {selected.shared_with.length > 0 && (
              <p className="text-xs text-green-400 mt-3">Shared with {selected.shared_with.length} player(s)</p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-tavern-muted text-sm italic">
            Select a handout to view
          </div>
        )}
      </div>
    </div>
  );
}
