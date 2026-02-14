#!/bin/bash
# Install systemd service for Joule Cloudflare tunnel (plug-and-play remote access)
# Run: sudo ./install-cloudflared-service.sh
#
# Prerequisites:
#   1. Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
#   2. Bridge must be running (prostat-bridge or joule-bridge service)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="joule-cloudflared.service"

BRIDGE_DIR="$SCRIPT_DIR"

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo $0"
  exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install it first (Pi Zero 2W / Pi 4 / Pi 5 use arm64):"
  echo "  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /tmp/cloudflared"
  echo "  sudo mv /tmp/cloudflared /usr/local/bin/cloudflared"
  echo "  sudo chmod +x /usr/local/bin/cloudflared"
  echo ""
  echo "For 32-bit Pi (armv7l): use cloudflared-linux-arm instead of cloudflared-linux-arm64"
  exit 1
fi

if [[ ! -f "$BRIDGE_DIR/cloudflared-tunnel.sh" ]]; then
  echo "cloudflared-tunnel.sh not found at $BRIDGE_DIR"
  exit 1
fi

chmod +x "$BRIDGE_DIR/cloudflared-tunnel.sh"

# Create service file with correct paths
# ExecStartPre sleep: Pi Zero WiFi can take 30-60s; bridge needs time to listen on 8080
cat > "/etc/systemd/system/$SERVICE_NAME" << EOF
[Unit]
Description=Joule Cloudflare Tunnel (quick tunnel for remote access)
After=network.target prostat-bridge.service
Wants=prostat-bridge.service

[Service]
Type=simple
User=pi
WorkingDirectory=$BRIDGE_DIR
ExecStartPre=/bin/sleep 45
ExecStart=$BRIDGE_DIR/cloudflared-tunnel.sh
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl start "$SERVICE_NAME"

echo ""
echo "Joule Cloudflare tunnel service installed and started."
echo "  Status: sudo systemctl status $SERVICE_NAME"
echo "  Logs:   sudo journalctl -u $SERVICE_NAME -f"
echo ""
echo "The tunnel URL is captured automatically. The Pi display QR code will update within ~1 minute."
echo "Scan it from anywhere to open the Joule app."
