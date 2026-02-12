#!/bin/bash
# Raspberry Pi 5 Setup Script for Joule Local RAG
# Installs Ollama, Llama 3.2 3B, and sets up the local API bridge

set -e

echo "🚀 Setting up Raspberry Pi 5 for Joule Local RAG..."
echo ""

# Check if running on Raspberry Pi
if [ ! -f /proc/device-tree/model ] || ! grep -q "Raspberry Pi" /proc/device-tree/model; then
    echo "⚠️  Warning: This script is designed for Raspberry Pi. Continuing anyway..."
fi

# Update system
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install dependencies
echo "📦 Installing dependencies..."
sudo apt-get install -y \
    curl \
    git \
    python3 \
    python3-pip \
    nodejs \
    npm \
    build-essential

# Install Ollama
echo "📦 Installing Ollama..."
if ! command -v ollama &> /dev/null; then
    curl -fsSL https://ollama.com/install.sh | sh
    echo "✅ Ollama installed"
else
    echo "✅ Ollama already installed"
fi

# Configure Ollama to keep models loaded 24h and listen on all interfaces (for Pi HMI/onboarding)
echo "⚙️  Configuring Ollama (OLLAMA_KEEP_ALIVE=24h, OLLAMA_HOST for network access)..."
sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment="OLLAMA_KEEP_ALIVE=24h"\nEnvironment="OLLAMA_HOST=0.0.0.0"\nEnvironment="OLLAMA_ORIGINS=*"\n' | sudo tee /etc/systemd/system/ollama.service.d/override.conf > /dev/null
sudo systemctl daemon-reload
sudo systemctl restart ollama
echo "✅ Ollama configured and restarted"

# Pull Llama 3.2 3B model
echo "📥 Downloading Llama 3.2 3B model (this may take a few minutes)..."
ollama pull llama3.2:3b
echo "✅ Model downloaded"

# Test Ollama
echo "🧪 Testing Ollama..."
TEST_RESPONSE=$(ollama run llama3.2:3b "Say hello in one word" 2>&1)
if echo "$TEST_RESPONSE" | grep -q "hello\|Hello\|hi\|Hi"; then
    echo "✅ Ollama is working correctly"
else
    echo "⚠️  Ollama test response: $TEST_RESPONSE"
fi

# Create directory for Joule bridge
echo "📁 Setting up Joule bridge directory..."
mkdir -p ~/joule-bridge
cd ~/joule-bridge

# Install Node.js dependencies for bridge
if [ -f "package.json" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

# Create systemd service file
echo "⚙️  Creating systemd service..."
sudo tee /etc/systemd/system/joule-bridge.service > /dev/null <<EOF
[Unit]
Description=Joule Local RAG Bridge
After=network.target ollama.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/joule-bridge
Environment=NODE_ENV=production
Environment=PORT=3002
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
echo "🚀 Enabling Joule bridge service..."
sudo systemctl daemon-reload
sudo systemctl enable joule-bridge.service

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy the joule-bridge server files to ~/joule-bridge/"
echo "2. Run: sudo systemctl start joule-bridge"
echo "3. Check status: sudo systemctl status joule-bridge"
echo "4. View logs: sudo journalctl -u joule-bridge -f"
echo ""
echo "🌐 The bridge will be available at: http://$(hostname -I | awk '{print $1}'):3002"
echo ""





