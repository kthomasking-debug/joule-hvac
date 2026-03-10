#!/bin/bash
# Automated setup script for a fresh Pi Zero running Raspberry Pi OS
# Usage: bash setup-fresh-pi.sh <pi_ip> <repo_url>

set -e

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <pi_ip> <repo_url>"
  exit 1
fi

PI_IP="$1"
REPO_URL="$2"

echo "Copying setup-cloudflared.sh to pi@$PI_IP..."
scp ./setup-cloudflared.sh pi@"$PI_IP":~

# SSH into Pi and run setup commands
echo "Connecting to pi@$PI_IP..."
ssh pi@"$PI_IP" bash -s <<'ENDSSH'
set -e

# Update and install dependencies
sudo apt-get update
sudo apt-get install -y git python3 python3-pip python3-venv nodejs npm build-essential

# Optional: install sshpass if you want passwordless deploys
# sudo apt-get install -y sshpass

# Clone repo if not already present
if [ ! -d "$HOME/git/joule-hvac" ]; then
  mkdir -p "$HOME/git"
  cd "$HOME/git"
  git clone REPO_URL_PLACEHOLDER
else
  cd "$HOME/git/joule-hvac"
  git pull
fi

cd "$HOME/git/joule-hvac"

# Run setup script if present
if [ -f ./setup-pi-zero.sh ]; then
  chmod +x ./setup-pi-zero.sh
  ./setup-pi-zero.sh
elif [ -f ./deploy-to-pi.sh ]; then
  chmod +x ./deploy-to-pi.sh
  ./deploy-to-pi.sh
else
  echo "No setup script found. Please run setup manually."
fi
ENDSSH

# Replace placeholder with actual repo URL in remote command
dos2unix setup-fresh-pi.sh 2>/dev/null || true
sed -i "s|REPO_URL_PLACEHOLDER|$REPO_URL|g" setup-fresh-pi.sh

echo "Setup complete. Follow any prompts on the Pi for additional configuration."
echo
echo "To enable remote access via Cloudflare Tunnel, run this on your Pi:"
echo "  sudo bash ~/setup-cloudflared.sh <TUNNEL_TOKEN>"
echo "Replace <TUNNEL_TOKEN> with your actual Cloudflare tunnel token."
