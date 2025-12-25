# Quick Start: Pre-Configuring Mini Computers for Shipping

**Automated script to prepare mini computers for end users**

## Prerequisites

- Fresh Raspberry Pi OS installed (via Raspberry Pi Imager)
- SSH enabled (configure in Raspberry Pi Imager)
- Ethernet connection (or temporary WiFi)
- Bridge files available (from this repository)

## Quick Setup (5 Minutes)

### Step 1: Transfer Bridge Files

**Option A: From USB Drive**
```bash
# If bridge files are on USB
cp -r /media/USB/prostat-bridge ~/
cd ~/prostat-bridge
```

**Option B: From Git Repository**
```bash
# Clone or copy repository
git clone <your-repo> ~/prostat-bridge
cd ~/prostat-bridge/prostat-bridge
```

### Step 2: Run Pre-Configuration Script

**Basic Setup (DHCP - IP assigned by router):**
```bash
chmod +x pre-configure-bridge.sh
./pre-configure-bridge.sh
```

**With Static IP (Recommended - IP never changes):**
```bash
./pre-configure-bridge.sh --static-ip 192.168.0.200
```

**Note:** Use a high IP address (like `.200`) to avoid conflicts with router's DHCP range.

### Step 3: Print Sticker

The script creates `STICKER-INFO.txt` with all the information to print on a sticker:

```bash
cat ~/prostat-bridge/STICKER-INFO.txt
```

Print this and attach to the mini computer.

### Step 4: Test

```bash
# Test bridge is running
curl http://localhost:8080/health

# Check service status
sudo systemctl status prostat-bridge
```

### Step 5: Package and Ship

**Package Contents:**
- ✅ Mini computer (pre-configured)
- ✅ Power adapter
- ✅ Ethernet cable (6 feet)
- ✅ Simple instruction sheet (print `SIMPLE-INSTRUCTIONS-PRINT.txt`)
- ✅ Sticker with MAC address/IP

## What the Script Does

1. ✅ Updates system packages
2. ✅ Installs Python 3 and pip
3. ✅ Sets up bridge files in `~/prostat-bridge/`
4. ✅ Creates Python virtual environment
5. ✅ Installs all dependencies
6. ✅ Tests bridge server
7. ✅ Installs systemd service (auto-starts on boot)
8. ✅ Optionally configures static IP
9. ✅ Gathers network information (MAC, IP)
10. ✅ Creates sticker information file
11. ✅ Verifies everything works

## Static IP vs DHCP

### DHCP (Default)
- ✅ Easier setup
- ✅ No configuration needed
- ⚠️ IP may change after power outage
- ⚠️ User needs to find IP in router

### Static IP (Recommended)
- ✅ IP never changes
- ✅ More reliable
- ✅ User can use same IP every time
- ⚠️ Requires choosing an IP that won't conflict

**Recommendation:** Use static IP with high number (`.200`, `.250`) to avoid conflicts.

## Troubleshooting

### Script Fails at Dependency Installation

```bash
# Install build tools
sudo apt install build-essential python3-dev

# Try again
./pre-configure-bridge.sh
```

### Service Won't Start

```bash
# Check logs
sudo journalctl -u prostat-bridge -n 50

# Check Python path
ls -la ~/prostat-bridge/venv/bin/python3

# Restart service
sudo systemctl restart prostat-bridge
```

### Static IP Not Working

```bash
# Check configuration
cat /etc/dhcpcd.conf | grep -A 5 "interface"

# Or for NetworkManager
nmcli connection show

# Reboot to apply
sudo reboot
```

## Batch Processing Multiple Units

If configuring multiple units:

```bash
# For each unit:
1. Flash SD card with Raspberry Pi OS
2. Enable SSH, set password
3. Boot and SSH in
4. Transfer bridge files
5. Run: ./pre-configure-bridge.sh --static-ip 192.168.0.XXX
6. Print sticker from STICKER-INFO.txt
7. Package and label
```

**Tip:** Use different static IPs for each unit (`.200`, `.201`, `.202`, etc.)

## Quality Checklist

Before shipping, verify:

- [ ] Script completed without errors
- [ ] Service is running: `sudo systemctl status prostat-bridge`
- [ ] Health check works: `curl http://localhost:8080/health`
- [ ] Sticker printed and attached
- [ ] Instruction sheet included
- [ ] Ethernet cable included
- [ ] Power adapter included
- [ ] Tested with actual router (if possible)

## Time Estimate

- **Per unit:** ~10-15 minutes
  - Script runs: ~5 minutes
  - Testing: ~2 minutes
  - Packaging: ~3-5 minutes

## Next Steps

After pre-configuration:
1. Package with all contents
2. Include simple instruction sheet
3. Ship to end user
4. End user follows `END-USER-SETUP-GUIDE.md`

