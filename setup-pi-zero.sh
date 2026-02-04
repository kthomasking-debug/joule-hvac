#!/bin/bash
# Setup script for Pi Zero 2W - Run this on the Pi itself via SSH
# Or run commands remotely using: ssh pi@joule-bridge.local

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "     Joule Bridge + E-Paper Display Setup"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Update system
echo "📦 Step 1: Updating system..."
sudo apt update
sudo apt upgrade -y

# Install base packages
echo "📦 Step 2: Installing base packages..."
sudo apt install -y python3 python3-pip python3-venv git curl

# Enable SPI and I2C (required for e-paper display)
echo "🔧 Step 3: Enabling SPI and I2C..."
sudo raspi-config nonint do_spi 0
sudo raspi-config nonint do_i2c 0

# Clone repository
echo "📥 Step 4: Cloning repository..."
cd ~
if [ ! -d joule-hvac ]; then
    git clone https://github.com/kthomasking-debug/joule-hvac.git
else
    echo "Repository exists, updating..."
    cd joule-hvac
    git pull
    cd ~
fi

# Set up bridge
echo "🌉 Step 5: Setting up bridge..."
cd ~/joule-hvac/prostat-bridge
chmod +x pre-configure-bridge.sh
./pre-configure-bridge.sh

# Set up e-paper display
echo "📺 Step 6: Setting up e-paper display..."
cd ~/joule-hvac/pi-hmi

# Install Python dependencies
echo "  Installing Python packages..."
sudo apt install -y python3-dev libjpeg-dev zlib1g-dev
pip3 install -r requirements.txt

# Clone Waveshare library
if [ ! -d ~/e-Paper ]; then
    echo "  Cloning Waveshare e-paper library..."
    cd ~
    git clone https://github.com/waveshare/e-Paper.git
fi

# Download fonts
echo "  Downloading fonts..."
mkdir -p ~/joule-hvac/fonts
cd ~/joule-hvac/fonts
wget -q https://github.com/google/fonts/raw/main/ofl/ibmplexmono/IBMPlexMono-Regular.ttf || echo "⚠️  Font download failed"
wget -q https://github.com/google/fonts/raw/main/ofl/ibmplexmono/IBMPlexMono-Bold.ttf || echo "⚠️  Font download failed"

# Install HMI service
echo "⚙️  Step 7: Installing HMI service..."
cd ~/joule-hvac/pi-hmi
sudo bash install_service.sh -b http://127.0.0.1:8080

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Setup Complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Reboot: sudo reboot"
echo "2. After reboot, check services:"
echo "   sudo systemctl status prostat-bridge.service"
echo "   sudo systemctl status pi-hmi.service"
echo "3. Test bridge: curl http://localhost:8080/health"
echo ""




