import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Download, Sliders, ImagePlus, Minus, Plus, Pencil, Minus as LineIcon, Square, Circle } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  onClose: () => void;
  onSave: (blob: Blob, name: string, gridSize: number) => void;
  editMap?: { id: string; name: string; imageUrl: string; gridSize: number };
}

type Preset = 'blank' | 'forest' | 'riverside' | 'dungeon';
type DrawTool = 'pen' | 'line' | 'rect' | 'circle';

const PRESETS: { id: Preset; label: string; emoji: string }[] = [
  { id: 'blank',    label: 'Blank',    emoji: '⬜' },
  { id: 'forest',   label: 'Forest',   emoji: '🌲' },
  { id: 'riverside',label: 'Riverside',emoji: '🌊' },
  { id: 'dungeon',  label: 'Dungeon',  emoji: '🏰' },
];

const TERRAIN: { type: string; emoji: string; label: string }[] = [
  { type: 'tree',  emoji: '🌲', label: 'Tree'  },
  { type: 'wall',  emoji: '🧱', label: 'Wall'  },
  { type: 'gate',  emoji: '🚪', label: 'Gate'  },
  { type: 'tower', emoji: '🏰', label: 'Tower' },
  { type: 'water', emoji: '💧', label: 'Water' },
  { type: 'fire',  emoji: '🔥', label: 'Torch' },
  { type: 'chest', emoji: '💰', label: 'Chest' },
  { type: 'rock',  emoji: '🪨', label: 'Rock'  },
  { type: 'bush',  emoji: '🌿', label: 'Bush'  },
  { type: 'erase', emoji: '🧹', label: 'Erase' },
];

const DRAW_TOOLS: { id: DrawTool; icon: React.ReactNode; label: string }[] = [
  { id: 'pen',    icon: <Pencil size={13} />,   label: 'Pen'   },
  { id: 'line',   icon: <LineIcon size={13} />, label: 'Line'  },
  { id: 'rect',   icon: <Square size={13} />,   label: 'Rect'  },
  { id: 'circle', icon: <Circle size={13} />,   label: 'Circle'},
];

interface Stamp { col: number; row: number; emoji: string }
interface CanvasDrawing { tool: DrawTool; points: number[]; color: string; width: number }

const MAP_W = 1200;
const MAP_H = 900;

function drawPreset(ctx: CanvasRenderingContext2D, preset: Preset) {
  ctx.clearRect(0, 0, MAP_W, MAP_H);
  if (preset === 'blank') {
    ctx.fillStyle = '#2d1f0f'; ctx.fillRect(0, 0, MAP_W, MAP_H); return;
  }
  if (preset === 'forest') {
    const ground = ctx.createLinearGradient(0, 0, MAP_W, MAP_H);
    ground.addColorStop(0, '#1a3a1a'); ground.addColorStop(0.5, '#2d5a2d'); ground.addColorStop(1, '#1a2d1a');
    ctx.fillStyle = ground; ctx.fillRect(0, 0, MAP_W, MAP_H);
    ctx.fillStyle = 'rgba(80,50,20,0.25)';
    for (let i = 0; i < 18; i++) {
      const px = Math.sin(i * 137.5) * 0.5 + 0.5, py = Math.cos(i * 137.5) * 0.5 + 0.5;
      ctx.beginPath(); ctx.ellipse(px * MAP_W, py * MAP_H, 40 + i * 5, 25 + i * 3, Math.PI * 0.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(60,100,40,0.18)'; ctx.lineWidth = 1;
    for (let i = 0; i < 200; i++) {
      const px = Math.sin(i * 97.3) * 0.5 + 0.5, py = Math.cos(i * 97.3) * 0.5 + 0.5;
      ctx.beginPath(); ctx.moveTo(px * MAP_W, py * MAP_H); ctx.lineTo(px * MAP_W + 8, py * MAP_H - 12); ctx.stroke();
    }
    return;
  }
  if (preset === 'riverside') {
    const land = ctx.createLinearGradient(0, 0, MAP_W, 0);
    land.addColorStop(0, '#3a2010'); land.addColorStop(0.3, '#4a3020'); land.addColorStop(0.45, '#5a4030');
    ctx.fillStyle = land; ctx.fillRect(0, 0, MAP_W * 0.55, MAP_H);
    ctx.fillStyle = '#3a2010'; ctx.fillRect(MAP_W * 0.75, 0, MAP_W * 0.25, MAP_H);
    const river = ctx.createLinearGradient(MAP_W * 0.45, 0, MAP_W * 0.75, 0);
    river.addColorStop(0, '#1a3a5a'); river.addColorStop(0.3, '#1a4a6a'); river.addColorStop(0.7, '#1a5a7a'); river.addColorStop(1, '#1a3a5a');
    ctx.fillStyle = river; ctx.fillRect(MAP_W * 0.44, 0, MAP_W * 0.32, MAP_H);
    ctx.strokeStyle = 'rgba(100,180,255,0.15)'; ctx.lineWidth = 2;
    for (let y = 20; y < MAP_H; y += 30) {
      ctx.beginPath();
      for (let x = MAP_W * 0.44; x < MAP_W * 0.76; x += 4) {
        const wave = Math.sin((x + y) * 0.04) * 4;
        if (x === MAP_W * 0.44) ctx.moveTo(x, y + wave); else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
    return;
  }
  if (preset === 'dungeon') {
    ctx.fillStyle = '#1a1510'; ctx.fillRect(0, 0, MAP_W, MAP_H);
    const tileSize = 80;
    ctx.strokeStyle = 'rgba(60,50,40,0.6)'; ctx.lineWidth = 1.5;
    for (let x = 0; x <= MAP_W; x += tileSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); ctx.stroke(); }
    for (let y = 0; y <= MAP_H; y += tileSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_W, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(80,70,60,0.12)';
    for (let tx = 0; tx < MAP_W / tileSize; tx++)
      for (let ty = 0; ty < MAP_H / tileSize; ty++)
        if ((tx + ty) % 3 === 0) ctx.fillRect(tx * tileSize + 2, ty * tileSize + 2, tileSize - 4, tileSize - 4);
    const vig = ctx.createRadialGradient(MAP_W / 2, MAP_H / 2, MAP_H * 0.3, MAP_W / 2, MAP_H / 2, MAP_H * 0.9);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, MAP_W, MAP_H);
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, gridSize: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 0.5;
  for (let x = 0; x <= MAP_W; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); ctx.stroke(); }
  for (let y = 0; y <= MAP_H; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_W, y); ctx.stroke(); }
}

function drawStamps(ctx: CanvasRenderingContext2D, stamps: Stamp[], gridSize: number) {
  ctx.font = `${Math.round(gridSize * 0.7)}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const s of stamps) ctx.fillText(s.emoji, s.col * gridSize + gridSize / 2, s.row * gridSize + gridSize / 2);
}

function renderDrawing(ctx: CanvasRenderingContext2D, d: CanvasDrawing) {
  ctx.strokeStyle = d.color; ctx.lineWidth = d.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (d.tool === 'pen' && d.points.length >= 4) {
    ctx.beginPath(); ctx.moveTo(d.points[0], d.points[1]);
    for (let i = 2; i < d.points.length; i += 2) ctx.lineTo(d.points[i], d.points[i + 1]);
    ctx.stroke();
  } else if (d.tool === 'line' && d.points.length >= 4) {
    ctx.beginPath(); ctx.moveTo(d.points[0], d.points[1]); ctx.lineTo(d.points[2], d.points[3]); ctx.stroke();
  } else if (d.tool === 'rect' && d.points.length >= 4) {
    ctx.beginPath(); ctx.strokeRect(d.points[0], d.points[1], d.points[2] - d.points[0], d.points[3] - d.points[1]);
  } else if (d.tool === 'circle' && d.points.length >= 4) {
    const rx = Math.abs(d.points[2] - d.points[0]) / 2, ry = Math.abs(d.points[3] - d.points[1]) / 2;
    const cx = (d.points[0] + d.points[2]) / 2, cy = (d.points[1] + d.points[3]) / 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2); ctx.stroke();
  }
}

export default function MapBuilderModal({ onClose, onSave, editMap }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const overlayRef  = useRef<HTMLCanvasElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [preset,       setPreset]       = useState<Preset>('blank');
  const [bgImage,      setBgImage]      = useState<HTMLImageElement | null>(null);
  const [gridSize,     setGridSize]     = useState(editMap?.gridSize ?? 60);
  const [stamps,       setStamps]       = useState<Stamp[]>([]);
  const [activeTerrain,setActiveTerrain]= useState<string | null>(null);
  const [mapName,      setMapName]      = useState(editMap?.name ?? 'Custom Map');
  const [saving,       setSaving]       = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Drawing
  const [drawTool,   setDrawTool]   = useState<DrawTool | null>(null);
  const [drawColor,  setDrawColor]  = useState('#ef4444');
  const [drawWidth,  setDrawWidth]  = useState(3);
  const [drawings,   setDrawings]   = useState<CanvasDrawing[]>([]);
  const isDrawingRef   = useRef(false);
  const drawStartRef   = useRef<[number, number] | null>(null);
  const penPointsRef   = useRef<[number, number][]>([]);

  // Zoom
  const [zoom, setZoom] = useState(0.75);
  const ZOOM_STEP = 0.25, ZOOM_MIN = 0.25, ZOOM_MAX = 3;

  // Load existing map for editing
  useEffect(() => {
    if (!editMap?.imageUrl) return;
    const img = new Image();
    img.onload  = () => setBgImage(img);
    img.onerror = () => console.warn('Could not load map image for editing');
    img.src = editMap.imageUrl;
  }, []);

  function handleImageImport(file: File) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setBgImage(img); setStamps([]); };
    img.src = url;
  }

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (bgImage) { ctx.clearRect(0, 0, MAP_W, MAP_H); ctx.drawImage(bgImage, 0, 0, MAP_W, MAP_H); }
    else drawPreset(ctx, preset);
    drawGrid(ctx, gridSize);
    drawStamps(ctx, stamps, gridSize);
    for (const d of drawings) renderDrawing(ctx, d);
  }, [preset, bgImage, gridSize, stamps, drawings]);

  useEffect(() => { redraw(); }, [redraw]);

  // Helpers
  function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement>): [number, number] {
    const canvas = overlayRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) * (MAP_W / rect.width), (e.clientY - rect.top) * (MAP_H / rect.height)];
  }

  function clearOverlay() {
    const canvas = overlayRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, MAP_W, MAP_H);
  }

  function renderOverlayPreview(ex: number, ey: number) {
    const canvas = overlayRef.current;
    if (!canvas || !drawTool) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, MAP_W, MAP_H);
    if (!drawStartRef.current) return;
    const d: CanvasDrawing = drawTool === 'pen'
      ? { tool: 'pen', points: penPointsRef.current.flatMap(p => p), color: drawColor, width: drawWidth }
      : { tool: drawTool, points: [...drawStartRef.current, ex, ey], color: drawColor, width: drawWidth };
    renderDrawing(ctx, d);
  }

  // Mouse handlers on overlay
  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawTool) return;
    const [x, y] = getCanvasCoords(e);
    isDrawingRef.current = true;
    drawStartRef.current = [x, y];
    penPointsRef.current = [[x, y]];
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !drawTool) return;
    const [x, y] = getCanvasCoords(e);
    if (drawTool === 'pen') penPointsRef.current.push([x, y]);
    renderOverlayPreview(x, y);
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || !drawTool) return;
    const [x, y] = getCanvasCoords(e);
    isDrawingRef.current = false;
    clearOverlay();
    if (drawTool === 'pen') {
      const pts = penPointsRef.current;
      if (pts.length >= 2) setDrawings(prev => [...prev, { tool: 'pen', points: pts.flatMap(p => p), color: drawColor, width: drawWidth }]);
    } else if (drawStartRef.current) {
      setDrawings(prev => [...prev, { tool: drawTool, points: [...drawStartRef.current!, x, y], color: drawColor, width: drawWidth }]);
    }
    drawStartRef.current = null;
    penPointsRef.current = [];
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (drawTool) return;
    if (!activeTerrain) return;
    const [mx, my] = getCanvasCoords(e);
    const col = Math.floor(mx / gridSize), row = Math.floor(my / gridSize);
    if (activeTerrain === 'erase') {
      setStamps(prev => prev.filter(s => !(s.col === col && s.row === row)));
    } else {
      const terrain = TERRAIN.find(t => t.type === activeTerrain);
      if (!terrain) return;
      setStamps(prev => [...prev.filter(s => !(s.col === col && s.row === row)), { col, row, emoji: terrain.emoji }]);
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
  const canvasW  = MAP_W * zoom;
  const canvasH  = MAP_H * zoom;

  const overlayCursor = drawTool ? 'cursor-crosshair' : activeTerrain ? 'cursor-crosshair' : 'cursor-default';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-tavern-card border border-tavern-border rounded-lg w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">

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
            {/* Zoom controls */}
            <div className="flex items-center gap-1 border border-tavern-border rounded px-1">
              <button onClick={() => setZoom(z => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))} className="p-1 text-tavern-muted hover:text-tavern-text" title="Zoom out">
                <Minus size={12} />
              </button>
              <span className="text-xs text-tavern-muted w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))} className="p-1 text-tavern-muted hover:text-tavern-text" title="Zoom in">
                <Plus size={12} />
              </button>
            </div>
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
          <div className="flex items-center gap-4 px-3 py-2 bg-tavern-bg border-b border-tavern-border flex-shrink-0 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-tavern-muted whitespace-nowrap">Grid: {gridSize}px</label>
              <input type="range" min={20} max={120} step={4} value={gridSize} onChange={(e) => setGridSize(parseInt(e.target.value))} className="w-28 accent-yellow-500" />
              <span className="text-xs text-tavern-muted">{colCount}×{rowCount}</span>
            </div>
            <button onClick={() => setStamps([])} className="text-xs text-red-400 hover:text-red-300 border border-red-900/40 rounded px-2 py-0.5">Clear stamps</button>
            <button onClick={() => setDrawings([])} className="text-xs text-red-400 hover:text-red-300 border border-red-900/40 rounded px-2 py-0.5">Clear drawings</button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-start gap-2 p-2 border-b border-tavern-border flex-shrink-0 flex-wrap">
          {/* Image import */}
          <div className="flex gap-1 mr-1 items-center">
            <button
              onClick={() => imgInputRef.current?.click()}
              title="Import image as background"
              className={clsx('flex flex-col items-center px-2 py-1 rounded border text-xs transition-colors',
                bgImage ? 'border-tavern-gold bg-tavern-gold/10 text-tavern-gold' : 'border-tavern-border text-tavern-muted hover:text-tavern-text')}
            >
              <ImagePlus size={14} />
              <span className="text-[9px] mt-0.5">Import</span>
            </button>
            {bgImage && (
              <button onClick={() => setBgImage(null)} title="Remove image"
                className="flex flex-col items-center px-1.5 py-1 rounded border border-tavern-border text-tavern-muted hover:text-red-400 text-xs transition-colors">
                <X size={12} /><span className="text-[9px] mt-0.5">Clear</span>
              </button>
            )}
            <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageImport(e.target.files[0])} />
          </div>

          {/* Presets */}
          <div className={clsx('flex gap-1 mr-2', bgImage && 'opacity-40 pointer-events-none')}>
            {PRESETS.map((p) => (
              <button key={p.id} onClick={() => setPreset(p.id)} title={p.label}
                className={clsx('flex flex-col items-center px-2 py-1 rounded border text-xs transition-colors',
                  preset === p.id && !bgImage ? 'border-tavern-gold bg-tavern-gold/10 text-tavern-gold' : 'border-tavern-border text-tavern-muted hover:text-tavern-text')}>
                <span>{p.emoji}</span><span className="text-[9px] mt-0.5">{p.label}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-8 bg-tavern-border mx-1 self-center" />

          {/* Terrain stamps */}
          <div className="flex gap-1 flex-wrap">
            {TERRAIN.map((t) => (
              <button key={t.type}
                onClick={() => { setActiveTerrain(activeTerrain === t.type ? null : t.type); setDrawTool(null); }}
                title={t.label}
                className={clsx('flex flex-col items-center px-1.5 py-1 rounded border text-xs transition-colors',
                  activeTerrain === t.type ? 'border-tavern-gold bg-tavern-gold/10' : 'border-tavern-border text-tavern-muted hover:text-tavern-text')}>
                <span>{t.emoji}</span><span className="text-[9px] mt-0.5">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-8 bg-tavern-border mx-1 self-center" />

          {/* Drawing tools */}
          <div className="flex items-center gap-1">
            {DRAW_TOOLS.map((dt) => (
              <button key={dt.id}
                onClick={() => { setDrawTool(drawTool === dt.id ? null : dt.id); setActiveTerrain(null); }}
                title={dt.label}
                className={clsx('flex flex-col items-center px-2 py-1 rounded border text-xs transition-colors',
                  drawTool === dt.id ? 'border-tavern-gold bg-tavern-gold/10 text-tavern-gold' : 'border-tavern-border text-tavern-muted hover:text-tavern-text')}>
                {dt.icon}<span className="text-[9px] mt-0.5">{dt.label}</span>
              </button>
            ))}
            {drawTool && (
              <>
                <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)}
                  className="w-7 h-7 rounded border border-tavern-border cursor-pointer bg-transparent"
                  title="Draw color" />
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-tavern-muted">W</span>
                  <input type="range" min={1} max={20} step={1} value={drawWidth} onChange={(e) => setDrawWidth(parseInt(e.target.value))}
                    className="w-16 accent-yellow-500" title="Stroke width" />
                  <span className="text-[9px] text-tavern-muted">{drawWidth}px</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Canvas area — scrollable when zoomed */}
        <div className="flex-1 min-h-0 overflow-auto bg-black">
          <div style={{ padding: 8, minWidth: canvasW + 16, minHeight: canvasH + 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: canvasW, height: canvasH, flexShrink: 0 }}>
              {/* Main canvas */}
              <canvas ref={canvasRef} width={MAP_W} height={MAP_H}
                style={{ display: 'block', width: canvasW, height: canvasH }} />
              {/* Drawing overlay canvas */}
              <canvas ref={overlayRef} width={MAP_W} height={MAP_H}
                style={{ position: 'absolute', top: 0, left: 0, width: canvasW, height: canvasH }}
                className={overlayCursor}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={(e) => { if (isDrawingRef.current) handleMouseUp(e); }}
                onClick={handleOverlayClick}
              />
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="px-3 py-1.5 border-t border-tavern-border text-xs text-tavern-muted flex items-center gap-3 flex-shrink-0">
          <span>{MAP_W}×{MAP_H}px</span>
          <span>{stamps.length} stamps</span>
          <span>{drawings.length} drawings</span>
          {activeTerrain && <span className="text-tavern-gold">Stamping: {TERRAIN.find(t => t.type === activeTerrain)?.emoji} {TERRAIN.find(t => t.type === activeTerrain)?.label}</span>}
          {drawTool && <span className="text-tavern-gold">Drawing: {drawTool}</span>}
        </div>
      </div>
    </div>
  );
}
