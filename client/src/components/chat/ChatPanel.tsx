import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/game';
import type { ChatMessage } from '../../store/game';
import { useAuthStore } from '../../store/auth';
import { Send, Dices } from 'lucide-react';
import clsx from 'clsx';

function MessageRow({ msg }: { msg: ChatMessage }) {
  const { user } = useAuthStore();
  const isOwn = msg.user_id === user?.id;

  if (msg.type === 'roll') {
    return (
      <div className="flex flex-col items-center py-2">
        <div className="bg-tavern-bg border border-tavern-gold/30 rounded px-3 py-2 max-w-xs text-center">
          <div className="flex items-center gap-1.5 justify-center mb-1">
            <Dices size={12} className="text-tavern-gold" />
            <span className="text-xs text-tavern-muted font-serif">{msg.username}</span>
          </div>
          <div className="text-xs text-tavern-muted">{msg.metadata?.notation}</div>
          <div className="flex flex-wrap gap-1 justify-center my-1">
            {msg.metadata?.results?.map((r: number, i: number) => (
              <span key={i} className="w-6 h-6 border border-tavern-border rounded text-xs flex items-center justify-center text-tavern-text">{r}</span>
            ))}
          </div>
          <div className="font-serif text-xl font-bold text-tavern-gold">{msg.metadata?.total}</div>
        </div>
      </div>
    );
  }

  if (msg.type === 'system') {
    return (
      <div className="text-center py-1">
        <span className="text-xs text-tavern-muted italic">{msg.content}</span>
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col mb-2', isOwn && 'items-end')}>
      <div className={clsx('flex items-baseline gap-1.5 mb-0.5', isOwn && 'flex-row-reverse')}>
        <span className="text-xs font-serif text-tavern-gold">{msg.username}</span>
        <span className="text-xs text-tavern-muted/50">{new Date(msg.created_at * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div className={clsx(
        'px-3 py-2 rounded max-w-[85%] text-sm',
        isOwn ? 'bg-tavern-gold/20 text-tavern-text rounded-br-none' : 'bg-tavern-card border border-tavern-border text-tavern-text rounded-bl-none'
      )}>
        {msg.content}
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const { messages, socket } = useGameStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    socket.emit('chat_message', { content: input.trim(), type: 'chat' });
    setInput('');
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-tavern-muted text-xs font-serif py-4 italic">
            The adventurers gather around the table...
          </div>
        ) : (
          messages.map((msg) => <MessageRow key={msg.id} msg={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 p-2 border-t border-tavern-border">
        <input
          className="tavern-input text-sm py-1.5 flex-1"
          placeholder="Say something..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={!input.trim()} className="btn-primary px-3 py-1.5">
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
