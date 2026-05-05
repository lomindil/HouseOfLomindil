# Starting The Tavern VTT

## First Time Setup

```bash
# Install all dependencies
npm install
npm install --workspace=server
npm install --workspace=client
```

## Configure Email (Optional)

Edit `server/.env`:
```
SMTP_USER=your@gmail.com
SMTP_PASS=your-google-app-password
```
Without email configured, the OTP is printed to the server console in dev mode.

## Run in Development

```bash
# Start both server + client with hot reload
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Share with Players

1. Start the app
2. Sign in, create a game as DM
3. Click "Launch Game"
4. Copy the join link (or 6-char code) and send to players
5. Players go to http://YOUR-LOCAL-IP:5173/join/CODE

> To get your local IP: `ip addr show eth0` (or `ipconfig` on Windows)

## Features

- **Auth**: Email OTP (passwordless) — works without email config in dev mode
- **Characters**: Full D&D 5e sheets with avatar upload
- **Game Lobby**: Create/join games with 6-char codes
- **Battle Map**: Upload images, add grid overlay, fog of war
- **Tokens**: Each player moves their own token; DM moves all
- **Drawing Tools**: Pen, line, rectangle, circle on the map
- **Fog of War**: DM can hide/reveal map areas
- **Dice Roller**: Click dice types, roll with animation, visible to everyone in chat
- **Chat**: Real-time chat for all players
- **Handouts**: DM can share notes/files with players
- **Single Active Game**: Enforced at launch — prevents overloading the host PC
