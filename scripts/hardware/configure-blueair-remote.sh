#!/bin/bash
# configure-blueair-remote.sh
# Quick script to configure Blueair credentials on remote bridge

BRIDGE_HOST="tom-pc@192.168.0.106"
BRIDGE_PASSWORD="!Tk1234!"
USERNAME="bunnyrita@gmail.com"
PASSWORD="12345678"

echo "Configuring Blueair credentials on remote bridge..."
echo "Host: $BRIDGE_HOST"
echo "Username: $USERNAME"
echo ""

# Use sshpass if available, otherwise prompt
if command -v sshpass &> /dev/null; then
    SSH_CMD="sshpass -p '$BRIDGE_PASSWORD' ssh -o StrictHostKeyChecking=no $BRIDGE_HOST"
    SCP_CMD="sshpass -p '$BRIDGE_PASSWORD' scp -o StrictHostKeyChecking=no"
else
    echo "Note: sshpass not installed. You'll be prompted for password."
    echo "Password: $BRIDGE_PASSWORD"
    SSH_CMD="ssh $BRIDGE_HOST"
    SCP_CMD="scp"
fi

# Create the remote script
$SSH_CMD << 'ENDSSH'
#!/bin/bash
SERVICE_FILE="/etc/systemd/system/prostat-bridge.service"
USERNAME="bunnyrita@gmail.com"
PASSWORD="12345678"

echo "Checking service file..."
if [ ! -f "$SERVICE_FILE" ]; then
    echo "Error: Service file not found"
    exit 1
fi

# Backup
sudo cp "$SERVICE_FILE" "${SERVICE_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
echo "✓ Backup created"

# Remove old Blueair credentials if they exist
if grep -q "BLUEAIR_USERNAME" "$SERVICE_FILE"; then
    echo "Removing old credentials..."
    sudo sed -i '/BLUEAIR_USERNAME=/d' "$SERVICE_FILE"
    sudo sed -i '/BLUEAIR_PASSWORD=/d' "$SERVICE_FILE"
fi

# Add new credentials
echo "Adding new credentials..."
# Find the [Service] section and add after it
sudo sed -i '/\[Service\]/a Environment="BLUEAIR_USERNAME='"$USERNAME"'"' "$SERVICE_FILE"
sudo sed -i '/\[Service\]/a Environment="BLUEAIR_PASSWORD='"$PASSWORD"'"' "$SERVICE_FILE"

echo "✓ Credentials added"

# Reload and restart
sudo systemctl daemon-reload
echo "✓ Daemon reloaded"

sudo systemctl restart prostat-bridge
echo "✓ Service restarted"

sleep 2
echo ""
echo "Service status:"
sudo systemctl status prostat-bridge --no-pager | head -15

echo ""
echo "Checking Blueair connection..."
sleep 3
curl -s http://localhost:8080/api/blueair/status | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8080/api/blueair/status
ENDSSH

echo ""
echo "Done! Check the output above for status."


