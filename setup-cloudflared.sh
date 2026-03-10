ingress:
echo "Cloudflare Tunnel setup complete!"
echo "Check status: sudo systemctl status cloudflared"
echo "Check logs: sudo journalctl -u cloudflared -n 50"
#!/bin/bash
# Install and set up Cloudflare Tunnel (cloudflared) as a systemd service on Raspberry Pi using a tunnel token
# Usage: sudo bash setup-cloudflared.sh <TUNNEL_TOKEN>

set -e

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo bash setup-cloudflared.sh ...)"
  exit 1
fi

if [ $# -ne 1 ]; then
  echo "Usage: sudo bash $0 <TUNNEL_TOKEN>"
  exit 1
fi

TUNNEL_TOKEN="$1"

# Add Cloudflare GPG key
echo "Adding Cloudflare GPG key..."
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | sudo tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null

# Add Cloudflare apt repo
echo "Adding Cloudflare apt repository..."
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Install cloudflared
echo "Installing cloudflared..."
sudo apt-get update && sudo apt-get install -y cloudflared

# Install the tunnel as a service using the provided token
echo "Installing cloudflared service with provided tunnel token..."
sudo cloudflared service install "$TUNNEL_TOKEN"

echo "Cloudflare Tunnel setup complete!"
echo "Check status: sudo systemctl status cloudflared"
echo "Check logs: sudo journalctl -u cloudflared -n 50"
