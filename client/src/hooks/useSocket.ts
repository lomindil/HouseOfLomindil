import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/game';
import { useAuthStore } from '../store/auth';
import api from '../lib/api';

// socket.io-client is loaded via <script> tag in index.html from the backend server.
// This avoids all Vite ESM pre-bundling issues with socket.io-client.
declare const io: (url: string, opts?: Record<string, unknown>) => any;

// Always connect to the same origin as the page.
// In dev, Vite proxies /socket.io → localhost:3001.
// In prod, Express serves /socket.io directly.
const SOCKET_URL = window.location.origin;

export function useGameSocket(gameId: string, onSessionEnded?: () => void) {
  const { token } = useAuthStore();
  const { setSocket, addMessage, updateToken, addToken, removeToken, updateDrawings, updateFog, setPlayerOnline, setMap, setHpOverride, setActiveEncounter, updateEncounterCombatant, setEncounterRound } = useGameStore();
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (!token || !gameId) return;
    if (typeof io === 'undefined') {
      console.error('socket.io client not loaded — check that the backend server is running');
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    setSocket(socket);

    socket.on('connect', () => {
      socket.emit('join_game', { gameId });
    });

    socket.on('connect_error', (err: Error) => {
      console.warn('Socket connect error:', err.message);
    });

    socket.on('chat_message', (msg: any) => addMessage(msg));

    socket.on('dice_roll', (data: any) => {
      addMessage({
        id: `roll-${Date.now()}`,
        user_id: data.userId,
        username: data.username,
        type: 'roll',
        content: `rolled ${data.notation} = ${data.total}`,
        metadata: { notation: data.notation, results: data.results, total: data.total },
        created_at: Math.floor(data.timestamp / 1000),
      });
    });

    socket.on('token_moved', ({ mapId, tokenId, x, y }: any) => updateToken(mapId, tokenId, x, y));
    socket.on('token_added', ({ mapId, token }: any) => addToken(mapId, token));
    socket.on('token_removed', ({ mapId, tokenId }: any) => removeToken(mapId, tokenId));
    socket.on('map_updated', ({ mapId, drawings }: any) => updateDrawings(mapId, drawings));
    socket.on('fog_updated', ({ mapId, fogData }: any) => updateFog(mapId, fogData));

    socket.on('map_changed', ({ mapId }: any) => {
      const { game } = useGameStore.getState();
      if (game) {
        api.get(`/games/${gameId}/maps/${mapId}`).then(({ data }) => setMap(data));
      }
    });

    socket.on('player_joined', (data: any) => setPlayerOnline(data.userId, true));
    socket.on('player_left', (data: any) => setPlayerOnline(data.userId, false));

    socket.on('character_hp_update', ({ characterId, current_hp, max_hp }: any) => {
      setHpOverride(characterId, { current_hp, max_hp });
    });

    socket.on('encounter_started', ({ encounterId, name, combatants, round }: any) => {
      setActiveEncounter({ id: encounterId, name, round, combatants });
    });

    socket.on('encounter_combatant_updated', ({ combatantId, current_hp, initiative, status }: any) => {
      const updates: any = {};
      if (current_hp !== undefined) updates.current_hp = current_hp;
      if (initiative !== undefined) updates.initiative = initiative;
      if (status !== undefined) updates.status = status;
      updateEncounterCombatant(combatantId, updates);
    });

    socket.on('encounter_round', ({ encounterId, round }: any) => {
      setEncounterRound(encounterId, round);
    });

    socket.on('encounter_ended', () => {
      setActiveEncounter(null);
    });

    socket.on('session_ended', () => {
      onSessionEnded?.();
    });

    socket.on('chat_cleared', () => {
      useGameStore.getState().setMessages([]);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, gameId]);

  return socketRef;
}
