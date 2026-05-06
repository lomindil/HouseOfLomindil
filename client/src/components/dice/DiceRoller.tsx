import { useEffect, useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/game';
import clsx from 'clsx';

const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;
type DieType = typeof DICE[number];

function roll(sides: number) { return Math.floor(Math.random() * sides) + 1; }

function sidesToDie(sides: number): DieType {
  const map: Record<number, DieType> = { 4:'d4', 6:'d6', 8:'d8', 10:'d10', 12:'d12', 20:'d20', 100:'d100' };
  return map[sides] || 'd6';
}

function parseNotation(notation: string) {
  const cleaned = notation.trim().replace(/\s/g, '');
  const tokens = cleaned.match(/\d*d\d+/gi) || [];
  if (!tokens.length) return null;
  const dice = tokens.map(t => {
    const [c, s] = t.toLowerCase().split('d');
    return { count: parseInt(c || '1'), sides: parseInt(s) };
  });
  const modMatch = cleaned.match(/([+-]\d+)$/);
  return { dice, modifier: modMatch ? parseInt(modMatch[1]) : 0 };
}

// ─── Geometry (module-level cache — disposable geometries) ─────────────────
const geoCache: Partial<Record<DieType, THREE.BufferGeometry>> = {};

function buildD10(): THREE.BufferGeometry {
  const n = 5;
  const verts: number[] = [];
  const idx: number[] = [];
  verts.push(0, 1.1, 0);                                                  // 0: top apex
  for (let i = 0; i < n; i++) {                                            // 1–5: upper ring
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    verts.push(0.9 * Math.cos(a), 0.1, 0.9 * Math.sin(a));
  }
  for (let i = 0; i < n; i++) {                                            // 6–10: lower ring
    const a = (i / n) * Math.PI * 2;
    verts.push(0.9 * Math.cos(a), -0.1, 0.9 * Math.sin(a));
  }
  verts.push(0, -1.1, 0);                                                  // 11: bottom apex
  for (let i = 0; i < n; i++) idx.push(0, 1 + i, 1 + (i + 1) % n);      // top fan
  for (let i = 0; i < n; i++) {                                            // kite band
    const a = 1 + i, b = 1 + (i + 1) % n, c = 6 + i, d = 6 + (i + 1) % n;
    idx.push(a, b, c); idx.push(b, d, c);
  }
  for (let i = 0; i < n; i++) idx.push(11, 6 + (i + 1) % n, 6 + i);     // bottom fan
  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

function getGeo(die: DieType): THREE.BufferGeometry {
  if (!geoCache[die]) {
    switch (die) {
      case 'd4':   geoCache.d4   = new THREE.TetrahedronGeometry(1.05);   break;
      case 'd6':   geoCache.d6   = new THREE.BoxGeometry(1.3, 1.3, 1.3);  break;
      case 'd8':   geoCache.d8   = new THREE.OctahedronGeometry(1.1);      break;
      case 'd10':  geoCache.d10  = buildD10();                             break;
      case 'd12':  geoCache.d12  = new THREE.DodecahedronGeometry(1.0);    break;
      case 'd20':  geoCache.d20  = new THREE.IcosahedronGeometry(1.1);     break;
      case 'd100': geoCache.d100 = buildD10();                             break;
    }
  }
  return geoCache[die]!;
}

// ─── Die mesh (inside Canvas) ──────────────────────────────────────────────
type PhaseState = 'idle' | 'tumbling' | 'landing';

function DiceMesh({ die, phase, position, isMax, isMin }: {
  die: DieType;
  phase: PhaseState;
  position: [number, number, number];
  isMax?: boolean;
  isMin?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const vel = useRef({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    if (phase === 'tumbling') {
      vel.current = {
        x: (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 8),
        y: (Math.random() > 0.5 ? 1 : -1) * (14 + Math.random() * 10),
        z: (Math.random() > 0.5 ? 1 : -1) * (6  + Math.random() * 6),
      };
    }
  }, [phase]);

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    if (phase === 'tumbling') {
      meshRef.current.rotation.x += vel.current.x * dt;
      meshRef.current.rotation.y += vel.current.y * dt;
      meshRef.current.rotation.z += vel.current.z * dt;
    } else if (phase === 'landing') {
      vel.current.x *= 0.87;
      vel.current.y *= 0.87;
      vel.current.z *= 0.87;
      meshRef.current.rotation.x += vel.current.x * dt;
      meshRef.current.rotation.y += vel.current.y * dt;
      meshRef.current.rotation.z += vel.current.z * dt;
    }
  });

  const color   = isMax ? '#c8930a' : isMin ? '#7f1010' : '#5a3510';
  const emissive= isMax ? '#441e00' : isMin ? '#2a0505' : '#1c0900';
  const specular = isMax ? '#ffcc44' : isMin ? '#aa2222' : '#996622';

  return (
    <mesh ref={meshRef} position={position} geometry={getGeo(die)}>
      <meshPhongMaterial color={color} emissive={emissive} shininess={110} specular={specular} />
    </mesh>
  );
}

// ─── Multi-die canvas ──────────────────────────────────────────────────────
interface RollEntry { value: number; sides: number }

function DiceCanvas({ rolls, phase }: { rolls: RollEntry[]; phase: PhaseState }) {
  const spacing = 2.6;
  const totalSpan = (rolls.length - 1) * spacing;
  const camZ = Math.max(3.5, totalSpan / 2 + 2.8);

  return (
    <Canvas
      key={rolls.length}
      camera={{ position: [0, 0, camZ], fov: 50 }}
      style={{ width: '100%', height: 120 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#0d0805']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 5, 5]} intensity={1.3} castShadow />
      <pointLight position={[-4, -3, 3]} intensity={0.4} color="#cc8844" />
      {rolls.map((r, i) => {
        const die = sidesToDie(r.sides);
        return (
          <DiceMesh
            key={i}
            die={die}
            phase={phase}
            position={[i * spacing - totalSpan / 2, 0, 0]}
            isMax={r.value === r.sides}
            isMin={r.value === 1 && r.sides > 1}
          />
        );
      })}
    </Canvas>
  );
}

// ─── SVG silhouettes for selector buttons ─────────────────────────────────
function DieSVG({ die, active }: { die: DieType; active: boolean }) {
  const stroke = active ? '#c8930a' : '#7a5010';
  const fill   = active ? '#5a3200' : '#2e1b0a';
  const inner  = active ? '#c8930a' : '#7a5010';
  const s = 34;
  switch (die) {
    case 'd4':
      return <svg width={s} height={s} viewBox="0 0 40 38"><polygon points="20,2 38,35 2,35" fill={fill} stroke={stroke} strokeWidth="1.5" /></svg>;
    case 'd6':
      return <svg width={s} height={s} viewBox="0 0 36 36">
        <rect x="3" y="3" width="30" height="30" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <circle cx="11" cy="11" r="2.5" fill={inner} opacity="0.7" />
        <circle cx="25" cy="25" r="2.5" fill={inner} opacity="0.7" />
        <circle cx="11" cy="25" r="2.5" fill={inner} opacity="0.5" />
        <circle cx="25" cy="11" r="2.5" fill={inner} opacity="0.5" />
      </svg>;
    case 'd8':
      return <svg width={s} height={s} viewBox="0 0 40 44">
        <polygon points="20,2 38,22 20,42 2,22" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <line x1="2" y1="22" x2="38" y2="22" stroke={inner} strokeWidth="0.8" opacity="0.6" />
        <line x1="20" y1="2"  x2="20" y2="42" stroke={inner} strokeWidth="0.8" opacity="0.6" />
      </svg>;
    case 'd10':
      return <svg width={s} height={s} viewBox="0 0 40 44"><polygon points="20,2 38,18 32,40 8,40 2,18" fill={fill} stroke={stroke} strokeWidth="1.5" /></svg>;
    case 'd12':
      return <svg width={s} height={s} viewBox="0 0 44 44"><polygon points="22,2 40,10 44,30 30,42 14,42 0,30 4,10" fill={fill} stroke={stroke} strokeWidth="1.5" /></svg>;
    case 'd20':
      return <svg width={s} height={s} viewBox="0 0 44 42">
        <polygon points="22,2 44,40 0,40" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <line x1="22" y1="2"  x2="11" y2="40" stroke={inner} strokeWidth="0.7" opacity="0.7" />
        <line x1="22" y1="2"  x2="33" y2="40" stroke={inner} strokeWidth="0.7" opacity="0.7" />
        <line x1="11" y1="28" x2="33" y2="28" stroke={inner} strokeWidth="0.7" opacity="0.7" />
      </svg>;
    case 'd100':
      return <svg width={s} height={s} viewBox="0 0 40 44">
        <polygon points="20,2 38,18 32,40 8,40 2,18" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <text x="20" y="27" textAnchor="middle" fontSize="9" fill={inner} fontFamily="serif" opacity="0.9">%</text>
      </svg>;
    default:
      return <svg width={s} height={s} viewBox="0 0 36 36"><rect x="3" y="3" width="30" height="30" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" /></svg>;
  }
}

// ─── Die selector button ──────────────────────────────────────────────────
function DieButton({ die, count, onClick }: { die: DieType; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`Add ${die}`}
      className={clsx(
        'relative flex flex-col items-center justify-center py-2 rounded border transition-all select-none hover:-translate-y-0.5 active:translate-y-0',
        count > 0
          ? 'border-tavern-gold bg-tavern-gold/10'
          : 'border-tavern-border hover:border-tavern-gold/50 bg-tavern-bg/40'
      )}
    >
      <DieSVG die={die} active={count > 0} />
      <span className="text-[10px] font-serif mt-0.5 text-tavern-muted leading-none">{die}</span>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-tavern-gold text-tavern-bg text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none z-10">
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Roll result display ──────────────────────────────────────────────────
interface RollResult { notation: string; rolls: RollEntry[]; modifier: number; total: number }

function RollResultDisplay({ result, phase }: { result: RollResult; phase: PhaseState }) {
  return (
    <div className={clsx(
      'rounded-lg border overflow-hidden',
      phase !== 'idle' ? 'border-tavern-gold/60' : 'border-tavern-border',
    )}>
      <div className="bg-tavern-bg/80 text-[11px] text-tavern-muted text-center pt-2 pb-1 font-serif tracking-wider">
        {result.notation}
      </div>

      <Suspense fallback={
        <div className="h-[120px] bg-[#0d0805] flex items-center justify-center text-tavern-muted text-xs">
          Loading 3D dice...
        </div>
      }>
        <DiceCanvas rolls={result.rolls} phase={phase} />
      </Suspense>

      <div className="bg-tavern-bg/80 px-3 pt-2 pb-3">
        <div className="flex flex-wrap gap-1.5 justify-center mb-2">
          {result.rolls.map((r, i) => {
            const isMax = r.value === r.sides;
            const isMin = r.value === 1 && r.sides > 1;
            return (
              <span key={i} className={clsx(
                'text-xs font-serif font-bold rounded px-1.5 py-0.5 border',
                isMax ? 'text-yellow-300 border-yellow-600/50 bg-yellow-900/20' :
                isMin ? 'text-red-400   border-red-600/40   bg-red-900/20'    :
                        'text-tavern-text border-tavern-border/60 bg-tavern-bg',
              )}>
                {sidesToDie(r.sides)}: {r.value}
              </span>
            );
          })}
        </div>

        {result.modifier !== 0 && (
          <div className="text-center text-xs text-tavern-muted font-serif mb-1">
            {result.modifier > 0 ? `+${result.modifier}` : result.modifier} modifier
          </div>
        )}

        <div className={clsx(
          'text-center font-serif text-3xl font-bold',
          phase !== 'idle' ? 'text-tavern-gold animate-pulse' : 'text-tavern-gold',
        )}>
          {result.total}
        </div>
      </div>
    </div>
  );
}

// ─── Main DiceRoller ──────────────────────────────────────────────────────
export default function DiceRoller() {
  const { socket } = useGameStore();
  const [counts,     setCounts]     = useState<Record<string, number>>({});
  const [modifier,   setModifier]   = useState(0);
  const [custom,     setCustom]     = useState('');
  const [phase,      setPhase]      = useState<PhaseState>('idle');
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildNotation() {
    const parts = Object.entries(counts).filter(([, c]) => c > 0).map(([d, c]) => `${c}${d}`);
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
      phaseTimer.current = setTimeout(() => setPhase('idle'), 600);
    }, 900);

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

  useEffect(() => () => { if (phaseTimer.current) clearTimeout(phaseTimer.current); }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Die selector grid */}
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

      {/* Custom notation input */}
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

      {/* 3D result */}
      {lastResult && <RollResultDisplay result={lastResult} phase={phase} />}
    </div>
  );
}
