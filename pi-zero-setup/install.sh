#!/bin/bash
# Raspberry Pi Zero 2 W Setup Script for Joule Groq-Powered RAG
# Lightweight setup: local embeddings + Groq API inference

set -e

echo "🚀 Setting up Raspberry Pi Zero 2 W for Joule Groq-Powered RAG..."
echo ""

# Check if running on Raspberry Pi Zero
if [ ! -f /proc/device-tree/model ] || ! grep -q "Raspberry Pi" /proc/device-tree/model; then
    echo "⚠️  Warning: This script is designed for Raspberry Pi Zero 2 W. Continuing anyway..."
fi

# Check RAM (Pi Zero 2 W has 512MB)
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_RAM" -lt 400 ]; then
    echo "⚠️  Warning: Low RAM detected (${TOTAL_RAM}MB). This setup is optimized for 512MB."
fi

# Update system
echo "📦 Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install minimal dependencies
echo "📦 Installing dependencies..."
sudo apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    git \
    curl

# Create virtual environment
echo "📦 Setting up Python virtual environment..."
python3 -m venv ~/joule-rag-env
source ~/joule-rag-env/bin/activate

# Install lightweight RAG stack
echo "📦 Installing lightweight RAG stack..."
pip install --upgrade pip
pip install \
    langchain \
    langchain-community \
    langchain-groq \
    chromadb \
    sentence-transformers \
    pypdf \
    python-docx

echo "✅ Python packages installed"

# Create directory structure
echo "📁 Setting up directory structure..."
mkdir -p ~/joule-bridge
mkdir -p ~/joule-bridge/docs
mkdir -p ~/joule-bridge/rag_db

# Install Node.js for bridge server (lightweight)
echo "📦 Installing Node.js (lightweight)..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✅ Node.js installed: $(node --version)"

# Create systemd service file
echo "⚙️  Creating systemd service..."
sudo tee /etc/systemd/system/joule-bridge.service > /dev/null <<EOF
[Unit]
Description=Joule Groq-Powered RAG Bridge
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/joule-bridge
Environment=NODE_ENV=production
Environment=PORT=3002
Environment="PATH=$HOME/joule-rag-env/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable service
echo "🚀 Enabling Joule bridge service..."
sudo systemctl daemon-reload
sudo systemctl enable joule-bridge.service

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Get Groq API key from https://console.groq.com/"
echo "2. Set environment variable: export GROQ_API_KEY=your_key_here"
echo "3. Add to ~/.bashrc for persistence"
echo "4. Copy bridge server files to ~/joule-bridge/"
echo "5. Run: sudo systemctl start joule-bridge"
echo "6. Check status: sudo systemctl status joule-bridge"
echo ""
echo "🌐 The bridge will be available at: http://$(hostname -I | awk '{print $1}'):3002"
echo "💡 Power consumption: ~1-2W (perfect for always-on operation)"
echo ""





