#!/bin/bash
# Fix USB permissions so you can write without sudo
# Run this once: sudo ./fix-usb-permissions.sh /media/thomas/writable

USB_PATH="${1:-/media/thomas/writable}"

if [ "$EUID" -ne 0 ]; then 
    echo "This script must be run with sudo"
    echo "Usage: sudo $0 [USB_PATH]"
    exit 1
fi

if [ ! -d "$USB_PATH" ]; then
    echo "Error: USB path does not exist: $USB_PATH"
    exit 1
fi

echo "Changing ownership of $USB_PATH to $SUDO_USER..."
chown -R "$SUDO_USER:$SUDO_USER" "$USB_PATH"

echo "✅ Done! You can now write to $USB_PATH without sudo"
echo ""
echo "Test it:"
echo "  touch $USB_PATH/test.txt && rm $USB_PATH/test.txt"

