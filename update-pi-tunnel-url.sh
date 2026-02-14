#!/bin/bash
# Write a Cloudflare tunnel URL to the Pi so the bridge and display QR code use it.
# Use when you have a tunnel URL from elsewhere (e.g. dev machine) and want the Pi to show it.
#
# Run from project root. Uses same PI_* as deploy-to-pi.sh.

PI_USER="pi"
PI_HOST="192.168.0.103"
PI_PASSWORD="1"
URL_FILE="/tmp/joule-cloudflare-tunnel-url.txt"

echo "📡 Update Pi tunnel URL"
echo ""
echo "Enter the tunnel URL (e.g. https://xyz.trycloudflare.com or https://uuid.cfargotunnel.com):"
read -r TUNNEL_URL

# Trim whitespace
TUNNEL_URL=$(echo "$TUNNEL_URL" | xargs)

if [ -z "$TUNNEL_URL" ]; then
  echo "❌ No URL entered. Exiting."
  exit 1
fi

# Ensure it starts with https://
if [[ ! "$TUNNEL_URL" =~ ^https:// ]]; then
  TUNNEL_URL="https://${TUNNEL_URL#*://}"
fi

# Remove trailing slash
TUNNEL_URL="${TUNNEL_URL%/}"

# Validate: real tunnel URLs contain trycloudflare.com, cfargotunnel.com, ngrok.io, or similar
if [[ ! "$TUNNEL_URL" =~ (trycloudflare\.com|cfargotunnel\.com|ngrok\.io|ngrok-free\.app|duckdns\.org) ]]; then
  echo "⚠️  Warning: This doesn't look like a tunnel URL. Real URLs usually contain trycloudflare.com or cfargotunnel.com."
  echo "   Continue anyway? [y/N]"
  read -r confirm
  if [[ ! "$confirm" =~ ^[yY] ]]; then
    echo "Aborted."
    exit 1
  fi
fi

echo ""
echo "Writing to Pi: $TUNNEL_URL"
echo ""

# Write to the Pi (bridge reads from this file)
# Use temp file + scp to avoid shell escaping issues with special chars in URL
TMP=$(mktemp)
echo "$TUNNEL_URL" > "$TMP"
sshpass -p "$PI_PASSWORD" scp "$TMP" ${PI_USER}@${PI_HOST}:"$URL_FILE"
rm -f "$TMP"

# Restart pi-hmi so the display refreshes with the new URL
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "sudo systemctl restart pi-hmi.service"

echo "✅ Tunnel URL written. Pi display should update within ~30 seconds."
echo "   Verify: ssh pi@$PI_HOST 'cat $URL_FILE'"
echo ""
