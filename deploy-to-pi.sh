#!/bin/bash
# Deploy web app to Raspberry Pi bridge
# This builds the production app and copies it to the Pi

set -e  # Exit on error

PI_USER="pi"
PI_HOST="192.168.0.103"
PI_PASSWORD="1"

echo "🏗️  Building production web app..."
npm run build

echo "📦 Copying build to Pi..."
sshpass -p "$PI_PASSWORD" scp -r dist/* ${PI_USER}@${PI_HOST}:/home/pi/git/joule-hvac/dist/

echo "🔄 Restarting bridge service..."
sshpass -p "$PI_PASSWORD" ssh ${PI_USER}@${PI_HOST} "sudo systemctl restart prostat-bridge"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📱 Access the app at:"
echo "   - http://joule-bridge.local:8080"
echo "   - http://192.168.0.103:8080"
echo ""
echo "🔧 Bridge API still available at /api/*"
