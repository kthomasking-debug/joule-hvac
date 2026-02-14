#!/bin/bash
# Update the Ollama/Local AI URL on the Pi bridge so the app (including when opened from phone) uses your dev machine's GPU.
# Run from project root. Uses same PI_* as deploy-to-pi.sh.
#
# First run cloudflared on your dev machine: cloudflared tunnel --url http://localhost:11434
# Then paste the tunnel URL here (add /v1 is automatic if missing).

PI_HOST="${PI_HOST:-192.168.0.103}"
BRIDGE_URL="http://${PI_HOST}:8080"

echo "🤖 Update Pi Ollama / Local AI URL"
echo ""
echo "Enter the Ollama URL (e.g. https://xyz.trycloudflare.com/v1 or http://192.168.0.108:11434/v1):"
read -r OLLAMA_URL

# Trim whitespace
OLLAMA_URL=$(echo "$OLLAMA_URL" | xargs)

if [ -z "$OLLAMA_URL" ]; then
  echo "❌ No URL entered. Exiting."
  exit 1
fi

# Ensure it has a scheme
if [[ ! "$OLLAMA_URL" =~ ^https?:// ]]; then
  OLLAMA_URL="https://${OLLAMA_URL}"
fi

# Ollama API needs /v1 - add if missing
if [[ ! "$OLLAMA_URL" =~ /v1/?$ ]]; then
  OLLAMA_URL="${OLLAMA_URL%/}/v1"
fi

# Validate: tunnel URLs contain trycloudflare.com etc; local IPs match 192.168.x.x or similar
if [[ ! "$OLLAMA_URL" =~ (trycloudflare\.com|ngrok\.io|ngrok-free\.app|duckdns\.org|localhost|127\.0\.0\.1|192\.168\.|10\.) ]]; then
  echo "⚠️  Warning: This doesn't look like an Ollama URL. Expected:"
  echo "   - Tunnel: https://xyz.trycloudflare.com (or /v1)"
  echo "   - Local:  http://192.168.0.108:11434/v1"
  echo "   Continue anyway? [y/N]"
  read -r confirm
  if [[ ! "$confirm" =~ ^[yY] ]]; then
    echo "Aborted."
    exit 1
  fi
fi

echo ""
echo "Updating bridge at $BRIDGE_URL with: $OLLAMA_URL"
echo ""

# POST to bridge settings API (use temp file to avoid shell escaping issues)
TMP=$(mktemp)
printf '{"value":"%s"}\n' "$(echo "$OLLAMA_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')" > "$TMP"
RESP=$(curl -s -w "\n%{http_code}" -X POST "${BRIDGE_URL}/api/settings/localAIBaseUrl" \
  -H "Content-Type: application/json" \
  -d @"$TMP")
rm -f "$TMP"
HTTP_CODE=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
if echo "$BODY" | grep -qE '"success"\s*:\s*true'; then
  echo "✅ localAIBaseUrl updated"
elif [ -z "$BODY" ] || [ "$HTTP_CODE" = "000" ]; then
  echo "❌ Cannot reach bridge at $BRIDGE_URL. Is the Pi on and the bridge running?"
  echo "   Try: curl -s $BRIDGE_URL/health"
  exit 1
else
  echo "❌ Bridge returned HTTP $HTTP_CODE: $BODY"
  exit 1
fi

# Also set aiProvider to local so the app uses it
if curl -s -X POST "${BRIDGE_URL}/api/settings/aiProvider" \
  -H "Content-Type: application/json" \
  -d '{"value": "local"}' | grep -qE '"success"\s*:\s*true'; then
  echo "✅ aiProvider set to local"
else
  echo "⚠️  Could not set aiProvider (non-fatal)"
fi

echo ""
echo "Done. When you open the app from your phone (via Pi tunnel), it will use this Ollama URL."
echo ""
