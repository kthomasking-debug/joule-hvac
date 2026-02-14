#!/bin/bash
# One-time setup: Create a named Cloudflare tunnel for Ollama on your dev machine.
# Run from dev machine (needs browser for cloudflared login).
#
# Result: permanent URL https://<uuid>.cfargotunnel.com/v1 for Ollama
# Then run ./update-pi-ollama-url.sh and paste that URL.

set -e

TUNNEL_NAME="joule-ollama"

echo "🤖 Setting up named Cloudflare tunnel for Ollama"
echo "   (Permanent URL for your dev machine GPU)"
echo ""

# 1. Check cloudflared
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

# 4. Create config
CLOUDFLARED_DIR="$HOME/.cloudflared"
CRED_FILE="$CLOUDFLARED_DIR/${TUNNEL_ID}.json"
mkdir -p "$CLOUDFLARED_DIR"

if [ ! -f "$CRED_FILE" ]; then
  echo "❌ Credentials file not found: $CRED_FILE"
  exit 1
fi

CONFIG="$CLOUDFLARED_DIR/config-ollama.yml"
cat > "$CONFIG" << EOF
tunnel: $TUNNEL_ID
credentials-file: $CRED_FILE

ingress:
  - service: http://localhost:11434
  - service: http_status:404
EOF

OLLAMA_URL="https://${TUNNEL_ID}.cfargotunnel.com/v1"
echo ""
echo "   Permanent Ollama URL: $OLLAMA_URL"
echo ""
echo "   Next: Run ./update-pi-ollama-url.sh and paste that URL"
echo ""

if [ "$1" = "--background" ] || [ "$1" = "-b" ]; then
  echo "3. Starting tunnel in background..."
  nohup cloudflared tunnel --config "$CONFIG" run "$TUNNEL_NAME" > /tmp/cloudflared-ollama.log 2>&1 &
  echo "   PID: $!"
  echo "   Logs: tail -f /tmp/cloudflared-ollama.log"
  echo ""
  echo "   To stop: kill $!"
else
  echo "3. Starting tunnel (Ctrl+C to stop; use --background to run in background)..."
  echo ""
  exec cloudflared tunnel --config "$CONFIG" run "$TUNNEL_NAME"
fi
