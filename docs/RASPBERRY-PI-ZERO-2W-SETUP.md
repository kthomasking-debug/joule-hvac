# Raspberry Pi Zero 2 W - Headless Setup (No Keyboard/Mouse/Screen Needed)

## What You Need

### Required Hardware
- ✅ Raspberry Pi Zero 2 W
- ✅ MicroSD card (8GB minimum, 16GB+ recommended, Class 10)
- ✅ Power supply (5V, 2.5A minimum)
- ✅ USB flash drive with bridge files (from your USB)

### What You DON'T Need
- ❌ Keyboard
- ❌ Mouse  
- ❌ Screen/Monitor
- ❌ HDMI cable

### What You DO Need (One-Time)
- ✅ **A computer** (Windows/Mac/Linux) to:
  - Write the Raspberry Pi OS image to SD card
  - Configure WiFi and SSH on the SD card
  - Access the USB drive with bridge files
- ✅ **SD card reader** (to plug SD card into your computer)
- ✅ **Your WiFi credentials** (network name and password)

## Step-by-Step: Headless Setup

### Step 1: Write Raspberry Pi OS to SD Card

1. **Download Raspberry Pi Imager:**
   - https://www.raspberrypi.com/software/
   - Install on your computer

2. **Insert SD card** into your computer

3. **Open Raspberry Pi Imager:**
   - Click "Choose OS" → Select "Raspberry Pi OS (other)" → "Raspberry Pi OS Lite" (no desktop needed)
   - Click "Choose Storage" → Select your SD card
   - **IMPORTANT:** Click the gear icon (⚙️) to configure before writing

4. **Configure Settings (Before Writing):**
   - ✅ **Enable SSH:** Check "Enable SSH"
   - ✅ **Set username:** Default is `pi` (or choose your own)
   - ✅ **Set password:** Choose a password (write it down!)
   - ✅ **Configure WiFi:**
     - SSID: Your WiFi network name
     - Password: Your WiFi password
     - Country: Your country code (US, GB, CA, etc.)
   - ✅ **Set hostname:** e.g., `joule-bridge` (optional)
   - Click "Save"

5. **Write the image:**
   - Click "Write" → Confirm
   - Wait for it to finish

### Step 2: Boot the Raspberry Pi

1. **Eject the SD card** from your computer
2. **Insert SD card** into Raspberry Pi Zero 2 W
3. **Connect power supply** to Raspberry Pi
4. **Wait 1-2 minutes** for it to boot and connect to WiFi

### Step 3: Find the Raspberry Pi's IP Address

**Option A: Check Router (Easiest)**
- Log into your router settings page (usually `http://192.168.0.1` or `http://192.168.1.1`)
- Look at "Connected Devices" or "DHCP Clients"
- Find your Raspberry Pi (hostname will be `raspberrypi` or `joule-bridge` if you set it)
- Note the IP address (e.g., `192.168.0.100`)

**Option B: Network Scanner**
```bash
# From another computer on same network
nmap -sn 192.168.0.0/24
# Look for device with hostname "raspberrypi" or "joule-bridge"
```

**Option C: Try Common IPs**
- If you set a static IP in router, use that
- Or try: `192.168.0.100`, `192.168.1.100`, etc.

### Step 4: SSH Into Raspberry Pi

From your computer:

```bash
# Default username is "pi" (or whatever you set)
ssh pi@192.168.0.100

# Enter password (the one you set in Step 1)
```

**Success!** You're now connected to your Raspberry Pi - no keyboard/screen needed!

### Step 5: Install Bridge Software

Now follow the installation guide from your USB drive:

```bash
# Copy files from USB (if USB is mounted)
cp -r /media/USB/prostat-bridge ~/

# Or if USB not mounted, use the files you have
# (You'll need to transfer them via SCP or copy from USB)

# Then follow INSTALL.txt from USB
cd ~/prostat-bridge
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Alternative: If You Can't Pre-Configure WiFi

If you can't configure WiFi before first boot, you have two options:

### Option 1: Use Ethernet (Temporary)

1. **Get a USB-to-Ethernet adapter** (~$10)
2. **Connect Ethernet cable** from router to adapter
3. **Plug adapter into Raspberry Pi** USB port
4. **Boot the Pi** - it will get IP via Ethernet
5. **Find IP from router** settings page
6. **SSH in** and configure WiFi
7. **Disconnect Ethernet** - WiFi will take over

### Option 2: Brief Keyboard/Screen Access

If you have access to a keyboard/screen temporarily:

1. **Connect keyboard** via USB-to-micro-USB adapter
2. **Connect screen** via mini-HDMI adapter
3. **Boot and configure WiFi** using `raspi-config`
4. **Enable SSH** if not already enabled
5. **Disconnect keyboard/screen** - use SSH from now on

## Summary

**For Raspberry Pi Zero 2 W:**
- ❌ **No keyboard/mouse/screen needed** (if you pre-configure WiFi/SSH)
- ✅ **Need:** Computer, SD card reader, WiFi credentials
- ✅ **One-time setup:** Write OS image, configure WiFi/SSH, boot
- ✅ **After boot:** Everything via SSH

**Your shopping list is complete:**
- ✅ Raspberry Pi Zero 2 W
- ✅ Case
- ✅ Power supply
- ✅ MicroSD card (not in your list - add this!)
- ✅ USB drive with bridge files (you already have)

**Optional but recommended:**
- MicroSD card (8GB+, Class 10) - **YOU NEED THIS!**
- USB-to-Ethernet adapter (if WiFi setup fails)
- Mini-HDMI adapter + keyboard (only if you can't pre-configure)

## Next Steps After Setup

1. ✅ SSH into Raspberry Pi
2. ✅ Copy bridge files from USB
3. ✅ Install Python dependencies
4. ✅ Set up bridge as service
5. ✅ Set static IP (optional but recommended)
6. ✅ Pair with Ecobee via web app

All done headlessly via SSH!

