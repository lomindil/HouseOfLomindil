import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'tavern-secret-change-in-production';

interface UserInfo {
  id: string;
  email: string;
  username: string;
}

interface AuthSocket extends Socket {
  user?: UserInfo;
  gameId?: string;
  isDM?: boolean;
}

export function setupGameSocket(io: Server) {
  // Auth middleware
  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('No token'));
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as UserInfo;
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    console.log(`Socket connected: ${socket.user?.username}`);

    socket.on('join_game', ({ gameId }: { gameId: string }) => {
      const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId) as any;
      if (!game) return socket.emit('error', { message: 'Game not found' });

      const isMember = game.dm_id === socket.user!.id ||
        db.prepare('SELECT 1 FROM game_players WHERE game_id = ? AND user_id = ?').get(gameId, socket.user!.id);
      if (!isMember) return socket.emit('error', { message: 'Not a member' });

      socket.join(`game:${gameId}`);
      socket.gameId = gameId;
      socket.isDM = game.dm_id === socket.user!.id;

      io.to(`game:${gameId}`).emit('player_joined', {
        userId: socket.user!.id,
        username: socket.user!.username,
        isDM: socket.isDM,
      });

      socket.emit('joined', { gameId, isDM: socket.isDM });
    });

    // Chat message
    socket.on('chat_message', ({ content, type = 'chat', metadata = {} }: any) => {
      if (!socket.gameId) return;
      const id = uuidv4();
      const ts = Math.floor(Date.now() / 1000);

      db.prepare('INSERT INTO chat_messages (id, game_id, user_id, username, type, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        id, socket.gameId, socket.user!.id, socket.user!.username, type, content, JSON.stringify(metadata), ts
      );

      io.to(`game:${socket.gameId}`).emit('chat_message', {
        id, game_id: socket.gameId, user_id: socket.user!.id,
        username: socket.user!.username, type, content, metadata, created_at: ts,
      });
    });

    // Dice roll - broadcast to everyone
    socket.on('dice_roll', ({ notation, results, total }: any) => {
      if (!socket.gameId) return;
      const rollData = {
        userId: socket.user!.id,
        username: socket.user!.username,
        notation,
        results,
        total,
        timestamp: Date.now(),
      };

      // Save as chat message
      const id = uuidv4();
      db.prepare('INSERT INTO chat_messages (id, game_id, user_id, username, type, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        id, socket.gameId, socket.user!.id, socket.user!.username, 'roll',
        `rolled ${notation} = ${total}`, JSON.stringify({ notation, results, total }), Math.floor(Date.now() / 1000)
      );

      io.to(`game:${socket.gameId}`).emit('dice_roll', rollData);
    });

    // Token movement - players can only move their own token
    socket.on('token_move', ({ mapId, tokenId, x, y }: any) => {
      if (!socket.gameId) return;

      const map = db.prepare('SELECT * FROM maps WHERE id = ? AND game_id = ?').get(mapId, socket.gameId) as any;
      if (!map) return;

      const tokens = JSON.parse(map.tokens || '[]');
      const tokenIndex = tokens.findIndex((t: any) => t.id === tokenId);
      if (tokenIndex === -1) return;

      const token = tokens[tokenIndex];
      // DM can move any token, players can only move their own
      if (!socket.isDM && token.userId !== socket.user!.id) {
        return socket.emit('error', { message: 'Cannot move this token' });
      }

      tokens[tokenIndex] = { ...token, x, y };
      db.prepare('UPDATE maps SET tokens = ? WHERE id = ?').run(JSON.stringify(tokens), mapId);

      io.to(`game:${socket.gameId}`).emit('token_moved', { mapId, tokenId, x, y, movedBy: socket.user!.id });
    });

    // Token add/remove (DM only)
    socket.on('token_add', ({ mapId, token }: any) => {
      if (!socket.gameId || !socket.isDM) return;

      const map = db.prepare('SELECT * FROM maps WHERE id = ? AND game_id = ?').get(mapId, socket.gameId) as any;
      if (!map) return;

      const tokens = JSON.parse(map.tokens || '[]');
      const newToken = { id: uuidv4(), ...token };
      tokens.push(newToken);
      db.prepare('UPDATE maps SET tokens = ? WHERE id = ?').run(JSON.stringify(tokens), mapId);

      io.to(`game:${socket.gameId}`).emit('token_added', { mapId, token: newToken });
    });

    socket.on('token_remove', ({ mapId, tokenId }: any) => {
      if (!socket.gameId || !socket.isDM) return;

      const map = db.prepare('SELECT * FROM maps WHERE id = ? AND game_id = ?').get(mapId, socket.gameId) as any;
      if (!map) return;

      const tokens = JSON.parse(map.tokens || '[]').filter((t: any) => t.id !== tokenId);
      db.prepare('UPDATE maps SET tokens = ? WHERE id = ?').run(JSON.stringify(tokens), mapId);

      io.to(`game:${socket.gameId}`).emit('token_removed', { mapId, tokenId });
    });

    // DM draws on map
    socket.on('map_draw', ({ mapId, drawings }: any) => {
      if (!socket.gameId || !socket.isDM) return;

      db.prepare('UPDATE maps SET drawings = ? WHERE id = ? AND game_id = ?').run(
        JSON.stringify(drawings), mapId, socket.gameId
      );
      socket.to(`game:${socket.gameId}`).emit('map_updated', { mapId, drawings });
    });

    // Fog of war update (DM only)
    socket.on('fog_update', ({ mapId, fogData }: any) => {
      if (!socket.gameId || !socket.isDM) return;

      db.prepare('UPDATE maps SET fog_data = ? WHERE id = ? AND game_id = ?').run(
        JSON.stringify(fogData), mapId, socket.gameId
      );
      io.to(`game:${socket.gameId}`).emit('fog_updated', { mapId, fogData });
    });

    // Map change (DM switches active map)
    socket.on('change_map', ({ mapId }: any) => {
      if (!socket.gameId || !socket.isDM) return;

      db.prepare('UPDATE games SET current_map_id = ? WHERE id = ?').run(mapId, socket.gameId);
      io.to(`game:${socket.gameId}`).emit('map_changed', { mapId });
    });

    // Handout shared
    socket.on('share_handout', ({ handoutId, userIds }: any) => {
      if (!socket.gameId || !socket.isDM) return;

      const handout = db.prepare('SELECT * FROM handouts WHERE id = ? AND game_id = ?').get(handoutId, socket.gameId) as any;
      if (!handout) return;

      db.prepare('UPDATE handouts SET shared_with = ? WHERE id = ?').run(JSON.stringify(userIds), handoutId);
      io.to(`game:${socket.gameId}`).emit('handout_shared', {
        handout: { ...handout, shared_with: userIds },
        sharedWith: userIds,
      });
    });

    socket.on('disconnect', () => {
      if (socket.gameId) {
        io.to(`game:${socket.gameId}`).emit('player_left', {
          userId: socket.user!.id,
          username: socket.user!.username,
        });
      }
    });
  });
}
