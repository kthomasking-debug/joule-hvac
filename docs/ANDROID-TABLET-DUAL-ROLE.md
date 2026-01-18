# Android Tablet as Display + Bridge Server

## Overview

This guide covers using an Android tablet to serve **both** roles:
1. **Display Interface**: Wall-mounted touchscreen running the Joule HVAC web UI
2. **Bridge Server**: Running bridge services (pi-zero-bridge or prostat-bridge) on the same device

## Feasibility Assessment

### ✅ What WILL Work

**Your Tablet Specs:**
- 2GB RAM + 2GB expandable (4GB total)
- 32GB storage
- 1.5GHz quad-core processor
- 7" touchscreen
- Android 13

**Feasible Bridge Options:**

1. **pi-zero-bridge (Groq Cloud API)** ✅
   - Uses cloud-based Groq API (no local LLM)
   - Lightweight: Node.js server only
   - RAM: ~200-400MB
   - Perfect for 2-4GB RAM tablets

2. **prostat-bridge (HomeKit HAP)** ✅
   - Python-based thermostat control
   - Lightweight: ~100-200MB RAM
   - Works great on Android via Termux

### ❌ What WON'T Work

**pi-bridge (Local LLM with Ollama)** ❌
- Requires 16GB RAM minimum
- Your tablet has 2-4GB RAM
- Ollama + Llama 3.2 3B won't run properly

## Recommended Architecture

```
┌─────────────────────────────────────┐
│      Android Tablet (Dual Role)     │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Chrome Browser (Fullscreen) │  │
│  │  → http://localhost:4173     │  │
│  │  → Joule HVAC Web UI         │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Termux (Linux Container)    │  │
│  │  ├─ Node.js                  │  │
│  │  ├─ pi-zero-bridge server    │  │
│  │  │   (port 3002)             │  │
│  │  └─ prostat-bridge (optional)│  │
│  │      (port 8080)             │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Android System              │  │
│  │  - WiFi                      │  │
│  │  - Bluetooth                 │  │
│  │  - USB OTG (for relays)      │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
         │                    │
         │                    │
    ┌────▼────┐         ┌────▼────┐
    │ Ecobee  │         │ USB     │
    │ Thermo  │         │ Relay   │
    │         │         │         │
    └─────────┘         └─────────┘
```

## Setup Instructions

### Step 1: Install Termux

1. **Install Termux** (from F-Droid, NOT Play Store - Play Store version is outdated)
   - Download from: https://f-droid.org/en/packages/com.termux/
   - Install the APK file

2. **Open Termux** and grant storage permissions:
   ```bash
   termux-setup-storage
   ```

### Step 2: Install Node.js and Python

```bash
# Update package lists
pkg update && pkg upgrade

# Install Node.js (for pi-zero-bridge)
pkg install nodejs

# Install Python 3 (for prostat-bridge, if needed)
pkg install python

# Verify installations
node --version  # Should show v16+
python3 --version  # Should show 3.x
```

### Step 3: Install Bridge Server (pi-zero-bridge)

**Option A: Clone Repository (if you have git)**

```bash
# Install git
pkg install git

# Clone your repository (adjust URL)
cd ~/storage/shared
git clone https://github.com/yourusername/joule-hvac.git
cd joule-hvac/pi-zero-bridge
```

**Option B: Manual Copy (if no git)**

1. Copy `pi-zero-bridge` folder from your computer to tablet's Downloads folder
2. In Termux:
   ```bash
   cd ~/storage/downloads
   cp -r pi-zero-bridge ~/joule-bridge
   cd ~/joule-bridge
   ```

**Install Dependencies:**

```bash
npm install
```

### Step 4: Configure Bridge Server

**For pi-zero-bridge (Groq Cloud API):**

1. Set up Groq API key:
   ```bash
   # Create environment file
   echo 'GROQ_API_KEY=your-api-key-here' > ~/.joule-env
   ```

2. Create startup script:
   ```bash
   # Create start-bridge.sh
   cat > ~/start-bridge.sh << 'EOF'
   #!/bin/bash
   source ~/.joule-env
   export PORT=3002
   cd ~/joule-bridge
   node server.js
   EOF
   
   chmod +x ~/start-bridge.sh
   ```

**For prostat-bridge (HomeKit, optional):**

```bash
cd ~/joule-bridge/../prostat-bridge  # Adjust path as needed
pip3 install -r requirements.txt
```

### Step 5: Start Bridge Server on Boot

**Using Termux:Boot (Recommended):**

1. Install Termux:Boot from F-Droid
2. Create `~/.termux/boot/start-bridge`:
   ```bash
   mkdir -p ~/.termux/boot
   cat > ~/.termux/boot/start-bridge << 'EOF'
   #!/data/data/com.termux/files/usr/bin/sh
   source ~/.joule-env
   export PORT=3002
   cd ~/joule-bridge
   nohup node server.js > ~/bridge.log 2>&1 &
   EOF
   chmod +x ~/.termux/boot/start-bridge
   ```

**Manual Start (for testing):**

```bash
# In Termux
cd ~/joule-bridge
node server.js

# Keep Termux running in background (Android will keep it alive)
```

### Step 6: Set Up Web UI

**Option A: Build and Serve Locally**

1. On your computer, build the web app:
   ```bash
   npm run build:pi
   ```

2. Copy `dist/` folder to tablet's Downloads

3. In Termux, serve static files:
   ```bash
   # Install a simple HTTP server
   npm install -g http-server
   
   cd ~/storage/downloads/dist
   http-server -p 4173 --cors
   ```

**Option B: Use Existing Web Server**

If your web app is already hosted (Vercel, Netlify, etc.), just point the tablet browser to that URL.

### Step 7: Configure Chrome (Kiosk Mode)

1. **Install Chrome** from Play Store (if not already installed)

2. **Create a shortcut script** that opens Chrome in kiosk mode:
   ```bash
   # Install Tasker or use Auto Start app
   # Or manually open Chrome to: http://localhost:4173
   ```

3. **Kiosk Mode Options:**
   - Use **"Kiosk Browser Lockdown"** app (Play Store)
   - Or use **Tasker** to auto-launch Chrome on boot
   - Or use Android's built-in kiosk mode (Settings → Security → Device Admin)

4. **Set Chrome to launch on startup:**
   - Settings → Apps → Default Apps → Browser → Chrome
   - Use an auto-start app to open: `http://localhost:4173`

### Step 8: Configure Web UI to Use Local Bridge

In your Joule HVAC app settings, configure:

```javascript
// Settings → Advanced
{
  "bridgeUrl": "http://localhost:3002",  // Local bridge on same device
  "useLocalBridge": true
}
```

If the web UI is hosted elsewhere, use the tablet's local IP:

```javascript
// Find tablet's IP: Settings → WiFi → Connected Network
{
  "bridgeUrl": "http://192.168.1.XXX:3002",  // Tablet's local IP
  "useLocalBridge": true
}
```

## Performance Considerations

### RAM Usage (Total ~1-1.5GB)

- **Chrome Browser**: ~400-600MB
- **pi-zero-bridge (Node.js)**: ~200-400MB
- **Android System**: ~400-600MB
- **Available**: ~500MB-1.5GB free (comfortable with 2-4GB RAM)

### Storage Usage

- **Termux + Node.js**: ~200MB
- **Bridge server code**: ~50MB
- **Web UI build**: ~20-50MB
- **Available**: ~30GB+ free (plenty of space)

### Battery Life

- **Screen on 24/7**: Will drain battery
- **Solution**: Keep tablet plugged in (use furnace transformer with 24VAC-to-USB adapter)
- See `docs/ANDROID-TABLET-THERMOSTAT.md` for power wiring details

## Testing Checklist

- [ ] Termux installed and Node.js working
- [ ] Bridge server starts: `node server.js` (check logs)
- [ ] Bridge responds: `curl http://localhost:3002/health`
- [ ] Chrome can access web UI at `http://localhost:4173`
- [ ] Web UI can connect to bridge at `http://localhost:3002`
- [ ] Bridge auto-starts on reboot (test by restarting tablet)
- [ ] Chrome auto-launches in kiosk mode on boot

## Troubleshooting

### Bridge Server Not Starting

```bash
# Check if port is already in use
lsof -i :3002  # May not work on Android
netstat -an | grep 3002  # Alternative

# Check Node.js version
node --version  # Should be v16+

# Check logs
cat ~/bridge.log
```

### Web UI Can't Connect to Bridge

- Verify bridge is running: `curl http://localhost:3002/health`
- Check firewall: Android may block localhost connections
- Try using tablet's WiFi IP instead of localhost: `http://192.168.1.XXX:3002`

### Termux Process Killed by Android

Android may kill Termux processes if tablet is low on memory or battery optimization is enabled.

**Solution:**
1. Settings → Apps → Termux → Battery → "Unrestricted"
2. Settings → Apps → Termux → Notifications → "Enable all notifications"
3. Use `termux-wake-lock` to prevent sleep:
   ```bash
   pkg install termux-api
   termux-wake-lock
   ```

### Chrome Not Auto-Launching

- Install **"Auto Start"** or **Tasker** app
- Create task: "On Boot" → "Launch App" → Chrome → URL: `http://localhost:4173`

## Advantages of This Setup

✅ **All-in-one device** - No separate Pi needed  
✅ **Low cost** - Just the tablet (~$30-50)  
✅ **Simple networking** - Everything on localhost  
✅ **Touch interface** - Native Android support  
✅ **Portable** - Can move tablet if needed  
✅ **Easy updates** - Just update the web UI build  

## Limitations

⚠️ **No Local LLM** - pi-zero-bridge uses cloud Groq API (internet required)  
⚠️ **Battery drain** - Must keep plugged in for 24/7 operation  
⚠️ **Limited RAM** - Can't run resource-intensive services  
⚠️ **Android overhead** - Less efficient than dedicated Linux system  

## Alternative: Separate Devices

If you want local LLM or need more power:

**Recommended:**
- **Tablet**: Display only (Chrome + web UI)
- **Raspberry Pi 5**: Bridge server (local LLM with Ollama)

See `docs/ANDROID-TABLET-THERMOSTAT.md` for tablet setup, and `pi-setup/README.md` for Pi setup.

## Next Steps

1. ✅ Set up Termux and install Node.js
2. ✅ Install and test bridge server
3. ✅ Build and serve web UI
4. ✅ Configure Chrome kiosk mode
5. ✅ Test end-to-end functionality
6. ✅ Set up auto-start on boot
7. ✅ Configure power (use furnace transformer)

## Related Documentation

- `docs/ANDROID-TABLET-THERMOSTAT.md` - Tablet as display only
- `pi-zero-bridge/README.md` - Bridge server details
- `prostat-bridge/README.md` - HomeKit bridge details
- `pi-setup/README.md` - Full Linux setup (for comparison)

