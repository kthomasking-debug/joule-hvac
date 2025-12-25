# Installing Bridge on Mini Computer Remotely

Your mini computer is at **192.168.0.106**, but SSH is not enabled yet.

## Step 1: Enable SSH on Mini Computer

### Option A: If You Have Keyboard/Screen Access

```bash
# Enable SSH
sudo systemctl enable ssh
sudo systemctl start ssh

# Verify it's running
sudo systemctl status ssh
```

### Option B: Raspberry Pi - Enable SSH Before Boot

1. **Insert SD card** into your computer
2. **Create empty file** named `ssh` (no extension) in the `boot` partition
3. **Eject and insert** into Raspberry Pi
4. **Boot** - SSH will be enabled automatically

### Option C: Check if SSH is on Different Port

```bash
# Check if SSH is on non-standard port
nmap -p 22,2222,22022 192.168.0.106
```

## Step 2: Once SSH is Enabled

### Test SSH Connection

```bash
ssh thomas@192.168.0.106
# or
ssh pi@192.168.0.106
```

### Install Bridge Software

**From your main computer, copy files:**

```bash
# Create archive of bridge files
cd /home/thomas/git/joule-hvac
tar -czf /tmp/bridge-files.tar.gz prostat-bridge/ \
  --exclude='prostat-bridge/venv' \
  --exclude='prostat-bridge/__pycache__' \
  --exclude='prostat-bridge/data/pairings.json'

# Copy to mini computer
scp /tmp/bridge-files.tar.gz thomas@192.168.0.106:~/

# SSH in and install
ssh thomas@192.168.0.106
```

**On mini computer:**

```bash
# Extract files
cd ~
tar -xzf bridge-files.tar.gz
cd prostat-bridge

# Install Python if needed
sudo apt update
sudo apt install -y python3 python3-pip python3-venv

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Make executable
chmod +x server.py

# Test it
python3 server.py
# Press Ctrl+C to stop

# Install as service
chmod +x install-service.sh
./install-service.sh

# Verify service is running
sudo systemctl status prostat-bridge
```

## Step 3: Verify Bridge is Running

```bash
# From mini computer
curl http://localhost:8080/api/paired

# From your main computer
curl http://192.168.0.106:8080/api/paired
```

## Alternative: Use USB Drive Method

If SSH is too complicated:

1. **Copy bridge files to USB drive** (already done)
2. **Insert USB into mini computer**
3. **Access files directly** (if you have keyboard/screen)
4. **Follow INSTALL.txt** from USB drive

## Quick Commands Summary

**Enable SSH:**
```bash
sudo systemctl enable ssh
sudo systemctl start ssh
```

**Copy files:**
```bash
scp /path/to/bridge-files.tar.gz thomas@192.168.0.106:~/
```

**Install:**
```bash
ssh thomas@192.168.0.106
cd ~
tar -xzf bridge-files.tar.gz
cd prostat-bridge
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
./install-service.sh
```

## Troubleshooting

**"Connection refused" on SSH:**
- SSH is not enabled
- Enable it using one of the methods above

**"Permission denied" on SSH:**
- Wrong username (try `pi`, `ubuntu`, `user`)
- Wrong password
- Check if password authentication is enabled

**Can't access mini computer:**
- Use USB drive method instead
- Or enable SSH first

