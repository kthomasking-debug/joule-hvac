#!/bin/bash
# Installation script for Joule Bridge systemd service
# This sets up the bridge to auto-start on boot

set -e

echo "🔧 Installing Joule Bridge systemd service..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVICE_FILE="$SCRIPT_DIR/joule-bridge.service"

# Check if service file exists
if [ ! -f "$SERVICE_FILE" ]; then
    echo "❌ Error: Service file not found at $SERVICE_FILE"
    exit 1
fi

# Get the actual user (not root)
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  Running as root. Please run as regular user (will use sudo when needed)."
    exit 1
fi

# Get user's home directory
USER_HOME=$(eval echo ~$USER)
BRIDGE_DIR="$USER_HOME/prostat-bridge"

# Check if bridge directory exists
if [ ! -d "$BRIDGE_DIR" ]; then
    echo "⚠️  Bridge directory not found at $BRIDGE_DIR"
    echo "   Using script directory: $SCRIPT_DIR"
    BRIDGE_DIR="$SCRIPT_DIR"
fi

# Update service file with correct paths
echo "📝 Creating systemd service file..."
sudo tee /etc/systemd/system/prostat-bridge.service > /dev/null <<EOF
[Unit]
Description=Joule Bridge HomeKit Controller
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$BRIDGE_DIR
ExecStart=$BRIDGE_DIR/venv/bin/python3 $BRIDGE_DIR/server.py
Restart=always
RestartSec=10
Environment="PATH=$BRIDGE_DIR/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
echo "🔄 Reloading systemd daemon..."
sudo systemctl daemon-reload

# Enable service (start on boot)
echo "✅ Enabling service to start on boot..."
sudo systemctl enable prostat-bridge.service

# Start the service
echo "🚀 Starting service..."
sudo systemctl start prostat-bridge.service

# Check status
echo ""
echo "📊 Service status:"
sudo systemctl status prostat-bridge.service --no-pager -l || true

echo ""
echo "✅ Installation complete!"
echo ""
echo "📋 Useful commands:"
echo "   Status:  sudo systemctl status prostat-bridge"
echo "   Start:   sudo systemctl start prostat-bridge"
echo "   Stop:    sudo systemctl stop prostat-bridge"
echo "   Restart: sudo systemctl restart prostat-bridge"
echo "   Logs:    sudo journalctl -u prostat-bridge -f"
echo ""
echo "🌐 Bridge should be available at: http://localhost:8080"

