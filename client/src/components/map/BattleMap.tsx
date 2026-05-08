import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KImage, Line, Rect, Circle, Group, Text } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { useGameStore } from '../../store/game';
import type { Token, Drawing, MapData } from '../../store/game';
import { useAuthStore } from '../../store/auth';
import clsx from 'clsx';
import { Move, Pen, Square, Minus, Eye, EyeOff, Eraser, ZoomIn, ZoomOut, RotateCcw, Circle as CircleIcon, Plus, Trash2, ImagePlus, Layers } from 'lucide-react';
import api from '../../lib/api';
import { getMonsterAvatar, getRaceAvatar, avatarStyle } from '../../lib/avatars';

const MAP_UTILS = [
  { label: '🌲', name: 'Tree', color: '#2d6a1f' },
  { label: '🪨', name: 'Rock', color: '#6b7280' },
  { label: '🚪', name: 'Gate', color: '#8b5e3c' },
  { label: '🔥', name: 'Fire', color: '#ef4444' },
  { label: '💧', name: 'Water', color: '#3b82f6' },
  { label: '🏚️', name: 'Ruin', color: '#78716c' },
  { label: '⚠️', name: 'Hazard', color: '#f59e0b' },
  { label: '⚔️', name: 'Battle', color: '#dc2626' },
];

type Tool = 'select' | 'pen' | 'line' | 'rect' | 'circle' | 'fog' | 'fog-erase' | 'token-add';

const COLORS = ['#ff4444', '#ff8800', '#ffff00', '#44ff44', '#4488ff', '#aa44ff', '#ffffff', '#888888'];

const TokenShape = React.memo(function TokenShape({ token, isDraggable, onDragEnd }: {
  token: Token;
  isDraggable: boolean;
  onDragEnd: (id: string, x: number, y: number) => void;
}) {
  const [img] = useImage(token.avatarUrl || '');
  const r = token.size / 2;

  // Emoji check — for map utility tokens (fire, door etc.)
  const isEmoji = /^\p{Extended_Pictographic}/u.test(token.label);

  // For player/character tokens with no uploaded avatar, use race emoji
  const raceFallback = !token.avatarUrl && !isEmoji && token.charRace
    ? getRaceAvatar(token.charRace).emoji
    : null;
  const showRaceFallback = !!raceFallback;

  // Label shown below the token (name)
  const showNameTag = img || showRaceFallback;
  // Text inside circle (only for pure emoji utility tokens with no image)
  const innerText = isEmoji ? token.label : (!img && !showRaceFallback ? token.label : null);
  const innerFontSize = isEmoji ? Math.floor(r * 1.05) : 9;

  return (
    <Group
      x={token.x} y={token.y}
      draggable={isDraggable}
      onDragEnd={(e) => {
        e.cancelBubble = true;
        onDragEnd(token.id, e.target.x(), e.target.y());
      }}
    >
      {/* Background */}
      <Circle radius={r} fill={img ? '#1a1a2e' : token.color} opacity={0.92} />
      {/* Uploaded avatar image */}
      {img && <KImage image={img} x={-r} y={-r} width={token.size} height={token.size} cornerRadius={r} />}
      {/* Race emoji fallback — shown large like emoji utility tokens */}
      {showRaceFallback && (
        <Text
          text={raceFallback!}
          x={-r} y={-r}
          width={token.size} height={token.size}
          align="center" verticalAlign="middle"
          fontSize={Math.floor(r * 1.05)}
          fill="#ffffff"
        />
      )}
      {/* Emoji utility token or plain name fallback */}
      {innerText && (
        <Text
          text={innerText}
          x={-r} y={-r}
          width={token.size} height={token.size}
          align="center" verticalAlign="middle"
          fontSize={innerFontSize}
          fill="#ffffff"
        />
      )}
      {/* Border ring */}
      <Circle radius={r} fill="transparent" stroke="rgba(255,255,255,0.75)" strokeWidth={1.5} />
      {/* Name tag below for character/image tokens */}
      {showNameTag && (
        <Text
          text={token.label}
          x={-r} y={r + 2}
          width={token.size} align="center"
          fontSize={9} fill="rgba(255,255,255,0.9)"
        />
      )}
    </Group>
  );
}, (prev, next) =>
  prev.isDraggable === next.isDraggable &&
  prev.onDragEnd === next.onDragEnd &&
  prev.token.id === next.token.id &&
  prev.token.x === next.token.x &&
  prev.token.y === next.token.y &&
  prev.token.label === next.token.label &&
  prev.token.color === next.token.color &&
  prev.token.size === next.token.size &&
  prev.token.userId === next.token.userId &&
  prev.token.avatarUrl === next.token.avatarUrl &&
  prev.token.charRace === next.token.charRace
);

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
            key={key}
            x={col * gridSize - 0.5} y={row * gridSize - 0.5}
            width={gridSize + 1} height={gridSize + 1}
            fill={isDM ? 'rgba(0,0,0,0.94)' : '#000000'}
            opacity={1}
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
  const { game, socket, updateToken: storeUpdateToken, addToken: storeAddToken, removeToken: storeRemoveToken,
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
  const [fogBrushSize, setFogBrushSize] = useState(1);
  const [showAddToken, setShowAddToken] = useState(false);
  const [tokenLabel, setTokenLabel] = useState('');
  const [tokenColor, setTokenColor] = useState('#4488ff');
  const [tokenAvatarUrl, setTokenAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [presetMonsters, setPresetMonsters] = useState<any[]>([]);
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 600 });

  const tokens = map.tokens || [];

  function applyFogBrush(fog: Record<string, boolean>, col: number, row: number, add: boolean) {
    const half = Math.floor(fogBrushSize / 2);
    for (let dr = -half; dr <= half; dr++) {
      for (let dc = -half; dc <= half; dc++) {
        const key = `${col + dc},${row + dr}`;
        if (add) fog[key] = true;
        else delete fog[key];
      }
    }
  }

  useEffect(() => { setDrawings(map.drawings || []); }, [map.drawings]);
  useEffect(() => { setFogData(map.fog_data || {}); }, [map.fog_data]);

  // Load preset monsters for DM token panel
  useEffect(() => {
    if (!isDM || !game?.id) return;
    api.get(`/games/${game.id}/monsters`).then(({ data }) => setPresetMonsters(data)).catch(() => {});
  }, [isDM, game?.id]);

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
      const next = { ...fogData };
      applyFogBrush(next, col, row, tool === 'fog');
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
      const next = { ...fogData };
      applyFogBrush(next, col, row, tool === 'fog');
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

  const handleTokenDrag = useCallback((tokenId: string, x: number, y: number) => {
    if (socket) {
      socket.emit('token_move', { mapId: map.id, tokenId, x, y });
      storeUpdateToken(map.id, tokenId, x, y);
    }
  }, [socket, map.id, storeUpdateToken]);

  function canMoveToken(token: Token) {
    return isDM || token.userId === user?.id;
  }

  async function uploadTokenAvatar(file: File) {
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/upload', fd);
      setTokenAvatarUrl(data.url);
    } catch {
      // silently fail avatar upload
    } finally {
      setUploadingAvatar(false);
    }
  }

  function centerPos() {
    return { x: (stageSize.w / 2 - offset.x) / scale, y: (stageSize.h / 2 - offset.y) / scale };
  }

  const TOKEN_SIZE = Math.round(map.grid_size * 0.85);

  function addToken() {
    if (!tokenLabel.trim() || !isDM) return;
    const { x, y } = centerPos();
    const token = {
      label: tokenLabel.trim(),
      color: tokenColor,
      avatarUrl: tokenAvatarUrl || undefined,
      x, y,
      size: TOKEN_SIZE,
    };
    socket?.emit('token_add', { mapId: map.id, token });
    setShowAddToken(false);
    setTokenLabel('');
    setTokenAvatarUrl('');
  }

  function addPresetToken(label: string, avatarUrl: string | undefined, color: string) {
    const { x, y } = centerPos();
    const token = { label, color, avatarUrl, x, y, size: TOKEN_SIZE };
    socket?.emit('token_add', { mapId: map.id, token });
  }

  function placeMyToken() {
    if (!socket || !user) return;
    const me = game?.players.find(p => p.id === user.id);
    const { x, y } = centerPos();
    const token = {
      label: me?.char_name || me?.username || user.username,
      color: '#4488ff',
      userId: user.id,
      avatarUrl: me?.avatar_url || undefined,
      charRace: me?.char_race || undefined,
      x, y,
      size: TOKEN_SIZE,
    };
    socket.emit('token_add', { mapId: map.id, token });
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

  const cursorClass = ({
    select: 'map-pan',
    pen: 'map-draw', line: 'map-draw', rect: 'map-draw', circle: 'map-draw',
    fog: 'map-fog', 'fog-erase': 'map-erase',
    'token-add': 'cursor-copy',
  } as Record<Tool, string>)[tool] ?? 'map-pan';

  const myToken = tokens.find(t => t.userId === user?.id);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-tavern-border bg-tavern-card flex-wrap">
        {/* Pan — all users */}
        <button onClick={() => setTool('select')} title="Pan"
          className={clsx('p-1.5 rounded border text-xs transition-colors',
            tool === 'select' ? 'border-tavern-gold text-tavern-gold' : 'border-tavern-border text-tavern-muted hover:text-tavern-text')}>
          <Move size={14} />
        </button>

        {/* Drawing tools — DM only */}
        {isDM && <>
          {[
            { id: 'pen', icon: <Pen size={14} />, label: 'Draw' },
            { id: 'line', icon: <Minus size={14} />, label: 'Line' },
            { id: 'rect', icon: <Square size={14} />, label: 'Rect' },
            { id: 'circle', icon: <CircleIcon size={14} />, label: 'Circle' },
          ].map(({ id, icon, label }) => (
            <button key={id} onClick={() => setTool(id as Tool)} title={label}
              className={clsx('p-1.5 rounded border text-xs transition-colors',
                tool === id ? 'border-tavern-gold text-tavern-gold' : 'border-tavern-border text-tavern-muted hover:text-tavern-text')}>
              {icon}
            </button>
          ))}
          <div className="w-px h-5 bg-tavern-border mx-1" />
          {[
            { id: 'fog', icon: <Eye size={14} />, label: 'Add Fog' },
            { id: 'fog-erase', icon: <EyeOff size={14} />, label: 'Remove Fog' },
          ].map(({ id, icon, label }) => (
            <button key={id} onClick={() => setTool(id as Tool)} title={label}
              className={clsx('p-1.5 rounded border text-xs transition-colors',
                tool === id ? 'border-tavern-gold text-tavern-gold' : 'border-tavern-border text-tavern-muted hover:text-tavern-text')}>
              {icon}
            </button>
          ))}
          {(tool === 'fog' || tool === 'fog-erase') && (
            <span
              title="Right-click map to cycle brush size"
              className="text-xs text-tavern-gold font-serif bg-tavern-bg border border-tavern-gold/40 rounded px-1.5 py-1 select-none cursor-default"
            >
              {fogBrushSize}×{fogBrushSize}
            </span>
          )}
          <button onClick={() => { setShowAddToken(!showAddToken); setShowPresets(false); setTool('select'); }} title="Add Token"
            className={clsx('p-1.5 rounded border text-xs transition-colors',
              showAddToken ? 'border-tavern-gold text-tavern-gold' : 'border-tavern-border text-tavern-muted hover:text-tavern-text')}>
            <Plus size={14} />
          </button>
          <button onClick={() => { setShowPresets(v => !v); setShowAddToken(false); }} title="Token Presets"
            className={clsx('p-1.5 rounded border text-xs transition-colors',
              showPresets ? 'border-tavern-gold text-tavern-gold' : 'border-tavern-border text-tavern-muted hover:text-tavern-text')}>
            <Layers size={14} />
          </button>
          <button onClick={clearDrawings} title="Clear Drawings"
            className="p-1.5 rounded border border-tavern-border text-tavern-muted hover:text-red-400 text-xs transition-colors">
            <Eraser size={14} />
          </button>
          <div className="w-px h-5 bg-tavern-border mx-1" />
          {/* Color picker — DM only */}
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button key={c} className={clsx('w-5 h-5 rounded-full border-2 transition-transform', color === c ? 'border-white scale-125' : 'border-transparent')}
                style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
          <div className="w-px h-5 bg-tavern-border mx-1" />
        </>}

        {/* Player: place own token */}
        {!isDM && !myToken && (
          <>
            <div className="w-px h-5 bg-tavern-border mx-1" />
            <button onClick={placeMyToken} title="Place your token on the map"
              className="flex items-center gap-1.5 px-2 py-1 rounded border border-blue-600/50 text-blue-400 hover:border-blue-500 text-xs transition-colors">
              <Plus size={13} /> Place My Token
            </button>
          </>
        )}

        {/* Zoom — all users */}
        <>
          <button onClick={() => setScale((s) => Math.min(s + 0.2, 4))} className="p-1.5 rounded border border-tavern-border text-tavern-muted hover:text-tavern-text"><ZoomIn size={14} /></button>
          <span className="text-xs text-tavern-muted w-12 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((s) => Math.max(s - 0.2, 0.2))} className="p-1.5 rounded border border-tavern-border text-tavern-muted hover:text-tavern-text"><ZoomOut size={14} /></button>
          <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} className="p-1.5 rounded border border-tavern-border text-tavern-muted hover:text-tavern-text"><RotateCcw size={14} /></button>
        </>
      </div>

      {/* DM Token Presets Panel */}
      {showPresets && isDM && (
        <div className="flex items-start gap-3 p-2 bg-tavern-bg/80 border-b border-tavern-border overflow-x-auto">
          {/* Monsters */}
          {presetMonsters.length > 0 && (
            <div className="flex-shrink-0">
              <p className="text-[10px] text-tavern-muted uppercase tracking-wide mb-1.5">Monsters</p>
              <div className="flex gap-1.5">
                {presetMonsters.map(m => {
                  const avatarDef = getMonsterAvatar(m.type || '');
                  return (
                    <button key={m.id}
                      onClick={() => addPresetToken(m.name.split(' ')[0], m.avatar_url || undefined, '#cc2222')}
                      title={`${m.name} (CR ${m.cr})`}
                      className="flex flex-col items-center gap-0.5 w-12 hover:opacity-80 transition-opacity">
                      <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-base"
                        style={m.avatar_url ? undefined : avatarStyle(avatarDef)}>
                        {m.avatar_url
                          ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                          : avatarDef.emoji}
                      </div>
                      <span className="text-[9px] text-tavern-muted truncate w-full text-center">{m.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {presetMonsters.length > 0 && (
            <div className="w-px self-stretch bg-tavern-border flex-shrink-0 mx-1" />
          )}

          {/* Map utilities */}
          <div className="flex-shrink-0">
            <p className="text-[10px] text-tavern-muted uppercase tracking-wide mb-1.5">Map Objects</p>
            <div className="flex gap-1.5">
              {MAP_UTILS.map(u => (
                <button key={u.name}
                  onClick={() => addPresetToken(u.label, undefined, u.color)}
                  title={u.name}
                  className="flex flex-col items-center gap-0.5 w-10 hover:opacity-80 transition-opacity">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xl"
                    style={{ background: `${u.color}22`, border: `2px solid ${u.color}66` }}>
                    {u.label}
                  </div>
                  <span className="text-[9px] text-tavern-muted">{u.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add token form (DM — for NPCs/monsters only) */}
      {showAddToken && isDM && (
        <div className="flex items-center gap-2 p-2 bg-tavern-bg border-b border-tavern-border text-sm flex-wrap">
          <input className="tavern-input py-1 text-xs w-28" placeholder="Label or emoji" value={tokenLabel} onChange={(e) => setTokenLabel(e.target.value)} />
          {/* Avatar */}
          <div className="flex items-center gap-1">
            <input className="tavern-input py-1 text-xs w-36" placeholder="Avatar URL" value={tokenAvatarUrl} onChange={(e) => setTokenAvatarUrl(e.target.value)} />
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="p-1 rounded border border-tavern-border text-tavern-muted hover:text-tavern-text text-xs transition-colors"
              title="Upload image"
            >
              {uploadingAvatar ? '...' : <ImagePlus size={13} />}
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadTokenAvatar(e.target.files[0])} />
            {tokenAvatarUrl && (
              <img src={tokenAvatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-tavern-border" />
            )}
          </div>
          {/* Color */}
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button key={c} className={clsx('w-4 h-4 rounded-full border', tokenColor === c ? 'border-white' : 'border-transparent')}
                style={{ background: c }} onClick={() => setTokenColor(c)} />
            ))}
          </div>
          <button onClick={addToken} className="btn-primary text-xs py-1 px-2">Add</button>
          <button onClick={() => { setShowAddToken(false); setTokenAvatarUrl(''); }} className="btn-secondary text-xs py-1 px-2">Cancel</button>
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
          onDragEnd={(e) => {
            // Only update offset when the Stage itself was dragged, not a child token
            if (e.target === stageRef.current) {
              setOffset({ x: e.target.x(), y: e.target.y() });
            }
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={(e) => {
            e.evt.preventDefault();
            const delta = e.evt.deltaY > 0 ? -0.1 : 0.1;
            setScale((s) => Math.max(0.2, Math.min(4, s + delta)));
          }}
          onContextMenu={(e) => {
            e.evt.preventDefault();
            if (tool === 'fog' || tool === 'fog-erase') {
              const sizes = [1, 2, 3, 5, 7];
              setFogBrushSize(s => sizes[(sizes.indexOf(s) + 1) % sizes.length]);
            }
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

          {/* Tokens — players cannot see tokens inside fogged cells */}
          <Layer>
            {(isDM ? tokens : tokens.filter(t => {
              if (t.userId === user?.id) return true;
              const col = Math.floor(t.x / map.grid_size);
              const row = Math.floor(t.y / map.grid_size);
              return !fogData[`${col},${row}`];
            })).map((token) => (
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
