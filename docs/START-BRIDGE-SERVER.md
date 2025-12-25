# How to Start the Bridge Server on Mini Computer

Your mini computer is online at **192.168.0.106**, but the bridge server isn't running yet.

## Quick Check: Is Bridge Installed?

SSH into your mini computer:

```bash
ssh thomas@192.168.0.106
# or
ssh pi@192.168.0.106
```

Then check:

```bash
# Check if bridge directory exists
ls ~/prostat-bridge/

# Check if service is installed
sudo systemctl status prostat-bridge
```

## Option 1: Start Existing Service (If Installed)

If the bridge is already installed:

```bash
# Check service status
sudo systemctl status prostat-bridge

# Start the service
sudo systemctl start prostat-bridge

# Enable auto-start on boot
sudo systemctl enable prostat-bridge

# Check if it's running
sudo systemctl status prostat-bridge
```

## Option 2: Start Manually (For Testing)

If you want to test without systemd:

```bash
cd ~/prostat-bridge
source venv/bin/activate
python3 server.py
```

You should see:
```
INFO - Starting ProStat Bridge server on http://0.0.0.0:8080
```

Press `Ctrl+C` to stop.

## Option 3: Install Bridge (If Not Installed)

If the bridge isn't installed yet, you need to install it first.

### From USB Drive:

1. **Insert USB drive** with bridge files
2. **SSH into mini computer:**
   ```bash
   ssh thomas@192.168.0.106
   ```

3. **Find USB drive:**
   ```bash
   ls /media/
   ls /media/*/writable
   ```

4. **Copy files:**
   ```bash
   cp -r /media/*/writable/prostat-bridge ~/
   ```

5. **Follow installation:**
   ```bash
   cd ~/prostat-bridge
   cat INSTALL.txt  # Read instructions
   # Follow the steps in INSTALL.txt
   ```

### From Git/Network:

If you have the code on your main computer:

```bash
# From your main computer, copy files
scp -r prostat-bridge thomas@192.168.0.106:~/

# Then SSH in and install
ssh thomas@192.168.0.106
cd ~/prostat-bridge
# Follow installation steps
```

## Verify Bridge is Running

After starting the bridge:

```bash
# From your main computer
curl http://192.168.0.106:8080/api/paired

# Should return JSON (even if empty devices list)
```

Or check from mini computer:

```bash
curl http://localhost:8080/api/paired
```

## Update Your Web App

Once bridge is running:

1. **Go to Settings → Joule Bridge Settings**
2. **Enter:** `http://192.168.0.106:8080`
3. **Click Save**
4. **Click Refresh** - should show "Connected" ✅

## Troubleshooting

### "Connection refused" or port 8080 closed

**Bridge server is not running:**
- Start the service: `sudo systemctl start prostat-bridge`
- Or start manually: `python3 server.py`

### "No such file or directory"

**Bridge is not installed:**
- Install from USB or copy files
- Follow installation guide

### "Permission denied"

**Check file permissions:**
```bash
chmod +x ~/prostat-bridge/server.py
chmod +x ~/prostat-bridge/install-service.sh
```

### Service won't start

**Check logs:**
```bash
sudo journalctl -u prostat-bridge -n 50
```

**Common issues:**
- Python dependencies not installed
- Wrong file paths in service file
- Missing environment variables

## Quick Reference

**Your mini computer:**
- IP: `192.168.0.106`
- Hostname: `tom-pc-P150HMx`
- MAC: `00-24-D7-A7-15-14`

**Bridge URL for web app:**
- `http://192.168.0.106:8080`

**Note:** This IP might change after power outages. Consider setting a static IP.

