#!/bin/bash
# Script to prepare files for USB transfer
# Copies only essential files, excludes venv, cache, and data files
# Handles permission issues automatically (uses sudo if needed)

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
USB_PATH="${1:-/mnt/usb}"

echo "📦 Preparing bridge files for USB transfer..."
echo "   Destination: $USB_PATH/prostat-bridge"
echo ""

# Check if USB path exists
if [ ! -d "$USB_PATH" ]; then
    echo "❌ Error: USB path does not exist: $USB_PATH"
    echo ""
    echo "Usage: $0 [USB_MOUNT_PATH]"
    echo "Example: $0 /mnt/usb"
    echo "         $0 /media/user/USBDRIVE"
    exit 1
fi

# Check if we can write without sudo
USE_SUDO=""
if [ -w "$USB_PATH" ]; then
    echo "✅ USB drive is writable (no sudo needed)"
else
    echo "⚠️  USB drive requires sudo permissions"
    USE_SUDO="sudo"
fi

# Create directory structure
echo "📁 Creating directory structure..."
if [ -n "$USE_SUDO" ]; then
    $USE_SUDO mkdir -p "$USB_PATH/prostat-bridge/data"
else
    mkdir -p "$USB_PATH/prostat-bridge/data"
fi

# Copy essential files
echo "📋 Copying essential files..."
if [ -n "$USE_SUDO" ]; then
    $USE_SUDO cp "$SCRIPT_DIR/server.py" "$USB_PATH/prostat-bridge/"
    $USE_SUDO cp "$SCRIPT_DIR/requirements.txt" "$USB_PATH/prostat-bridge/"
else
    cp "$SCRIPT_DIR/server.py" "$USB_PATH/prostat-bridge/"
    cp "$SCRIPT_DIR/requirements.txt" "$USB_PATH/prostat-bridge/"
fi

# Copy helpful files
echo "📚 Copying documentation and setup files..."
if [ -f "$SCRIPT_DIR/README.md" ]; then
    if [ -n "$USE_SUDO" ]; then
        $USE_SUDO cp "$SCRIPT_DIR/README.md" "$USB_PATH/prostat-bridge/"
    else
        cp "$SCRIPT_DIR/README.md" "$USB_PATH/prostat-bridge/"
    fi
fi

if [ -f "$SCRIPT_DIR/install-service.sh" ]; then
    if [ -n "$USE_SUDO" ]; then
        $USE_SUDO cp "$SCRIPT_DIR/install-service.sh" "$USB_PATH/prostat-bridge/"
    else
        cp "$SCRIPT_DIR/install-service.sh" "$USB_PATH/prostat-bridge/"
    fi
fi

if [ -f "$SCRIPT_DIR/joule-bridge.service" ]; then
    if [ -n "$USE_SUDO" ]; then
        $USE_SUDO cp "$SCRIPT_DIR/joule-bridge.service" "$USB_PATH/prostat-bridge/"
    else
        cp "$SCRIPT_DIR/joule-bridge.service" "$USB_PATH/prostat-bridge/"
    fi
fi

# Make scripts executable
echo "🔧 Setting permissions..."
if [ -n "$USE_SUDO" ]; then
    $USE_SUDO chmod +x "$USB_PATH/prostat-bridge/server.py" 2>/dev/null || true
    $USE_SUDO chmod +x "$USB_PATH/prostat-bridge/install-service.sh" 2>/dev/null || true
else
    chmod +x "$USB_PATH/prostat-bridge/server.py" 2>/dev/null || true
    chmod +x "$USB_PATH/prostat-bridge/install-service.sh" 2>/dev/null || true
fi

# Create empty data directory (pairings.json will be created on first run)
echo "📂 Creating empty data directory..."
if [ -n "$USE_SUDO" ]; then
    $USE_SUDO touch "$USB_PATH/prostat-bridge/data/.gitkeep" 2>/dev/null || true
else
    touch "$USB_PATH/prostat-bridge/data/.gitkeep" 2>/dev/null || true
fi

# Show summary
echo ""
echo "✅ Files copied successfully!"
echo ""
echo "📊 Files on USB drive:"
ls -lh "$USB_PATH/prostat-bridge/" | grep -v "^d" | tail -n +2
echo ""
echo "📁 Directory structure:"
tree -L 2 "$USB_PATH/prostat-bridge/" 2>/dev/null || find "$USB_PATH/prostat-bridge" -type f -o -type d | head -20
echo ""
echo "💾 Total size:"
du -sh "$USB_PATH/prostat-bridge/"
echo ""
echo "✨ Ready to transfer to mini computer!"
echo ""
echo "📝 Next steps on mini computer:"
echo "   1. Mount USB drive"
echo "   2. Copy files: cp -r /mnt/usb/prostat-bridge ~/"
echo "   3. cd ~/prostat-bridge"
echo "   4. python3 -m venv venv"
echo "   5. source venv/bin/activate"
echo "   6. pip install -r requirements.txt"
echo "   7. python3 server.py"

