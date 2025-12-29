# Ecobee Bridge Installation Guide for Mini Computer

This guide will help you install the Ecobee bridge on a mini computer (Raspberry Pi, mini PC, or any Linux-based system) to bridge between your Netlify-hosted website and your Ecobee thermostat.

## Overview

The bridge server:
- Runs on your local network (mini computer)
- Connects to your Ecobee via HomeKit protocol (local, no cloud)
- Provides a REST API that your Netlify website can call
- Acts as a secure bridge between the internet and your local thermostat

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌──────────┐
│  Netlify   │────────▶│  Mini PC     │────────▶│  Ecobee  │
│  Website   │  HTTP   │  (Bridge)   │   HAP   │          │
└─────────────┘         └──────────────┘         └──────────┘
     │                          │
     │                          │
     └──────────────────────────┘
        Your Local Network
```

## Prerequisites

- Mini computer running Linux (Raspberry Pi, Intel NUC, mini PC, etc.)
- Python 3.8 or higher
- Network connection (Ethernet or WiFi)
- Ecobee thermostat with HomeKit support
- Access to your router for port forwarding (if accessing from outside your network)

## Step 1: Prepare Your Mini Computer

### 1.1 Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### 1.2 Install Python and pip

```bash
sudo apt install python3 python3-pip python3-venv -y
```

### 1.3 Install Git (if not already installed)

```bash
sudo apt install git -y
```

## Step 2: Clone or Copy the Bridge Code

### Option A: If you have the code in a Git repository

```bash
cd ~
git clone <your-repo-url> joule-hvac
cd joule-hvac/prostat-bridge
```

### Option B: If you need to copy files manually

1. Copy the `prostat-bridge` directory to your mini computer
2. Place it in a location like `~/joule-hvac/prostat-bridge` or `/opt/joule-bridge`

```bash
# Example: if you copied to ~/joule-hvac/prostat-bridge
cd ~/joule-hvac/prostat-bridge
```

## Step 3: Set Up Python Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

## Step 4: Test the Bridge (Manual Start)

Before setting up as a service, test that it works:

```bash
# Make sure you're in the prostat-bridge directory
cd ~/joule-hvac/prostat-bridge  # or wherever you placed it

# Activate virtual environment
source venv/bin/activate

# Start the bridge
python3 server.py
```

You should see output like:
```
INFO - Starting ProStat Bridge server on http://0.0.0.0:8080
INFO - HomeKit controller initialized
```

### Test the Bridge

Open a new terminal and test:

```bash
# Health check
curl http://localhost:8080/health

# Should return: {"status": "ok"}
```

If it works, press `Ctrl+C` to stop the bridge. We'll set it up as a service next.

## Step 5: Configure the Bridge for Your Network

### 5.1 Bridge Discovery (Automatic)

The bridge automatically advertises itself on your local network using mDNS/Bonjour. This means:

- **Users can access it as:** `http://joule-bridge.local:8080`
- **No need to find the IP address** - the hostname works automatically
- **Works on most modern networks** (Windows, Mac, Linux, iOS, Android)

The web app will automatically try this hostname first, so most users won't need to configure anything!

### 5.2 Find Your Mini Computer's IP Address (Optional)

If mDNS doesn't work on your network, you can use the IP address instead:

```bash
# On Linux
ip addr show | grep "inet "

# Or
hostname -I
```

Note your IP address (e.g., `192.168.1.100`). Users can enter this in the format: `http://192.168.1.100:8080`

### 5.2 Configure Firewall (if needed)

If you have a firewall enabled, allow port 8080:

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 8080/tcp

# Or for other firewalls, allow port 8080
```

## Step 6: Set Up as a Systemd Service (Auto-Start)

### 6.1 Create Systemd Service File

```bash
# Edit the service file (we'll create it)
sudo nano /etc/systemd/system/joule-bridge.service
```

Paste this content (adjust paths for your system):

```ini
[Unit]
Description=Joule Bridge HomeKit Controller
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/joule-hvac/prostat-bridge
ExecStart=/home/YOUR_USERNAME/joule-hvac/prostat-bridge/venv/bin/python3 /home/YOUR_USERNAME/joule-hvac/prostat-bridge/server.py
Restart=always
RestartSec=10
Environment="PATH=/home/YOUR_USERNAME/joule-hvac/prostat-bridge/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**Important:** Replace:
- `YOUR_USERNAME` with your actual Linux username (e.g., `pi`, `thomas`, etc.)
- `/home/YOUR_USERNAME/joule-hvac/prostat-bridge` with your actual path

### 6.2 Enable and Start the Service

```bash
# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable joule-bridge

# Start the service
sudo systemctl start joule-bridge

# Check status
sudo systemctl status joule-bridge
```

### 6.3 View Logs

```bash
# View live logs
sudo journalctl -u joule-bridge -f

# View recent logs
sudo journalctl -u joule-bridge -n 50
```

## Step 7: Configure Your Netlify Website

### 7.1 Set Bridge URL in Environment Variables (Optional)

**⚠️ Important:** The bridge URL can be set via environment variable OR configured by users in the Settings page. The app will never default to localhost.

In your Netlify dashboard or `netlify.toml`, you can optionally set:

```bash
VITE_JOULE_BRIDGE_URL=http://YOUR_MINI_PC_IP:8080
```

Replace `YOUR_MINI_PC_IP` with your mini computer's IP address (e.g., `http://192.168.1.100:8080`).

**Note:** If you don't set this environment variable, users must configure the bridge URL in the Settings page. The app will show an error if no bridge URL is configured.

### 7.2 Update Your React App

**⚠️ Important:** The React app requires an explicit bridge URL. It will never use localhost as a fallback.

Your React app should already be configured to use `VITE_JOULE_BRIDGE_URL`. The code should look like:

```javascript
// Uses environment variable or localStorage - never localhost
const bridgeUrl = import.meta.env.VITE_JOULE_BRIDGE_URL || localStorage.getItem('jouleBridgeUrl');
if (!bridgeUrl) {
  throw new Error('Joule Bridge URL not configured');
}
```

Make sure to set `VITE_JOULE_BRIDGE_URL` in your build environment, or users must configure it in the Settings page.

## Step 8: Pair Your Ecobee

### 8.1 Enable HomeKit on Ecobee

1. On your Ecobee thermostat, go to: **Menu → Settings → Installation Settings → HomeKit**
2. Make sure HomeKit is **enabled** and pairing mode is **active**
3. Write down the **8-digit pairing code** (format: XXX-XX-XXX, e.g., `640-54-831`)

**⚠️ Important:** If your Ecobee is already paired to Apple HomeKit, you must unpair it first:
1. Open the **Home** app on your iPhone/iPad
2. Find your Ecobee → Long-press → **Settings** → **Remove Accessory**
3. Wait 30 seconds
4. Enable pairing mode on the Ecobee again

### 8.2 Discover Your Ecobee

From your mini computer or via your website:

```bash
curl http://localhost:8080/api/discover
```

Or from your website's Settings page, click "Discover".

### 8.3 Pair the Device

Via API:
```bash
curl -X POST http://localhost:8080/api/pair \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "cc:73:51:2d:3b:0b",
    "pairing_code": "640-54-831"
  }'
```

Or use your website's Settings page → Joule Bridge Settings → Enter pairing code → Click "Pair".

### 8.4 Verify Pairing

```bash
curl http://localhost:8080/api/paired
```

Should return your paired device.

## Step 9: Test End-to-End

1. **Test from mini computer:**
   ```bash
   curl "http://localhost:8080/api/status?device_id=YOUR_DEVICE_ID"
   ```

2. **Test from your Netlify website:**
   - Go to Settings → Joule Bridge Settings
   - Check that it can connect to your bridge
   - Try reading temperature or setting a temperature

## Step 10: Access from Outside Your Network (Optional)

If you want to access the bridge from outside your local network:

### 10.1 Port Forwarding

1. Log into your router
2. Set up port forwarding:
   - External Port: `8080` (or any port you prefer)
   - Internal IP: Your mini computer's IP (e.g., `192.168.1.100`)
   - Internal Port: `8080`
   - Protocol: TCP

### 10.2 Update Netlify Environment Variable

```bash
VITE_JOULE_BRIDGE_URL=http://YOUR_PUBLIC_IP:8080
```

**⚠️ Security Warning:** Exposing the bridge to the internet requires additional security measures. Consider using a VPN or reverse proxy with authentication instead.

Or use a dynamic DNS service if your public IP changes.

**⚠️ Security Note:** Exposing the bridge to the internet requires additional security measures. Consider:
- Using HTTPS (set up reverse proxy with nginx)
- Adding authentication
- Using a VPN instead

## Troubleshooting

### Bridge Won't Start

```bash
# Check logs
sudo journalctl -u joule-bridge -n 50

# Check if port is in use
sudo lsof -i :8080

# Check Python path
which python3
```

### Can't Discover Ecobee

- Ensure Ecobee and mini computer are on the same WiFi network
- Check that HomeKit is enabled on Ecobee
- Try restarting both devices

### Pairing Fails

- Verify pairing code format: `XXX-XX-XXX` (with dashes)
- Ensure Ecobee is in pairing mode (code visible on screen)
- Unpair from Apple HomeKit first if previously paired
- Check bridge logs: `sudo journalctl -u joule-bridge -f`

### Website Can't Connect to Bridge

- **Verify bridge URL is configured:** Check Settings → Joule Bridge Settings shows a valid URL (not localhost)
- **Check environment variable:** If using `VITE_JOULE_BRIDGE_URL`, verify it's set correctly in your build environment
- **Check localStorage:** Verify `jouleBridgeUrl` is set in browser localStorage
- **Check firewall:** Ensure firewall allows port 8080
- **Test from mini computer:** `curl http://localhost:8080/health` (from the bridge computer itself)
- **Check CORS settings:** If needed, verify CORS is configured on the bridge

## Service Management Commands

```bash
# Start service
sudo systemctl start joule-bridge

# Stop service
sudo systemctl stop joule-bridge

# Restart service
sudo systemctl restart joule-bridge

# Check status
sudo systemctl status joule-bridge

# View logs
sudo journalctl -u joule-bridge -f

# Disable auto-start
sudo systemctl disable joule-bridge

# Enable auto-start
sudo systemctl enable joule-bridge
```

## Next Steps

1. ✅ Bridge is running and auto-starts on boot
2. ✅ Ecobee is paired and responding
3. ✅ Netlify website can connect to bridge
4. ✅ Test temperature reading and setting from website

Your bridge is now ready to connect your Netlify website to your local Ecobee thermostat!

