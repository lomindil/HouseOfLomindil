import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Download, Sliders, ImagePlus } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  onClose: () => void;
  onSave: (blob: Blob, name: string, gridSize: number) => void;
  editMap?: { id: string; name: string; imageUrl: string; gridSize: number };
}

type Preset = 'blank' | 'forest' | 'riverside' | 'dungeon';

const PRESETS: { id: Preset; label: string; emoji: string }[] = [
  { id: 'blank', label: 'Blank', emoji: '⬜' },
  { id: 'forest', label: 'Forest', emoji: '🌲' },
  { id: 'riverside', label: 'Riverside', emoji: '🌊' },
  { id: 'dungeon', label: 'Dungeon', emoji: '🏰' },
];

const TERRAIN: { type: string; emoji: string; label: string }[] = [
  { type: 'tree',    emoji: '🌲', label: 'Tree' },
  { type: 'wall',    emoji: '🧱', label: 'Wall' },
  { type: 'gate',    emoji: '🚪', label: 'Gate' },
  { type: 'tower',   emoji: '🏰', label: 'Tower' },
  { type: 'water',   emoji: '💧', label: 'Water' },
  { type: 'fire',    emoji: '🔥', label: 'Torch' },
  { type: 'chest',   emoji: '💰', label: 'Chest' },
  { type: 'rock',    emoji: '🪨', label: 'Rock' },
  { type: 'bush',    emoji: '🌿', label: 'Bush' },
  { type: 'erase',   emoji: '🧹', label: 'Erase' },
];

interface Stamp {
  col: number;
  row: number;
  emoji: string;
}

const MAP_W = 1200;
const MAP_H = 900;

function drawPreset(ctx: CanvasRenderingContext2D, preset: Preset) {
  ctx.clearRect(0, 0, MAP_W, MAP_H);

  if (preset === 'blank') {
    ctx.fillStyle = '#2d1f0f';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    return;
  }

  if (preset === 'forest') {
    // Ground
    const ground = ctx.createLinearGradient(0, 0, MAP_W, MAP_H);
    ground.addColorStop(0, '#1a3a1a');
    ground.addColorStop(0.5, '#2d5a2d');
    ground.addColorStop(1, '#1a2d1a');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Dirt patches
    ctx.fillStyle = 'rgba(80,50,20,0.25)';
    for (let i = 0; i < 18; i++) {
      const px = Math.sin(i * 137.5) * 0.5 + 0.5;
      const py = Math.cos(i * 137.5) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.ellipse(px * MAP_W, py * MAP_H, 40 + i * 5, 25 + i * 3, Math.PI * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grass texture lines
    ctx.strokeStyle = 'rgba(60,100,40,0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 200; i++) {
      const px = Math.sin(i * 97.3) * 0.5 + 0.5;
      const py = Math.cos(i * 97.3) * 0.5 + 0.5;
      ctx.beginPath();
      ctx.moveTo(px * MAP_W, py * MAP_H);
      ctx.lineTo(px * MAP_W + 8, py * MAP_H - 12);
      ctx.stroke();
    }
    return;
  }

  if (preset === 'riverside') {
    // Land
    const land = ctx.createLinearGradient(0, 0, MAP_W, 0);
    land.addColorStop(0, '#3a2010');
    land.addColorStop(0.3, '#4a3020');
    land.addColorStop(0.45, '#5a4030');
    ctx.fillStyle = land;
    ctx.fillRect(0, 0, MAP_W * 0.55, MAP_H);

    // Right bank
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(MAP_W * 0.75, 0, MAP_W * 0.25, MAP_H);

    // River
    const river = ctx.createLinearGradient(MAP_W * 0.45, 0, MAP_W * 0.75, 0);
    river.addColorStop(0, '#1a3a5a');
    river.addColorStop(0.3, '#1a4a6a');
    river.addColorStop(0.7, '#1a5a7a');
    river.addColorStop(1, '#1a3a5a');
    ctx.fillStyle = river;
    ctx.fillRect(MAP_W * 0.44, 0, MAP_W * 0.32, MAP_H);

    // River ripples
    ctx.strokeStyle = 'rgba(100,180,255,0.15)';
    ctx.lineWidth = 2;
    for (let y = 20; y < MAP_H; y += 30) {
      ctx.beginPath();
      for (let x = MAP_W * 0.44; x < MAP_W * 0.76; x += 4) {
        const wave = Math.sin((x + y) * 0.04) * 4;
        if (x === MAP_W * 0.44) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
    return;
  }

  if (preset === 'dungeon') {
    // Stone floor
    ctx.fillStyle = '#1a1510';
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // Stone tiles
    const tileSize = 80;
    ctx.strokeStyle = 'rgba(60,50,40,0.6)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x <= MAP_W; x += tileSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); ctx.stroke();
    }
    for (let y = 0; y <= MAP_H; y += tileSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_W, y); ctx.stroke();
    }

    // Stone highlights
    ctx.fillStyle = 'rgba(80,70,60,0.12)';
    for (let tx = 0; tx < MAP_W / tileSize; tx++) {
      for (let ty = 0; ty < MAP_H / tileSize; ty++) {
        if ((tx + ty) % 3 === 0) {
          ctx.fillRect(tx * tileSize + 2, ty * tileSize + 2, tileSize - 4, tileSize - 4);
        }
      }
    }

    // Dark vignette edges (walls)
    const vig = ctx.createRadialGradient(MAP_W / 2, MAP_H / 2, MAP_H * 0.3, MAP_W / 2, MAP_H / 2, MAP_H * 0.9);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, MAP_W, MAP_H);
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, gridSize: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= MAP_W; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); ctx.stroke();
  }
  for (let y = 0; y <= MAP_H; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_W, y); ctx.stroke();
  }
}

function drawStamps(ctx: CanvasRenderingContext2D, stamps: Stamp[], gridSize: number) {
  ctx.font = `${Math.round(gridSize * 0.7)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const s of stamps) {
    ctx.fillText(s.emoji, s.col * gridSize + gridSize / 2, s.row * gridSize + gridSize / 2);
  }
}

export default function MapBuilderModal({ onClose, onSave, editMap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [preset, setPreset] = useState<Preset>('blank');
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [gridSize, setGridSize] = useState(editMap?.gridSize ?? 60);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [activeTerrain, setActiveTerrain] = useState<string | null>(null);
  const [mapName, setMapName] = useState(editMap?.name ?? 'Custom Map');
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Load existing map image if editing
  useEffect(() => {
    if (!editMap?.imageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setBgImage(img);
    img.src = editMap.imageUrl;
  }, []);

  function handleImageImport(file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setBgImage(img);
      setStamps([]);
    };
    img.src = url;
  }

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (bgImage) {
      ctx.clearRect(0, 0, MAP_W, MAP_H);
      ctx.drawImage(bgImage, 0, 0, MAP_W, MAP_H);
    } else {
      drawPreset(ctx, preset);
    }
    drawGrid(ctx, gridSize);
    drawStamps(ctx, stamps, gridSize);
  }, [preset, bgImage, gridSize, stamps]);

  useEffect(() => { redraw(); }, [redraw]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!activeTerrain) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = MAP_W / rect.width;
    const scaleY = MAP_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(mx / gridSize);
    const row = Math.floor(my / gridSize);

    if (activeTerrain === 'erase') {
      setStamps((prev) => prev.filter((s) => !(s.col === col && s.row === row)));
    } else {
      const terrain = TERRAIN.find((t) => t.type === activeTerrain);
      if (!terrain) return;
      setStamps((prev) => [
        ...prev.filter((s) => !(s.col === col && s.row === row)),
        { col, row, emoji: terrain.emoji },
      ]);
    }
  }

  async function handleSave() {
    const canvas = canvasRef.current!;
    setSaving(true);
    canvas.toBlob((blob) => {
      if (blob) onSave(blob, mapName, gridSize);
      setSaving(false);
    }, 'image/png');
  }

  const colCount = Math.ceil(MAP_W / gridSize);
  const rowCount = Math.ceil(MAP_H / gridSize);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-tavern-card border border-tavern-border rounded-lg w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-tavern-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-serif text-tavern-gold text-sm">Map Builder</span>
            <input
              className="tavern-input text-sm py-0.5 px-2 w-48"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              placeholder="Map name"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 text-tavern-muted hover:text-tavern-text border border-tavern-border rounded"
              title="Settings"
            >
              <Sliders size={14} />
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
              <Download size={12} /> {saving ? 'Saving...' : editMap ? 'Update Map' : 'Add to Game'}
            </button>
            <button onClick={onClose} className="text-tavern-muted hover:text-tavern-text transition-colors p-1">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Settings bar */}
        {showSettings && (
          <div className="flex items-center gap-4 px-3 py-2 bg-tavern-bg border-b border-tavern-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <label className="text-xs text-tavern-muted whitespace-nowrap">Grid: {gridSize}px</label>
              <input
                type="range" min={20} max={120} step={4} value={gridSize}
                onChange={(e) => setGridSize(parseInt(e.target.value))}
                className="w-32 accent-yellow-500"
              />
              <span className="text-xs text-tavern-muted">{colCount}×{rowCount}</span>
            </div>
            <button onClick={() => setStamps([])} className="text-xs text-red-400 hover:text-red-300 border border-red-900/40 rounded px-2 py-0.5">
              Clear stamps
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-start gap-2 p-2 border-b border-tavern-border flex-shrink-0 flex-wrap">
          {/* Import image */}
          <div className="flex gap-1 mr-1 items-center">
            <button
              onClick={() => imgInputRef.current?.click()}
              title="Import image as background"
              className={clsx(
                'flex flex-col items-center px-2 py-1 rounded border text-xs transition-colors',
                bgImage ? 'border-tavern-gold bg-tavern-gold/10 text-tavern-gold' : 'border-tavern-border text-tavern-muted hover:text-tavern-text'
              )}
            >
              <ImagePlus size={14} />
              <span className="text-[9px] mt-0.5">Import</span>
            </button>
            {bgImage && (
              <button
                onClick={() => setBgImage(null)}
                title="Remove imported image"
                className="flex flex-col items-center px-1.5 py-1 rounded border border-tavern-border text-tavern-muted hover:text-red-400 text-xs transition-colors"
              >
                <X size={12} />
                <span className="text-[9px] mt-0.5">Clear</span>
              </button>
            )}
            <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageImport(e.target.files[0])} />
          </div>

          {/* Presets (disabled when custom image loaded) */}
          <div className={clsx('flex gap-1 mr-2', bgImage && 'opacity-40 pointer-events-none')}>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                title={p.label}
                className={clsx(
                  'flex flex-col items-center px-2 py-1 rounded border text-xs transition-colors',
                  preset === p.id && !bgImage ? 'border-tavern-gold bg-tavern-gold/10 text-tavern-gold' : 'border-tavern-border text-tavern-muted hover:text-tavern-text'
                )}
              >
                <span>{p.emoji}</span>
                <span className="text-[9px] mt-0.5">{p.label}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-8 bg-tavern-border mx-1 self-center" />

          {/* Terrain stamps */}
          <div className="flex gap-1 flex-wrap">
            {TERRAIN.map((t) => (
              <button
                key={t.type}
                onClick={() => setActiveTerrain(activeTerrain === t.type ? null : t.type)}
                title={t.label}
                className={clsx(
                  'flex flex-col items-center px-1.5 py-1 rounded border text-xs transition-colors',
                  activeTerrain === t.type ? 'border-tavern-gold bg-tavern-gold/10' : 'border-tavern-border text-tavern-muted hover:text-tavern-text'
                )}
              >
                <span>{t.emoji}</span>
                <span className="text-[9px] mt-0.5">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-black p-2 flex items-center justify-center min-h-0">
          <canvas
            ref={canvasRef}
            width={MAP_W}
            height={MAP_H}
            onClick={handleCanvasClick}
            className={clsx(
              'max-w-full max-h-full object-contain',
              activeTerrain ? 'cursor-crosshair' : 'cursor-default'
            )}
            style={{ maxHeight: 'calc(95vh - 220px)' }}
          />
        </div>

        {/* Status bar */}
        <div className="px-3 py-1.5 border-t border-tavern-border text-xs text-tavern-muted flex items-center gap-3 flex-shrink-0">
          <span>{MAP_W}×{MAP_H}px canvas</span>
          <span>{stamps.length} terrain stamps</span>
          {activeTerrain && (
            <span className="text-tavern-gold">
              Placing: {TERRAIN.find((t) => t.type === activeTerrain)?.emoji} {TERRAIN.find((t) => t.type === activeTerrain)?.label} — click to stamp
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
