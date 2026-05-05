# Deploying The Tavern VTT to lomindil.com via Cloudflare Tunnel

This guide exposes your local server to the internet at `lomindil.com` (Namecheap domain) using a free Cloudflare Tunnel — no open firewall ports, no static IP needed.

---

## Prerequisites

- Domain `lomindil.com` bought on Namecheap (you have this)
- A free Cloudflare account — create one at cloudflare.com
- The app running locally (`npm run dev` at root)

---

## Step 1 — Move DNS to Cloudflare

Cloudflare Tunnel needs to manage your DNS records.

1. Log in to Cloudflare → **Add a site** → enter `lomindil.com` → choose the **Free** plan.
2. Cloudflare will scan your existing Namecheap DNS records. Keep any you want (usually none needed for a fresh domain).
3. Cloudflare gives you **two nameserver addresses** like:
   ```
   aria.ns.cloudflare.com
   bob.ns.cloudflare.com
   ```
4. Log in to **Namecheap** → Domain List → Manage `lomindil.com` → **Nameservers** → choose "Custom DNS" → paste Cloudflare's nameservers → Save.
5. Wait 5–30 minutes for propagation. Cloudflare will email you when active.

---

## Step 2 — Install cloudflared

```bash
# Ubuntu/WSL (your environment)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Verify
cloudflared --version
```

---

## Step 3 — Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser. Select `lomindil.com`. A certificate file is saved to `~/.cloudflared/cert.pem`.

---

## Step 4 — Create the tunnel

```bash
cloudflared tunnel create tavern-vtt
```

This creates a tunnel and saves credentials to `~/.cloudflared/<UUID>.json`. Note the UUID printed.

---

## Step 5 — Configure the tunnel

Create the config file:

```bash
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: tavern-vtt
credentials-file: /home/ekaksha/.cloudflared/<PASTE-UUID-HERE>.json

ingress:
  # Main app (Vite frontend, proxied through Vite → Express backend)
  - hostname: lomindil.com
    service: http://localhost:5173
  # WebSocket / API direct to backend (for socket.io)
  - hostname: api.lomindil.com
    service: http://localhost:3001
  - service: http_status:404
EOF
```

Replace `<PASTE-UUID-HERE>` with your actual UUID.

---

## Step 6 — Create DNS records via Cloudflare

```bash
cloudflared tunnel route dns tavern-vtt lomindil.com
cloudflared tunnel route dns tavern-vtt api.lomindil.com
```

This creates CNAME records pointing to the tunnel automatically.

---

## Step 7 — Update environment variables for production

**Server** — create `/home/ekaksha/Ubuntu Backup/projects/tavern-vtt/server/.env`:
```
NODE_ENV=production
PORT=3001
CLIENT_URL=https://lomindil.com
JWT_SECRET=<generate-a-strong-random-secret>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=yourmail@gmail.com
SMTP_PASS=your-app-password
```

**Client/server wiring** — already done in the code. The app uses a single-origin design:
- `index.html` loads socket.io from `/socket.io/socket.io.js` (relative URL)
- Vite proxies `/socket.io` → `localhost:3001` in dev
- Express serves `/socket.io` directly in prod (socket.io does this automatically)
- `useSocket.ts` connects to `window.location.origin` — no hardcoded URLs
- `vite.config.ts` builds to `../server/public` (Express serves it in prod)
- `server/src/index.ts` serves the built frontend when `NODE_ENV=production`

No code changes needed — these are already in place.

---

## Step 8 — Build and run

```bash
# Build frontend
cd "/home/ekaksha/Ubuntu Backup/projects/tavern-vtt/client"
npm run build

# Start backend (production)
cd "/home/ekaksha/Ubuntu Backup/projects/tavern-vtt/server"
NODE_ENV=production npm start
```

---

## Step 9 — Start the tunnel

```bash
cloudflared tunnel run tavern-vtt
```

Your app is now live at `https://lomindil.com` 🎉

---

## Step 10 — Run as a persistent service (auto-start)

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

To also auto-start the Node server, create a systemd service:

```bash
sudo tee /etc/systemd/system/tavern-vtt.service << 'EOF'
[Unit]
Description=Tavern VTT Server
After=network.target

[Service]
Type=simple
User=ekaksha
WorkingDirectory=/home/ekaksha/Ubuntu Backup/projects/tavern-vtt/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=NODE_ENV=production
EnvironmentFile=/home/ekaksha/Ubuntu Backup/projects/tavern-vtt/server/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable tavern-vtt
sudo systemctl start tavern-vtt
```

Build the server first:
```bash
cd "/home/ekaksha/Ubuntu Backup/projects/tavern-vtt/server"
npx tsc
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| `cloudflared` can't find certificate | Re-run `cloudflared tunnel login` |
| DNS not propagating | Check Namecheap shows Cloudflare nameservers; wait up to 48h |
| socket.io connection fails | Make sure `api.lomindil.com` CNAME exists in Cloudflare dashboard |
| WebSocket drops | In Cloudflare dashboard → `api.lomindil.com` → Network → **WebSockets: ON** |
| CORS errors | Verify `CLIENT_URL=https://lomindil.com` in server `.env` (exact match, no trailing slash) |
| App shows blank after build | Make sure `build.outDir` points to `server/public` and Express serves it |

---

## Quick reference

```bash
# Local dev (as always)
npm run dev

# Check tunnel status
cloudflared tunnel info tavern-vtt

# View tunnel logs
journalctl -u cloudflared -f

# View server logs
journalctl -u tavern-vtt -f
```
