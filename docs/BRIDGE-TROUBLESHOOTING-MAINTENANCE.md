# Bridge Troubleshooting & Maintenance Guide

Complete guide for common issues and maintenance tasks.

## Quick Diagnostics

### Is the Bridge Running?

```bash
# Check service status
sudo systemctl status prostat-bridge

# Check if port 8080 is listening
sudo netstat -tlnp | grep 8080
# or
sudo ss -tlnp | grep 8080

# Test from mini computer
curl http://localhost:8080/health
```

### Can't Connect from Web App?

**Check these in order:**

1. **Bridge is running:**
   ```bash
   sudo systemctl status prostat-bridge
   ```

2. **Firewall blocking port 8080:**
   ```bash
   # Check firewall status
   sudo ufw status
   
   # Allow port 8080
   sudo ufw allow 8080/tcp
   ```

3. **Correct IP address:**
   ```bash
   hostname -I
   # Use this IP in web app
   ```

4. **Bridge accessible from network:**
   ```bash
   # From another computer on same network:
   curl http://192.168.0.100:8080/health
   ```

## Firewall Configuration

### Ubuntu/Debian (ufw)

```bash
# Check status
sudo ufw status

# Allow port 8080
sudo ufw allow 8080/tcp

# Verify
sudo ufw status numbered
```

### Raspberry Pi OS (iptables)

```bash
# Check if firewall is active
sudo iptables -L

# Allow port 8080 (if firewall is active)
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT
sudo iptables-save
```

### Disable Firewall (Not Recommended)

```bash
# Ubuntu/Debian
sudo ufw disable

# Only do this if you're on a trusted local network
```

## Port Already in Use

**Problem:** Port 8080 is already in use by another service

**Find what's using it:**
```bash
sudo lsof -i :8080
# or
sudo netstat -tlnp | grep 8080
```

**Solutions:**

1. **Stop the other service** (if not needed)
2. **Change bridge port:**
   ```bash
   # Edit server.py
   nano ~/prostat-bridge/server.py
   # Find: site = web.TCPSite(runner, '0.0.0.0', 8080)
   # Change 8080 to another port (e.g., 8081)
   # Restart service
   sudo systemctl restart prostat-bridge
   ```

## Python Version Issues

**Problem:** Python 3.8+ not available

**Check Python version:**
```bash
python3 --version
```

**If Python < 3.8:**

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install python3.9 python3.9-venv python3.9-pip
python3.9 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Raspberry Pi OS:**
```bash
# Usually has Python 3.9+ by default
# If not, update system:
sudo apt update
sudo apt upgrade
```

## Dependencies Won't Install

**Problem:** `pip install -r requirements.txt` fails

**Common issues:**

1. **pip is outdated:**
   ```bash
   pip install --upgrade pip
   ```

2. **Missing build tools (for compiled packages):**
   ```bash
   # Ubuntu/Debian
   sudo apt install build-essential python3-dev
   
   # Raspberry Pi OS
   sudo apt install build-essential python3-dev
   ```

3. **Network issues:**
   ```bash
   # Try with timeout
   pip install --default-timeout=100 -r requirements.txt
   ```

4. **Permission issues:**
   ```bash
   # Make sure you're in virtual environment
   source venv/bin/activate
   # Should see (venv) in prompt
   ```

## Service Won't Start

**Problem:** `sudo systemctl start prostat-bridge` fails

**Check logs:**
```bash
sudo journalctl -u prostat-bridge -n 50
```

**Common causes:**

1. **Wrong Python path:**
   ```bash
   # Check service file
   sudo nano /etc/systemd/system/prostat-bridge.service
   # Verify ExecStart path is correct
   # Should be: /home/USER/prostat-bridge/venv/bin/python3
   ```

2. **Wrong working directory:**
   ```bash
   # Check WorkingDirectory in service file
   # Should match actual directory
   ```

3. **Missing dependencies:**
   ```bash
   # Reinstall dependencies
   cd ~/prostat-bridge
   source venv/bin/activate
   pip install -r requirements.txt
   ```

4. **File permissions:**
   ```bash
   # Make sure user can read files
   ls -la ~/prostat-bridge/
   chmod +x ~/prostat-bridge/server.py
   ```

## Updating the Bridge Software

**When you get a new version:**

1. **Backup pairing data:**
   ```bash
   cp ~/prostat-bridge/data/pairings.json ~/prostat-bridge/data/pairings.json.backup
   ```

2. **Stop the service:**
   ```bash
   sudo systemctl stop prostat-bridge
   ```

3. **Update files:**
   ```bash
   # Copy new files from USB or git
   cp -r /path/to/new/files/* ~/prostat-bridge/
   ```

4. **Update dependencies (if requirements.txt changed):**
   ```bash
   cd ~/prostat-bridge
   source venv/bin/activate
   pip install --upgrade -r requirements.txt
   ```

5. **Restart service:**
   ```bash
   sudo systemctl start prostat-bridge
   sudo systemctl status prostat-bridge
   ```

## Backup and Restore

### Backup Pairing Data

```bash
# Copy pairing file
cp ~/prostat-bridge/data/pairings.json ~/pairings-backup-$(date +%Y%m%d).json

# Or backup entire data directory
tar -czf bridge-backup-$(date +%Y%m%d).tar.gz ~/prostat-bridge/data/
```

### Restore Pairing Data

```bash
# Stop service
sudo systemctl stop prostat-bridge

# Restore file
cp ~/pairings-backup-YYYYMMDD.json ~/prostat-bridge/data/pairings.json

# Fix permissions
chmod 644 ~/prostat-bridge/data/pairings.json

# Start service
sudo systemctl start prostat-bridge
```

## Uninstalling the Bridge

**To completely remove:**

```bash
# Stop and disable service
sudo systemctl stop prostat-bridge
sudo systemctl disable prostat-bridge

# Remove service file
sudo rm /etc/systemd/system/prostat-bridge.service
sudo systemctl daemon-reload

# Remove bridge files (optional - keeps pairing data)
# rm -rf ~/prostat-bridge
```

## Changing the Port

**If you need to use a different port:**

1. **Edit server.py:**
   ```bash
   nano ~/prostat-bridge/server.py
   # Find: site = web.TCPSite(runner, '0.0.0.0', 8080)
   # Change 8080 to your desired port (e.g., 8081)
   ```

2. **Update firewall (if changed):**
   ```bash
   sudo ufw allow 8081/tcp
   ```

3. **Restart service:**
   ```bash
   sudo systemctl restart prostat-bridge
   ```

4. **Update web app:**
   - Settings → Joule Bridge Settings
   - Change URL to: `http://192.168.0.100:8081`

## Multiple Network Interfaces

**Problem:** Mini computer has WiFi and Ethernet, bridge on wrong interface

**Check which interface is active:**
```bash
ip addr show
# Look for interface with your IP address
```

**Force bridge to use specific interface:**
```bash
# Edit server.py
nano ~/prostat-bridge/server.py
# Change: '0.0.0.0' to specific IP (e.g., '192.168.0.100')
# Or keep '0.0.0.0' to listen on all interfaces (recommended)
```

## Logs and Debugging

### View Live Logs

```bash
# Systemd service
sudo journalctl -u prostat-bridge -f

# Manual start
tail -f /tmp/bridge.log
```

### Filter Logs

```bash
# Pairing issues
sudo journalctl -u prostat-bridge | grep -i pair

# Connection issues
sudo journalctl -u prostat-bridge | grep -i "connect\|error"

# Discovery issues
sudo journalctl -u prostat-bridge | grep -i discover
```

### Increase Logging Verbosity

```bash
# Edit server.py
nano ~/prostat-bridge/server.py
# Find: logging.basicConfig(level=logging.INFO)
# Change to: logging.basicConfig(level=logging.DEBUG)
# Restart service
sudo systemctl restart prostat-bridge
```

## Network Connectivity Issues

### Can't Reach Bridge from Web App

**Checklist:**

1. ✅ Bridge is running: `sudo systemctl status prostat-bridge`
2. ✅ Port 8080 is open: `sudo netstat -tlnp | grep 8080`
3. ✅ Firewall allows port: `sudo ufw status`
4. ✅ Correct IP: `hostname -I`
5. ✅ Same network: Both devices on 192.168.0.x
6. ✅ Test from mini computer: `curl http://localhost:8080/health`
7. ✅ Test from another device: `curl http://192.168.0.100:8080/health`

### Bridge Can't Reach Ecobee

**Checklist:**

1. ✅ Ecobee is on same WiFi network
2. ✅ Ecobee is powered on
3. ✅ Ecobee WiFi is connected (check Ecobee screen)
4. ✅ HomeKit is enabled on Ecobee
5. ✅ Try discovery: `curl http://localhost:8080/api/discover`

## Service Auto-Restart Issues

**Problem:** Service keeps restarting (crash loop)

**Check logs:**
```bash
sudo journalctl -u prostat-bridge -n 100
```

**Common causes:**
- Missing Python dependencies
- Wrong file paths
- Permission issues
- Port already in use

**Temporary fix (disable auto-restart for debugging):**
```bash
sudo systemctl edit prostat-bridge
# Add:
[Service]
Restart=no
# Then restart
sudo systemctl daemon-reload
sudo systemctl restart prostat-bridge
```

## Performance Issues

### Bridge is Slow

**Check:**
```bash
# CPU usage
top -p $(pgrep -f "python3.*server.py")

# Memory usage
free -h

# Network connectivity
ping -c 5 192.168.0.1
```

### High Memory Usage

**Python virtual environment can be large:**
```bash
du -sh ~/prostat-bridge/venv
# If > 500MB, consider cleaning:
pip cache purge
```

## Security Considerations

### Local Network Only

The bridge runs on `0.0.0.0:8080` which means:
- ✅ Accessible from your local network
- ⚠️ NOT accessible from internet (unless you port forward - don't do this)
- ✅ Safe for local use

### Adding Authentication (Advanced)

If you want to add password protection:
- Requires modifying `server.py`
- Not needed for local network use
- Consider if exposing to internet (not recommended)

## Quick Reference Commands

```bash
# Service management
sudo systemctl status prostat-bridge
sudo systemctl start prostat-bridge
sudo systemctl stop prostat-bridge
sudo systemctl restart prostat-bridge
sudo systemctl enable prostat-bridge
sudo systemctl disable prostat-bridge

# Logs
sudo journalctl -u prostat-bridge -f
sudo journalctl -u prostat-bridge -n 50

# Testing
curl http://localhost:8080/health
curl http://localhost:8080/api/paired
curl http://localhost:8080/api/discover

# Network
hostname -I
ip route | grep default
sudo ufw status
sudo netstat -tlnp | grep 8080

# Files
ls -la ~/prostat-bridge/data/
cat ~/prostat-bridge/data/pairings.json
```

## Getting Help

If you're stuck:

1. **Check logs first:** `sudo journalctl -u prostat-bridge -n 100`
2. **Verify service is running:** `sudo systemctl status prostat-bridge`
3. **Test locally:** `curl http://localhost:8080/health`
4. **Check network:** `hostname -I` and verify IP is correct
5. **Review this guide** for your specific issue

