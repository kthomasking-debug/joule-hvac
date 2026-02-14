# Cloudflare Named Tunnel Setup (Permanent URLs)

Instead of quick tunnels (random `trycloudflare.com` URLs that change on restart), you can use **named tunnels** for device-specific permanent URLs with **no DNS management**.

## Quick setup (recommended)

### Pi bridge tunnel (one-time)

From project root:
```bash
./prostat-bridge/setup-named-tunnel-pi.sh
```
This logs in (browser), creates the tunnel, copies credentials to the Pi, installs the service, and writes the permanent URL. The Pi display QR updates automatically.

### Ollama tunnel (one-time, on dev machine)

From project root:
```bash
./setup-ollama-named-tunnel.sh
```
Then run `./update-pi-ollama-url.sh` and paste the printed URL. Use `--background` to run the tunnel in the background.

---

## Manual Option A: cfargotunnel.com (No DNS)

Each named tunnel gets a free permanent URL: `https://<tunnel-uuid>.cfargotunnel.com`

### One-time per device

1. **Create the tunnel** (run once on the Pi or from your dev machine):
   ```bash
   cloudflared tunnel login   # Opens browser, authenticate with Cloudflare
   cloudflared tunnel create joule-pi-1   # Or joule-pi-2, joule-bridge, etc.
   ```
   Note the tunnel UUID from the output.

2. **Create config** at `~/.cloudflared/config.yml` (or `/home/pi/.cloudflared/config.yml` on Pi):
   ```yaml
   tunnel: <TUNNEL_UUID>
   credentials-file: /home/pi/.cloudflared/<TUNNEL_UUID>.json

   ingress:
     - service: http://localhost:8080
     - service: http_status:404
   ```
   Replace `<TUNNEL_UUID>` in the first two lines. The tunnel is reachable at `https://<TUNNEL_UUID>.cfargotunnel.com` automatically.

3. **Copy credentials** to the Pi if you created the tunnel elsewhere:
   ```bash
   scp -r ~/.cloudflared pi@192.168.0.103:~/
   ```

4. **Run the tunnel**:
   ```bash
   cloudflared tunnel run joule-pi-1
   ```
   Or use `./prostat-bridge/install-cloudflared-named-tunnel.sh` for systemd.

5. **Write the URL to the Pi** so the display QR updates:
   ```bash
   ./update-pi-tunnel-url.sh
   # Enter: https://<TUNNEL_UUID>.cfargotunnel.com
   ```

The URL `https://<uuid>.cfargotunnel.com` is permanent and does not change on restart.

---

## Option B: cloudflareaccess.com (Zero Trust)

For URLs like `<device>.joule-hvac.cloudflareaccess.com`:

1. **Create a Zero Trust team** at [dash.teams.cloudflare.com](https://dash.teams.cloudflare.com) (free plan).
2. **Create a named tunnel** per device (as in Option A).
3. **In Zero Trust dashboard** → Access → Applications → Add an application:
   - Application type: Self-hosted
   - Domain: Add a public hostname (e.g. `pi-1.joule-hvac.cloudflareaccess.com`)
   - Subdomain: If Cloudflare provides `*.cloudflareaccess.com` for your team, use that
4. **Connect the tunnel** to the application (Cloudflare routes the hostname to your tunnel).

Exact steps depend on your Zero Trust team setup. The key idea: you attach a public hostname in the Zero Trust UI and route it to your named tunnel—no external DNS.

---

## Comparison

| Approach | URL | Persistent? | DNS? |
|----------|-----|-------------|------|
| Quick tunnel (current) | `https://random-words.trycloudflare.com` | No (changes each run) | No |
| Named tunnel (Option A) | `https://<uuid>.cfargotunnel.com` | Yes | No |
| Zero Trust (Option B) | `https://<device>.joule-hvac.cloudflareaccess.com` | Yes | No |

---

## Switching from quick tunnel to named tunnel

1. Create the named tunnel and config (Option A above).
2. Stop the quick tunnel service: `sudo systemctl stop joule-cloudflared`
3. Create a new systemd service that runs `cloudflared tunnel run joule-pi-1` instead of `cloudflared-tunnel.sh`.
4. Run `./update-pi-tunnel-url.sh` and enter your permanent URL.
