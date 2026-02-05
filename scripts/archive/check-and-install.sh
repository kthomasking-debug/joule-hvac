#!/bin/bash
# Check if we're on the mini PC and install directly

echo "Checking current hostname..."
CURRENT_HOST=$(hostname)
echo "Current host: $CURRENT_HOST"
echo ""

# Check if USB is mounted
echo "Looking for USB drive..."
if [ -d "/media/thomas/writable/prostat-bridge" ]; then
    USB_PATH="/media/thomas/writable"
    echo "✅ Found USB at: $USB_PATH"
elif [ -d "/media/$USER/writable/prostat-bridge" ]; then
    USB_PATH="/media/$USER/writable"
    echo "✅ Found USB at: $USB_PATH"
else
    echo "❌ USB not found. Checking mount points..."
    lsblk | grep -i usb
    ls /media/
    echo ""
    read -p "Enter USB path: " USB_PATH
fi

echo ""
echo "📋 Copying files from USB..."
cp -r "$USB_PATH/prostat-bridge" ~/
echo "✅ Files copied"
echo ""

echo "🔍 Verifying files..."
cd ~/prostat-bridge
ls -la
echo ""

echo "🔧 Running installation..."
chmod +x pre-configure-bridge.sh
./pre-configure-bridge.sh --static-ip 192.168.0.106

echo ""
echo "✅ Installation complete!"
echo ""
echo "🔍 Checking service status..."
sudo systemctl status prostat-bridge --no-pager | head -15

echo ""
echo "🌐 Testing bridge API..."
sleep 2
curl -s http://localhost:8080/api/paired || echo "Bridge may still be starting..."

echo ""
echo "✨ Done! Bridge should be running at: http://192.168.0.106:8080"




