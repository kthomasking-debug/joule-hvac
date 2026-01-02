# Joule HVAC User Manual

**Complete guide for end users - everything you need to know!**

---

## Table of Contents

1. [What's in the Box](#whats-in-the-box)
2. [How It Works](#how-it-works)
3. [Quick Setup (2 Minutes)](#quick-setup-2-minutes)
4. [Pairing Your Ecobee Thermostat](#pairing-your-ecobee-thermostat)
5. [Using the App](#using-the-app)
6. [Voice Commands (AI Mode)](#voice-commands-ai-mode)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Topics](#advanced-topics)

---

## What's in the Box

- ✅ Mini computer (already set up and configured)
- ✅ Power adapter
- ✅ Ethernet cable
- ✅ This user manual

**That's it!** Everything you need is included.

---

## How It Works

**The web app runs in YOUR browser, not on the internet!**

Here's what happens when you use the app:

```
┌──────────────────────────────────────────────────────────────┐
│                    YOUR HOME NETWORK                        │
│                                                             │
│   ┌─────────────┐         Direct Connection        ┌──────┐ │
│   │   Your      │  ──────────────────────────────▶ │ Mini │ │
│   │   Phone/    │  (http://joule-bridge.local:8080)│  PC  │ │
│   │   Computer  │ ◀──────────────────────────────  │Bridge│ │
│   │   Browser   │         API Responses            └──┬───┘ │
│   └──────┬──────┘                                      │     │
│          │                                            │     │
│          │ Downloads app                              │     │
│          │ (HTML/JS/CSS files)                        │     │
│          ▼                                            │     │
│   ┌──────────┐                                       │     │
│   │ Netlify  │  ← Static files only                  │     │
│   │ Website  │     (No API calls here!)              │     │
│   └──────────┘                                       │     │
│                                                      │     │
│                                                      ▼     │
│                                              ┌──────────┐  │
│                                              │  Ecobee  │  │
│                                              │Thermostat│  │
│                                              └──────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Key Points:**

1. **The app runs in YOUR browser** (on your phone, tablet, or computer)
2. **All communication stays on YOUR network** - nothing goes to the internet
3. **The mini PC bridge** connects directly to your Ecobee thermostat
4. **Fast and private** - everything happens locally in your home

**Why This Matters:**

- ✅ **Works offline** - No internet needed after initial download
- ✅ **Super fast** - Direct connection, no cloud delays
- ✅ **Private** - Your thermostat data never leaves your home
- ✅ **Reliable** - No dependency on internet or cloud services

**Important:** The app only works when you're on the same WiFi network as the mini PC. If you're away from home, you won't be able to control your thermostat (unless you set up a VPN, which is optional).

---

## Quick Setup (2 Minutes)

### ⚠️ CRITICAL REQUIREMENT: 2.4 GHz WiFi

**The mini computer MUST be connected to a 2.4 GHz WiFi network.**

**Why This Matters:**
- **Ecobee thermostats** only work with HomeKit over 2.4 GHz WiFi
- **Blueair devices** require 2.4 GHz WiFi
- **Device discovery** only works reliably on 2.4 GHz

**How to Ensure 2.4 GHz:**
- If your router has separate networks, connect to the **2.4 GHz network** (e.g., `YourNetwork-2.4GHz`)
- If your router uses one name for both bands, it should auto-select 2.4 GHz for IoT devices
- **⚠️ Using 5 GHz WiFi will cause connection failures and pairing issues**

### Step 1: Plug It In

1. **Plug the Ethernet cable** into your WiFi router (any open port)
2. **Plug the other end** into the mini computer
3. **Plug in the power adapter** to the mini computer
4. **Wait 2 minutes** for it to start up

**That's it!** The mini computer is now connected to your network.

**Note:** If using WiFi instead of Ethernet, ensure you connect to the **2.4 GHz network**.

### Step 2: Find Your Bridge

**How Bridge Discovery Works:**

The mini PC automatically tells your network "I'm here!" using a technology called mDNS (like a digital name tag):

```
┌─────────────────────────────────────────────────────┐
│              YOUR HOME NETWORK                      │
│                                                     │
│  Mini PC Bridge                                     │
│  ┌──────────────┐                                   │
│  │ "Hello! I'm  │                                   │
│  │ joule-bridge │ ──── Broadcasts name ────▶      │
│  │ .local"      │                                   │
│  └──────────────┘                                   │
│                                                     │
│  Your Phone/Computer                                │
│  ┌──────────────┐                                   │
│  │ "Looking for │                                   │
│  │ joule-bridge │ ◀─── Finds it automatically ──── │
│  │ .local"      │                                   │
│  └──────────────┘                                   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Option A: Use Hostname (Easiest - Try This First!)**

The bridge automatically advertises itself on your network. You can access it using:

1. **Open your web app** (the Netlify website)
2. **Go to Settings** → **Joule Bridge Settings**
3. **The app will automatically try:** `http://joule-bridge.local:8080`
4. **Click "Refresh"** - if you see a green checkmark ✅, you're done!

**If that doesn't work, try Option B or C below.**

**Option B: Check Your Router**

1. **Open a web browser** on any device (phone, tablet, computer)
2. **Type this in the address bar:** `192.168.0.1` (or `192.168.1.1` if that doesn't work)
3. **Log in** to your router (check router label for username/password)
4. **Look for "Connected Devices"** or "DHCP Clients"
5. **Find "Joule Bridge"** or "raspberrypi" in the list
6. **Write down the IP address** (looks like `192.168.0.100`)

**Option C: Use the Sticker**

- Look at the sticker on the mini computer
- It has a MAC address (looks like `AA:BB:CC:DD:EE:FF`)
- In your router's connected devices, find this MAC address
- Write down the IP address next to it

### Step 3: Connect Your Web App

**If Option A worked (hostname), you're done! Skip to Step 4.**

**If you need to use an IP address:**

1. **Open your web app** (the Netlify website)
2. **Go to Settings** → **Joule Bridge Settings**
3. **Enter the IP address** you found in the format: `http://192.168.0.100:8080`
   - Replace `192.168.0.100` with the actual IP address from Step 2
   - The format must be: `http://IP_ADDRESS:8080`
4. **Click "Save"**
5. **Click "Refresh"** - you should see a green checkmark ✅

**Success!** Your bridge is now connected.

**Note:** If you see an error about "Bridge URL not configured", make sure you've entered the URL correctly and clicked "Save".

---

## Pairing Your Ecobee Thermostat

### How Pairing Works

```
┌─────────────────────────────────────────────────────┐
│              YOUR HOME NETWORK                      │
│                                                     │
│  ┌──────────────┐         ┌──────────────┐         │
│  │   Your       │         │    Mini PC   │         │
│  │   Browser    │────────▶│    Bridge    │         │
│  │              │  "Find  │              │         │
│  │              │  devices"              │         │
│  └──────────────┘         └──────┬───────┘         │
│                                   │                 │
│                                   │ Discovers       │
│                                   ▼                 │
│                            ┌──────────────┐         │
│                            │   Ecobee     │         │
│                            │ Thermostat   │         │
│                            │              │         │
│                            │ Shows pairing│         │
│                            │ code: 640-54-│         │
│                            │     831      │         │
│                            └──────────────┘         │
│                                                     │
│  ┌──────────────┐         ┌──────────────┐         │
│  │   Your       │         │    Mini PC   │         │
│  │   Browser    │────────▶│    Bridge    │────────▶│
│  │              │  "Pair  │              │  "Pair  │
│  │              │  with  │              │  with   │
│  │              │  code   │              │  code   │
│  │              │  640-   │              │  640-   │
│  │              │  54-831"│              │  54-831"│
│  └──────────────┘         └──────────────┘         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Step 1: Enable HomeKit Pairing Mode on Ecobee

1. **On your Ecobee thermostat**, go to:
   - **Menu** → **Settings** → **Installation Settings** → **HomeKit**

2. **Make sure HomeKit is enabled** and pairing mode is **active**

3. **The thermostat will display:**
   - A QR code (for Apple Home app)
   - An **8-digit pairing code** (format: `XXX-XX-XXX`, e.g., `640-54-831`)
   - **⚠️ Important:** Write down this code - you'll need it for pairing!

**⚠️ Critical: If Already Paired to Apple HomeKit**

If your Ecobee is already paired to Apple HomeKit, you **must unpair it first**:

1. Open the **Home** app on your iPhone/iPad
2. Find your Ecobee thermostat
3. Long-press on it → **Settings** → **Remove Accessory**
4. Wait 30 seconds for the device to reset
5. Then enable pairing mode on the Ecobee again
6. **Note:** The pairing code may change - use the **NEW** code shown on screen

**Why?** HomeKit devices can only be paired to **ONE controller at a time**. If it's paired to Apple HomeKit, it won't pair to the bridge.

### Step 2: Discover Your Ecobee

1. In **Settings** → **Joule Bridge Settings**
2. Click the **"Discover"** button
3. Wait 10-60 seconds for discovery to complete (HomeKit discovery can be slow)
4. Your Ecobee should appear in the list with:
   - Device name (e.g., "My ecobee")
   - Device ID (e.g., `cc:73:51:2d:3b:0b`)

**If no devices found:**
- ✅ Make sure Ecobee is in pairing mode (Step 1)
- ✅ Verify Ecobee and bridge are on the same WiFi network
- ✅ Check that HomeKit is enabled on Ecobee
- ✅ Try clicking "Discover" again - discovery can take up to 60 seconds

### Step 3: Pair with Your Ecobee

1. **Find your Ecobee** in the discovered devices list
2. Click the **"Pair"** button next to your Ecobee
3. **Enter the 8-digit pairing code** from your Ecobee screen
   - Format: `XXX-XX-XXX` (with dashes)
   - Example: `640-54-831` or `810-85-888`
   - **Flexible input:** You can type with or without dashes:
     - `810-85-888` (recommended)
     - `81085888` (auto-formatted to `810-85-888`)
   - The input field will auto-format as you type
4. Click **"Pair"** button
5. **Wait up to 45 seconds** - pairing can take time
   - Keep the Ecobee screen showing the pairing code during this time
   - Don't close the pairing screen on Ecobee

**Success!** You should see:
- ✅ "Successfully paired!" message
- ✅ Device appears in "Paired Devices" section
- ✅ Green checkmark next to device

### Step 4: Verify Pairing Works

1. **Check "Paired Devices" section** - your Ecobee should be listed
2. **Test connection:**
   - The app should automatically start reading temperature
   - Go to the main dashboard and check if temperature is showing
   - Try changing the target temperature to verify write access

**If device shows as "paired but not reachable":**
- This can happen if the bridge restarted and pairing data didn't load correctly
- Wait a few seconds for automatic reconnection
- If it persists, see troubleshooting section below

---

## Using the App

Once your bridge is connected and your Ecobee is paired, you can:

- **View current temperature** - See real-time readings from your thermostat
- **Control temperature** - Set heating and cooling targets
- **Change HVAC mode** - Switch between Heat, Cool, Auto, and Off
- **View energy forecasts** - See weekly and monthly cost predictions
- **Optimize settings** - Get recommendations for energy savings
- **Use voice commands** - Control your thermostat by speaking (see next section)

All features work locally on your network - no internet required after the initial app download!

---

## Voice Commands (AI Mode)

Your Joule system includes a talking thermostat with voice control! 

**To use voice commands:**

1. Navigate to **"AI Mode"** from the main menu
2. Click the **microphone button** (🎤) to start speaking
3. Say your command naturally

### Temperature Control Commands

```
"Make it warmer"           → Increases by 2°F
"Make it cooler by 3"      → Decreases by 3°F
"Turn up the heat by 5"    → Increases by 5°F
"Set winter to 72"         → Sets to exact temp
```

### Preset Modes

```
"I'm going to sleep"       → Sets to 65°F (sleep mode)
"I'm leaving"              → Sets to 60°F (away mode)
"I'm home"                 → Sets to 70°F (home mode)
```

### Information Queries

```
"What's the temperature"   → Shows current setting
"How cold is it"           → Same as above
"What can I save"          → Shows recommendations
"My Joule score"           → Shows efficiency score
```

**For complete voice command documentation**, see `docs/QUICK_START_GUIDE.md`

---

## Troubleshooting

### "Can't Find Bridge" or "Not Connected"

**Visual Check:**

```
┌─────────────────────────────────────────────────────┐
│  Check these connections:                          │
│                                                     │
│  Router ────[Ethernet Cable]───▶ Mini PC          │
│    │                                    │          │
│    │                                    │          │
│    │                                    ▼          │
│    │                              [Power Plug]     │
│    │                                    │          │
│    │                                    ▼          │
│    │                              [Power Outlet]   │
│    │                                                │
│    └───[WiFi]───▶ Your Phone/Computer              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

1. **Check the Ethernet cable** is plugged into router
2. **Check the power** is plugged in
3. **Wait 2 more minutes** - it takes time to start
4. **Check your router** - look for "Joule Bridge" in connected devices
5. **Try a different Ethernet port** on your router

### "Can't Access Router"

- Router address is usually `192.168.0.1` or `192.168.1.1`
- Check the label on your router for the settings address
- Or ask your internet provider

### "Bridge IP Changed After Power Outage"

**Why This Happens:**

```
Before Power Outage:          After Power Outage:
┌─────────────┐               ┌─────────────┐
│   Router    │               │   Router    │
│             │               │             │
│ Assigns IP: │               │ Assigns IP: │
│ 192.168.0.106               │ 192.168.0.115  ← Different!
└─────────────┘               └─────────────┘
```

- This is normal - your router assigns IP addresses dynamically
- Just find the new IP in your router (see Step 2, Option B)
- Or use the hostname `joule-bridge.local:8080` - it always works!
- Or see the "Set Static IP" guide (optional, advanced)

### "App Works at Home But Not Away"

**Why This Happens:**

```
At Home (Works):              Away from Home (Doesn't Work):
┌─────────────────┐          ┌─────────────────┐
│  Your Phone     │          │  Your Phone     │
│  (Same WiFi)    │          │  (Different     │
│       │         │          │   Network)      │
│       │         │          │       │         │
│       ▼         │          │       │         │
│  ┌──────────┐  │          │       │         │
│  │  Router  │  │          │       │         │
│  └────┬─────┘  │          │       │         │
│       │        │          │       │         │
│       ▼        │          │       │         │
│  ┌──────────┐  │          │       │         │
│  │Mini PC   │  │          │       │         │
│  │Bridge    │  │          │       │         │
│  └──────────┘  │          │       │         │
│                 │          │       │         │
│  ✅ Connected!  │          │       │         │
│                 │          │       │         │
│                 │          │       ▼         │
│                 │          │  ┌──────────┐  │
│                 │          │  │ Internet │  │
│                 │          │  └──────────┘  │
│                 │          │                 │
│                 │          │  ❌ Can't reach │
│                 │          │     mini PC     │
└─────────────────┘          └─────────────────┘
```

**This is normal!** The bridge is on your private home network. To control it from away, you'd need to set up a VPN (optional, advanced).

### Pairing Issues

**"Device Not Found" During Discovery**

- ✅ Ensure Ecobee and Bridge are on the same WiFi network
- ✅ Check that HomeKit is enabled on Ecobee (Menu → Settings → Installation Settings → HomeKit)
- ✅ Verify Ecobee is powered on and connected to WiFi
- ✅ Try restarting discovery: Click "Discover" again
- ✅ Wait up to 60 seconds - HomeKit discovery can be slow

**Pairing Fails**

**Common Causes & Solutions:**

1. **Device Not in Pairing Mode**
   - On Ecobee: Menu → Settings → Installation Settings → HomeKit
   - Make sure pairing mode is **ACTIVE** (you should see a pairing code on screen)
   - The pairing code format is `XXX-XX-XXX` (e.g., `640-54-831`)

2. **Device Already Paired to Apple HomeKit**
   - HomeKit devices can only be paired to ONE controller at a time
   - Unpair from Apple HomeKit first:
     1. Open **Home** app on iPhone/iPad
     2. Find your Ecobee → Long-press → **Settings** → **Remove Accessory**
     3. Wait 30 seconds
     4. Enable pairing mode on Ecobee again
     5. Use the **NEW** pairing code shown on screen

3. **Incorrect Pairing Code Format**
   - The pairing code must be 8 digits in format: `XXX-XX-XXX` (with dashes)
   - Example: `640-54-831` or `810-85-888`
   - **Flexible input:** You can enter with or without dashes:
     - `810-85-888` (recommended)
     - `81085888` (auto-formatted to `810-85-888`)
   - Enter the exact code shown on your Ecobee screen

4. **Network Connectivity Issues**
   - Ensure Ecobee and Bridge are on the same Wi-Fi network
   - Check that both devices have stable network connections
   - Try restarting both the Ecobee and the Bridge

5. **Pairing Initialization Timeout**
   - The pairing process has a 45-second timeout
   - If it times out, check:
     - Is the Ecobee actually in pairing mode? (Check the screen)
     - Are both devices on the same network?
     - Is the pairing code correct?
   - Try restarting the Ecobee and enabling pairing mode again

**Error Messages Explained:**

- `"Pairing initialization timed out"` - Device didn't respond within 10 seconds. Verify pairing mode is active on Ecobee screen, unpair from Apple Home if needed, check network connectivity.

- `"Pairing timed out"` - The pairing process took longer than 30 seconds. Verify code matches Ecobee screen exactly, wait 30 seconds and try again with same code.

- `"Device is already paired to another controller"` - Unpair from Apple HomeKit first (see #2 above).

- `"Device not found. Please discover devices first"` - Run discovery first, then use the device_id from the results.

**Device Shows "Paired but Not Reachable"**

- The bridge automatically refreshes device IP addresses when connection fails
- Wait a few seconds for automatic reconnection
- If it persists:
  1. Check that the Ecobee is powered on and connected to Wi-Fi
  2. Verify the Ecobee's IP address hasn't changed (check your router)
  3. Try unpairing and re-pairing the device

---

## Advanced Topics

### Setting a Static IP Address

If your bridge IP address keeps changing after power outages, you can set a static IP. See `docs/SET-STATIC-IP-MINI-COMPUTER.md` for detailed instructions.

### Remote Access (VPN) - Optional

To control your thermostat when away from home, or to enable remote support access, you can set up Tailscale:

**Benefits:**
- ✅ Free and easy to set up
- ✅ Enables remote support (support staff can help you remotely)
- ✅ Access your bridge from anywhere
- ✅ Secure VPN connection

**Setup Instructions:**

1. **SSH into your bridge:**
   ```bash
   ssh user@your-bridge-ip
   ```

2. **Install Tailscale:**
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sudo sh
   ```

3. **Authenticate:**
   ```bash
   sudo tailscale up
   ```
   Visit the URL shown to log in with your email.

4. **Get your Tailscale IP:**
   ```bash
   tailscale ip -4
   ```
   This will show an IP starting with `100.x.x.x`

5. **Share with support (optional):**
   - Your Tailscale IP will appear in Bridge Diagnostics → Remote Support Access
   - Include it in support tickets for faster remote assistance

**Note:** This is completely optional. Most users only need local access. Tailscale is mainly useful if you want remote support or to access your bridge when away from home.

### Blueair Air Purifier Control

If you have a Blueair air purifier, you can control it through the bridge. See `docs/BLUEAIR-SETUP-GUIDE.md` for setup instructions.

---

## Quick Reference: How Everything Connects

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR HOME NETWORK                       │
│                                                            │
│  ┌──────────────┐                                          │
│  │   Internet   │                                          │
│  │   (Netlify)  │                                          │
│  └──────┬───────┘                                          │
│         │ Downloads app                                    │
│         │ (one time)                                       │
│         ▼                                                  │
│  ┌──────────────┐                                          │
│  │   Your       │  ──── Direct connection ────▶          │
│  │   Phone/     │  (http://joule-bridge.local:8080)       │
│  │   Computer   │                                          │
│  │   Browser    │ ◀─── API responses ────                 │
│  └──────────────┘                                          │
│         │                                                  │
│         │ Same WiFi network                                │
│         ▼                                                  │
│  ┌──────────────┐                                          │
│  │   Router     │                                          │
│  │   (WiFi)     │                                          │
│  └──────┬───────┘                                          │
│         │ Ethernet cable                                   │
│         ▼                                                  │
│  ┌──────────────┐         ┌──────────────┐               │
│  │   Mini PC    │────────▶│   Ecobee     │               │
│  │   Bridge     │ HomeKit │ Thermostat   │               │
│  │              │ Protocol│              │               │
│  └──────────────┘         └──────────────┘               │
│                                                            │
│  ✅ All communication stays on YOUR network               │
│  ✅ Fast, private, and works offline                      │
│                                                            │
└─────────────────────────────────────────────────────────────┘
```

**Summary:**
- The web app runs in **your browser** (not on the internet)
- All API calls go **directly from your browser to the mini PC** (same network)
- The mini PC connects to your **Ecobee thermostat** via HomeKit
- **Nothing goes through the internet** after the initial app download
- **Works offline** once the app is loaded

---

## Need Help?

- Check the troubleshooting section above
- **Submit a support ticket**: Go to Tools → Support Ticket in the app
- The support ticket automatically includes diagnostic information to help us help you faster
- If you have Tailscale installed, your remote access IP will be included in the ticket
- For technical installation help, see `docs/BRIDGE-INSTALLATION-GUIDE.md` (for developers/advanced users)

---

**That's it! Simple as plugging in a lamp. Enjoy your Joule HVAC system!** 🏠✨

