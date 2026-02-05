#!/bin/bash
# Setup passwordless sudo for bridge service restart
# Usage: ./setup-passwordless-sudo.sh [bridge-ip] [username] [password]

BRIDGE_IP="${1:-192.168.0.103}"
BRIDGE_USER="${2:-pi}"
PASSWORD="${3:-}"

echo "🔧 Setting up passwordless sudo for bridge service restart..."

if [ -z "$PASSWORD" ]; then
    echo "⚠️  Password not provided. You'll be prompted to enter it."
    echo ""
    echo "Run this command manually:"
    echo "  ssh $BRIDGE_USER@$BRIDGE_IP"
    echo ""
    echo "Then on the remote bridge, run:"
    echo "  echo 'tom-pc ALL=(ALL) NOPASSWD: /bin/systemctl restart prostat-bridge, /bin/systemctl start prostat-bridge, /bin/systemctl stop prostat-bridge, /bin/systemctl status prostat-bridge' | sudo tee /etc/sudoers.d/prostat-bridge"
    echo "  sudo chmod 0440 /etc/sudoers.d/prostat-bridge"
    exit 0
fi

# Check if sshpass is available
if ! command -v sshpass &> /dev/null; then
    echo "❌ sshpass not installed. Installing..."
    sudo apt-get update && sudo apt-get install -y sshpass
fi

# Set up passwordless sudo
sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no "$BRIDGE_USER@$BRIDGE_IP" << 'EOF'
    echo 'tom-pc ALL=(ALL) NOPASSWD: /bin/systemctl restart prostat-bridge, /bin/systemctl start prostat-bridge, /bin/systemctl stop prostat-bridge, /bin/systemctl status prostat-bridge' | sudo tee /etc/sudoers.d/prostat-bridge
    sudo chmod 0440 /etc/sudoers.d/prostat-bridge
    echo "✅ Passwordless sudo configured"
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Setup complete! Testing restart endpoint..."
    sleep 2
    curl -X POST "http://$BRIDGE_IP:8080/api/bridge/restart"
    echo ""
else
    echo "❌ Setup failed. Please run manually."
fi

