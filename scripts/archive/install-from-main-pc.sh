#!/bin/bash
# Install bridge on mini PC from main PC via SSH

set -e

MINI_PC="tom-pc@192.168.0.106"

echo "🔌 Installing bridge on mini PC ($MINI_PC)..."
echo ""

# Step 1: Find USB drive on mini PC
echo "📁 Finding USB drive on mini PC..."
USB_PATH=$(ssh $MINI_PC "ls -d /media/*/writable 2>/dev/null | head -1" || echo "")
if [ -z "$USB_PATH" ]; then
    echo "Checking all mount points..."
    ssh $MINI_PC "lsblk | grep -i usb || ls /media/ || ls /mnt/"
    echo ""
    read -p "Enter USB path on mini PC (or press Enter for /media/thomas/writable): " USB_PATH
    USB_PATH=${USB_PATH:-/media/thomas/writable}
else
    echo "✅ Found USB at: $USB_PATH"
fi

# Step 2: Copy files from USB
echo ""
echo "📋 Copying files from USB to home directory..."
ssh $MINI_PC "cp -r $USB_PATH/prostat-bridge ~/ && echo '✅ Files copied successfully'"

# Step 3: Verify files
echo ""
echo "🔍 Verifying files..."
ssh $MINI_PC "cd ~/prostat-bridge && ls -la | head -15"

# Step 4: Run installation
echo ""
echo "🔧 Running automated installation..."
echo "This may take a few minutes..."
ssh $MINI_PC "cd ~/prostat-bridge && chmod +x pre-configure-bridge.sh && ./pre-configure-bridge.sh --static-ip 192.168.0.106"

# Step 5: Check service status
echo ""
echo "✅ Checking service status..."
ssh $MINI_PC "sudo systemctl status prostat-bridge --no-pager | head -20"

# Step 6: Test API
echo ""
echo "🌐 Testing bridge API..."
sleep 3
ssh $MINI_PC "curl -s http://localhost:8080/api/paired" || echo "Bridge may still be starting..."

echo ""
echo "✨ Installation complete!"
echo ""
echo "Bridge should be running at: http://192.168.0.106:8080"
echo ""
echo "Next steps:"
echo "1. Go to your web app → Settings → Joule Bridge Settings"
echo "2. Enter: http://192.168.0.106:8080"
echo "3. Click Save, then Refresh"




