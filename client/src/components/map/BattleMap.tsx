import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KImage, Line, Rect, Circle, Group, Text } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { useGameStore } from '../../store/game';
import type { Token, Drawing, MapData } from '../../store/game';
import { useAuthStore } from '../../store/auth';
import clsx from 'clsx';
import { Move, Pen, Square, Minus, Eye, EyeOff, Eraser, ZoomIn, ZoomOut, RotateCcw, Circle as CircleIcon, Plus, Trash2 } from 'lucide-react';

type Tool = 'select' | 'pen' | 'line' | 'rect' | 'circle' | 'fog' | 'fog-erase' | 'token-add';

const COLORS = ['#ff4444', '#ff8800', '#ffff00', '#44ff44', '#4488ff', '#aa44ff', '#ffffff', '#888888'];

function TokenShape({ token, isDraggable, onDragEnd }: {
  token: Token;
  isDraggable: boolean;
  onDragEnd: (id: string, x: number, y: number) => void;
}) {
  const [img] = useImage(token.avatarUrl || '');

  return (
    <Group
      x={token.x} y={token.y}
      draggable={isDraggable}
      onDragEnd={(e) => onDragEnd(token.id, e.target.x(), e.target.y())}
    >
      <Circle radius={token.size / 2} fill={token.color} stroke="white" strokeWidth={2} opacity={0.95} />
      {img && <KImage image={img} x={-token.size / 2} y={-token.size / 2} width={token.size} height={token.size} cornerRadius={token.size / 2} />}
      <Text text={token.label} x={-token.size / 2} y={token.size / 2 + 2} width={token.size} align="center" fontSize={10} fill="#fff" />
    </Group>
  );
}

function FogLayer({ fogData, gridSize, width, height, isDM }: {
  fogData: Record<string, boolean>;
  gridSize: number;
  width: number;
  height: number;
  isDM: boolean;
}) {
  const cols = Math.ceil(width / gridSize);
  const rows = Math.ceil(height / gridSize);
  const cells: React.ReactNode[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const key = `${col},${row}`;
      const fogged = fogData[key];
      if (fogged) {
        cells.push(
          <Rect
            key={key} x={col * gridSize} y={row * gridSize}
            width={gridSize} height={gridSize}
            fill={isDM ? 'rgba(0,0,0,0.82)' : 'black'}
          />
        );
      }
    }
  }
  return <>{cells}</>;
}

interface BattleMapProps {
  map: MapData;
  isDM: boolean;
}

export default function BattleMap({ map, isDM }: BattleMapProps) {
  const { socket, updateToken: storeUpdateToken, addToken: storeAddToken, removeToken: storeRemoveToken,
    updateDrawings: storeUpdateDrawings, updateFog: storeUpdateFog } = useGameStore();
  const { user } = useAuthStore();
  const [mapImg] = useImage(map.image_url);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState('#ff4444');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drawings, setDrawings] = useState<Drawing[]>(map.drawings || []);
  const [fogData, setFogData] = useState<Record<string, boolean>>(map.fog_data || {});
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [showAddToken, setShowAddToken] = useState(false);
  const [tokenLabel, setTokenLabel] = useState('');
  const [tokenColor, setTokenColor] = useState('#4488ff');
  const [tokenUserId, setTokenUserId] = useState('');
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 600 });

  const tokens = map.tokens || [];

  useEffect(() => {
    setDrawings(map.drawings || []);
    setFogData(map.fog_data || {});
  }, [map.id]);

  useEffect(() => {
    function resize() {
      if (containerRef.current) {
        setStageSize({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight });
      }
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const imgWidth = mapImg?.width || 1000;
  const imgHeight = mapImg?.height || 800;

  function getCellFromPos(pos: { x: number; y: number }) {
    const col = Math.floor((pos.x - offset.x) / (map.grid_size * scale));
    const row = Math.floor((pos.y - offset.y) / (map.grid_size * scale));
    return { col, row };
  }

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (tool === 'select') return;
    const pos = e.target.getStage()!.getPointerPosition()!;
    const relX = (pos.x - offset.x) / scale;
    const relY = (pos.y - offset.y) / scale;

    if (tool === 'fog' || tool === 'fog-erase') {
      if (!isDM) return;
      const { col, row } = getCellFromPos(pos);
      const key = `${col},${row}`;
      const next = { ...fogData };
      if (tool === 'fog') next[key] = true;
      else delete next[key];
      setFogData(next);
      setIsDrawing(true);
      return;
    }

    setIsDrawing(true);
    setCurrentPoints([relX, relY]);
  }

  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!isDrawing) return;
    const pos = e.target.getStage()!.getPointerPosition()!;
    const relX = (pos.x - offset.x) / scale;
    const relY = (pos.y - offset.y) / scale;

    if (tool === 'fog' || tool === 'fog-erase') {
      if (!isDM) return;
      const { col, row } = getCellFromPos(pos);
      const key = `${col},${row}`;
      const next = { ...fogData };
      if (tool === 'fog') next[key] = true;
      else delete next[key];
      setFogData(next);
      return;
    }

    if (tool === 'pen') {
      setCurrentPoints((pts) => [...pts, relX, relY]);
    } else {
      setCurrentPoints((pts) => [pts[0], pts[1], relX, relY]);
    }
  }

  function handleMouseUp() {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === 'fog' || tool === 'fog-erase') {
      if (isDM && socket) {
        socket.emit('fog_update', { mapId: map.id, fogData });
        storeUpdateFog(map.id, fogData);
      }
      return;
    }

    if (currentPoints.length >= 4) {
      const newDrawing: Drawing = {
        id: crypto.randomUUID(),
        tool: tool as Drawing['tool'],
        points: currentPoints,
        color,
        strokeWidth,
      };
      const next = [...drawings, newDrawing];
      setDrawings(next);
      if (socket && isDM) {
        socket.emit('map_draw', { mapId: map.id, drawings: next });
        storeUpdateDrawings(map.id, next);
      }
    }
    setCurrentPoints([]);
  }

  function handleTokenDrag(tokenId: string, x: number, y: number) {
    const relX = (x - offset.x) / scale;
    const relY = (y - offset.y) / scale;

    if (socket) {
      socket.emit('token_move', { mapId: map.id, tokenId, x: relX, y: relY });
      storeUpdateToken(map.id, tokenId, relX, relY);
    }
  }

  function canMoveToken(token: Token) {
    return isDM || token.userId === user?.id;
  }

  function addToken() {
    if (!tokenLabel.trim() || !isDM) return;
    const token = {
      label: tokenLabel.trim(),
      color: tokenColor,
      userId: tokenUserId || undefined,
      x: (stageSize.w / 2 - offset.x) / scale,
      y: (stageSize.h / 2 - offset.y) / scale,
      size: map.grid_size * 0.8,
    };
    socket?.emit('token_add', { mapId: map.id, token });
    setShowAddToken(false);
    setTokenLabel('');
  }

  function removeSelectedToken(tokenId: string) {
    if (!isDM) return;
    socket?.emit('token_remove', { mapId: map.id, tokenId });
    storeRemoveToken(map.id, tokenId);
  }

  function clearDrawings() {
    if (!isDM) return;
    setDrawings([]);
    socket?.emit('map_draw', { mapId: map.id, drawings: [] });
    storeUpdateDrawings(map.id, []);
  }

  const gridLines: React.ReactNode[] = [];
  for (let x = 0; x <= imgWidth; x += map.grid_size) {
    gridLines.push(<Line key={`v${x}`} points={[x, 0, x, imgHeight]} stroke={map.grid_color} strokeWidth={0.5} opacity={map.grid_opacity} />);
  }
  for (let y = 0; y <= imgHeight; y += map.grid_size) {
    gridLines.push(<Line key={`h${y}`} points={[0, y, imgWidth, y]} stroke={map.grid_color} strokeWidth={0.5} opacity={map.grid_opacity} />);
  }

  const cursorClass = {
    select: 'map-pan',
    pen: 'map-draw', line: 'map-draw', rect: 'map-draw', circle: 'map-draw',
    fog: 'map-fog', 'fog-erase': 'map-erase',
    'token-add': 'cursor-copy',
  }[tool];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-tavern-border bg-tavern-card flex-wrap">
        {[
          { id: 'select', icon: <Move size={14} />, label: 'Pan' },
          { id: 'pen', icon: <Pen size={14} />, label: 'Draw' },
          { id: 'line', icon: <Minus size={14} />, label: 'Line' },
          { id: 'rect', icon: <Square size={14} />, label: 'Rect' },
          { id: 'circle', icon: <CircleIcon size={14} />, label: 'Circle' },
        ].map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => setTool(id as Tool)}
            title={label}
            className={clsx(
              'p-1.5 rounded border text-xs transition-colors',
              tool === id ? 'border-tavern-gold text-tavern-gold' : 'border-tavern-border text-tavern-muted hover:text-tavern-text'
            )}
          >{icon}</button>
        ))}

        {isDM && <>
          <div className="w-px h-5 bg-tavern-border mx-1" />
          {[
            { id: 'fog', icon: <Eye size={14} />, label: 'Add Fog' },
            { id: 'fog-erase', icon: <EyeOff size={14} />, label: 'Remove Fog' },
          ].map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => setTool(id as Tool)}
              title={label}
              className={clsx(
                'p-1.5 rounded border text-xs transition-colors',
                tool === id ? 'border-tavern-gold text-tavern-gold' : 'border-tavern-border text-tavern-muted hover:text-tavern-text'
              )}
            >{icon}</button>
          ))}
          <button onClick={() => { setShowAddToken(!showAddToken); setTool('select'); }} title="Add Token"
            className="p-1.5 rounded border border-tavern-border text-tavern-muted hover:text-tavern-text text-xs transition-colors">
            <Plus size={14} />
          </button>
          <button onClick={clearDrawings} title="Clear Drawings"
            className="p-1.5 rounded border border-tavern-border text-tavern-muted hover:text-red-400 text-xs transition-colors">
            <Eraser size={14} />
          </button>
        </>}

        <div className="w-px h-5 bg-tavern-border mx-1" />

        {/* Color picker */}
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button key={c} className={clsx('w-5 h-5 rounded-full border-2 transition-transform', color === c ? 'border-white scale-125' : 'border-transparent')}
              style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>

        <div className="w-px h-5 bg-tavern-border mx-1" />

        {/* Zoom */}
        <button onClick={() => setScale((s) => Math.min(s + 0.2, 4))} className="p-1.5 rounded border border-tavern-border text-tavern-muted hover:text-tavern-text"><ZoomIn size={14} /></button>
        <span className="text-xs text-tavern-muted w-12 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.max(s - 0.2, 0.2))} className="p-1.5 rounded border border-tavern-border text-tavern-muted hover:text-tavern-text"><ZoomOut size={14} /></button>
        <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} className="p-1.5 rounded border border-tavern-border text-tavern-muted hover:text-tavern-text"><RotateCcw size={14} /></button>
      </div>

      {/* Add token form */}
      {showAddToken && isDM && (
        <div className="flex items-center gap-2 p-2 bg-tavern-bg border-b border-tavern-border text-sm">
          <input className="tavern-input py-1 text-xs w-32" placeholder="Token label" value={tokenLabel} onChange={(e) => setTokenLabel(e.target.value)} />
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button key={c} className={clsx('w-4 h-4 rounded-full border', tokenColor === c ? 'border-white' : 'border-transparent')}
                style={{ background: c }} onClick={() => setTokenColor(c)} />
            ))}
          </div>
          <button onClick={addToken} className="btn-primary text-xs py-1 px-2">Add</button>
          <button onClick={() => setShowAddToken(false)} className="btn-secondary text-xs py-1 px-2">Cancel</button>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} className={clsx('flex-1 overflow-hidden bg-black relative', cursorClass)}>
        <Stage
          ref={stageRef}
          width={stageSize.w}
          height={stageSize.h}
          scaleX={scale}
          scaleY={scale}
          x={offset.x}
          y={offset.y}
          draggable={tool === 'select'}
          onDragEnd={(e) => setOffset({ x: e.target.x(), y: e.target.y() })}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={(e) => {
            e.evt.preventDefault();
            const delta = e.evt.deltaY > 0 ? -0.1 : 0.1;
            setScale((s) => Math.max(0.2, Math.min(4, s + delta)));
          }}
        >
          {/* Map image */}
          <Layer>
            {mapImg && <KImage image={mapImg} width={imgWidth} height={imgHeight} />}
            {gridLines}
          </Layer>

          {/* Drawings */}
          <Layer>
            {drawings.map((d) => {
              if (d.tool === 'pen') return <Line key={d.id} points={d.points} stroke={d.color} strokeWidth={d.strokeWidth} tension={0.5} lineCap="round" />;
              if (d.tool === 'line') return <Line key={d.id} points={d.points} stroke={d.color} strokeWidth={d.strokeWidth} />;
              if (d.tool === 'rect') {
                const [x1, y1, x2, y2] = d.points;
                return <Rect key={d.id} x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} stroke={d.color} strokeWidth={d.strokeWidth} fill="transparent" />;
              }
              if (d.tool === 'circle') {
                const [x1, y1, x2, y2] = d.points;
                const r = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                return <Circle key={d.id} x={x1} y={y1} radius={r} stroke={d.color} strokeWidth={d.strokeWidth} fill="transparent" />;
              }
              return null;
            })}

            {/* Current drawing preview */}
            {isDrawing && currentPoints.length >= 4 && (() => {
              const [x1, y1, x2, y2] = currentPoints;
              if (tool === 'pen') return <Line points={currentPoints} stroke={color} strokeWidth={strokeWidth} tension={0.5} lineCap="round" />;
              if (tool === 'line') return <Line points={[x1, y1, x2, y2]} stroke={color} strokeWidth={strokeWidth} />;
              if (tool === 'rect') return <Rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} stroke={color} strokeWidth={strokeWidth} fill="transparent" />;
              if (tool === 'circle') {
                const r = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                return <Circle x={x1} y={y1} radius={r} stroke={color} strokeWidth={strokeWidth} fill="transparent" />;
              }
              return null;
            })()}
          </Layer>

          {/* Fog of war */}
          <Layer>
            <FogLayer fogData={fogData} gridSize={map.grid_size} width={imgWidth} height={imgHeight} isDM={isDM} />
          </Layer>

          {/* Tokens */}
          <Layer>
            {tokens.map((token) => (
              <TokenShape
                key={token.id}
                token={token}
                isDraggable={canMoveToken(token)}
                onDragEnd={handleTokenDrag}
              />
            ))}
          </Layer>
        </Stage>

        {/* Token right-click remove (DM) */}
        {isDM && tokens.length > 0 && (
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {tokens.map((t) => (
              <button
                key={t.id}
                onClick={() => removeSelectedToken(t.id)}
                className="flex items-center gap-1 text-xs bg-tavern-card border border-tavern-border rounded px-2 py-1 text-tavern-muted hover:text-red-400 transition-colors"
              >
                <Trash2 size={10} /> {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
