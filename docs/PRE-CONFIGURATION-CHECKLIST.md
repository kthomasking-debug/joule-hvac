# Pre-Configuration Checklist for Seller

**Before shipping to end user - configure everything possible!**

## Hardware Setup

- [ ] Flash Raspberry Pi OS to SD card
- [ ] Enable SSH (via Raspberry Pi Imager settings)
- [ ] Set username: `pi` (or custom)
- [ ] Set password: `raspberry` (or secure password - user can change later)
- [ ] **DO NOT configure WiFi** - we'll use Ethernet only
- [ ] Insert SD card into Raspberry Pi
- [ ] Test boot (optional - can skip if confident)

## Software Installation

- [ ] SSH into Raspberry Pi (via Ethernet or temporary WiFi)
- [ ] Update system: `sudo apt update && sudo apt upgrade -y`
- [ ] Install Python: `sudo apt install python3 python3-pip python3-venv -y`
- [ ] Copy bridge files to `~/prostat-bridge/`
- [ ] Create virtual environment: `python3 -m venv venv`
- [ ] Install dependencies: `source venv/bin/activate && pip install -r requirements.txt`
- [ ] Test bridge runs: `python3 server.py` (Ctrl+C to stop)

## Service Setup

- [ ] Install as systemd service: `./install-service.sh`
- [ ] Verify service starts: `sudo systemctl status prostat-bridge`
- [ ] Enable auto-start: `sudo systemctl enable prostat-bridge`
- [ ] Test service: `sudo systemctl restart prostat-bridge`
- [ ] Check logs: `sudo journalctl -u prostat-bridge -n 20`

## Network Configuration

- [ ] **Option A: Use DHCP (Easiest for Users)**
  - Leave as default - router will assign IP
  - Print MAC address on sticker for easy lookup

- [ ] **Option B: Set Static IP (More Reliable)**
  - Follow `SET-STATIC-IP-MINI-COMPUTER.md`
  - Use IP like `192.168.0.200` (high number, less likely to conflict)
  - Print IP address on sticker

## Create Sticker/Label

Print and attach to mini computer:

```
Joule Bridge
MAC Address: AA:BB:CC:DD:EE:FF
IP Address: 192.168.0.200 (if static)
or
Find IP in router admin page using MAC address above

Setup: Connect Ethernet cable to router, plug in power, wait 2 minutes.
```

## Package Contents

- [ ] Mini computer (pre-configured)
- [ ] Power adapter
- [ ] Ethernet cable (6 feet recommended)
- [ ] Simple instruction sheet (END-USER-SETUP-GUIDE.md)
- [ ] Sticker with MAC address/IP

## Final Testing

- [ ] Connect Ethernet cable
- [ ] Power on
- [ ] Wait 2 minutes
- [ ] Find IP in router
- [ ] Test: `curl http://IP:8080/health`
- [ ] Verify service is running: `sudo systemctl status prostat-bridge`
- [ ] Check logs for errors: `sudo journalctl -u prostat-bridge -n 50`

## Optional: Create QR Code

Generate QR code that links to:
- Router admin page (if you know common router IPs)
- Or a simple web page with instructions
- Or the web app's bridge settings page

## Shipping Notes

- [ ] Package securely (anti-static bag recommended)
- [ ] Include all cables and power adapter
- [ ] Print instruction sheet clearly
- [ ] Attach sticker to device
- [ ] Note: User needs Ethernet port on router (most routers have 4+ ports)

## Why Ethernet Instead of WiFi?

✅ **Easier for users:**
- No WiFi password needed
- No WiFi configuration
- Just plug and play

✅ **More reliable:**
- No WiFi signal issues
- No connection drops
- Faster, more stable

✅ **Simpler troubleshooting:**
- If it's plugged in, it's connected
- Easy to verify in router admin

✅ **Works everywhere:**
- Every router has Ethernet ports
- No compatibility issues

**Trade-off:** User needs to run Ethernet cable from router to mini computer location (usually fine - most routers are near where mini computer would be placed anyway).

