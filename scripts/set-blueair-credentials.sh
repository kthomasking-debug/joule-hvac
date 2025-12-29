#!/bin/bash
# set-blueair-credentials.sh
# Sets Blueair credentials on the remote bridge

BRIDGE_HOST="${1:-tom-pc@192.168.0.106}"
USERNAME="${2:-bunnyrita@gmail.com}"
PASSWORD="${3:-12345678}"

echo "=========================================="
echo "Setting Blueair Credentials on Remote Bridge"
echo "=========================================="
echo "Bridge: $BRIDGE_HOST"
echo "Username: $USERNAME"
echo ""

# Check if service file exists
echo "1. Checking service file..."
SERVICE_FILE="/etc/systemd/system/prostat-bridge.service"

# Create a temporary script to run on remote
cat > /tmp/set_blueair_creds.sh << 'REMOTE_SCRIPT'
#!/bin/bash
SERVICE_FILE="/etc/systemd/system/prostat-bridge.service"
USERNAME="$1"
PASSWORD="$2"

if [ ! -f "$SERVICE_FILE" ]; then
    echo "Error: Service file not found at $SERVICE_FILE"
    exit 1
fi

# Backup original
sudo cp "$SERVICE_FILE" "${SERVICE_FILE}.backup.$(date +%Y%m%d_%H%M%S)"

# Check if credentials already exist
if grep -q "BLUEAIR_USERNAME" "$SERVICE_FILE"; then
    echo "Updating existing Blueair credentials..."
    # Remove old credentials
    sudo sed -i '/BLUEAIR_USERNAME=/d' "$SERVICE_FILE"
    sudo sed -i '/BLUEAIR_PASSWORD=/d' "$SERVICE_FILE"
fi

# Add new credentials before ExecStart
sudo sed -i "/\[Service\]/a Environment=\"BLUEAIR_USERNAME=$USERNAME\"" "$SERVICE_FILE"
sudo sed -i "/\[Service\]/a Environment=\"BLUEAIR_PASSWORD=$PASSWORD\"" "$SERVICE_FILE"

echo "✓ Credentials added to service file"

# Reload systemd
sudo systemctl daemon-reload

echo "✓ Systemd daemon reloaded"
echo ""
echo "Service file updated. Restart the service with:"
echo "  sudo systemctl restart prostat-bridge"
echo ""
echo "Or restart now? (y/n)"
read -r response
if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
    sudo systemctl restart prostat-bridge
    echo "✓ Service restarted"
    sleep 2
    sudo systemctl status prostat-bridge --no-pager | head -20
fi
REMOTE_SCRIPT

chmod +x /tmp/set_blueair_creds.sh

echo "2. Copying script to remote bridge..."
scp /tmp/set_blueair_creds.sh "$BRIDGE_HOST:/tmp/set_blueair_creds.sh"

echo ""
echo "3. Running script on remote bridge..."
echo "   (You will be prompted for the bridge password: !Tk1234!)"
echo ""

ssh "$BRIDGE_HOST" "bash /tmp/set_blueair_creds.sh '$USERNAME' '$PASSWORD'"

echo ""
echo "4. Testing Blueair connection..."
sleep 3
curl -s "http://192.168.0.106:8080/api/blueair/status" | python3 -m json.tool 2>/dev/null || curl -s "http://192.168.0.106:8080/api/blueair/status"

echo ""
echo "=========================================="
echo "Done!"
echo "=========================================="
echo ""
echo "Check bridge logs:"
echo "  ssh $BRIDGE_HOST 'sudo journalctl -u prostat-bridge -f | grep -i blueair'"
echo ""
echo "Or check status:"
echo "  curl http://192.168.0.106:8080/api/blueair/status"


