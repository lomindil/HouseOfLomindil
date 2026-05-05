import { useState } from 'react';
import { useGameStore } from '../../store/game';
import { useAuthStore } from '../../store/auth';
import { Dices } from 'lucide-react';
import clsx from 'clsx';

const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];
const FACES: Record<string, string> = {
  d4: '▲', d6: '■', d8: '◆', d10: '⬟', d12: '⬠', d20: '⬡', d100: '%',
};

function roll(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function parseNotation(notation: string): { dice: Array<{ count: number; sides: number }>; modifier: number } | null {
  const cleaned = notation.trim().replace(/\s/g, '');
  const match = cleaned.match(/^(\d*d\d+(?:[+-]\d*d\d+)*)(([+-]\d+)?)$/i);
  if (!match) return null;

  const dice: Array<{ count: number; sides: number }> = [];
  let modifier = 0;

  const dicePart = match[1];
  const modPart = match[2];

  const diceTokens = dicePart.match(/\d*d\d+/gi) || [];
  for (const token of diceTokens) {
    const [countStr, sidesStr] = token.toLowerCase().split('d');
    dice.push({ count: parseInt(countStr || '1'), sides: parseInt(sidesStr) });
  }

  if (modPart) modifier = parseInt(modPart);
  return { dice, modifier };
}

export default function DiceRoller() {
  const { socket } = useGameStore();
  const { user } = useAuthStore();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [modifier, setModifier] = useState(0);
  const [custom, setCustom] = useState('');
  const [rolling, setRolling] = useState(false);
  const [lastResult, setLastResult] = useState<{ notation: string; results: number[]; total: number } | null>(null);

  function increment(die: string) {
    setCounts((c) => ({ ...c, [die]: (c[die] || 0) + 1 }));
  }

  function buildNotation() {
    const parts = Object.entries(counts)
      .filter(([, c]) => c > 0)
      .map(([die, c]) => `${c}${die}`);
    if (parts.length === 0) return '';
    let n = parts.join('+');
    if (modifier > 0) n += `+${modifier}`;
    else if (modifier < 0) n += `${modifier}`;
    return n;
  }

  function doRoll(notation: string) {
    const parsed = parseNotation(notation);
    if (!parsed) return;

    const results: number[] = [];
    for (const { count, sides } of parsed.dice) {
      for (let i = 0; i < Math.min(count, 100); i++) {
        results.push(roll(sides));
      }
    }
    const total = results.reduce((a, b) => a + b, 0) + parsed.modifier;

    setRolling(true);
    setLastResult({ notation, results, total });

    if (socket) {
      socket.emit('dice_roll', { notation, results, total });
    }

    setTimeout(() => setRolling(false), 800);
  }

  function rollAll() {
    const n = buildNotation();
    if (!n) return;
    doRoll(n);
    setCounts({});
    setModifier(0);
  }

  function rollCustom() {
    if (!custom.trim()) return;
    doRoll(custom.trim());
    setCustom('');
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Dice buttons */}
      <div className="grid grid-cols-4 gap-1.5">
        {DICE.map((die) => (
          <button
            key={die}
            onClick={() => increment(die)}
            className={clsx(
              'relative flex flex-col items-center justify-center p-2 rounded border transition-all text-xs font-serif select-none',
              counts[die]
                ? 'border-tavern-gold bg-tavern-gold/10 text-tavern-gold'
                : 'border-tavern-border text-tavern-muted hover:border-tavern-gold/50 hover:text-tavern-text'
            )}
          >
            <span className="text-lg leading-none">{FACES[die]}</span>
            <span className="mt-0.5">{die}</span>
            {counts[die] > 0 && (
              <span className="absolute -top-1 -right-1 bg-tavern-gold text-tavern-bg text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {counts[die]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Modifier */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-tavern-muted label">Modifier</span>
        <button onClick={() => setModifier((m) => m - 1)} className="w-6 h-6 border border-tavern-border rounded text-tavern-muted hover:text-tavern-text text-sm flex items-center justify-center">-</button>
        <span className="text-tavern-text text-sm w-8 text-center font-serif">{modifier >= 0 ? `+${modifier}` : modifier}</span>
        <button onClick={() => setModifier((m) => m + 1)} className="w-6 h-6 border border-tavern-border rounded text-tavern-muted hover:text-tavern-text text-sm flex items-center justify-center">+</button>
      </div>

      {/* Roll button */}
      <button
        onClick={rollAll}
        disabled={rolling || Object.values(counts).every((c) => c === 0)}
        className={clsx('btn-primary w-full flex items-center justify-center gap-2', rolling && 'dice-rolling')}
      >
        <Dices size={16} className={rolling ? 'dice-rolling' : ''} />
        {rolling ? 'Rolling...' : `Roll ${buildNotation() || '—'}`}
      </button>

      {/* Custom notation */}
      <div className="flex gap-2">
        <input
          className="tavern-input text-sm py-1.5"
          placeholder="Custom: 2d6+3"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && rollCustom()}
        />
        <button onClick={rollCustom} disabled={!custom.trim()} className="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap">Roll</button>
      </div>

      {/* Last result */}
      {lastResult && (
        <div className={clsx('p-3 rounded border border-tavern-border bg-tavern-bg text-center', rolling && 'dice-bounce')}>
          <div className="text-xs text-tavern-muted mb-1">{lastResult.notation}</div>
          <div className="flex flex-wrap gap-1 justify-center mb-2">
            {lastResult.results.map((r, i) => (
              <span key={i} className="w-7 h-7 flex items-center justify-center border border-tavern-border rounded text-sm font-bold text-tavern-text">{r}</span>
            ))}
          </div>
          <div className="font-serif text-2xl font-bold text-tavern-gold">{lastResult.total}</div>
        </div>
      )}
    </div>
  );
}
