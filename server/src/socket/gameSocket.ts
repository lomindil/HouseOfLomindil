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

      // DM-only slash commands
      if (socket.isDM && typeof content === 'string') {
        const hitMatch = content.match(/^\/hit\s+(\S+)\s+(\d+)$/i);
        const healMatch = content.match(/^\/heal\s+(\S+)\s+(\d+)$/i);
        const match = hitMatch || healMatch;
        if (match) {
          const isHit = !!hitMatch;
          const targetUsername = match[1];
          const amount = parseInt(match[2], 10);

          // Find the player in this game by username
          const playerRow = db.prepare(`
            SELECT gp.user_id, gp.character_id, c.sheet_data
            FROM game_players gp
            JOIN users u ON u.id = gp.user_id
            LEFT JOIN characters c ON c.id = gp.character_id
            WHERE gp.game_id = ? AND LOWER(u.username) = LOWER(?)
          `).get(socket.gameId, targetUsername) as any;

          if (!playerRow || !playerRow.character_id) {
            socket.emit('chat_message', {
              id: uuidv4(), game_id: socket.gameId, user_id: null,
              username: 'System', type: 'system',
              content: `No character found for player "${targetUsername}".`,
              metadata: {}, created_at: Math.floor(Date.now() / 1000),
            });
            return;
          }

          const sheet = JSON.parse(playerRow.sheet_data || '{}');
          const combat = sheet.combat || {};
          const maxHp: number = combat.max_hp ?? 10;
          let currentHp: number = combat.current_hp ?? maxHp;

          if (isHit) {
            currentHp = Math.max(0, currentHp - amount);
          } else {
            currentHp = Math.min(maxHp, currentHp + amount);
          }

          sheet.combat = { ...combat, current_hp: currentHp };
          db.prepare('UPDATE characters SET sheet_data = ?, updated_at = unixepoch() WHERE id = ?')
            .run(JSON.stringify(sheet), playerRow.character_id);

          const verb = isHit ? `hits ${targetUsername} for ${amount} damage` : `heals ${targetUsername} for ${amount} HP`;
          const hpLine = `HP: ${currentHp}/${maxHp}`;
          const systemContent = `⚔️ DM ${verb}! (${hpLine})`;

          const sysId = uuidv4();
          const ts = Math.floor(Date.now() / 1000);
          db.prepare('INSERT INTO chat_messages (id, game_id, user_id, username, type, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
            sysId, socket.gameId, null, 'System', 'system', systemContent, '{}', ts
          );
          io.to(`game:${socket.gameId}`).emit('chat_message', {
            id: sysId, game_id: socket.gameId, user_id: null,
            username: 'System', type: 'system', content: systemContent, metadata: {}, created_at: ts,
          });

          // Notify the affected player's client to refresh their character
          io.to(`game:${socket.gameId}`).emit('character_hp_update', {
            userId: playerRow.user_id,
            characterId: playerRow.character_id,
            current_hp: currentHp,
            max_hp: maxHp,
          });
          return;
        }
      }

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

      // Broadcast to everyone else — sender already applied the move locally via storeUpdateToken
      socket.broadcast.to(`game:${socket.gameId}`).emit('token_moved', { mapId, tokenId, x, y, movedBy: socket.user!.id });
    });

    // Token add: DM can add any token; players can only add their own
    socket.on('token_add', ({ mapId, token }: any) => {
      if (!socket.gameId) return;
      // Players may only place a token that belongs to themselves
      if (!socket.isDM && token.userId !== socket.user!.id) return;
      // Players may only place one token (their own) per map
      if (!socket.isDM) {
        const map = db.prepare('SELECT * FROM maps WHERE id = ? AND game_id = ?').get(mapId, socket.gameId) as any;
        if (!map) return;
        const existing = JSON.parse(map.tokens || '[]');
        if (existing.some((t: any) => t.userId === socket.user!.id)) return;
      }

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

    // DM clears chat
    socket.on('clear_chat', () => {
      if (!socket.gameId || !socket.isDM) return;
      db.prepare('DELETE FROM chat_messages WHERE game_id = ?').run(socket.gameId);
      io.to(`game:${socket.gameId}`).emit('chat_cleared');
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

    // Encounter events (DM only)
    socket.on('encounter_start', ({ encounterId }: any) => {
      if (!socket.gameId || !socket.isDM) return;
      const enc = db.prepare('SELECT * FROM encounters WHERE id = ? AND game_id = ?').get(encounterId, socket.gameId) as any;
      if (!enc) return;
      db.prepare("UPDATE encounters SET status = 'active', round = 1 WHERE id = ?").run(encounterId);
      const combatants = db.prepare('SELECT * FROM encounter_combatants WHERE encounter_id = ? ORDER BY initiative DESC').all(encounterId).map((c: any) => ({
        ...c, stats: JSON.parse(c.stats || '{}'), actions: JSON.parse(c.actions || '[]'),
      }));

      const sysId = uuidv4();
      const ts = Math.floor(Date.now() / 1000);
      const sysMsg = `⚔️ Encounter "${enc.name}" has begun! Round 1`;
      db.prepare('INSERT INTO chat_messages (id, game_id, user_id, username, type, content, metadata, created_at) VALUES (?,?,?,?,?,?,?,?)').run(
        sysId, socket.gameId, null, 'System', 'system', sysMsg, '{}', ts
      );
      io.to(`game:${socket.gameId}`).emit('chat_message', { id: sysId, game_id: socket.gameId, user_id: null, username: 'System', type: 'system', content: sysMsg, metadata: {}, created_at: ts });
      io.to(`game:${socket.gameId}`).emit('encounter_started', { encounterId, name: enc.name, combatants, round: 1 });
    });

    // DM directly adjusts a player's HP from the party panel
    socket.on('dm_adjust_hp', ({ characterId, userId, delta }: any) => {
      if (!socket.gameId || !socket.isDM) return;
      const row = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId) as any;
      if (!row) return;
      const sheet = JSON.parse(row.sheet_data || '{}');
      const combat = sheet.combat || {};
      const maxHp: number = combat.max_hp ?? 10;
      const newHp = Math.max(0, Math.min(maxHp, (combat.current_hp ?? maxHp) + delta));
      sheet.combat = { ...combat, current_hp: newHp };
      db.prepare('UPDATE characters SET sheet_data = ?, updated_at = unixepoch() WHERE id = ?').run(JSON.stringify(sheet), characterId);
      io.to(`game:${socket.gameId}`).emit('character_hp_update', { userId, characterId, current_hp: newHp, max_hp: maxHp });
    });

    socket.on('encounter_update', ({ encounterId, combatantId, current_hp, initiative, status }: any) => {
      if (!socket.gameId || !socket.isDM) return;
      db.prepare('UPDATE encounter_combatants SET current_hp=COALESCE(?,current_hp), initiative=COALESCE(?,initiative), status=COALESCE(?,status) WHERE id=? AND encounter_id=?').run(
        current_hp ?? null, initiative ?? null, status ?? null, combatantId, encounterId
      );
      io.to(`game:${socket.gameId}`).emit('encounter_combatant_updated', { encounterId, combatantId, current_hp, initiative, status });
    });

    socket.on('encounter_next_round', ({ encounterId }: any) => {
      if (!socket.gameId || !socket.isDM) return;
      const enc = db.prepare('SELECT * FROM encounters WHERE id = ? AND game_id = ?').get(encounterId, socket.gameId) as any;
      if (!enc) return;
      const newRound = enc.round + 1;
      db.prepare('UPDATE encounters SET round = ? WHERE id = ?').run(newRound, encounterId);
      const sysId = uuidv4(); const ts = Math.floor(Date.now() / 1000);
      const sysMsg = `🔔 Round ${newRound} begins!`;
      db.prepare('INSERT INTO chat_messages (id, game_id, user_id, username, type, content, metadata, created_at) VALUES (?,?,?,?,?,?,?,?)').run(sysId, socket.gameId, null, 'System', 'system', sysMsg, '{}', ts);
      io.to(`game:${socket.gameId}`).emit('chat_message', { id: sysId, game_id: socket.gameId, user_id: null, username: 'System', type: 'system', content: sysMsg, metadata: {}, created_at: ts });
      io.to(`game:${socket.gameId}`).emit('encounter_round', { encounterId, round: newRound });
    });

    socket.on('encounter_end', ({ encounterId }: any) => {
      if (!socket.gameId || !socket.isDM) return;
      const enc = db.prepare('SELECT * FROM encounters WHERE id = ? AND game_id = ?').get(encounterId, socket.gameId) as any;
      if (!enc) return;
      db.prepare("UPDATE encounters SET status = 'completed' WHERE id = ?").run(encounterId);
      const sysId = uuidv4(); const ts = Math.floor(Date.now() / 1000);
      const sysMsg = `✅ Encounter "${enc.name}" has ended.`;
      db.prepare('INSERT INTO chat_messages (id, game_id, user_id, username, type, content, metadata, created_at) VALUES (?,?,?,?,?,?,?,?)').run(sysId, socket.gameId, null, 'System', 'system', sysMsg, '{}', ts);
      io.to(`game:${socket.gameId}`).emit('chat_message', { id: sysId, game_id: socket.gameId, user_id: null, username: 'System', type: 'system', content: sysMsg, metadata: {}, created_at: ts });
      io.to(`game:${socket.gameId}`).emit('encounter_ended', { encounterId });
    });

    socket.on('encounter_attack_roll', ({ encounterId, attackerName, targetName, notation, attackBonus, damageDice, attackTotal, damageTotal, hit }: any) => {
      if (!socket.gameId || !socket.isDM) return;
      const id = uuidv4(); const ts = Math.floor(Date.now() / 1000);
      const metadata = { notation, results: [attackTotal], total: attackTotal, attackBonus, damageDice, damageTotal, hit, attackerName, targetName, isAttack: true };
      const content = hit
        ? `${attackerName} hits ${targetName}! Attack: ${attackTotal} | Damage: ${damageTotal}`
        : `${attackerName} misses ${targetName}. (Attack roll: ${attackTotal})`;
      db.prepare('INSERT INTO chat_messages (id, game_id, user_id, username, type, content, metadata, created_at) VALUES (?,?,?,?,?,?,?,?)').run(
        id, socket.gameId, socket.user!.id, socket.user!.username, 'roll', content, JSON.stringify(metadata), ts
      );
      io.to(`game:${socket.gameId}`).emit('chat_message', { id, game_id: socket.gameId, user_id: socket.user!.id, username: socket.user!.username, type: 'roll', content, metadata, created_at: ts });
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
