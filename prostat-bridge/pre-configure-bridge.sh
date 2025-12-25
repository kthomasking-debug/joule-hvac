#!/bin/bash
# Pre-Configuration Script for Joule Bridge
# Run this on a fresh Raspberry Pi to prepare it for shipping to end user
# Usage: ./pre-configure-bridge.sh [--static-ip IP_ADDRESS]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BRIDGE_DIR="$HOME/prostat-bridge"
STATIC_IP=""
SET_STATIC_IP=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --static-ip)
            STATIC_IP="$2"
            SET_STATIC_IP=true
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--static-ip IP_ADDRESS]"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}     Joule Bridge Pre-Configuration Script${NC}"
echo -e "${BLUE}     Preparing mini computer for end user${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}❌ Don't run as root. Run as regular user (will use sudo when needed).${NC}"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo -e "${YELLOW}📋 Step 1: System Information${NC}"
echo "Hostname: $(hostname)"
echo "User: $USER"
echo "Home: $HOME"
echo "Script directory: $SCRIPT_DIR"
echo ""

# Step 2: Update System
echo -e "${YELLOW}📦 Step 2: Updating System${NC}"
echo "This may take a few minutes..."
sudo apt update
sudo apt upgrade -y
echo -e "${GREEN}✅ System updated${NC}"
echo ""

# Step 3: Install Required Packages
echo -e "${YELLOW}📦 Step 3: Installing Required Packages${NC}"
sudo apt install -y python3 python3-pip python3-venv git curl
echo -e "${GREEN}✅ Packages installed${NC}"
echo ""

# Step 4: Check Python Version
echo -e "${YELLOW}🐍 Step 4: Checking Python Version${NC}"
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo "Python version: $PYTHON_VERSION"
if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)"; then
    echo -e "${RED}❌ Python 3.8+ required. Current: $PYTHON_VERSION${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Python version OK${NC}"
echo ""

# Step 5: Copy Bridge Files
echo -e "${YELLOW}📁 Step 5: Setting Up Bridge Files${NC}"
if [ -d "$BRIDGE_DIR" ]; then
    echo "Bridge directory exists. Updating files..."
    cp -r "$SCRIPT_DIR"/* "$BRIDGE_DIR/" 2>/dev/null || true
else
    echo "Creating bridge directory..."
    mkdir -p "$BRIDGE_DIR"
    cp -r "$SCRIPT_DIR"/* "$BRIDGE_DIR/"
fi
cd "$BRIDGE_DIR"
echo -e "${GREEN}✅ Bridge files ready${NC}"
echo ""

# Step 6: Create Virtual Environment
echo -e "${YELLOW}🔧 Step 6: Creating Python Virtual Environment${NC}"
if [ -d "venv" ]; then
    echo "Virtual environment exists. Recreating..."
    rm -rf venv
fi
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
echo -e "${GREEN}✅ Virtual environment created${NC}"
echo ""

# Step 7: Install Python Dependencies
echo -e "${YELLOW}📚 Step 7: Installing Python Dependencies${NC}"
if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}❌ requirements.txt not found${NC}"
    exit 1
fi
pip install -r requirements.txt
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 8: Test Bridge Server
echo -e "${YELLOW}🧪 Step 8: Testing Bridge Server${NC}"
echo "Starting bridge server for 5 seconds to test..."
timeout 5 python3 server.py || true
echo -e "${GREEN}✅ Bridge server test passed${NC}"
echo ""

# Step 9: Install Systemd Service
echo -e "${YELLOW}⚙️  Step 9: Installing Systemd Service${NC}"
if [ -f "install-service.sh" ]; then
    chmod +x install-service.sh
    ./install-service.sh
else
    echo -e "${YELLOW}⚠️  install-service.sh not found. Installing service manually...${NC}"
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
    sudo systemctl daemon-reload
    sudo systemctl enable prostat-bridge.service
    sudo systemctl start prostat-bridge.service
fi
echo -e "${GREEN}✅ Service installed and started${NC}"
echo ""

# Step 10: Configure Static IP (Optional)
if [ "$SET_STATIC_IP" = true ] && [ -n "$STATIC_IP" ]; then
    echo -e "${YELLOW}🌐 Step 10: Configuring Static IP${NC}"
    echo "Setting static IP to: $STATIC_IP"
    
    # Detect network interface
    INTERFACE=$(ip route | grep default | awk '{print $5}' | head -1)
    if [ -z "$INTERFACE" ]; then
        echo -e "${YELLOW}⚠️  Could not detect network interface. Skipping static IP.${NC}"
    else
        echo "Detected interface: $INTERFACE"
        
        # Get current gateway
        GATEWAY=$(ip route | grep default | awk '{print $3}' | head -1)
        echo "Gateway: $GATEWAY"
        
        # Check if using NetworkManager (newer Raspberry Pi OS)
        if command -v nmcli &> /dev/null; then
            echo "Using NetworkManager..."
            CONNECTION=$(nmcli -t -f NAME connection show --active | head -1)
            sudo nmcli connection modify "$CONNECTION" ipv4.method manual ipv4.addresses "$STATIC_IP/24" ipv4.gateway "$GATEWAY" ipv4.dns "$GATEWAY 8.8.8.8"
            sudo nmcli connection down "$CONNECTION"
            sudo nmcli connection up "$CONNECTION"
        else
            # Use dhcpcd.conf (older Raspberry Pi OS)
            echo "Using dhcpcd.conf..."
            if ! grep -q "interface $INTERFACE" /etc/dhcpcd.conf 2>/dev/null; then
                sudo tee -a /etc/dhcpcd.conf > /dev/null <<EOF

# Static IP for Joule Bridge
interface $INTERFACE
static ip_address=$STATIC_IP/24
static routers=$GATEWAY
static domain_name_servers=$GATEWAY 8.8.8.8
EOF
                echo "Static IP configured. Reboot required."
                echo -e "${YELLOW}⚠️  Please reboot after script completes: sudo reboot${NC}"
            else
                echo -e "${YELLOW}⚠️  Static IP already configured in dhcpcd.conf${NC}"
            fi
        fi
        echo -e "${GREEN}✅ Static IP configured${NC}"
    fi
    echo ""
fi

# Step 11: Get Network Information
echo -e "${YELLOW}📡 Step 11: Gathering Network Information${NC}"
CURRENT_IP=$(hostname -I | awk '{print $1}')
MAC_ADDRESS=$(ip link show | grep -A 1 "$(ip route | grep default | awk '{print $5}')" | grep "link/ether" | awk '{print $2}')
GATEWAY=$(ip route | grep default | awk '{print $3}' | head -1)
HOSTNAME=$(hostname)

echo "Current IP: $CURRENT_IP"
echo "MAC Address: $MAC_ADDRESS"
echo "Gateway: $GATEWAY"
echo "Hostname: $HOSTNAME"
echo ""

# Step 12: Verify Service is Running
echo -e "${YELLOW}✅ Step 12: Verifying Service${NC}"
sleep 2
if sudo systemctl is-active --quiet prostat-bridge; then
    echo -e "${GREEN}✅ Bridge service is running${NC}"
else
    echo -e "${RED}❌ Bridge service is not running${NC}"
    echo "Checking logs..."
    sudo journalctl -u prostat-bridge -n 20 --no-pager
    exit 1
fi

# Test health endpoint
sleep 2
if curl -s http://localhost:8080/health > /dev/null; then
    echo -e "${GREEN}✅ Bridge health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  Health check failed (may need more time to start)${NC}"
fi
echo ""

# Step 13: Create Sticker Information File
echo -e "${YELLOW}🏷️  Step 13: Creating Sticker Information${NC}"
STICKER_FILE="$BRIDGE_DIR/STICKER-INFO.txt"
cat > "$STICKER_FILE" <<EOF
═══════════════════════════════════════════════════════════════
                    JOULE BRIDGE
═══════════════════════════════════════════════════════════════

MAC Address: $MAC_ADDRESS
Hostname: $HOSTNAME
Current IP: $CURRENT_IP
${STATIC_IP:+Static IP: $STATIC_IP}

═══════════════════════════════════════════════════════════════

SETUP INSTRUCTIONS:
1. Plug Ethernet cable into router
2. Plug in power adapter
3. Wait 2 minutes
4. Find IP address in router admin page (use MAC address above)
5. Enter IP in web app: http://IP:8080

═══════════════════════════════════════════════════════════════
EOF

echo "Sticker information saved to: $STICKER_FILE"
echo ""
cat "$STICKER_FILE"
echo ""

# Step 14: Create Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Pre-Configuration Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "📋 Summary:"
echo "  • System updated"
echo "  • Python environment ready"
echo "  • Bridge software installed"
echo "  • Service configured (auto-starts on boot)"
if [ "$SET_STATIC_IP" = true ]; then
    echo "  • Static IP: $STATIC_IP"
fi
echo ""
echo "📡 Network Information:"
echo "  • MAC Address: $MAC_ADDRESS"
echo "  • Current IP: $CURRENT_IP"
if [ "$SET_STATIC_IP" = true ]; then
    echo "  • Static IP: $STATIC_IP"
    echo -e "${YELLOW}  ⚠️  Reboot required for static IP to take effect${NC}"
fi
echo ""
echo "📦 Package Contents Checklist:"
echo "  [ ] Mini computer (this device)"
echo "  [ ] Power adapter"
echo "  [ ] Ethernet cable (6 feet recommended)"
echo "  [ ] Simple instruction sheet"
echo "  [ ] Sticker with MAC address (see STICKER-INFO.txt)"
echo ""
echo "🏷️  Print the sticker from: $STICKER_FILE"
echo ""
echo "🧪 Final Test:"
echo "  curl http://localhost:8080/health"
echo ""
if [ "$SET_STATIC_IP" = true ]; then
    echo -e "${YELLOW}⚠️  IMPORTANT: Reboot to apply static IP:${NC}"
    echo "  sudo reboot"
    echo ""
fi
echo -e "${GREEN}Ready to ship! 🚀${NC}"

