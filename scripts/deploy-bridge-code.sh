#!/bin/bash
# deploy-bridge-code.sh
# Deploy updated server.py to remote bridge

BRIDGE_HOST="tom-pc@192.168.0.106"
BRIDGE_PASSWORD="!Tk1234!"
REMOTE_PATH="/home/tom-pc/prostat-bridge"
LOCAL_FILE="prostat-bridge/server.py"

echo "=========================================="
echo "Deploying Bridge Code to Remote Server"
echo "=========================================="
echo "Host: $BRIDGE_HOST"
echo "Remote Path: $REMOTE_PATH"
echo ""

# Check if file exists
if [ ! -f "$LOCAL_FILE" ]; then
    echo "❌ Error: $LOCAL_FILE not found"
    exit 1
fi

# Check if sshpass is available
if command -v sshpass &> /dev/null; then
    SSH_CMD="sshpass -p '$BRIDGE_PASSWORD' ssh -o StrictHostKeyChecking=no -t"
    SCP_CMD="sshpass -p '$BRIDGE_PASSWORD' scp -o StrictHostKeyChecking=no"
    # For sudo commands, we need to pass password via stdin
    SUDO_CMD="echo '$BRIDGE_PASSWORD' | sudo -S"
else
    echo "Note: sshpass not installed. You'll be prompted for password."
    echo "Password: $BRIDGE_PASSWORD"
    SSH_CMD="ssh -t"
    SCP_CMD="scp"
    SUDO_CMD="sudo"
fi

# Step 1: Create backup on remote
echo "1. Creating backup on remote bridge..."
$SSH_CMD $BRIDGE_HOST << 'ENDSSH'
BACKUP_DIR="$HOME/.joule-bridge-backups"
mkdir -p "$BACKUP_DIR"
if [ -f "$HOME/prostat-bridge/server.py" ]; then
    BACKUP_FILE="$BACKUP_DIR/server.py.$(date +%Y%m%d_%H%M%S)"
    cp "$HOME/prostat-bridge/server.py" "$BACKUP_FILE"
    echo "✓ Backup created: $BACKUP_FILE"
else
    echo "⚠ No existing server.py to backup"
fi
ENDSSH

# Step 2: Install/configure Avahi for hostname resolution
echo ""
echo "2. Configuring Avahi for hostname resolution..."
$SSH_CMD $BRIDGE_HOST bash -s << ENDSSH
BRIDGE_PASSWORD='$BRIDGE_PASSWORD'
# Install avahi-utils if not already installed
if ! command -v avahi-set-host-name &> /dev/null; then
    echo "Installing avahi-utils..."
    echo "\$BRIDGE_PASSWORD" | sudo -S apt-get update -qq
    echo "\$BRIDGE_PASSWORD" | sudo -S apt-get install -y avahi-utils avahi-daemon
fi

# Ensure Avahi daemon is running
echo "\$BRIDGE_PASSWORD" | sudo -S systemctl enable avahi-daemon 2>/dev/null || true
echo "\$BRIDGE_PASSWORD" | sudo -S systemctl start avahi-daemon 2>/dev/null || true

# Register hostname (requires sudo, but service runs as user)
# This makes joule-bridge.local resolve
echo "Registering hostname 'joule-bridge' via Avahi..."
if echo "\$BRIDGE_PASSWORD" | sudo -S avahi-set-host-name joule-bridge 2>/dev/null; then
    echo "✓ Hostname registered"
else
    echo "⚠ Hostname registration may require manual setup"
fi
ENDSSH

# Step 3: Copy files (server.py and homekit_bridge.py)
echo ""
echo "3. Copying files to remote bridge..."
$SCP_CMD "$LOCAL_FILE" "$BRIDGE_HOST:$REMOTE_PATH/server.py"
if [ $? -eq 0 ]; then
    echo "✓ server.py copied successfully"
else
    echo "❌ Failed to copy server.py"
    exit 1
fi

# Copy homekit_bridge.py if it exists
if [ -f "prostat-bridge/homekit_bridge.py" ]; then
    $SCP_CMD "prostat-bridge/homekit_bridge.py" "$BRIDGE_HOST:$REMOTE_PATH/homekit_bridge.py"
    if [ $? -eq 0 ]; then
        echo "✓ homekit_bridge.py copied successfully"
    else
        echo "⚠ Failed to copy homekit_bridge.py (continuing anyway)"
    fi
fi

# Step 3.5: Install HAP-python on remote if needed
echo ""
echo "3.5. Checking/installing HAP-python on remote bridge..."
$SSH_CMD $BRIDGE_HOST bash -s << ENDSSH
BRIDGE_PASSWORD='$BRIDGE_PASSWORD'
cd $REMOTE_PATH
source venv/bin/activate
if ! python3 -c "import pyhap" 2>/dev/null; then
    echo "Installing HAP-python..."
    pip install HAP-python --quiet
    echo "✓ HAP-python installed"
else
    echo "✓ HAP-python already installed"
fi
ENDSSH

# Step 4: Update service file and enable service
echo ""
echo "4. Updating service file and enabling auto-start..."
# Create temporary service file locally
TEMP_SERVICE=$(mktemp)
cat > "$TEMP_SERVICE" << 'EOFSERVICE'
[Unit]
Description=Joule Bridge HomeKit Controller
After=network-online.target
Wants=network-online.target
Requires=network-online.target

[Service]
Type=simple
User=tom-pc
WorkingDirectory=/home/tom-pc/prostat-bridge
ExecStart=/home/tom-pc/prostat-bridge/venv/bin/python3 /home/tom-pc/prostat-bridge/server.py
Restart=always
RestartSec=10
Environment="PATH=/home/tom-pc/prostat-bridge/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOFSERVICE

# Copy service file to remote
$SCP_CMD "$TEMP_SERVICE" "$BRIDGE_HOST:/tmp/prostat-bridge.service.new"
rm -f "$TEMP_SERVICE"

# Install it on remote
$SSH_CMD $BRIDGE_HOST bash -s << ENDSSH
BRIDGE_PASSWORD='$BRIDGE_PASSWORD'
# Move service file into place
echo "\$BRIDGE_PASSWORD" | sudo -S mv /tmp/prostat-bridge.service.new /etc/systemd/system/prostat-bridge.service

# Reload systemd to pick up changes
echo "\$BRIDGE_PASSWORD" | sudo -S systemctl daemon-reload

# Enable service to start on boot
echo "\$BRIDGE_PASSWORD" | sudo -S systemctl enable prostat-bridge

# Restart service
echo "\$BRIDGE_PASSWORD" | sudo -S systemctl restart prostat-bridge
sleep 3
echo "Service status:"
echo "\$BRIDGE_PASSWORD" | sudo -S systemctl status prostat-bridge --no-pager | head -15
echo ""
echo "Service enabled for auto-start:"
echo "\$BRIDGE_PASSWORD" | sudo -S systemctl is-enabled prostat-bridge
echo ""
echo "Service dependencies:"
echo "\$BRIDGE_PASSWORD" | sudo -S systemctl show prostat-bridge | grep -E 'After=|Wants=|Requires=' | head -3
ENDSSH

# Step 5: Check mDNS registration
echo ""
echo "5. Checking mDNS registration..."
sleep 2
MDNS_LOG=$($SSH_CMD $BRIDGE_HOST "journalctl -u prostat-bridge -n 50 --no-pager | grep -i 'mDNS\|register\|joule-bridge' | tail -10" 2>&1)
if echo "$MDNS_LOG" | grep -qi "registered mDNS service"; then
    echo "✓ mDNS service registered successfully"
    echo "$MDNS_LOG" | grep -i "registered\|discoverable\|accessible" | head -5
elif echo "$MDNS_LOG" | grep -qi "failed to register"; then
    echo "⚠ mDNS registration had issues (bridge still works via IP)"
    echo "$MDNS_LOG" | grep -i "failed\|error\|warning" | head -5
else
    echo "ℹ mDNS registration status unclear (checking logs...)"
    echo "$MDNS_LOG"
fi

# Step 6: Test connection
echo ""
echo "6. Testing bridge connection..."
sleep 2
HEALTH=$(curl -s --connect-timeout 5 http://192.168.0.106:8080/health 2>&1)
if echo "$HEALTH" | grep -q "ok"; then
    echo "✓ Bridge is responding at http://192.168.0.106:8080"
else
    echo "⚠ Bridge health check failed: $HEALTH"
    echo "   Waiting a bit longer for service to start..."
    sleep 3
    HEALTH=$(curl -s --connect-timeout 5 http://192.168.0.106:8080/health 2>&1)
    if echo "$HEALTH" | grep -q "ok"; then
        echo "✓ Bridge is now responding"
    else
        echo "❌ Bridge still not responding. Check logs:"
        echo "   ssh $BRIDGE_HOST 'sudo journalctl -u prostat-bridge -n 30'"
    fi
fi

# Step 7: Test Blueair endpoints
echo ""
echo "7. Testing Blueair endpoints..."
CREDENTIALS_ENDPOINT=$(curl -s http://192.168.0.106:8080/api/blueair/credentials 2>&1)
if echo "$CREDENTIALS_ENDPOINT" | grep -q "has_credentials\|error"; then
    echo "✓ Credentials endpoint is working"
    echo "  Response: $CREDENTIALS_ENDPOINT"
else
    echo "⚠ Credentials endpoint may not be working: $CREDENTIALS_ENDPOINT"
fi

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "📋 Summary:"
echo "  • Bridge URL: http://192.168.0.106:8080"
echo "  • mDNS: Check logs above for registration status"
echo "  • Health: $(echo "$HEALTH" | grep -q "ok" && echo "✓ OK" || echo "⚠ Check logs")"
echo ""
echo "🔍 Verify mDNS registration:"
echo "  • From another device: ping joule-bridge.local"
echo "  • Or check: avahi-browse -a | grep joule-bridge"
echo ""
echo "📝 Next steps:"
echo "1. Update bridge URL in UI: Settings → Joule Bridge Settings"
echo "   Use: http://192.168.0.106:8080 (or joule-bridge.local:8080 if mDNS works)"
echo "2. Set Blueair credentials via web UI: Settings → Joule Bridge Settings"
echo ""
echo "📊 Check logs:"
echo "  ssh $BRIDGE_HOST 'sudo journalctl -u prostat-bridge -f'"
echo ""
echo "🔧 Troubleshooting:"
echo "  • If mDNS doesn't work, use IP address: http://192.168.0.106:8080"
echo "  • Check service: ssh $BRIDGE_HOST 'sudo systemctl status prostat-bridge'"
echo "  • View recent logs: ssh $BRIDGE_HOST 'journalctl -u prostat-bridge -n 50'"


