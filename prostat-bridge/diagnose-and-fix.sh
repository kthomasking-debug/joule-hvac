#!/bin/bash
# Diagnostic and fix script for Joule Bridge service
# This script diagnoses common issues and attempts to fix them

set -e

echo "🔍 Joule Bridge Diagnostic & Fix Script"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current user
CURRENT_USER=$(whoami)
USER_HOME=$(eval echo ~$CURRENT_USER)

# Common bridge directory locations
POSSIBLE_DIRS=(
    "$USER_HOME/prostat-bridge"
    "/home/$CURRENT_USER/prostat-bridge"
    "$(pwd)"
    "$(dirname "$0")"
)

BRIDGE_DIR=""
for dir in "${POSSIBLE_DIRS[@]}"; do
    if [ -d "$dir" ] && [ -f "$dir/server.py" ]; then
        BRIDGE_DIR="$dir"
        echo -e "${GREEN}✅ Found bridge directory: $BRIDGE_DIR${NC}"
        break
    fi
done

if [ -z "$BRIDGE_DIR" ]; then
    echo -e "${RED}❌ ERROR: Could not find bridge directory with server.py${NC}"
    echo "   Searched in:"
    for dir in "${POSSIBLE_DIRS[@]}"; do
        echo "     - $dir"
    done
    exit 1
fi

cd "$BRIDGE_DIR"
echo ""

# Step 1: Check if service file exists
echo "📋 Step 1: Checking systemd service..."
SERVICE_FILE="/etc/systemd/system/prostat-bridge.service"
if [ -f "$SERVICE_FILE" ]; then
    echo -e "${GREEN}✅ Service file exists${NC}"
    echo "   Location: $SERVICE_FILE"
else
    echo -e "${YELLOW}⚠️  Service file not found${NC}"
    echo "   Will install service..."
    INSTALL_NEEDED=true
fi
echo ""

# Step 2: Check service status
echo "📋 Step 2: Checking service status..."
if systemctl is-active --quiet prostat-bridge 2>/dev/null; then
    echo -e "${GREEN}✅ Service is RUNNING${NC}"
    SERVICE_RUNNING=true
elif systemctl is-failed --quiet prostat-bridge 2>/dev/null; then
    echo -e "${RED}❌ Service is FAILED${NC}"
    SERVICE_FAILED=true
elif systemctl list-unit-files | grep -q "prostat-bridge.service"; then
    echo -e "${YELLOW}⚠️  Service exists but is NOT RUNNING${NC}"
    SERVICE_EXISTS=true
else
    echo -e "${RED}❌ Service is NOT INSTALLED${NC}"
    INSTALL_NEEDED=true
fi

# Check if enabled
if systemctl is-enabled --quiet prostat-bridge 2>/dev/null; then
    echo -e "${GREEN}✅ Service is ENABLED (will start on boot)${NC}"
else
    echo -e "${YELLOW}⚠️  Service is NOT ENABLED (won't start on boot)${NC}"
    ENABLE_NEEDED=true
fi
echo ""

# Step 3: Check Python virtual environment
echo "📋 Step 3: Checking Python virtual environment..."
if [ -d "$BRIDGE_DIR/venv" ]; then
    echo -e "${GREEN}✅ Virtual environment exists${NC}"
    if [ -f "$BRIDGE_DIR/venv/bin/python3" ]; then
        PYTHON_PATH="$BRIDGE_DIR/venv/bin/python3"
        PYTHON_VERSION=$($PYTHON_PATH --version 2>&1 || echo "unknown")
        echo "   Python: $PYTHON_VERSION"
        echo "   Path: $PYTHON_PATH"
    else
        echo -e "${RED}❌ Python3 not found in venv${NC}"
        RECREATE_VENV=true
    fi
else
    echo -e "${RED}❌ Virtual environment not found${NC}"
    RECREATE_VENV=true
fi
echo ""

# Step 4: Check if server.py exists and is executable
echo "📋 Step 4: Checking server.py..."
if [ -f "$BRIDGE_DIR/server.py" ]; then
    echo -e "${GREEN}✅ server.py exists${NC}"
    if [ -x "$BRIDGE_DIR/server.py" ]; then
        echo -e "${GREEN}✅ server.py is executable${NC}"
    else
        echo -e "${YELLOW}⚠️  Making server.py executable...${NC}"
        chmod +x "$BRIDGE_DIR/server.py"
    fi
else
    echo -e "${RED}❌ ERROR: server.py not found in $BRIDGE_DIR${NC}"
    exit 1
fi
echo ""

# Step 5: Check Python dependencies
echo "📋 Step 5: Checking Python dependencies..."
if [ -f "$BRIDGE_DIR/requirements.txt" ]; then
    echo "   Checking if dependencies are installed..."
    if [ -n "$PYTHON_PATH" ]; then
        MISSING_DEPS=$($PYTHON_PATH -c "
import sys
missing = []
try:
    import aiohomekit
except ImportError:
    missing.append('aiohomekit')
try:
    import aiohttp
except ImportError:
    missing.append('aiohttp')
try:
    import serial
except ImportError:
    missing.append('pyserial')
if missing:
    print(','.join(missing))
" 2>/dev/null || echo "")
        
        if [ -n "$MISSING_DEPS" ]; then
            echo -e "${YELLOW}⚠️  Missing dependencies: $MISSING_DEPS${NC}"
            INSTALL_DEPS=true
        else
            echo -e "${GREEN}✅ All required dependencies installed${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  requirements.txt not found${NC}"
fi
echo ""

# Step 6: Check if port 8080 is in use
echo "📋 Step 6: Checking if port 8080 is available..."
if command -v netstat >/dev/null 2>&1; then
    PORT_IN_USE=$(netstat -tuln 2>/dev/null | grep -c ":8080 " || echo "0")
elif command -v ss >/dev/null 2>&1; then
    PORT_IN_USE=$(ss -tuln 2>/dev/null | grep -c ":8080 " || echo "0")
else
    PORT_IN_USE="unknown"
fi

if [ "$PORT_IN_USE" != "0" ] && [ "$PORT_IN_USE" != "unknown" ]; then
    echo -e "${YELLOW}⚠️  Port 8080 is in use${NC}"
    echo "   This might be the bridge running, or another service"
    if [ -z "$SERVICE_RUNNING" ]; then
        echo "   Checking what's using it..."
        if command -v lsof >/dev/null 2>&1; then
            lsof -i :8080 2>/dev/null || echo "   (lsof not available)"
        fi
    fi
else
    echo -e "${GREEN}✅ Port 8080 is available${NC}"
fi
echo ""

# Step 7: Check service logs if service exists
if [ -n "$SERVICE_EXISTS" ] || [ -n "$SERVICE_FAILED" ] || [ -n "$SERVICE_RUNNING" ]; then
    echo "📋 Step 7: Recent service logs (last 20 lines)..."
    echo "----------------------------------------"
    journalctl -u prostat-bridge -n 20 --no-pager 2>/dev/null || echo "   (Could not read logs)"
    echo "----------------------------------------"
    echo ""
fi

# FIXES
echo "🔧 Applying Fixes..."
echo "===================="
echo ""

# Fix 1: Recreate virtual environment if needed
if [ -n "$RECREATE_VENV" ]; then
    echo "🔧 Fix 1: Creating virtual environment..."
    if [ -d "$BRIDGE_DIR/venv" ]; then
        echo "   Removing old venv..."
        rm -rf "$BRIDGE_DIR/venv"
    fi
    python3 -m venv "$BRIDGE_DIR/venv"
    echo -e "${GREEN}✅ Virtual environment created${NC}"
    INSTALL_DEPS=true
    PYTHON_PATH="$BRIDGE_DIR/venv/bin/python3"
    echo ""
fi

# Fix 2: Install dependencies if needed
if [ -n "$INSTALL_DEPS" ] && [ -n "$PYTHON_PATH" ]; then
    echo "🔧 Fix 2: Installing Python dependencies..."
    if [ -f "$BRIDGE_DIR/requirements.txt" ]; then
        "$PYTHON_PATH" -m pip install --upgrade pip >/dev/null 2>&1 || true
        "$PYTHON_PATH" -m pip install -r "$BRIDGE_DIR/requirements.txt"
        echo -e "${GREEN}✅ Dependencies installed${NC}"
    else
        echo -e "${YELLOW}⚠️  requirements.txt not found, installing common dependencies...${NC}"
        "$PYTHON_PATH" -m pip install --upgrade pip >/dev/null 2>&1 || true
        "$PYTHON_PATH" -m pip install aiohomekit aiohttp pyserial aiohttp-cors zeroconf
        echo -e "${GREEN}✅ Common dependencies installed${NC}"
    fi
    echo ""
fi

# Fix 3: Install/update service
if [ -n "$INSTALL_NEEDED" ] || [ -n "$SERVICE_FAILED" ]; then
    echo "🔧 Fix 3: Installing/updating systemd service..."
    
    # Create service file
    sudo tee /etc/systemd/system/prostat-bridge.service > /dev/null <<EOF
[Unit]
Description=Joule Bridge HomeKit Controller
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$BRIDGE_DIR
ExecStart=$PYTHON_PATH $BRIDGE_DIR/server.py
Restart=always
RestartSec=10
Environment="PATH=$BRIDGE_DIR/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    echo -e "${GREEN}✅ Service installed/updated${NC}"
    ENABLE_NEEDED=true
    echo ""
fi

# Fix 4: Enable service if needed
if [ -n "$ENABLE_NEEDED" ]; then
    echo "🔧 Fix 4: Enabling service (auto-start on boot)..."
    sudo systemctl enable prostat-bridge.service
    echo -e "${GREEN}✅ Service enabled${NC}"
    echo ""
fi

# Fix 5: Start service
echo "🔧 Fix 5: Starting service..."
if [ -n "$SERVICE_RUNNING" ]; then
    echo "   Service is already running, restarting to apply changes..."
    sudo systemctl restart prostat-bridge.service
else
    sudo systemctl start prostat-bridge.service
fi

# Wait a moment for service to start
sleep 2

# Check final status
echo ""
echo "📊 Final Status Check"
echo "====================="
if systemctl is-active --quiet prostat-bridge; then
    echo -e "${GREEN}✅ Service is RUNNING${NC}"
    echo ""
    echo "🌐 Bridge should be available at:"
    echo "   - http://localhost:8080"
    echo "   - http://$(hostname -I | awk '{print $1}'):8080"
    echo "   - http://joule-bridge.local:8080 (if mDNS is working)"
    echo ""
    echo "📋 Service status:"
    sudo systemctl status prostat-bridge --no-pager -l | head -20
else
    echo -e "${RED}❌ Service FAILED to start${NC}"
    echo ""
    echo "📋 Error details:"
    sudo systemctl status prostat-bridge --no-pager -l | head -30
    echo ""
    echo "📋 Recent logs:"
    journalctl -u prostat-bridge -n 30 --no-pager
    echo ""
    echo "💡 Common issues:"
    echo "   1. Check if Python dependencies are installed correctly"
    echo "   2. Check if port 8080 is already in use"
    echo "   3. Check file permissions on $BRIDGE_DIR"
    echo "   4. Try running manually: cd $BRIDGE_DIR && $PYTHON_PATH server.py"
    exit 1
fi





