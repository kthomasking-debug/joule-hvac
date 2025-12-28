#!/bin/bash
# Update the remote bridge with latest code from GitHub
# Usage: ./update-remote-bridge.sh [bridge-ip] [username]

BRIDGE_IP="${1:-192.168.0.106}"
BRIDGE_USER="${2:-tom-pc}"

echo "🔄 Updating remote bridge at $BRIDGE_USER@$BRIDGE_IP..."

# Check if SSH key is set up
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "$BRIDGE_USER@$BRIDGE_IP" exit 2>/dev/null; then
    echo "❌ SSH key not set up. You need to:"
    echo ""
    echo "1. Copy your SSH public key to the remote bridge:"
    echo "   ssh-copy-id $BRIDGE_USER@$BRIDGE_IP"
    echo ""
    echo "2. Or manually add this key to ~/.ssh/authorized_keys on the remote bridge:"
    cat ~/.ssh/id_ed25519.pub
    echo ""
    exit 1
fi

echo "✅ SSH connection works"

# Update the code
echo "📥 Pulling latest code from GitHub..."
ssh "$BRIDGE_USER@$BRIDGE_IP" << 'EOF'
    cd ~/git/joule-hvac || { echo "Repository not found. Clone it first: git clone https://github.com/kthomasking-debug/joule-hvac.git ~/git/joule-hvac"; exit 1; }
    git pull origin main
EOF

if [ $? -eq 0 ]; then
    echo "✅ Code updated"
    
    # Restart the bridge service
    echo "🔄 Restarting bridge service..."
    ssh "$BRIDGE_USER@$BRIDGE_IP" "sudo systemctl restart prostat-bridge"
    
    if [ $? -eq 0 ]; then
        echo "✅ Bridge service restarted"
        echo ""
        echo "🎉 Remote bridge updated successfully!"
        echo "   Check status: ssh $BRIDGE_USER@$BRIDGE_IP 'sudo systemctl status prostat-bridge'"
    else
        echo "⚠️  Failed to restart service. You may need to restart manually."
    fi
else
    echo "❌ Failed to update code"
    exit 1
fi

