#!/bin/bash
# Install systemd service for Joule named Cloudflare tunnel (permanent URL).
# Called by setup-named-tunnel-pi.sh with: sudo ./install-cloudflared-named-tunnel.sh <TUNNEL_ID> <TUNNEL_NAME>
#
# Prerequisites: credentials and config already copied to /home/pi/.cloudflared/

set -e

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo $0 <TUNNEL_ID> <TUNNEL_NAME>"
  exit 1
fi

TUNNEL_ID="$1"
TUNNEL_NAME="${2:-joule-pi}"

if [ -z "$TUNNEL_ID" ]; then
  echo "Usage: sudo $0 <TUNNEL_ID> <TUNNEL_NAME>"
  exit 1
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install it first (see fix-tunnel-on-pi.sh or USEFUL-COMMANDS.md)"
  exit 1
fi

CRED_FILE="/home/pi/.cloudflared/${TUNNEL_ID}.json"
CONFIG_FILE="/home/pi/.cloudflared/config.yml"

if [ ! -f "$CRED_FILE" ]; then
  echo "Credentials not found: $CRED_FILE"
  exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Config not found: $CONFIG_FILE"
  exit 1
fi

# Ensure pi owns the files
chown -R pi:pi /home/pi/.cloudflared

SERVICE_NAME="joule-cloudflared.service"

cat > "/etc/systemd/system/$SERVICE_NAME" << EOF
[Unit]
Description=Joule Cloudflare Tunnel (named tunnel - permanent URL)
After=network.target prostat-bridge.service
Wants=prostat-bridge.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/.cloudflared
ExecStartPre=/bin/sleep 45
ExecStart=/usr/local/bin/cloudflared tunnel --config $CONFIG_FILE run $TUNNEL_NAME
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
echo "Joule named tunnel service installed and started."
echo "  Status: sudo systemctl status $SERVICE_NAME"
echo "  Logs:   sudo journalctl -u $SERVICE_NAME -f"
echo "  URL:    https://${TUNNEL_ID}.cfargotunnel.com"
echo ""
