#!/bin/bash
# Deploy web app and Pi HMI to Raspberry Pi bridge
# Builds the production app, copies dist + pi-hmi/app.py, restarts bridge and pi-hmi services

set -e  # Exit on error

PI_USER="pi"
PI_HOST="192.168.0.103"
PI_PASSWORD="1"

echo "🏗️  Building production web app..."
npm run build

echo "📦 Copying build to Pi..."
sshpass -p "$PI_PASSWORD" scp -r dist/* ${PI_USER}@${PI_HOST}:/home/pi/git/joule-hvac/dist/

echo "🔄 Deploying bridge server (unified at /home/pi/git/joule-hvac/prostat-bridge)..."
PI_BRIDGE="/home/pi/git/joule-hvac/prostat-bridge"
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "mkdir -p $PI_BRIDGE"
sshpass -p "$PI_PASSWORD" scp prostat-bridge/server.py prostat-bridge/requirements.txt prostat-bridge/install-service.sh prostat-bridge/cloudflared-tunnel.sh prostat-bridge/install-cloudflared-service.sh prostat-bridge/install-cloudflared-named-tunnel.sh ${PI_USER}@${PI_HOST}:$PI_BRIDGE/
# Create venv and install deps if missing
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "cd $PI_BRIDGE && [ ! -d venv ] && python3 -m venv venv && venv/bin/pip install -r requirements.txt || true"
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "$PI_BRIDGE/install-service.sh" || echo "⚠️  Run install-service.sh manually if bridge service not yet installed"
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "sudo systemctl restart prostat-bridge"

# Ensure only one instance of the bridge server is running after deployment
echo "[Joule Deploy] Checking for duplicate prostat-bridge/server.py processes on Pi..."
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "pgrep -fl 'prostat-bridge/server.py' | grep -v grep | awk '{print \$1}' | xargs -r sudo kill -9"
echo "[Joule Deploy] All duplicate bridge processes killed."

echo "📺 Deploying Pi HMI..."
sshpass -p "$PI_PASSWORD" scp pi-hmi/app.py ${PI_USER}@${PI_HOST}:/home/pi/git/joule-hvac/pi-hmi/
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "sudo systemctl restart pi-hmi.service"

echo "🌐 Setting up Cloudflare tunnel..."
# Skip quick tunnel if named tunnel already configured (permanent URL)
if sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "test -f /home/pi/.cloudflared/config.yml" 2>/dev/null; then
  echo "   Named tunnel already configured (permanent URL) - skipping quick tunnel"
  sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "sudo systemctl restart joule-cloudflared 2>/dev/null" || true
else
  sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "sudo $PI_BRIDGE/install-cloudflared-service.sh" || echo "⚠️  Tunnel install skipped (cloudflared may not be installed - see public/docs/USEFUL-COMMANDS.md)"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📱 Access the app at:"
echo "   - http://joule-bridge.local:8080"
echo "   - http://192.168.0.103:8080"
echo ""
echo "🌐 Cloudflare tunnel: scan the Pi display QR code for remote access (if tunnel installed)"
echo "🔧 Bridge API still available at /api/*"
