# Streaming from Home — Anywhere on the Internet

The server binds to `0.0.0.0` so it's reachable on your LAN and by any tunnel.

## Option A — Cloudflare Tunnel (recommended, free)

Gives you a real domain like `music.yourdomain.com` with HTTPS and Cloudflare's
global network accelerating your audio delivery.

### 1. Install cloudflared

```bash
brew install cloudflare/cloudflare/cloudflared
```

### 2. Log in (one-time)

```bash
cloudflared tunnel login
```

### 3. Create a named tunnel

```bash
cloudflared tunnel create lossly
```

Note the tunnel UUID printed (e.g. `a1b2c3d4-...`).

### 4. Create config at `~/.cloudflared/config.yml`

```yaml
tunnel: <TUNNEL-UUID>
credentials-file: /Users/<you>/.cloudflared/<TUNNEL-UUID>.json

ingress:
  - hostname: music.yourdomain.com
    service: http://localhost:5001
  - service: http_status:404
```

Replace `yourdomain.com` with a domain you control in Cloudflare.

### 5. Route DNS

```bash
cloudflared tunnel route dns lossly music.yourdomain.com
```

### 6. Add to your .env

```
CLIENT_URL=https://music.yourdomain.com
PORT=5001
HOST=0.0.0.0
```

### 7. Run tunnel (alongside the server)

```bash
# Terminal 1
npm start

# Terminal 2
cloudflared tunnel run lossly
```

### 8. Run as a service (24/7, survives reboots)

```bash
sudo cloudflared service install
sudo launchctl start com.cloudflare.cloudflared
```

Your music is now streamable at `https://music.yourdomain.com` from anywhere.

---

## Option B — Tailscale Funnel (simpler, personal use)

```bash
brew install tailscale
tailscale up
tailscale funnel 5001
```

Tailscale gives you a `https://<machine>.tailXXXX.ts.net` URL accessible
from any device on your Tailscale network (and publicly via Funnel).

---

## Bulk importing your music

Copy FLACs/MP3s into `./songs/` then run:

```bash
npm run import
# or point at a specific folder:
node server/modules/library/bulkImport.js /path/to/your/music
```

This reads embedded metadata (title, artist, album, cover art) and registers
each file in the database.
