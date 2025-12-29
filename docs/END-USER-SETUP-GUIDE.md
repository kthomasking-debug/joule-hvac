# Simple Setup Guide for End Users

**For people who just want it to work - no technical knowledge needed!**

## What's in the Box

- ✅ Mini computer (already set up)
- ✅ Power adapter
- ✅ Ethernet cable
- ✅ This instruction sheet

## Setup (Takes 2 Minutes)

### Step 1: Plug It In

1. **Plug the Ethernet cable** into your WiFi router (any open port)
2. **Plug the other end** into the mini computer
3. **Plug in the power adapter** to the mini computer
4. **Wait 2 minutes** for it to start up

**That's it!** The mini computer is now connected to your network.

### Step 2: Find Your Bridge

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

1. **Check the Ethernet cable** is plugged into router
2. **Check the power** is plugged in
3. **Wait 2 more minutes** - it takes time to start
4. **Check your router** - look for "Joule Bridge" in connected devices
5. **Try a different Ethernet port** on your router

### "Can't Access Router"

- Router address is usually `192.168.0.1` or `192.168.1.1`
- Check the label on your router for the admin address
- Or ask your internet provider

### "Bridge IP Changed After Power Outage"

- This is normal - just find the new IP in your router
- Or see the "Set Static IP" guide (optional, advanced)

## Need Help?

- Check the troubleshooting guide
- Contact support with your router's IP address and the MAC address from the sticker

---

**That's it! Simple as plugging in a lamp.**

