import { useEffect, useRef, useState, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import clsx from 'clsx';

// ─── All visual + geometry code is identical to DiceRoller.tsx ────────────────

const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const;
type DieType = typeof DICE[number];

function roll(sides: number) { return Math.floor(Math.random() * sides) + 1; }
function sidesToDie(sides: number): DieType {
  const map: Record<number, DieType> = { 4: 'd4', 6: 'd6', 8: 'd8', 10: 'd10', 12: 'd12', 20: 'd20', 100: 'd100' };
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

const geoCache: Partial<Record<DieType, THREE.BufferGeometry>> = {};
const edgeCache: Partial<Record<DieType, THREE.EdgesGeometry>> = {};

function buildD10(): THREE.BufferGeometry {
  const n = 5;
  const verts: number[] = [];
  const idx: number[] = [];
  verts.push(0, 1.1, 0);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.PI / n; verts.push(0.9 * Math.cos(a), 0.1, 0.9 * Math.sin(a)); }
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; verts.push(0.9 * Math.cos(a), -0.1, 0.9 * Math.sin(a)); }
  verts.push(0, -1.1, 0);
  for (let i = 0; i < n; i++) idx.push(0, 1 + i, 1 + (i + 1) % n);
  for (let i = 0; i < n; i++) { const a = 1 + i, b = 1 + (i + 1) % n, c = 6 + i, d = 6 + (i + 1) % n; idx.push(a, b, c); idx.push(b, d, c); }
  for (let i = 0; i < n; i++) idx.push(11, 6 + (i + 1) % n, 6 + i);
  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

function getGeo(die: DieType): THREE.BufferGeometry {
  if (!geoCache[die]) {
    switch (die) {
      case 'd4':   geoCache.d4   = new THREE.TetrahedronGeometry(1.05); break;
      case 'd6':   geoCache.d6   = new THREE.BoxGeometry(1.3, 1.3, 1.3); break;
      case 'd8':   geoCache.d8   = new THREE.OctahedronGeometry(1.1);   break;
      case 'd10':  geoCache.d10  = buildD10();                           break;
      case 'd12':  geoCache.d12  = new THREE.DodecahedronGeometry(1.0); break;
      case 'd20':  geoCache.d20  = new THREE.IcosahedronGeometry(1.1);  break;
      case 'd100': geoCache.d100 = buildD10();                           break;
    }
  }
  return geoCache[die]!;
}

function getEdges(die: DieType): THREE.EdgesGeometry {
  if (!edgeCache[die]) edgeCache[die] = new THREE.EdgesGeometry(getGeo(die));
  return edgeCache[die]!;
}

type PhaseState = 'idle' | 'tumbling' | 'landing';

function dieColors(isMax: boolean, isMin: boolean) {
  if (isMax) return { face: '#c27c0e', emissive: '#7c4f00', specular: '#ffe066', edge: '#ffd700', label: '#ffd700', labelBg: 'rgba(50,30,0,0.92)', labelBorder: '#c27c0e' };
  if (isMin) return { face: '#cc2222', emissive: '#7f0000', specular: '#ff9999', edge: '#ff4444', label: '#ff9999', labelBg: 'rgba(50,0,0,0.92)',  labelBorder: '#cc2222' };
  return         { face: '#1a6fd4', emissive: '#0d2e6e', specular: '#90cdf4', edge: '#60a5fa', label: '#e0f2fe', labelBg: 'rgba(0,10,40,0.92)',   labelBorder: '#3b82f6' };
}

function SpinningDie({ die, phase, isMax, isMin }: { die: DieType; phase: PhaseState; isMax: boolean; isMin: boolean }) {
  const groupRef = useRef<THREE.Group>(null!);
  const vel = useRef({ x: 0, y: 0, z: 0 });
  useEffect(() => {
    if (phase === 'tumbling') vel.current = { x: (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 9), y: (Math.random() > 0.5 ? 1 : -1) * (14 + Math.random() * 10), z: (Math.random() > 0.5 ? 1 : -1) * (6 + Math.random() * 6) };
  }, [phase]);
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    if (phase === 'tumbling') { groupRef.current.rotation.x += vel.current.x * dt; groupRef.current.rotation.y += vel.current.y * dt; groupRef.current.rotation.z += vel.current.z * dt; }
    else if (phase === 'landing') { vel.current.x *= 0.87; vel.current.y *= 0.87; vel.current.z *= 0.87; groupRef.current.rotation.x += vel.current.x * dt; groupRef.current.rotation.y += vel.current.y * dt; groupRef.current.rotation.z += vel.current.z * dt; }
  });
  const c = dieColors(isMax, isMin);
  const edges = useMemo(() => getEdges(die), [die]);
  return (
    <group ref={groupRef}>
      <mesh geometry={getGeo(die)}><meshPhongMaterial color={c.face} emissive={c.emissive} shininess={130} specular={c.specular} /></mesh>
      <lineSegments geometry={edges}><lineBasicMaterial color={c.edge} transparent opacity={0.55} /></lineSegments>
    </group>
  );
}

interface RollEntry { value: number; sides: number }

function DieGroup({ die, phase, position, isMax, isMin, result }: { die: DieType; phase: PhaseState; position: [number, number, number]; isMax: boolean; isMin: boolean; result?: number }) {
  const c = dieColors(isMax, isMin);
  return (
    <group position={position}>
      <SpinningDie die={die} phase={phase} isMax={isMax} isMin={isMin} />
      {phase === 'idle' && result !== undefined && (
        <Html center zIndexRange={[200, 0]}>
          <div style={{ background: c.labelBg, color: c.label, border: `1.5px solid ${c.labelBorder}`, borderRadius: '5px', padding: '1px 9px', fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: '22px', lineHeight: '1.35', whiteSpace: 'nowrap', boxShadow: `0 0 10px ${c.labelBorder}99`, userSelect: 'none', pointerEvents: 'none' }}>{result}</div>
        </Html>
      )}
      {phase !== 'idle' && (
        <Html center zIndexRange={[200, 0]}>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'Georgia, serif', fontWeight: 'bold', fontSize: '18px', userSelect: 'none', pointerEvents: 'none' }}>?</div>
        </Html>
      )}
    </group>
  );
}

function DiceCanvas({ rolls, phase }: { rolls: RollEntry[]; phase: PhaseState }) {
  const spacing = 2.6;
  const totalSpan = (rolls.length - 1) * spacing;
  const camZ = Math.max(3.5, totalSpan / 2 + 2.8);
  return (
    <Canvas key={rolls.length} camera={{ position: [0, 0, camZ], fov: 50 }} style={{ width: '100%', height: 130 }} gl={{ antialias: true }}>
      <color attach="background" args={['#070c1a']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 5]} intensity={1.4} />
      <directionalLight position={[-3, -2, 3]} intensity={0.4} color="#6699ff" />
      <pointLight position={[0, 4, 2]} intensity={0.6} color="#ffffff" />
      {rolls.map((r, i) => {
        const die = sidesToDie(r.sides);
        return <DieGroup key={i} die={die} phase={phase} position={[i * spacing - totalSpan / 2, 0, 0]} isMax={r.value === r.sides} isMin={r.value === 1 && r.sides > 1} result={r.value} />;
      })}
    </Canvas>
  );
}

function DieSVG({ die, active }: { die: DieType; active: boolean }) {
  const stroke = active ? '#60a5fa' : '#4b5563';
  const fill   = active ? '#1e3a8a' : '#111827';
  const inner  = active ? '#93c5fd' : '#374151';
  const s = 34;
  switch (die) {
    case 'd4':   return <svg width={s} height={s} viewBox="0 0 40 38"><polygon points="20,2 38,35 2,35" fill={fill} stroke={stroke} strokeWidth="1.5" /></svg>;
    case 'd6':   return <svg width={s} height={s} viewBox="0 0 36 36"><rect x="3" y="3" width="30" height="30" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" /><circle cx="11" cy="11" r="2.5" fill={inner} opacity="0.8" /><circle cx="25" cy="25" r="2.5" fill={inner} opacity="0.8" /></svg>;
    case 'd8':   return <svg width={s} height={s} viewBox="0 0 40 44"><polygon points="20,2 38,22 20,42 2,22" fill={fill} stroke={stroke} strokeWidth="1.5" /><line x1="2" y1="22" x2="38" y2="22" stroke={inner} strokeWidth="0.8" opacity="0.6" /><line x1="20" y1="2" x2="20" y2="42" stroke={inner} strokeWidth="0.8" opacity="0.6" /></svg>;
    case 'd10':  return <svg width={s} height={s} viewBox="0 0 40 44"><polygon points="20,2 38,18 32,40 8,40 2,18" fill={fill} stroke={stroke} strokeWidth="1.5" /></svg>;
    case 'd12':  return <svg width={s} height={s} viewBox="0 0 44 44"><polygon points="22,2 40,10 44,30 30,42 14,42 0,30 4,10" fill={fill} stroke={stroke} strokeWidth="1.5" /></svg>;
    case 'd20':  return <svg width={s} height={s} viewBox="0 0 44 42"><polygon points="22,2 44,40 0,40" fill={fill} stroke={stroke} strokeWidth="1.5" /><line x1="22" y1="2" x2="11" y2="40" stroke={inner} strokeWidth="0.7" opacity="0.7" /><line x1="22" y1="2" x2="33" y2="40" stroke={inner} strokeWidth="0.7" opacity="0.7" /><line x1="11" y1="28" x2="33" y2="28" stroke={inner} strokeWidth="0.7" opacity="0.7" /></svg>;
    case 'd100': return <svg width={s} height={s} viewBox="0 0 40 44"><polygon points="20,2 38,18 32,40 8,40 2,18" fill={fill} stroke={stroke} strokeWidth="1.5" /><text x="20" y="27" textAnchor="middle" fontSize="9" fill={inner} fontFamily="serif" opacity="0.9">%</text></svg>;
  }
}

function DieButton({ die, count, onClick }: { die: DieType; count: number; onClick: () => void }) {
  return (
    <button onClick={onClick} title={`Add ${die}`}
      className={clsx('relative flex flex-col items-center justify-center py-2 rounded border transition-all select-none hover:-translate-y-0.5 active:translate-y-0',
        count > 0 ? 'border-blue-500/60 bg-blue-900/20' : 'border-tavern-border hover:border-blue-500/40 bg-tavern-bg/40')}>
      <DieSVG die={die} active={count > 0} />
      <span className="text-[10px] font-serif mt-0.5 text-tavern-muted leading-none">{die}</span>
      {count > 0 && <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none z-10">{count}</span>}
    </button>
  );
}

interface RollResult { notation: string; rolls: RollEntry[]; modifier: number; total: number }

function RollResultDisplay({ result, phase }: { result: RollResult; phase: PhaseState }) {
  return (
    <div className={clsx('rounded-lg border overflow-hidden', phase !== 'idle' ? 'border-blue-500/60' : 'border-tavern-border')}>
      <div className="bg-[#070c1a] text-[11px] text-tavern-muted text-center pt-2 pb-1 font-serif tracking-wider">{result.notation}</div>
      <Suspense fallback={<div className="h-[130px] bg-[#070c1a] flex items-center justify-center text-tavern-muted text-xs">Loading 3D dice...</div>}>
        <DiceCanvas rolls={result.rolls} phase={phase} />
      </Suspense>
      <div className="bg-tavern-bg/80 px-3 pt-2 pb-3">
        {phase !== 'idle' ? (
          <div className="h-14 flex items-center justify-center">
            <span className="text-blue-400/60 text-sm font-serif animate-pulse tracking-widest">Rolling…</span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 justify-center mb-2">
              {result.rolls.map((r, i) => {
                const isMax = r.value === r.sides, isMin = r.value === 1 && r.sides > 1;
                return <span key={i} className={clsx('text-xs font-serif font-bold rounded px-1.5 py-0.5 border', isMax ? 'text-yellow-300 border-yellow-500/50 bg-yellow-900/20' : isMin ? 'text-red-400 border-red-500/40 bg-red-900/20' : 'text-blue-200 border-blue-600/40 bg-blue-900/20')}>{sidesToDie(r.sides)}: {r.value}</span>;
              })}
            </div>
            {result.modifier !== 0 && <div className="text-center text-xs text-tavern-muted font-serif mb-1">{result.modifier > 0 ? `+${result.modifier}` : result.modifier} modifier</div>}
            <div className="text-center font-serif text-3xl font-bold text-blue-300">{result.total}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main PbpDiceRoller ────────────────────────────────────────────────────────

interface Props {
  onRoll: (notation: string, results: number[], total: number) => Promise<void>;
  canRoll: boolean;
  remainingRolls?: number; // undefined = unlimited (DM)
  rollLabel?: string;
}

export default function PbpDiceRoller({ onRoll, canRoll, remainingRolls, rollLabel }: Props) {
  const [counts,     setCounts]     = useState<Record<string, number>>({});
  const [modifier,   setModifier]   = useState(0);
  const [custom,     setCustom]     = useState('');
  const [phase,      setPhase]      = useState<PhaseState>('idle');
  const [lastResult, setLastResult] = useState<RollResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildNotation() {
    const parts = Object.entries(counts).filter(([, c]) => c > 0).map(([d, c]) => `${c}${d}`);
    if (!parts.length) return '';
    let n = parts.join('+');
    if (modifier > 0) n += `+${modifier}`;
    else if (modifier < 0) n += `${modifier}`;
    return n;
  }

  async function doRoll(notation: string) {
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
      phaseTimer.current = setTimeout(() => setPhase('idle'), 700);
    }, 950);

    setSubmitting(true);
    try {
      await onRoll(notation, rolls.map(r => r.value), total);
    } finally {
      setSubmitting(false);
    }
  }

  async function rollAll() {
    const n = buildNotation();
    if (!n || !canRoll) return;
    await doRoll(n);
    setCounts({});
    setModifier(0);
  }

  async function rollCustom() {
    if (!custom.trim() || !canRoll) return;
    await doRoll(custom.trim());
    setCustom('');
  }

  useEffect(() => () => { if (phaseTimer.current) clearTimeout(phaseTimer.current); }, []);

  const isUnlimited = remainingRolls === undefined;
  const noRolls = !isUnlimited && (remainingRolls ?? 0) <= 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Allocation badge */}
      {!isUnlimited && (
        <div className={clsx(
          'flex items-center justify-between text-xs px-2 py-1.5 rounded border',
          noRolls ? 'border-red-900/40 bg-red-900/10 text-red-400/80' : 'border-green-900/40 bg-green-900/10 text-green-400',
        )}>
          <span className="font-serif">
            {rollLabel ? `${rollLabel} — ` : ''}Rolls remaining
          </span>
          <span className="font-bold font-mono text-sm">{remainingRolls}</span>
        </div>
      )}

      {noRolls ? (
        <p className="text-xs text-tavern-muted text-center italic py-2 border border-tavern-border/30 rounded">
          No rolls allocated. Await the Dungeon Master.
        </p>
      ) : (
        <>
          {/* Die selector grid */}
          <div className="grid grid-cols-4 gap-1.5">
            {DICE.map(die => (
              <DieButton key={die} die={die} count={counts[die] ?? 0} onClick={() => setCounts(c => ({ ...c, [die]: (c[die] || 0) + 1 }))} />
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
            disabled={phase !== 'idle' || submitting || Object.values(counts).every(c => c === 0)}
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            {phase !== 'idle' || submitting ? 'Rolling...' : `Roll ${buildNotation() || '—'}`}
          </button>

          {/* Custom notation */}
          <div className="flex gap-2">
            <input className="tavern-input text-sm py-1.5 flex-1" placeholder="2d6+3" value={custom}
              onChange={e => setCustom(e.target.value)} onKeyDown={e => e.key === 'Enter' && rollCustom()} />
            <button onClick={rollCustom} disabled={!custom.trim() || submitting} className="btn-secondary text-xs py-1.5 px-3">Roll</button>
          </div>
        </>
      )}

      {/* 3D result */}
      {lastResult && <RollResultDisplay result={lastResult} phase={phase} />}
    </div>
  );
}
