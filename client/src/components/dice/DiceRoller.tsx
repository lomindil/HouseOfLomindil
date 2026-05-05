import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/game';
import clsx from 'clsx';

const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;
type DieType = typeof DICE[number];

function roll(sides: number) { return Math.floor(Math.random() * sides) + 1; }

function sidesToDie(sides: number): DieType {
  const map: Record<number, DieType> = { 4:'d4',6:'d6',8:'d8',10:'d10',12:'d12',20:'d20',100:'d100' };
  return map[sides] || 'd6';
}

function parseNotation(notation: string) {
  const cleaned = notation.trim().replace(/\s/g, '');
  const diceTokens = cleaned.match(/\d*d\d+/gi) || [];
  if (!diceTokens.length) return null;
  const dice = diceTokens.map(t => {
    const [c, s] = t.toLowerCase().split('d');
    return { count: parseInt(c || '1'), sides: parseInt(s) };
  });
  const modMatch = cleaned.match(/([+-]\d+)$/);
  const modifier = modMatch ? parseInt(modMatch[1]) : 0;
  return { dice, modifier };
}

// ─── Die geometry (60×60 viewBox) ─────────────────────────────────────────────
// Each die has layered face polygons rendered back→front with gradient fills.
// Light source: upper-left. Faces: light (top), mid (right), dark (left/bottom).

const DIE_DEFS: Record<DieType, {
  viewBox: string;
  faces: { points: string; shade: 'light'|'mid'|'dark' }[];
  edges: string;    // stroke-only border path
  textX: number; textY: number;
}> = {
  // Tetrahedron: outer triangle + Y-lines from centroid (30,36)
  d4: {
    viewBox:'0 0 60 58',
    faces:[
      { points:'30,4 54,52 30,36',  shade:'light' },  // right face
      { points:'6,52 54,52 30,36',  shade:'dark'  },  // bottom face
      { points:'6,52 30,4  30,36',  shade:'mid'   },  // left face
    ],
    edges:'M30,4 L54,52 L6,52 Z M30,36 L30,4 M30,36 L54,52 M30,36 L6,52',
    textX:30, textY:34,
  },
  // Isometric cube: 3 visible parallelogram faces
  d6: {
    viewBox:'0 0 60 60',
    faces:[
      { points:'30,4 52,17 30,30 8,17',  shade:'light' },  // top
      { points:'52,17 52,43 30,56 30,30', shade:'mid'   },  // right
      { points:'8,17 30,30 30,56 8,43',  shade:'dark'   },  // left
    ],
    edges:'M30,4 L52,17 L52,43 L30,56 L8,43 L8,17 Z M30,30 L30,4 M30,30 L52,17 M30,30 L8,17',
    textX:38, textY:40,
  },
  // Octahedron: 4 triangular faces (diamond + cross)
  d8: {
    viewBox:'0 0 60 60',
    faces:[
      { points:'30,4 54,30 30,30',  shade:'light' },
      { points:'30,4 6,30 30,30',   shade:'mid'   },
      { points:'54,30 30,56 30,30', shade:'mid'   },
      { points:'6,30 30,56 30,30',  shade:'dark'  },
    ],
    edges:'M30,4 L54,30 L30,56 L6,30 Z M30,4 L30,56 M6,30 L54,30',
    textX:30, textY:30,
  },
  // d10: 5-face kite / pentagonal view
  d10: {
    viewBox:'0 0 60 60',
    faces:[
      { points:'30,5 51,22 30,28',  shade:'light'  },
      { points:'51,22 42,50 30,28', shade:'mid'    },
      { points:'42,50 18,50 30,28', shade:'dark'   },
      { points:'18,50 9,22 30,28',  shade:'dark'   },
      { points:'9,22 30,5 30,28',   shade:'mid'    },
    ],
    edges:'M30,5 L51,22 L42,50 L18,50 L9,22 Z M30,28 L30,5 M30,28 L51,22 M30,28 L42,50 M30,28 L18,50 M30,28 L9,22',
    textX:30, textY:32,
  },
  // d12: pentagon + inner pentagon (dodecahedron face)
  d12: {
    viewBox:'0 0 60 60',
    faces:[
      { points:'30,4 53,20 30,14 7,20',  shade:'light' }, // top bridge
      { points:'53,20 46,50 39,44 30,14', shade:'mid'   },
      { points:'46,50 14,50 21,44 39,44', shade:'dark'  },
      { points:'14,50 7,20 21,44',        shade:'dark'  },
      { points:'30,14 39,44 21,44',       shade:'mid'   }, // inner pentagon center
    ],
    edges:'M30,4 L53,20 L46,50 L14,50 L7,20 Z M30,14 L39,44 L21,44 Z M30,4 L30,14 M53,20 L39,44 M46,50 L39,44 M14,50 L21,44 M7,20 L21,44',
    textX:30, textY:34,
  },
  // d20: classic 4-triangle icosahedron face pattern
  d20: {
    viewBox:'0 0 60 56',
    faces:[
      { points:'30,4 43,27 17,27',    shade:'light' },  // top small △
      { points:'56,52 43,27 30,52',   shade:'mid'   },  // bottom-right △
      { points:'4,52 17,27 30,52',    shade:'dark'  },  // bottom-left △
      { points:'17,27 43,27 30,52',   shade:'mid'   },  // center inverted △
    ],
    edges:'M30,4 L56,52 L4,52 Z M17,27 L43,27 L30,52 Z M30,4 L17,27 M30,4 L43,27 M56,52 L43,27 M4,52 L17,27 M56,52 L30,52 M4,52 L30,52',
    textX:30, textY:34,
  },
  // d100: same geometry as d10 but labelled %
  d100: {
    viewBox:'0 0 60 60',
    faces:[
      { points:'30,5 51,22 30,28',  shade:'light'  },
      { points:'51,22 42,50 30,28', shade:'mid'    },
      { points:'42,50 18,50 30,28', shade:'dark'   },
      { points:'18,50 9,22 30,28',  shade:'dark'   },
      { points:'9,22 30,5 30,28',   shade:'mid'    },
    ],
    edges:'M30,5 L51,22 L42,50 L18,50 L9,22 Z M30,28 L30,5 M30,28 L51,22 M30,28 L42,50 M30,28 L18,50 M30,28 L9,22',
    textX:30, textY:32,
  },
};

// ─── Colour palettes ────────────────────────────────────────────────────────────
const PALETTE = {
  normal: {
    light:'#4a2e12', mid:'#2e1b0a', dark:'#1c0e05',
    edge:'#7a5010', glow:'none', text:'#f0d090',
  },
  max: {
    light:'#c8930a', mid:'#8b6206', dark:'#5a3d00',
    edge:'#ffe066', glow:'drop-shadow(0 0 6px #ffd700)', text:'#fff8c0',
  },
  min: {
    light:'#7f1010', mid:'#4d0808', dark:'#280404',
    edge:'#cc2222', glow:'drop-shadow(0 0 5px #ef4444)', text:'#ffbaba',
  },
};

// ─── Die3D component ────────────────────────────────────────────────────────────
type PhaseState = 'idle' | 'tumbling' | 'landing';

interface Die3DProps {
  die: DieType;
  result?: number;
  maxVal: number;
  phase: PhaseState;
  size?: number;
}

function Die3D({ die, result, maxVal, phase, size = 52 }: Die3DProps) {
  const def = DIE_DEFS[die];
  const isMax = result !== undefined && result === maxVal;
  const isMin = result !== undefined && result === 1 && maxVal > 1;
  const pal = isMax ? PALETTE.max : isMin ? PALETTE.min : PALETTE.normal;

  const gradId = `g-${die}-${isMax?'max':isMin?'min':'norm'}`;

  return (
    <div
      className={clsx(
        'select-none',
        phase === 'tumbling' && 'die-tumbling',
        phase === 'landing'  && 'die-landing',
      )}
      style={{ display:'inline-block', lineHeight:0, filter: pal.glow }}
    >
      <svg
        viewBox={def.viewBox}
        width={size}
        height={size}
        style={{ display:'block', overflow:'visible' }}
      >
        <defs>
          <radialGradient id={`${gradId}-l`} cx="30%" cy="25%" r="70%">
            <stop offset="0%" stopColor={pal.light} stopOpacity="1" />
            <stop offset="100%" stopColor={pal.dark}  stopOpacity="1" />
          </radialGradient>
          <radialGradient id={`${gradId}-m`} cx="40%" cy="30%" r="70%">
            <stop offset="0%" stopColor={pal.mid}  stopOpacity="1" />
            <stop offset="100%" stopColor={pal.dark} stopOpacity="1" />
          </radialGradient>
          <radialGradient id={`${gradId}-d`} cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor={pal.dark}  stopOpacity="1" />
            <stop offset="100%" stopColor="#0a0503"  stopOpacity="1" />
          </radialGradient>
          <filter id={`shadow-${die}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Die faces */}
        <g filter={`url(#shadow-${die})`}>
          {def.faces.map((f, i) => (
            <polygon
              key={i}
              points={f.points}
              fill={`url(#${gradId}-${f.shade === 'light' ? 'l' : f.shade === 'mid' ? 'm' : 'd'})`}
              stroke="none"
            />
          ))}
        </g>

        {/* Edge lines */}
        <g fill="none" stroke={pal.edge} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" opacity="0.85">
          {def.edges.split('M').filter(Boolean).map((seg, i) => (
            <path key={i} d={`M${seg}`} />
          ))}
        </g>

        {/* Result number */}
        {result !== undefined && (
          <text
            x={def.textX}
            y={def.textY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={result >= 100 ? 10 : result >= 10 ? 13 : 16}
            fontWeight="bold"
            fontFamily="serif"
            fill={pal.text}
            stroke="#00000060"
            strokeWidth="0.5"
            paintOrder="stroke"
          >
            {die === 'd100' && result < 10 ? `0${result}` : result}
          </text>
        )}
      </svg>
    </div>
  );
}

// ─── Die selector button ─────────────────────────────────────────────────────────
function DieButton({ die, count, onClick }: { die: DieType; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`Add ${die}`}
      className={clsx(
        'relative flex flex-col items-center justify-center py-2 rounded border transition-all select-none hover:-translate-y-0.5 active:translate-y-0',
        count > 0 ? 'border-tavern-gold bg-tavern-gold/10' : 'border-tavern-border hover:border-tavern-gold/50 bg-tavern-bg/40'
      )}
    >
      <Die3D die={die} maxVal={parseInt(die.replace('d',''))} size={36} phase="idle" />
      <span className="text-[10px] font-serif mt-0.5 text-tavern-muted leading-none">{die}</span>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-tavern-gold text-tavern-bg text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none z-10">
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Roll result display ─────────────────────────────────────────────────────────
interface RollEntry { value: number; sides: number }
interface RollResult { notation: string; rolls: RollEntry[]; modifier: number; total: number }

function RollResultDisplay({ result, phase }: { result: RollResult; phase: PhaseState }) {
  return (
    <div className={clsx(
      'p-3 rounded-lg border bg-tavern-bg/80',
      phase !== 'idle' ? 'border-tavern-gold/60' : 'border-tavern-border',
    )}>
      <div className="text-[11px] text-tavern-muted text-center mb-2 font-serif tracking-wider">
        {result.notation}
      </div>
      <div className="flex flex-wrap gap-2 justify-center mb-2">
        {result.rolls.map((r, i) => {
          const die = sidesToDie(r.sides);
          const maxVal = r.sides;
          return (
            <Die3D
              key={i}
              die={die}
              result={r.value}
              maxVal={maxVal}
              phase={phase}
              size={48}
            />
          );
        })}
      </div>
      {result.modifier !== 0 && (
        <div className="text-center text-xs text-tavern-muted font-serif mb-1">
          {result.modifier > 0 ? `+${result.modifier}` : result.modifier} modifier
        </div>
      )}
      <div className={clsx(
        'text-center font-serif text-3xl font-bold mt-1',
        phase !== 'idle' ? 'text-tavern-gold animate-pulse' : 'text-tavern-gold',
      )}>
        {result.total}
      </div>
    </div>
  );
}

// ─── Main DiceRoller ─────────────────────────────────────────────────────────────
export default function DiceRoller() {
  const { socket } = useGameStore();
  const [counts,     setCounts]     = useState<Record<string, number>>({});
  const [modifier,   setModifier]   = useState(0);
  const [custom,     setCustom]     = useState('');
  const [phase,      setPhase]      = useState<PhaseState>('idle');
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildNotation() {
    const parts = Object.entries(counts).filter(([,c]) => c > 0).map(([d,c]) => `${c}${d}`);
    if (!parts.length) return '';
    let n = parts.join('+');
    if (modifier > 0) n += `+${modifier}`;
    else if (modifier < 0) n += `${modifier}`;
    return n;
  }

  function doRoll(notation: string) {
    const parsed = parseNotation(notation);
    if (!parsed) return;
    const rolls: RollEntry[] = [];
    for (const { count, sides } of parsed.dice)
      for (let i = 0; i < Math.min(count, 20); i++)
        rolls.push({ value: roll(sides), sides });
    const total = rolls.reduce((a, r) => a + r.value, 0) + parsed.modifier;
    const result: RollResult = { notation, rolls, modifier: parsed.modifier, total };
    setLastResult(result);

    if (phaseTimer.current) clearTimeout(phaseTimer.current);
    setPhase('tumbling');
    phaseTimer.current = setTimeout(() => {
      setPhase('landing');
      phaseTimer.current = setTimeout(() => setPhase('idle'), 500);
    }, 750);

    socket?.emit('dice_roll', { notation, results: rolls.map(r => r.value), total });
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

  // cleanup timer on unmount
  useEffect(() => () => { if (phaseTimer.current) clearTimeout(phaseTimer.current); }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Die grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {DICE.map(die => (
          <DieButton
            key={die}
            die={die}
            count={counts[die] ?? 0}
            onClick={() => setCounts(c => ({ ...c, [die]: (c[die] || 0) + 1 }))}
          />
        ))}
      </div>

      {/* Modifier */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-tavern-muted flex-1 font-serif">Modifier</span>
        <button onClick={() => setModifier(m => m - 1)} className="w-6 h-6 border border-tavern-border rounded text-tavern-muted hover:text-tavern-text flex items-center justify-center text-sm">−</button>
        <span className="text-tavern-text text-sm w-8 text-center font-serif">{modifier >= 0 ? `+${modifier}` : modifier}</span>
        <button onClick={() => setModifier(m => m + 1)} className="w-6 h-6 border border-tavern-border rounded text-tavern-muted hover:text-tavern-text flex items-center justify-center text-sm">+</button>
      </div>

      {/* Roll button */}
      <button
        onClick={rollAll}
        disabled={phase !== 'idle' || Object.values(counts).every(c => c === 0)}
        className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
      >
        {phase !== 'idle' ? 'Rolling...' : `Roll ${buildNotation() || '—'}`}
      </button>

      {/* Custom notation */}
      <div className="flex gap-2">
        <input
          className="tavern-input text-sm py-1.5 flex-1"
          placeholder="2d6+3"
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && rollCustom()}
        />
        <button onClick={rollCustom} disabled={!custom.trim()} className="btn-secondary text-xs py-1.5 px-3">Roll</button>
      </div>

      {/* Result */}
      {lastResult && <RollResultDisplay result={lastResult} phase={phase} />}
    </div>
  );
}
