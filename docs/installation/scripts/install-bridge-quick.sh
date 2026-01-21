#!/bin/bash

# Joule Bridge Ultra-Quick Installer for Ubuntu 24.04.3 LTS
# One-line paste into terminal (no download needed):
# 
# bash -c "$(curl -fsSL https://your-repo-url/install-bridge-quick.sh)"
#
# Or download and run:
# wget https://your-repo-url/install-bridge-quick.sh && bash install-bridge-quick.sh

set -e

echo "🚀 Joule Bridge Quick Installer for Ubuntu 24.04.3 LTS"
echo ""

# Minimal setup
USERNAME=${SUDO_USER:-$(whoami)}
HOME_DIR=$(eval echo ~$USERNAME)

# Update & Install essentials
echo "📦 Installing dependencies..."
sudo apt-get update -qq && sudo apt-get upgrade -y -qq > /dev/null 2>&1

# Node.js
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
    sudo apt-get install -y nodejs > /dev/null 2>&1
fi

# Python
sudo apt-get install -y python3 python3-pip python3-venv git > /dev/null 2>&1

echo "✅ Dependencies installed"
echo ""

# Clone repo if not already present
WORK_DIR="$HOME_DIR/joule-hvac"
if [ ! -d "$WORK_DIR" ]; then
    echo "📥 Cloning Joule repository..."
    git clone https://github.com/your-org/joule-hvac.git "$WORK_DIR"
else
    echo "📂 Using existing: $WORK_DIR"
fi

cd "$WORK_DIR"

# Setup Bridge
echo "🔧 Setting up Bridge..."
BRIDGE_DIR="$HOME_DIR/joule-bridge"
[ -d "$BRIDGE_DIR" ] || mkdir -p "$BRIDGE_DIR"
cp -r pi-zero-bridge/* "$BRIDGE_DIR/" 2>/dev/null || true

cd "$BRIDGE_DIR"
npm install > /dev/null 2>&1
echo "✅ Bridge ready"

# Setup HMI
echo "🔧 Setting up HMI..."
HMI_DIR="$HOME_DIR/joule-hmi"
[ -d "$HMI_DIR" ] || mkdir -p "$HMI_DIR"
cp -r "$WORK_DIR/pi-hmi"/* "$HMI_DIR/" 2>/dev/null || true

python3 -m venv "$HMI_DIR/venv"
source "$HMI_DIR/venv/bin/activate"
pip install -q requests Pillow groq python-dotenv > /dev/null 2>&1
deactivate
echo "✅ HMI ready"

# Setup Services
echo "⚙️  Creating services..."

sudo tee /etc/systemd/system/joule-bridge.service > /dev/null << EOF
[Unit]
Description=Joule Bridge Server
After=network.target

[Service]
Type=simple
User=$USERNAME
WorkingDirectory=$BRIDGE_DIR
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable joule-bridge > /dev/null 2>&1
sudo systemctl start joule-bridge

sleep 2

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║     Installation Complete! 🎉              ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "✅ Bridge running on http://localhost:3002"
echo ""
echo "Next steps:"
echo "  1. Get API key: https://console.groq.com/"
echo "  2. Set key: export GROQ_API_KEY=your_key"
echo "  3. In React: Settings → Bridge & AI"
echo "  4. Enter: http://192.168.0.106:3002"
echo ""
echo "Test bridge:"
echo "  curl http://localhost:3002/health | jq"
echo ""
echo "View logs:"
echo "  sudo journalctl -u joule-bridge -f"
echo ""
