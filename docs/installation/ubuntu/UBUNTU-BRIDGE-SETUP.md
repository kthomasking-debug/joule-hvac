# Joule Bridge Installation on Ubuntu 24.04.3 LTS

## Quick Setup (3 Steps)

### 1. Download Installation Script

```bash
# On your Ubuntu machine, open Terminal and run:
cd ~/Downloads

# Download the script (you can copy-paste this URL or download from your repo)
wget https://raw.githubusercontent.com/yourusername/joule-hvac/main/install-bridge-ubuntu.sh

# Or if you have git:
git clone https://github.com/yourusername/joule-hvac.git
cd joule-hvac
```

### 2. Run Installation Script

```bash
# Make it executable (if needed)
chmod +x install-bridge-ubuntu.sh

# Run the installer (will prompt for password)
bash install-bridge-ubuntu.sh
```

The script will:
- ✅ Update system packages
- ✅ Install Node.js v20
- ✅ Install Python 3.11+
- ✅ Setup Bridge server (port 3002)
- ✅ Setup HMI (Python virtual environment)
- ✅ Create systemd services for auto-start
- ✅ Verify everything is running

### 3. Configure & Connect

```bash
# Set your Groq API key (get free key at https://console.groq.com/)
export GROQ_API_KEY=your_api_key_here
echo 'export GROQ_API_KEY=your_api_key_here' >> ~/.bashrc

# Or edit the settings file
nano ~/joule-bridge/settings/joule-settings.json
```

## Verify Installation

### Check Services Are Running

```bash
# Check bridge status
sudo systemctl status joule-bridge

# Check HMI status (if available)
sudo systemctl status joule-hmi

# View live logs
sudo journalctl -u joule-bridge -f
```

### Test Bridge API

```bash
# Health check (should return "ok")
curl http://localhost:3002/health | jq

# Get HVAC status
curl http://localhost:3002/api/status | jq

# Get WiFi signal (returns bars 0-3)
curl http://localhost:3002/api/wifi/signal | jq
```

### Test from Another Machine

```bash
# From your laptop (replace IP with your Ubuntu machine)
curl http://192.168.0.106:3002/health | jq

# Should return something like:
# {
#   "status": "ok",
#   "mode": "groq-powered",
#   "hasApiKey": true,
#   "timestamp": "2026-01-20T19:00:00Z"
# }
```

## Configuration

### Bridge Settings File

```bash
# Edit settings
nano ~/joule-bridge/settings/joule-settings.json

# Example structure:
{
  "location": {
    "city": "Atlanta",
    "state": "Georgia",
    "latitude": 33.7490,
    "longitude": -84.3880,
    "elevation": 340
  },
  "hvac": {
    "mode": "heat",
    "targetTemp": 72,
    "temperature": 68,
    "humidity": 45
  }
}
```

### Connect from React App

1. Go to **Settings** → **Bridge & AI**
2. Enter Bridge URL: `http://192.168.0.106:3002`
3. Click **Save**
4. Check connection status

## Troubleshooting

### Bridge Won't Start

```bash
# Check service status
sudo systemctl status joule-bridge

# View detailed logs (last 50 lines)
sudo journalctl -u joule-bridge -n 50

# Restart service
sudo systemctl restart joule-bridge

# Check if port 3002 is in use
sudo netstat -tlnp | grep 3002
```

### Permission Denied

If you get permission errors, try:

```bash
# Add your user to necessary groups
sudo usermod -aG sudo $USER

# Apply group changes
newgrp sudo
```

### Python/Node Errors

```bash
# Reinstall Node.js
sudo apt-get install --reinstall nodejs

# Reinstall Python dependencies
source ~/joule-hmi/venv/bin/activate
pip install --upgrade pip
pip install -r ~/joule-hmi/requirements.txt
```

### Can't Connect from React App

```bash
# 1. Make sure bridge is running
curl http://localhost:3002/health

# 2. Check firewall (if running)
sudo ufw allow 3002

# 3. Verify network (can you ping the machine?)
ping 192.168.0.106

# 4. Check your machine's actual IP
hostname -I
```

## Service Management

### Start/Stop Services

```bash
# Start bridge
sudo systemctl start joule-bridge

# Stop bridge
sudo systemctl stop joule-bridge

# Restart bridge
sudo systemctl restart joule-bridge

# Enable auto-start on boot
sudo systemctl enable joule-bridge

# Disable auto-start
sudo systemctl disable joule-bridge
```

### View Logs

```bash
# Real-time logs (Ctrl+C to exit)
sudo journalctl -u joule-bridge -f

# Last 100 lines
sudo journalctl -u joule-bridge -n 100

# Last hour
sudo journalctl -u joule-bridge --since "1 hour ago"
```

## Uninstall

```bash
# Stop services
sudo systemctl stop joule-bridge joule-hmi

# Disable auto-start
sudo systemctl disable joule-bridge joule-hmi

# Remove service files
sudo rm /etc/systemd/system/joule-bridge.service
sudo rm /etc/systemd/system/joule-hmi.service

# Reload systemd
sudo systemctl daemon-reload

# Remove directories (optional)
rm -rf ~/joule-bridge
rm -rf ~/joule-hmi
```

## Ports & Firewall

### Bridge Server Port

- **Port**: 3002 (HTTP)
- **URL**: `http://192.168.0.106:3002`
- **Endpoints**: See [BRIDGE_ENDPOINTS_COMPLETE.md](../BRIDGE_ENDPOINTS_COMPLETE.md)

### Allow Through Firewall

```bash
# If using UFW
sudo ufw allow 3002/tcp

# If using iptables
sudo iptables -A INPUT -p tcp --dport 3002 -j ACCEPT
```

## Differences from Raspberry Pi Setup

| Aspect | Raspberry Pi | Ubuntu Desktop |
|--------|-------------|---|
| **OS** | Raspberry Pi OS Lite | Ubuntu 24.04.3 LTS |
| **Architecture** | ARM64 | x86_64 |
| **Power** | ~2W idle | ~20-30W idle |
| **Performance** | Quad-core @1GHz | Depends on CPU |
| **Storage** | microSD card | SSD/HDD |
| **Installation** | `./install.sh` | `./install-bridge-ubuntu.sh` |
| **Services** | systemd | systemd |
| **Locations** | `/home/pi/` | `/home/username/` |

## Support

For detailed API documentation, see:
- [BRIDGE_ENDPOINTS_COMPLETE.md](../BRIDGE_ENDPOINTS_COMPLETE.md)
- [BRIDGE_DYNAMIC_COST_ESTIMATION.md](../BRIDGE_DYNAMIC_COST_ESTIMATION.md)

For Pi Zero 2W setup (if needed later):
- [pi-zero-setup/README.md](../pi-zero-setup/README.md)
