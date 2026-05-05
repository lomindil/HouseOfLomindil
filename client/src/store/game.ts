import { create } from 'zustand';
import { Socket } from 'socket.io-client';

export interface Token {
  id: string;
  userId?: string;
  label: string;
  avatarUrl?: string;
  color: string;
  x: number;
  y: number;
  size: number;
}

export interface Drawing {
  id: string;
  tool: 'pen' | 'line' | 'rect' | 'circle';
  points: number[];
  color: string;
  strokeWidth: number;
}

export interface MapData {
  id: string;
  name: string;
  image_url: string;
  grid_size: number;
  grid_color: string;
  grid_opacity: number;
  fog_data: Record<string, boolean>;
  drawings: Drawing[];
  tokens: Token[];
}

export interface ChatMessage {
  id: string;
  user_id: string;
  username: string;
  type: 'chat' | 'roll' | 'system';
  content: string;
  metadata: Record<string, any>;
  created_at: number;
}

export interface Player {
  id: string;
  username: string;
  character_id?: string;
  char_name?: string;
  avatar_url?: string;
  online?: boolean;
}

export interface Game {
  id: string;
  name: string;
  description: string;
  dm_id: string;
  dm_username: string;
  status: string;
  join_code: string;
  current_map_id?: string;
  players: Player[];
  maps: { id: string; name: string }[];
  is_dm: boolean;
}

export interface HpOverride {
  current_hp: number;
  max_hp: number;
}

interface GameStore {
  game: Game | null;
  currentMap: MapData | null;
  messages: ChatMessage[];
  onlinePlayers: Set<string>;
  socket: Socket | null;
  hpOverrides: Record<string, HpOverride>; // characterId → live HP

  setGame: (game: Game) => void;
  setMap: (map: MapData) => void;
  setSocket: (socket: Socket) => void;
  addMessage: (msg: ChatMessage) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  updateToken: (mapId: string, tokenId: string, x: number, y: number) => void;
  addToken: (mapId: string, token: Token) => void;
  removeToken: (mapId: string, tokenId: string) => void;
  updateDrawings: (mapId: string, drawings: Drawing[]) => void;
  updateFog: (mapId: string, fogData: Record<string, boolean>) => void;
  setPlayerOnline: (userId: string, online: boolean) => void;
  setHpOverride: (characterId: string, hp: HpOverride) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  currentMap: null,
  messages: [],
  onlinePlayers: new Set(),
  socket: null,
  hpOverrides: {},

  setGame: (game) => set({ game }),
  setMap: (map) => set({ currentMap: map }),
  setSocket: (socket) => set({ socket }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),

  updateToken: (mapId, tokenId, x, y) => set((s) => {
    if (!s.currentMap || s.currentMap.id !== mapId) return s;
    const tokens = s.currentMap.tokens.map((t) =>
      t.id === tokenId ? { ...t, x, y } : t
    );
    return { currentMap: { ...s.currentMap, tokens } };
  }),

  addToken: (mapId, token) => set((s) => {
    if (!s.currentMap || s.currentMap.id !== mapId) return s;
    return { currentMap: { ...s.currentMap, tokens: [...s.currentMap.tokens, token] } };
  }),

  removeToken: (mapId, tokenId) => set((s) => {
    if (!s.currentMap || s.currentMap.id !== mapId) return s;
    return { currentMap: { ...s.currentMap, tokens: s.currentMap.tokens.filter((t) => t.id !== tokenId) } };
  }),

  updateDrawings: (mapId, drawings) => set((s) => {
    if (!s.currentMap || s.currentMap.id !== mapId) return s;
    return { currentMap: { ...s.currentMap, drawings } };
  }),

  updateFog: (mapId, fogData) => set((s) => {
    if (!s.currentMap || s.currentMap.id !== mapId) return s;
    return { currentMap: { ...s.currentMap, fog_data: fogData } };
  }),

  setPlayerOnline: (userId, online) => set((s) => {
    const next = new Set(s.onlinePlayers);
    online ? next.add(userId) : next.delete(userId);
    return { onlinePlayers: next };
  }),

  setHpOverride: (characterId, hp) => set((s) => ({
    hpOverrides: { ...s.hpOverrides, [characterId]: hp },
  })),

  reset: () => set({ game: null, currentMap: null, messages: [], onlinePlayers: new Set(), socket: null, hpOverrides: {} }),
}));
