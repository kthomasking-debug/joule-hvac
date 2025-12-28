#!/bin/bash
set -e

MINI_PC="thomas@192.168.0.106"

echo "🔌 Connecting to mini PC at $MINI_PC..."
echo ""

# Step 1: Find USB drive
echo "📁 Finding USB drive..."
USB_PATH=$(ssh $MINI_PC "ls -d /media/*/writable 2>/dev/null | head -1" || echo "/media/thomas/writable")
echo "Using USB path: $USB_PATH"
echo ""

# Step 2: Copy files from USB
echo "📋 Copying files from USB to home directory..."
ssh $MINI_PC "cp -r $USB_PATH/prostat-bridge ~/ && echo '✅ Files copied'"
echo ""

# Step 3: Verify files
echo "🔍 Verifying files..."
ssh $MINI_PC "cd ~/prostat-bridge && ls -la | head -15"
echo ""

# Step 4: Run installation
echo "🔧 Running automated installation..."
ssh $MINI_PC "cd ~/prostat-bridge && chmod +x pre-configure-bridge.sh && ./pre-configure-bridge.sh --static-ip 192.168.0.106"
echo ""

# Step 5: Check service status
echo "✅ Checking service status..."
ssh $MINI_PC "sudo systemctl status prostat-bridge --no-pager | head -15"
echo ""

# Step 6: Test API
echo "🌐 Testing bridge API..."
ssh $MINI_PC "sleep 2 && curl -s http://localhost:8080/api/paired || echo 'Bridge may still be starting...'"
echo ""

echo "✨ Installation complete!"
echo "Bridge should be running at: http://192.168.0.106:8080"




