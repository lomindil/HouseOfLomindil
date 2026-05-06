import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';

import fs from 'fs';
import authRouter from './routes/auth';
import charactersRouter from './routes/characters';
import gamesRouter from './routes/games';
import mapsRouter from './routes/maps';
import chatRouter from './routes/chat';
import uploadRouter from './routes/upload';
import monstersRouter from './routes/monsters';
import encountersRouter from './routes/encounters';
import libraryRouter from './routes/library';
import { setupGameSocket } from './socket/gameSocket';

// Ensure upload directories exist
['uploads/avatars', 'uploads/maps', 'uploads/tokens'].forEach((dir) => {
  fs.mkdirSync(path.join(__dirname, '..', dir), { recursive: true });
});

const app = express();
const httpServer = createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Allow any localhost port in development so Vite port-shifting doesn't break things
const corsOrigin = process.env.NODE_ENV === 'production'
  ? CLIENT_URL
  : (origin: string | undefined, cb: (e: Error | null, ok?: boolean) => void) => {
      if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) cb(null, true);
      else cb(new Error('Not allowed by CORS'));
    };

const io = new Server(httpServer, {
  cors: { origin: corsOrigin, credentials: true },
});

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/games', gamesRouter);
app.use('/api/games/:gameId/maps', mapsRouter);
app.use('/api/games/:gameId/monsters', monstersRouter);
app.use('/api/games/:gameId/encounters', encountersRouter);
app.use('/api/library', libraryRouter);
app.use('/api/games/:gameId', chatRouter);
app.use('/api/upload', uploadRouter);

setupGameSocket(io);

// Serve built frontend in production
if (process.env.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, '../public');
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

const PORT = parseInt(process.env.PORT || '3001');
httpServer.listen(PORT, () => {
  console.log(`Tavern VTT server running on http://localhost:${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
});
