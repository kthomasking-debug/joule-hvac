#!/bin/bash

# Joule Bridge + HMI Installation Script for Ubuntu 24.04.3 LTS
# Run this script on your Ubuntu desktop: bash install-bridge-ubuntu.sh

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        Joule Bridge + HMI Installation (Ubuntu 24.04)       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if running on Ubuntu 24.04
if ! grep -q "24.04" /etc/os-release; then
    echo "⚠️  Warning: This script is tested on Ubuntu 24.04.3 LTS"
    echo "Your version may differ. Proceeding anyway..."
fi

# Detect username
USERNAME=${SUDO_USER:-$(whoami)}
HOME_DIR=$(eval echo ~$USERNAME)

echo "📋 System Info:"
echo "  Username: $USERNAME"
echo "  Home: $HOME_DIR"
echo "  OS: $(lsb_release -ds)"
echo ""

# ============================================================================
# STEP 1: Update System
# ============================================================================

echo "🔄 Step 1: Updating system packages..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq > /dev/null 2>&1
echo "✅ System updated"
echo ""

# ============================================================================
# STEP 2: Install Node.js (for Bridge Server)
# ============================================================================

echo "🔄 Step 2: Installing Node.js v20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
    sudo apt-get install -y nodejs > /dev/null 2>&1
    echo "✅ Node.js installed: $(node --version)"
else
    echo "✅ Node.js already installed: $(node --version)"
fi
echo ""

# ============================================================================
# STEP 3: Install Python 3.11+ (for HMI)
# ============================================================================

echo "🔄 Step 3: Installing Python 3.11+..."
if ! command -v python3 &> /dev/null; then
    sudo apt-get install -y python3 python3-pip python3-venv > /dev/null 2>&1
    echo "✅ Python installed: $(python3 --version)"
else
    echo "✅ Python already installed: $(python3 --version)"
fi
echo ""

# ============================================================================
# STEP 4: Clone/Setup Bridge Server
# ============================================================================

echo "🔄 Step 4: Setting up Bridge Server..."
BRIDGE_DIR="$HOME_DIR/joule-bridge"

if [ ! -d "$BRIDGE_DIR" ]; then
    echo "  Cloning bridge repository..."
    # Check if we're in the joule-hvac repo and can copy from there
    if [ -d "/home/thomas/git/joule-hvac/pi-zero-bridge" ]; then
        cp -r /home/thomas/git/joule-hvac/pi-zero-bridge "$BRIDGE_DIR"
        echo "  Copied from local repo"
    else
        echo "  Creating bridge directory..."
        mkdir -p "$BRIDGE_DIR"
    fi
fi

cd "$BRIDGE_DIR"

# Check if package.json exists
if [ ! -f "$BRIDGE_DIR/package.json" ]; then
    # Copy from repo if available
    if [ -f "/home/thomas/git/joule-hvac/pi-zero-bridge/package.json" ]; then
        cp -r /home/thomas/git/joule-hvac/pi-zero-bridge/* "$BRIDGE_DIR/"
    else
        # Create minimal package.json
        cat > package.json << 'EOF'
{
  "name": "joule-bridge",
  "version": "1.0.0",
  "description": "Joule HVAC Bridge Server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "body-parser": "^1.20.2",
    "cors": "^2.8.5",
    "groq-sdk": "^0.4.0"
  }
}
EOF
        echo "  Created package.json"
    fi
fi

# Install Node dependencies
if [ -f "package.json" ]; then
    npm install > /dev/null 2>&1
    echo "✅ Bridge dependencies installed"
else
    echo "⚠️  No package.json found, skipping npm install"
fi

cd - > /dev/null

echo ""

# ============================================================================
# STEP 5: Setup HMI (Python)
# ============================================================================

echo "🔄 Step 5: Setting up HMI..."
HMI_DIR="$HOME_DIR/joule-hmi"

if [ ! -d "$HMI_DIR" ]; then
    mkdir -p "$HMI_DIR"
fi

# Copy HMI files if available
if [ -d "/home/thomas/git/joule-hvac/pi-hmi" ]; then
    cp -r /home/thomas/git/joule-hvac/pi-hmi/* "$HMI_DIR/" 2>/dev/null || true
fi

# Create Python virtual environment
if [ ! -d "$HMI_DIR/venv" ]; then
    python3 -m venv "$HMI_DIR/venv"
    echo "  Created Python virtual environment"
fi

# Activate and install requirements
source "$HMI_DIR/venv/bin/activate"

# Create requirements.txt if needed
if [ ! -f "$HMI_DIR/requirements.txt" ]; then
    cat > "$HMI_DIR/requirements.txt" << 'EOF'
requests==2.31.0
Pillow==10.1.0
groq==0.4.2
python-dotenv==1.0.0
EOF
fi

pip install -q -r "$HMI_DIR/requirements.txt" > /dev/null 2>&1
echo "✅ HMI Python dependencies installed"

deactivate

echo ""

# ============================================================================
# STEP 6: Create systemd Services
# ============================================================================

echo "🔄 Step 6: Creating systemd services..."

# Bridge Service
sudo tee /etc/systemd/system/joule-bridge.service > /dev/null << EOF
[Unit]
Description=Joule Bridge Server
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
User=$USERNAME
WorkingDirectory=$BRIDGE_DIR
Environment="NODE_ENV=production"
Environment="BRIDGE_URL=http://localhost:3002"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# HMI Service (if app.py exists)
if [ -f "$HMI_DIR/app.py" ]; then
    sudo tee /etc/systemd/system/joule-hmi.service > /dev/null << EOF
[Unit]
Description=Joule HMI Display
After=network.target joule-bridge.service
StartLimitIntervalSec=0

[Service]
Type=simple
User=$USERNAME
WorkingDirectory=$HMI_DIR
Environment="HMI_API_BASE=http://127.0.0.1:3002"
Environment="HMI_POLL_SECS=15"
ExecStart=$HMI_DIR/venv/bin/python $HMI_DIR/app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    echo "✅ Created joule-bridge.service and joule-hmi.service"
else
    echo "✅ Created joule-bridge.service (HMI skipped - app.py not found)"
fi

# Reload systemd
sudo systemctl daemon-reload
echo ""

# ============================================================================
# STEP 7: Configuration
# ============================================================================

echo "🔄 Step 7: Configuration..."

# Create settings directory
mkdir -p "$BRIDGE_DIR/settings"

# Create joule-settings.json if it doesn't exist
if [ ! -f "$BRIDGE_DIR/settings/joule-settings.json" ]; then
    cat > "$BRIDGE_DIR/settings/joule-settings.json" << 'EOF'
{
  "location": {
    "city": "Atlanta",
    "state": "Georgia",
    "latitude": 33.7490,
    "longitude": -84.3880,
    "elevation": 340
  },
  "hvac": {
    "mode": "heat",
    "targetTemp": 72,
    "temperature": 68,
    "humidity": 45,
    "connected": false
  },
  "settings": {
    "heatLossRate": 150,
    "coolGainRate": 120,
    "systemType": "heat_pump",
    "utilityRate": 0.12
  },
  "lastSetpointChange": "2024-01-20T00:00:00Z",
  "lastModeChange": "2024-01-20T00:00:00Z"
}
EOF
    echo "✅ Created joule-settings.json"
fi

# Setup Groq API key if provided
if [ -z "$GROQ_API_KEY" ]; then
    echo ""
    echo "⚠️  No GROQ_API_KEY set."
    echo "   To enable AI features, set:"
    echo "   export GROQ_API_KEY=your_api_key_here"
    echo "   Get a free key at: https://console.groq.com/"
fi

echo ""

# ============================================================================
# STEP 8: Start Services
# ============================================================================

echo "🔄 Step 8: Starting services..."

sudo systemctl enable joule-bridge > /dev/null 2>&1
sudo systemctl start joule-bridge

# Wait for bridge to start
sleep 2

if sudo systemctl is-active --quiet joule-bridge; then
    echo "✅ Bridge service started (port 3002)"
else
    echo "⚠️  Bridge service failed to start. Check logs:"
    echo "   sudo journalctl -u joule-bridge -n 20"
fi

if systemctl list-unit-files | grep -q joule-hmi; then
    sudo systemctl enable joule-hmi > /dev/null 2>&1
    sudo systemctl start joule-hmi 2>/dev/null
    if sudo systemctl is-active --quiet joule-hmi; then
        echo "✅ HMI service started"
    fi
fi

echo ""

# ============================================================================
# STEP 9: Verification
# ============================================================================

echo "🔄 Step 9: Verification..."
sleep 2

# Test bridge health
if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    echo "✅ Bridge is responding on http://localhost:3002"
    HEALTH=$(curl -s http://localhost:3002/health)
    echo "   Response: $HEALTH"
else
    echo "⚠️  Bridge not responding. Check with:"
    echo "   curl http://localhost:3002/health"
fi

echo ""

# ============================================================================
# STEP 10: Summary
# ============================================================================

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              Installation Complete! 🎉                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 Locations:"
echo "   Bridge: $BRIDGE_DIR"
echo "   HMI:    $HMI_DIR"
echo ""
echo "🚀 Quick Start Commands:"
echo "   Check bridge status:"
echo "   sudo systemctl status joule-bridge"
echo ""
echo "   View bridge logs:"
echo "   sudo journalctl -u joule-bridge -f"
echo ""
echo "   Test bridge API:"
echo "   curl http://localhost:3002/health | jq"
echo "   curl http://localhost:3002/api/status | jq"
echo ""
echo "🔧 Configuration:"
echo "   Bridge settings: $BRIDGE_DIR/settings/joule-settings.json"
echo "   Groq API key:    export GROQ_API_KEY=your_key_here"
echo ""
echo "🌐 Network:"
echo "   Bridge URL for React app:"
echo "   http://192.168.0.106:3002"
echo ""
echo "⚙️  Service Management:"
echo "   Restart bridge:  sudo systemctl restart joule-bridge"
echo "   Restart HMI:     sudo systemctl restart joule-hmi"
echo "   Stop services:   sudo systemctl stop joule-bridge joule-hmi"
echo ""
echo "📚 Next Steps:"
echo "   1. Set your GROQ_API_KEY for AI features"
echo "   2. Update joule-settings.json with your location"
echo "   3. Connect from React app at http://localhost:3002"
echo "   4. Check logs if services don't start"
echo ""
