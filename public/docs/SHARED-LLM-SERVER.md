# Shared Joule LLM Server — Final Free Setup (DuckDNS + Ollama)

Turn your Linux PC with a GPU into a shared LLM server. Joule users connect to:

**http://YOUR_DOMAIN.duckdns.org:11434/v1**

All free. Step-by-step wizard: **Tools → Shared LLM Server Wizard** in the app.

---

## Part 1 — DuckDNS auto-update script

**Step 1.1** — Create the folder and go there:

```bash
mkdir -p ~/duckdns && cd ~/duckdns
```

**Step 1.2** — Create the script in one command. Replace `YOUR_DOMAIN` and `YOUR_TOKEN` with your DuckDNS domain and token (no spaces; get them from [duckdns.org](https://www.duckdns.org)):

```bash
echo 'echo url="https://www.duckdns.org/update?domains=YOUR_DOMAIN&token=YOUR_TOKEN&ip=" | curl -k -o ~/duckdns/duck.log -K -' > update.sh
```

Example for domain `joulehvac` and token `abc123-def456`:

```bash
echo 'echo url="https://www.duckdns.org/update?domains=joulehvac&token=abc123-def456&ip=" | curl -k -o ~/duckdns/duck.log -K -' > update.sh
```

**Step 1.3** — Make it executable and test:

```bash
chmod +x update.sh
./update.sh
cat duck.log
```

You should see: **OK** (or **NOCHANGE** — that's fine, IP is already correct).

---

## Part 2 — Run every 5 minutes

```bash
crontab -e
```

Add this line (choose your editor if asked — nano is easiest):

```
*/5 * * * * ~/duckdns/update.sh >/dev/null 2>&1
```

Save and exit (nano: Ctrl+O, Enter, Ctrl+X). Domain stays synced.

---

## Part 3 — Ollama listen on internet

**Step 3.1** — Create the config in one command:

```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d/
printf '[Service]\nEnvironment="OLLAMA_HOST=0.0.0.0"\nEnvironment="OLLAMA_ORIGINS=*"\n' | sudo tee /etc/systemd/system/ollama.service.d/override.conf
```

**Step 3.2** — Restart Ollama:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

---

## Part 4 — Router port forward

On your router (often at **192.168.1.1**):

| Setting      | Value                 |
| ------------ | --------------------- |
| External port | 11434                |
| Internal IP   | your Linux machine   |
| Internal port | 11434                |
| Protocol      | TCP                  |

---

## Part 5 — Test from outside

From a phone on cellular or another network:

```bash
curl http://YOUR_DOMAIN.duckdns.org:11434
```

If it works, you'll see Ollama's response.

**Phone says "unable to open page"?** Many cell carriers block port 11434. Set up **Optional: Free HTTPS** (below) or **Optional: Cloudflare Tunnel**.

---

## Part 6 — Joule users connect

In Joule: **Settings → AI Integration → Local (Ollama) → On another device**

URL to enter: **http://YOUR_DOMAIN.duckdns.org:11434/v1**  
Model: **llama3** (or another you have)

### QR code for off-network users

Create a link that auto-configures Local Ollama when opened:

```
{APP_ORIGIN}/?ollamaUrl=http%3A%2F%2FYOUR_DOMAIN.duckdns.org%3A11434%2Fv1&aiProvider=local&ollamaModel=llama3:latest
```

Replace `{APP_ORIGIN}` with where users open the app (e.g. `http://192.168.0.42:8080` for same network, or your deployed app URL). Use any QR generator (e.g. qr-code-generator.com) with the link. When users scan and open it, Joule switches to Local Ollama with your shared server.

---

## Security (important)

The internet can reach your GPU. At minimum:

```bash
sudo ufw allow 11434/tcp
sudo ufw enable
```

To allow only specific IPs (e.g. friends):

```bash
sudo ufw allow from THEIR_IP to any port 11434
```

---

## Optional: Free HTTPS

```bash
sudo apt install caddy
```

Edit `/etc/caddy/Caddyfile`:

```bash
sudo nano /etc/caddy/Caddyfile
```

Add (use your domain):

```
YOUR_DOMAIN.duckdns.org {
    reverse_proxy localhost:11434
}
```

Restart:

```bash
sudo systemctl restart caddy
```

Then users connect via: **https://YOUR_DOMAIN.duckdns.org/v1** (no port needed).

---

## Optional: Cloudflare Tunnel (when ports 80/443 blocked)

If your ISP blocks ports 80 and 443, use a Cloudflare quick tunnel. No login or domain needed:

```bash
cloudflared tunnel --url http://localhost:11434
```

You'll see a URL like **https://something-random.trycloudflare.com**. Add `/v1` for Joule (e.g. `https://something-random.trycloudflare.com/v1`). The URL changes each time you restart the tunnel.

For a stable URL, use a named tunnel with your own domain in Cloudflare.

---

## Quick diagnostics

**Port open?**
```bash
sudo ss -tulpn | grep 11434
```

**Firewall?**
```bash
sudo ufw status
```

**Your public IP (should match DuckDNS):**
```bash
curl ifconfig.me
```
