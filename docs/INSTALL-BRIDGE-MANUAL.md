# Manual Bridge Installation on Mini Computer

Run these commands directly on your mini computer (tom-pc-P150HMx).

## Step 1: Prepare Files

**Option A: From USB Drive**

```bash
# Find USB drive
ls /media/
ls /media/*/writable

# Copy files
cp -r /media/*/writable/prostat-bridge ~/
cd ~/prostat-bridge
```

**Option B: Download from Git (if you have internet)**

```bash
cd ~
git clone <your-repo-url> joule-hvac
cd joule-hvac/prostat-bridge
```

## Step 2: Install Python (If Needed)

```bash
# Check if Python is installed
python3 --version

# If not installed:
sudo apt update
sudo apt install -y python3 python3-pip python3-venv
```

## Step 3: Set Up Python Environment

```bash
cd ~/prostat-bridge

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

## Step 4: Test Bridge Server

```bash
# Make server executable
chmod +x server.py

# Test it (will run until Ctrl+C)
python3 server.py
```

You should see:
```
INFO - Starting ProStat Bridge server on http://0.0.0.0:8080
```

Press `Ctrl+C` to stop.

## Step 5: Install as Service (Auto-Start)

```bash
# Make install script executable
chmod +x install-service.sh

# Run installation
./install-service.sh
```

This will:
- Create systemd service
- Enable auto-start on boot
- Start the service

## Step 6: Verify Service is Running

```bash
# Check status
sudo systemctl status prostat-bridge

# Check logs
sudo journalctl -u prostat-bridge -n 50

# Test API
curl http://localhost:8080/api/paired
```

## Step 7: Configure Blueair (Optional)

If you want to connect Blueair:

```bash
# Edit service file
sudo nano /etc/systemd/system/prostat-bridge.service

# Add these lines in [Service] section:
Environment="BLUEAIR_USERNAME=your-email@example.com"
Environment="BLUEAIR_PASSWORD=your-password"

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart prostat-bridge
```

## Step 8: Update Web App

1. Go to Settings → Joule Bridge Settings
2. Enter: `http://192.168.0.106:8080`
3. Click Save
4. Click Refresh

## Troubleshooting

**"Command not found: python3"**
```bash
sudo apt install -y python3 python3-pip python3-venv
```

**"pip: command not found"**
```bash
sudo apt install -y python3-pip
```

**Service won't start:**
```bash
# Check logs
sudo journalctl -u prostat-bridge -n 50

# Check Python path
which python3
ls -la ~/prostat-bridge/venv/bin/python3
```

**Port 8080 already in use:**
```bash
# Find what's using it
sudo lsof -i :8080

# Or change port in server.py
nano ~/prostat-bridge/server.py
# Find: site = web.TCPSite(runner, '0.0.0.0', 8080)
# Change 8080 to another port
```

## Quick Install Script

Save this as `install-bridge.sh` and run it:

```bash
#!/bin/bash
set -e

echo "🔧 Installing Joule Bridge..."

# Install Python if needed
if ! command -v python3 &> /dev/null; then
    sudo apt update
    sudo apt install -y python3 python3-pip python3-venv
fi

# Create venv
cd ~/prostat-bridge
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Install service
chmod +x install-service.sh
./install-service.sh

echo "✅ Installation complete!"
echo "Bridge URL: http://192.168.0.106:8080"
```

## All Done!

Once installed, your bridge will be available at:
- **URL:** `http://192.168.0.106:8080`
- **Auto-starts:** On boot (via systemd service)
- **Status:** Check with `sudo systemctl status prostat-bridge`

