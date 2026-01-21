# Ubuntu Bridge Installation - Quick Start

## Your Machine Details

**Device**: dev-machine (or tom-pc-P150HMx)  
**IP Address**: 192.168.0.106 or 192.168.0.108  
**OS**: Ubuntu 24.04.3 LTS  
**Password**: [stored securely]

---

## Installation Options

### Option 1: Full Installer (Recommended)

Best for detailed setup and troubleshooting.

```bash
# Download to your Ubuntu machine
cd ~/Downloads
wget https://raw.githubusercontent.com/your-org/joule-hvac/main/install-bridge-ubuntu.sh

# Make executable
chmod +x install-bridge-ubuntu.sh

# Run (will prompt for password)
bash install-bridge-ubuntu.sh
```

**Includes:**
- ✅ Full dependency installation
- ✅ Detailed progress messages
- ✅ Verification testing
- ✅ Complete configuration
- ✅ Comprehensive summary

---

### Option 2: Quick Installer

Minimal, fast setup in ~2 minutes.

```bash
# One-liner (paste into terminal)
bash -c "$(curl -fsSL https://raw.githubusercontent.com/your-org/joule-hvac/main/install-bridge-quick.sh)"

# Or download first
wget https://raw.githubusercontent.com/your-org/joule-hvac/main/install-bridge-quick.sh
bash install-bridge-quick.sh
```

**Includes:**
- ✅ Quick dependency installation
- ✅ Bridge + HMI setup
- ✅ Auto-start services
- ✅ Minimal config

---

### Option 3: Manual Setup

If scripts don't work, do it step-by-step:

```bash
# 1. Update system
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install Python
sudo apt-get install -y python3 python3-pip python3-venv

# 4. Clone repo
git clone https://github.com/your-org/joule-hvac.git
cd joule-hvac

# 5. Setup Bridge
mkdir -p ~/joule-bridge
cp -r pi-zero-bridge/* ~/joule-bridge/
cd ~/joule-bridge
npm install

# 6. Setup HMI
mkdir -p ~/joule-hmi
cp -r ../pi-hmi/* ~/joule-hmi/
python3 -m venv ~/joule-hmi/venv
source ~/joule-hmi/venv/bin/activate
pip install requests Pillow groq python-dotenv
deactivate

# 7. Start services manually
cd ~/joule-bridge
node server.js &  # Bridge runs in background

# 8. Test
curl http://localhost:3002/health
```

---

## After Installation

### 1. Configure API Key

```bash
# Get free Groq API key from:
# https://console.groq.com/

# Set it in terminal (persists for session)
export GROQ_API_KEY=your_api_key_here

# Or make it permanent
echo 'export GROQ_API_KEY=your_api_key_here' >> ~/.bashrc
source ~/.bashrc
```

### 2. Verify Bridge Is Running

```bash
# Check service status
sudo systemctl status joule-bridge

# Test API endpoint
curl http://localhost:3002/health | jq

# Should return:
# {
#   "status": "ok",
#   "mode": "groq-powered",
#   "hasApiKey": true,
#   "timestamp": "2026-01-20T19:30:00Z"
# }
```

### 3. Connect from React App

1. Open Joule React app
2. Go to **Settings** → **Bridge & AI**
3. Enter: `http://192.168.0.106:3002`
4. Click **Save**
5. Verify "✅ Connected"

---

## Service Management

### View Status

```bash
# Bridge service
sudo systemctl status joule-bridge

# View live logs
sudo journalctl -u joule-bridge -f

# Last 50 lines
sudo journalctl -u joule-bridge -n 50
```

### Control Services

```bash
# Start bridge
sudo systemctl start joule-bridge

# Stop bridge
sudo systemctl stop joule-bridge

# Restart bridge
sudo systemctl restart joule-bridge

# Enable auto-start on boot
sudo systemctl enable joule-bridge
```

---

## API Endpoints

Bridge runs on **http://localhost:3002** (internal) or **http://192.168.0.106:3002** (network)

### Health Check
```bash
curl http://localhost:3002/health | jq
```

### Get HVAC Status
```bash
curl http://localhost:3002/api/status | jq
```

### Get WiFi Signal
```bash
curl http://localhost:3002/api/wifi/signal | jq
```

### Set Temperature
```bash
curl -X POST http://localhost:3002/api/setpoint \
  -H "Content-Type: application/json" \
  -d '{"targetTemp": 72}'
```

### Set Mode
```bash
curl -X POST http://localhost:3002/api/mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "heat"}'
```

For all endpoints, see: [BRIDGE_ENDPOINTS_COMPLETE.md](BRIDGE_ENDPOINTS_COMPLETE.md)

---

## Troubleshooting

### Bridge Won't Start

```bash
# Check error logs
sudo journalctl -u joule-bridge -n 50

# Check if port 3002 is in use
sudo lsof -i :3002

# Kill process using port
sudo kill -9 $(sudo lsof -t -i:3002)

# Restart service
sudo systemctl restart joule-bridge
```

### Can't Connect from React App

```bash
# 1. Test locally first
curl http://localhost:3002/health

# 2. Check firewall
sudo ufw status
sudo ufw allow 3002

# 3. Verify machine IP
hostname -I

# 4. Test from another machine
curl http://192.168.0.106:3002/health
```

### Python/Node Errors

```bash
# Check Node.js
node --version  # Should be v20.x

# Check Python
python3 --version  # Should be 3.10+

# Reinstall if needed
sudo apt-get install --reinstall nodejs python3
```

---

## Locations

After installation, files will be at:

- **Bridge**: `~/joule-bridge/`
- **HMI**: `~/joule-hmi/`
- **Settings**: `~/joule-bridge/settings/joule-settings.json`
- **Logs**: `journalctl -u joule-bridge`

---

## Performance Notes

- **CPU Usage**: ~1-2% idle
- **Memory Usage**: ~50-100MB
- **Startup Time**: ~5 seconds
- **Response Time**: <100ms for most endpoints
- **Port**: 3002 (HTTP)

---

## Next Steps

1. ✅ Run installation script
2. ✅ Set Groq API key
3. ✅ Verify bridge is running
4. ✅ Connect from React app
5. ✅ Test HVAC control
6. ✅ Set up E-ink display (optional)

---

## Support

For detailed setup documentation:
- See: [UBUNTU-BRIDGE-SETUP.md](UBUNTU-BRIDGE-SETUP.md)
- API Docs: [BRIDGE_ENDPOINTS_COMPLETE.md](BRIDGE_ENDPOINTS_COMPLETE.md)
- Cost Estimation: [BRIDGE_DYNAMIC_COST_ESTIMATION.md](BRIDGE_DYNAMIC_COST_ESTIMATION.md)

For Raspberry Pi setup (if switching later):
- See: [pi-zero-setup/README.md](pi-zero-setup/README.md)
