# Installing Bridge on Regular Mini PC (tom-pc-P150HMx)

Your mini PC has the USB drive with bridge files. Here's how to install.

## Step 1: Access the Mini PC

You need to get to a command line. Options:

### Option A: Temporary Screen/Keyboard (Recommended)

1. **Connect a monitor** (HDMI/VGA)
2. **Connect a keyboard** (USB)
3. **Power on** the mini PC
4. **Log in** to the desktop/terminal
5. **Open terminal** (Ctrl+Alt+T or Applications → Terminal)

### Option B: Enable SSH First (If You Have Screen/Keyboard)

Once you have screen/keyboard access:

```bash
# Enable SSH
sudo systemctl enable ssh
sudo systemctl start ssh

# Verify
sudo systemctl status ssh
```

Then you can disconnect screen/keyboard and continue via SSH.

## Step 2: Find USB Drive

Once you have terminal access:

```bash
# List mounted drives
lsblk

# Or check common mount points
ls /media/
ls /mnt/

# Find your USB drive (usually /media/USERNAME/writable or similar)
```

## Step 3: Copy Bridge Files

```bash
# Find USB drive path (replace with actual path)
USB_PATH="/media/USERNAME/writable"  # Adjust based on lsblk output

# Copy files to home directory
cp -r $USB_PATH/prostat-bridge ~/

# Navigate to bridge directory
cd ~/prostat-bridge

# Verify files are there
ls -la
```

## Step 4: Install Bridge

### Quick Install (Using Pre-Configuration Script)

```bash
cd ~/prostat-bridge

# Make script executable
chmod +x pre-configure-bridge.sh

# Run installation
./pre-configure-bridge.sh --static-ip 192.168.0.106
```

This will:
- Install Python if needed
- Create virtual environment
- Install dependencies
- Set up systemd service
- Start the bridge
- Configure static IP (optional)

### Manual Install (Step by Step)

If you prefer manual steps:

```bash
cd ~/prostat-bridge

# Install Python if needed
sudo apt update
sudo apt install -y python3 python3-pip python3-venv

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Make server executable
chmod +x server.py

# Test it (briefly)
timeout 3 python3 server.py || true

# Install as service
chmod +x install-service.sh
./install-service.sh
```

## Step 5: Verify Installation

```bash
# Check service status
sudo systemctl status prostat-bridge

# Check logs
sudo journalctl -u prostat-bridge -n 50

# Test API
curl http://localhost:8080/api/paired
```

## Step 6: Configure Blueair (Optional)

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

## Step 7: Update Web App

1. Go to Settings → Joule Bridge Settings
2. Enter: `http://192.168.0.106:8080`
3. Click Save
4. Click Refresh

## Troubleshooting

**"Permission denied" on USB:**
```bash
# Fix USB permissions
sudo chown -R $USER:$USER /media/USERNAME/writable
```

**"Python not found":**
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv
```

**Service won't start:**
```bash
# Check logs
sudo journalctl -u prostat-bridge -n 50

# Check file paths
ls -la ~/prostat-bridge/
ls -la ~/prostat-bridge/venv/bin/python3
```

## After Installation

Once installed:
- ✅ Bridge runs automatically on boot
- ✅ Accessible at `http://192.168.0.106:8080`
- ✅ You can disconnect screen/keyboard
- ✅ Access via SSH (if you enabled it)

## Quick Reference

**Your mini PC:**
- Hostname: `tom-pc-P150HMx`
- IP: `192.168.0.106`
- USB: Already inserted with bridge files

**Installation:**
1. Get terminal access (screen/keyboard)
2. Copy files from USB: `cp -r /media/*/writable/prostat-bridge ~/`
3. Run: `cd ~/prostat-bridge && ./pre-configure-bridge.sh --static-ip 192.168.0.106`
4. Done!

