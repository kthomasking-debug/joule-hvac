#!/bin/bash
# One-time setup: Create a named Cloudflare tunnel for the Pi bridge (permanent URL).
# Run from dev machine (needs browser for cloudflared login). Uses same PI_* as deploy-to-pi.sh.
#
# Result: permanent URL https://<uuid>.cfargotunnel.com for the Joule app
# No more random trycloudflare.com URLs that change on restart.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

PI_USER="pi"
PI_HOST="${PI_HOST:-192.168.0.103}"
PI_PASSWORD="${PI_PASSWORD:-1}"
PI_BRIDGE="/home/pi/git/joule-hvac/prostat-bridge"
TUNNEL_NAME="joule-pi"

echo "🔧 Setting up named Cloudflare tunnel for Pi bridge"
echo "   (Permanent URL, no DNS needed)"
echo ""

# 1. Check cloudflared on dev machine
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "❌ cloudflared not found. Install it first:"
  echo "   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  exit 1
fi

# 2. Login (opens browser)
echo "1. Logging in to Cloudflare (browser will open)..."
cloudflared tunnel login

# 3. Create tunnel
echo ""
echo "2. Creating tunnel '$TUNNEL_NAME'..."
CREATE_OUT=$(cloudflared tunnel create "$TUNNEL_NAME" 2>&1) || true
if echo "$CREATE_OUT" | grep -q "already exists"; then
  echo "   Tunnel '$TUNNEL_NAME' already exists."
  TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "$TUNNEL_NAME" | awk '{print $1}')
else
  TUNNEL_ID=$(echo "$CREATE_OUT" | grep -oE '[a-f0-9-]{36}' | head -1)
fi

if [ -z "$TUNNEL_ID" ]; then
  echo "   Could not get tunnel ID. Run: cloudflared tunnel list"
  exit 1
fi

echo "   Tunnel ID: $TUNNEL_ID"

# 4. Create config locally
CLOUDFLARED_DIR="$HOME/.cloudflared"
CRED_FILE="$CLOUDFLARED_DIR/${TUNNEL_ID}.json"
mkdir -p "$CLOUDFLARED_DIR"

if [ ! -f "$CRED_FILE" ]; then
  echo "❌ Credentials file not found: $CRED_FILE"
  exit 1
fi

CONFIG="$CLOUDFLARED_DIR/config-pi.yml"
cat > "$CONFIG" << EOF
tunnel: $TUNNEL_ID
credentials-file: /home/pi/.cloudflared/${TUNNEL_ID}.json

ingress:
  - service: http://localhost:8080
  - service: http_status:404
EOF

echo ""
echo "3. Copying credentials and config to Pi..."
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "mkdir -p /home/pi/.cloudflared"
sshpass -p "$PI_PASSWORD" scp "$CRED_FILE" "$CONFIG" ${PI_USER}@${PI_HOST}:/home/pi/.cloudflared/

# 5. Create config on Pi with correct credentials path
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "cat > /home/pi/.cloudflared/config.yml" < "$CONFIG"

# 6. Install service on Pi
echo ""
echo "4. Installing tunnel service on Pi..."
sshpass -p "$PI_PASSWORD" scp "$SCRIPT_DIR/install-cloudflared-named-tunnel.sh" ${PI_USER}@${PI_HOST}:$PI_BRIDGE/
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "sudo $PI_BRIDGE/install-cloudflared-named-tunnel.sh $TUNNEL_ID $TUNNEL_NAME"

# 7. Stop old quick tunnel if running
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "sudo systemctl stop joule-cloudflared 2>/dev/null || true"

# 8. Write permanent URL to Pi
echo ""
echo "5. Writing permanent URL to Pi..."
TUNNEL_URL="https://${TUNNEL_ID}.cfargotunnel.com"
TMP=$(mktemp)
echo "$TUNNEL_URL" > "$TMP"
sshpass -p "$PI_PASSWORD" scp "$TMP" ${PI_USER}@${PI_HOST}:/tmp/joule-cloudflare-tunnel-url.txt
rm -f "$TMP"

# 9. Restart Pi HMI
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "sudo systemctl restart pi-hmi.service"

echo ""
echo "✅ Done! Permanent tunnel URL: $TUNNEL_URL"
echo ""
echo "   Pi display QR will update within ~30 seconds."
echo "   This URL never changes (unlike quick tunnels)."
echo ""
echo "   Save it for update-pi-tunnel-url.sh if needed:"
echo "   $TUNNEL_URL"
echo ""
