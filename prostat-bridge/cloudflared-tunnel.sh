#!/bin/bash
# Run cloudflared quick tunnel and capture the URL for the Joule display QR code.
# The URL is written to a file the bridge reads, so the Pi HMI QR code updates automatically.
#
# Usage: ./cloudflared-tunnel.sh
# Or:    cloudflared tunnel --url http://localhost:8080  # manual - won't capture URL
#
# Install cloudflared first: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

set -e

URL_FILE="${JOULE_CLOUDFLARE_URL_FILE:-/tmp/joule-cloudflare-tunnel-url.txt}"
BRIDGE_PORT="${BRIDGE_PORT:-8080}"
TUNNEL_URL="http://localhost:${BRIDGE_PORT}"

# Also try bridge data dir so it persists across reboots (if writable)
DATA_DIR="${HOME}/.local/share/joule-bridge"
if [ -d "$DATA_DIR" ] && [ -w "$DATA_DIR" ]; then
  URL_FILE_ALT="${DATA_DIR}/cloudflare-tunnel-url.txt"
else
  URL_FILE_ALT="$URL_FILE"
fi

echo "[Joule] Starting Cloudflare tunnel to $TUNNEL_URL"
echo "[Joule] Tunnel URL will be written to: $URL_FILE"
echo ""

# Remove stale URL when starting (tunnel URL changes each run for quick tunnels)
rm -f "$URL_FILE" "$URL_FILE_ALT" 2>/dev/null || true

# Run cloudflared and capture URL from output
# Cloudflared prints: "https://xxx-xxx-xxx.trycloudflare.com" on a line
cloudflared tunnel --url "$TUNNEL_URL" 2>&1 | while IFS= read -r line; do
  echo "$line"
  # Extract URL when we see it (trycloudflare.com quick tunnel or custom domain)
  if echo "$line" | grep -qE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com'; then
    captured=$(echo "$line" | grep -oE 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' | head -1)
    if [ -n "$captured" ]; then
      echo "$captured" > "$URL_FILE"
      [ "$URL_FILE" != "$URL_FILE_ALT" ] && echo "$captured" > "$URL_FILE_ALT" 2>/dev/null || true
      echo "[Joule] Tunnel URL captured: $captured"
    fi
  fi
done
