#!/bin/bash
# Remote installation script for bridge on tom-pc-P150HMx
# Run this from your current PC to install via SSH

MINI_PC="thomas@192.168.0.106"
USB_PATH="/media/thomas/writable"

echo "🔌 Connecting to mini PC..."
echo ""

# Step 1: Find USB drive
echo "📁 Finding USB drive..."
USB_FOUND=$(ssh $MINI_PC "ls -d /media/*/writable 2>/dev/null | head -1")
if [ -z "$USB_FOUND" ]; then
    echo "❌ USB drive not found. Checking all mount points..."
    ssh $MINI_PC "lsblk | grep -i usb || ls /media/ || ls /mnt/"
    echo ""
    read -p "Enter USB path manually (or press Enter to use /media/thomas/writable): " USB_PATH
    USB_PATH=${USB_PATH:-/media/thomas/writable}
else
    USB_PATH="$USB_FOUND"
    echo "✅ Found USB at: $USB_PATH"
fi

echo ""
echo "📋 Copying files from USB..."
ssh $MINI_PC "cp -r $USB_PATH/prostat-bridge ~/ && echo 'Files copied successfully'"

echo ""
echo "🔧 Running installation..."
ssh $MINI_PC "cd ~/prostat-bridge && chmod +x pre-configure-bridge.sh && ./pre-configure-bridge.sh --static-ip 192.168.0.106"

echo ""
echo "✅ Installation complete!"
echo ""
echo "🔍 Verifying installation..."
ssh $MINI_PC "sudo systemctl status prostat-bridge --no-pager | head -10"

echo ""
echo "🌐 Testing bridge API..."
ssh $MINI_PC "curl -s http://localhost:8080/api/paired || echo 'Bridge may still be starting...'"

echo ""
echo "✨ Done! Bridge should be running at: http://192.168.0.106:8080"




