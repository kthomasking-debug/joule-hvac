#!/bin/bash
# Fix Cloudflare tunnel on Pi so the QR code shows the remote URL.
# Run from project root. Uses same PI_* as deploy-to-pi.sh.

PI_USER="pi"
PI_HOST="192.168.0.103"
PI_PASSWORD="1"
PI_BRIDGE="/home/pi/git/joule-hvac/prostat-bridge"

echo "🔧 Fixing Cloudflare tunnel on Pi..."
echo ""

# 1. Install/reinstall cloudflared with correct architecture
echo "1. Checking cloudflared..."
ARCH=$(sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "uname -m")
case "$ARCH" in
  aarch64|arm64) CLOUDFLARED_ARCH="arm64" ;;
  armv7l|armv6l) CLOUDFLARED_ARCH="arm" ;;
  x86_64)        CLOUDFLARED_ARCH="amd64" ;;
  *)             CLOUDFLARED_ARCH="arm64" ;;  # default for unknown
esac
echo "   Pi arch: $ARCH -> using cloudflared-linux-$CLOUDFLARED_ARCH"

# Reinstall if missing or wrong arch (Exec format error)
NEED_INSTALL=$(sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "cloudflared --version 2>/dev/null || echo NEED")
if [ "$NEED_INSTALL" = "NEED" ]; then
  echo "   Installing cloudflared..."
  sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CLOUDFLARED_ARCH} -o /tmp/cloudflared"
  sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "sudo mv /tmp/cloudflared /usr/local/bin/cloudflared && sudo chmod +x /usr/local/bin/cloudflared"
  echo "   ✅ cloudflared installed"
else
  echo "   ✅ cloudflared present and runnable"
fi
echo ""

# 2. Ensure tunnel scripts are deployed
echo "2. Deploying tunnel scripts..."
sshpass -p "$PI_PASSWORD" scp prostat-bridge/cloudflared-tunnel.sh prostat-bridge/install-cloudflared-service.sh ${PI_USER}@${PI_HOST}:$PI_BRIDGE/
echo "   ✅ Scripts copied"
echo ""

# 3. Install and start joule-cloudflared service
echo "3. Installing tunnel service..."
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "sudo $PI_BRIDGE/install-cloudflared-service.sh"
echo ""

# 4. Wait for tunnel to establish (service has 45s sleep + ~15s for cloudflared)
echo "4. Waiting ~60s for tunnel to establish..."
sleep 60
echo ""

# 5. Check if URL was captured
echo "5. Checking tunnel URL..."
TUNNEL_URL=$(sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "cat /tmp/joule-cloudflare-tunnel-url.txt 2>/dev/null || echo ''")
if [ -n "$TUNNEL_URL" ]; then
  echo "   ✅ Tunnel URL: $TUNNEL_URL"
else
  echo "   ⚠️  No URL in /tmp/joule-cloudflare-tunnel-url.txt yet."
  echo "   Check tunnel logs: ssh pi@$PI_HOST 'sudo journalctl -u joule-cloudflared -n 30'"
fi
echo ""

# 6. Restart pi-hmi so it picks up the new URL
echo "6. Restarting Pi HMI display..."
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "sudo systemctl restart pi-hmi.service"
echo ""

echo "✅ Done. The Pi display should refresh within ~30s with the tunnel QR."
echo "   If the QR still shows local IP, wait 1–2 min and check the QR page again."
echo ""
