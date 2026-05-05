import { useState } from 'react';
import { useGameStore } from '../../store/game';
import clsx from 'clsx';

const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;
type DieType = typeof DICE[number];

// SVG polygon/shape definitions (40x40 viewBox)
const DIE_SHAPES: Record<DieType, React.ReactNode> = {
  d4:   <polygon points="20,2 39,37 1,37" strokeLinejoin="round" />,
  d6:   <rect x="3" y="3" width="34" height="34" rx="4" />,
  d8:   <polygon points="20,2 38,20 20,38 2,20" strokeLinejoin="round" />,
  d10:  <polygon points="20,2 38,15 33,38 7,38 2,15" strokeLinejoin="round" />,
  d12:  <polygon points="20,2 36,10 39,29 20,38 1,29 4,10" strokeLinejoin="round" />,
  d20:  <polygon points="20,2 38,36 2,36" strokeLinejoin="round" />,
  d100: <polygon points="20,2 38,15 33,38 7,38 2,15" strokeLinejoin="round" />,
};

// Offset for centering text inside each shape
const TEXT_OFFSET: Record<DieType, number> = {
  d4: 5, d6: 0, d8: 0, d10: 2, d12: 2, d20: 4, d100: 2,
};

function DieFaceIcon({ die, size = 36, result, isMax, isMin }: {
  die: DieType;
  size?: number;
  result?: number;
  isMax?: boolean;
  isMin?: boolean;
}) {
  const fill = isMax ? '#b8860b' : isMin ? '#7f1d1d' : '#2a1a0e';
  const stroke = isMax ? '#ffd700' : isMin ? '#ef4444' : '#8b6914';
  const textFill = isMax ? '#ffd700' : isMin ? '#fca5a5' : '#e8d5b7';

  return (
    <svg viewBox="0 0 40 40" width={size} height={size} style={{ display: 'block' }}>
      <g fill={fill} stroke={stroke} strokeWidth="2">
        {DIE_SHAPES[die]}
      </g>
      {result !== undefined && (
        <text
          x="20"
          y={20 + TEXT_OFFSET[die]}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={result >= 100 ? 9 : result >= 10 ? 12 : 14}
          fontWeight="bold"
          fontFamily="serif"
          fill={textFill}
        >
          {result}
        </text>
      )}
    </svg>
  );
}

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

// Map individual roll result to its die type for rendering
function sidesToDie(sides: number): DieType {
  const map: Record<number, DieType> = { 4: 'd4', 6: 'd6', 8: 'd8', 10: 'd10', 12: 'd12', 20: 'd20', 100: 'd100' };
  return map[sides] || 'd6';
}

interface RollEntry {
  value: number;
  sides: number;
}

interface RollResult {
  notation: string;
  rolls: RollEntry[];
  modifier: number;
  total: number;
}

export default function DiceRoller() {
  const { socket } = useGameStore();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [modifier, setModifier] = useState(0);
  const [custom, setCustom] = useState('');
  const [rolling, setRolling] = useState(false);
  const [lastResult, setLastResult] = useState<RollResult | null>(null);

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

    const rolls: RollEntry[] = [];
    for (const { count, sides } of parsed.dice) {
      for (let i = 0; i < Math.min(count, 20); i++) {
        rolls.push({ value: roll(sides), sides });
      }
    }
    const total = rolls.reduce((a, r) => a + r.value, 0) + parsed.modifier;

    setRolling(true);
    const result: RollResult = { notation, rolls, modifier: parsed.modifier, total };
    setLastResult(result);

    if (socket) {
      socket.emit('dice_roll', { notation, results: rolls.map((r) => r.value), total });
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
      {/* Die selector grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {DICE.map((die) => (
          <button
            key={die}
            onClick={() => increment(die)}
            title={`Add ${die}`}
            className={clsx(
              'relative flex flex-col items-center justify-center py-1.5 rounded border transition-all select-none',
              counts[die]
                ? 'border-tavern-gold bg-tavern-gold/10'
                : 'border-tavern-border hover:border-tavern-gold/50'
            )}
          >
            <DieFaceIcon die={die} size={28} />
            <span className="text-xs font-serif mt-0.5 text-tavern-muted">{die}</span>
            {(counts[die] ?? 0) > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-tavern-gold text-tavern-bg text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                {counts[die]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Modifier */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-tavern-muted flex-1">Modifier</span>
        <button onClick={() => setModifier((m) => m - 1)} className="w-6 h-6 border border-tavern-border rounded text-tavern-muted hover:text-tavern-text flex items-center justify-center">−</button>
        <span className="text-tavern-text text-sm w-8 text-center font-serif">{modifier >= 0 ? `+${modifier}` : modifier}</span>
        <button onClick={() => setModifier((m) => m + 1)} className="w-6 h-6 border border-tavern-border rounded text-tavern-muted hover:text-tavern-text flex items-center justify-center">+</button>
      </div>

      {/* Roll button */}
      <button
        onClick={rollAll}
        disabled={rolling || Object.values(counts).every((c) => c === 0)}
        className={clsx('btn-primary w-full flex items-center justify-center gap-2 text-sm', rolling && 'opacity-70')}
      >
        <span className={clsx('inline-block', rolling && 'dice-rolling')}>⚄</span>
        {rolling ? 'Rolling...' : `Roll ${buildNotation() || '—'}`}
      </button>

      {/* Custom notation */}
      <div className="flex gap-2">
        <input
          className="tavern-input text-sm py-1.5 flex-1"
          placeholder="2d6+3"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && rollCustom()}
        />
        <button onClick={rollCustom} disabled={!custom.trim()} className="btn-secondary text-xs py-1.5 px-3">Roll</button>
      </div>

      {/* Result display */}
      {lastResult && (
        <div className={clsx('p-3 rounded border border-tavern-border bg-tavern-bg', rolling && 'dice-bounce')}>
          <div className="text-xs text-tavern-muted text-center mb-2 font-serif">{lastResult.notation}</div>
          <div className="flex flex-wrap gap-1.5 justify-center mb-2">
            {lastResult.rolls.map((r, i) => {
              const die = sidesToDie(r.sides);
              const isMax = r.value === r.sides;
              const isMin = r.value === 1;
              return (
                <div
                  key={i}
                  className={clsx('flex items-center justify-center transition-transform', rolling && 'dice-rolling')}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <DieFaceIcon die={die} size={36} result={r.value} isMax={isMax} isMin={isMin} />
                </div>
              );
            })}
          </div>
          {lastResult.modifier !== 0 && (
            <div className="text-center text-xs text-tavern-muted mb-1 font-serif">
              {lastResult.modifier > 0 ? `+${lastResult.modifier}` : lastResult.modifier} modifier
            </div>
          )}
          <div className="text-center font-serif text-2xl font-bold text-tavern-gold">{lastResult.total}</div>
        </div>
      )}
    </div>
  );
}
