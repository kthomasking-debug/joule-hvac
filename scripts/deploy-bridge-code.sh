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
    SSH_CMD="sshpass -p '$BRIDGE_PASSWORD' ssh -o StrictHostKeyChecking=no"
    SCP_CMD="sshpass -p '$BRIDGE_PASSWORD' scp -o StrictHostKeyChecking=no"
else
    echo "Note: sshpass not installed. You'll be prompted for password."
    echo "Password: $BRIDGE_PASSWORD"
    SSH_CMD="ssh"
    SCP_CMD="scp"
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

# Step 2: Copy file
echo ""
echo "2. Copying server.py to remote bridge..."
$SCP_CMD "$LOCAL_FILE" "$BRIDGE_HOST:$REMOTE_PATH/server.py"
if [ $? -eq 0 ]; then
    echo "✓ File copied successfully"
else
    echo "❌ Failed to copy file"
    exit 1
fi

# Step 3: Restart service
echo ""
echo "3. Restarting bridge service..."
$SSH_CMD $BRIDGE_HOST << 'ENDSSH'
sudo systemctl restart prostat-bridge
sleep 2
sudo systemctl status prostat-bridge --no-pager | head -15
ENDSSH

# Step 4: Test connection
echo ""
echo "4. Testing bridge connection..."
sleep 3
HEALTH=$(curl -s http://192.168.0.106:8080/health 2>&1)
if echo "$HEALTH" | grep -q "ok"; then
    echo "✓ Bridge is responding"
else
    echo "⚠ Bridge health check failed: $HEALTH"
fi

# Step 5: Test Blueair endpoints
echo ""
echo "5. Testing Blueair endpoints..."
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
echo "Next steps:"
echo "1. Set Blueair credentials via web UI: Settings → Joule Bridge Settings"
echo "2. Or test: curl -X POST http://192.168.0.106:8080/api/blueair/credentials \\"
echo "   -H 'Content-Type: application/json' \\"
echo "   -d '{\"username\":\"bunnyrita@gmail.com\",\"password\":\"12345678\"}'"
echo ""
echo "Check logs:"
echo "  ssh $BRIDGE_HOST 'sudo journalctl -u prostat-bridge -f | grep -i blueair'"


