# Simple Setup Guide for End Users

> **⚠️ This guide has been consolidated into `USER_MANUAL.md`**  
> **Please see `docs/USER_MANUAL.md` for the complete, up-to-date user manual with table of contents.**

**For people who just want it to work - no technical knowledge needed!**

## What's in the Box

- ✅ Mini computer (already set up)
- ✅ Power adapter
- ✅ Ethernet cable
- ✅ This instruction sheet

## How It Works (Simple Explanation)

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

## Setup (Takes 2 Minutes)

### Step 1: Plug It In

1. **Plug the Ethernet cable** into your WiFi router (any open port)
2. **Plug the other end** into the mini computer
3. **Plug in the power adapter** to the mini computer
4. **Wait 2 minutes** for it to start up

**That's it!** The mini computer is now connected to your network.

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

### Step 4: Pair Your Ecobee

**How Pairing Works:**

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

1. **On your Ecobee thermostat:**
   - Menu → Settings → Installation Settings → HomeKit
   - Make sure HomeKit is **enabled**
   - Write down the **8-digit pairing code** (looks like `640-54-831`)

2. **In your web app:**
   - Settings → Joule Bridge Settings
   - Click **"Discover"** button
   - Enter the **pairing code** from your Ecobee
   - Click **"Pair"**
   - Wait 30 seconds

**Done!** Your Ecobee is now connected.

## Troubleshooting

### "Can't Find Bridge" or "Not Connected"

**Visual Check:**

```
┌─────────────────────────────────────────────────────┐
│  Check these connections:                            │
│                                                      │
│  Router ────[Ethernet Cable]───▶ Mini PC            │
│    │                                    │            │
│    │                                    │            │
│    │                                    ▼            │
│    │                              [Power Plug]       │
│    │                                    │            │
│    │                                    ▼            │
│    │                              [Power Outlet]     │
│    │                                                 │
│    └───[WiFi]───▶ Your Phone/Computer               │
│                                                      │
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

## Need Help?

- Check the troubleshooting guide
- Contact support with your router's IP address and the MAC address from the sticker

---

**That's it! Simple as plugging in a lamp.**

