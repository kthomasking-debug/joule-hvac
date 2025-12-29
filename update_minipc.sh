#!/bin/bash
# Simple update script for mini PC
# Usage: ./update_minipc.sh

echo "Connecting to mini PC at 192.168.0.106..."
echo "Password: !Tk1234!"
echo ""
echo "Commands that will run:"
echo "  cd /home/thomas/git/joule-hvac"
echo "  git pull origin main"
echo "  sudo systemctl restart prostat-bridge"
echo ""

ssh thomas@192.168.0.106 << 'EOF'
cd /home/thomas/git/joule-hvac
git pull origin main
sudo systemctl restart prostat-bridge
exit
EOF

echo ""
echo "✅ Mini PC bridge updated and restarted!"

