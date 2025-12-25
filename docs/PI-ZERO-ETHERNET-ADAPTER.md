# Adding Ethernet to Raspberry Pi Zero 2 W

The Raspberry Pi Zero 2 W **does not have a built-in Ethernet port** - it only has WiFi. To use Ethernet, you need a **USB-to-Ethernet adapter**.

## What You Need

### USB-to-Ethernet Adapter

**For Pi Zero 2 W (Micro USB):**
- **USB 2.0 to Ethernet Adapter** (~$8-15)
- Connects to the **USB port** (not the power port)
- Uses **ASIX AX88179** or **Realtek RTL8153** chipset (most common, well-supported)

**Recommended Adapters:**
- **Plugable USB2-OTGE100** (~$12-15) ⭐ **RECOMMENDED**
  - ASIX AX88772A chipset
  - Specifically tested with Raspberry Pi Zero 2 W
  - Works out of the box with Raspberry Pi OS
  - Includes micro USB connector (no adapter needed!)

- **UGREEN USB 2.0 to Ethernet Adapter** (~$10)
  - ASIX AX88179 chipset
  - Works out of the box with Raspberry Pi OS
  - Reliable and widely available
  - May need micro USB adapter

- **Cable Matters USB to Ethernet Adapter** (~$12)
  - Realtek RTL8153 chipset
  - Good compatibility
  - May need micro USB adapter

- **Anker USB 3.0 to Ethernet Adapter** (~$15)
  - Works on USB 2.0 ports (Pi Zero 2 W)
  - Future-proof if you upgrade
  - May need micro USB adapter

**Note:** Pi Zero 2 W has **micro USB** ports, so you may also need:
- **Micro USB to USB-A adapter** (if adapter has USB-A plug)
- Or get an adapter with **micro USB plug** (less common)

## Connection Setup

### Option 1: Direct Connection (If Adapter Has Micro USB)

```
Ethernet Cable → USB-to-Ethernet Adapter → Pi Zero 2 W USB Port
```

### Option 2: With Adapter Cable (Most Common)

```
Ethernet Cable → USB-to-Ethernet Adapter → Micro USB to USB-A Adapter → Pi Zero 2 W
```

**Parts needed:**
1. USB-to-Ethernet adapter (USB-A plug)
2. Micro USB to USB-A adapter/OTG cable (~$2-5)

## Alternative Options

### Option 1: USB Hub with Ethernet

**USB Hub with Ethernet Port** (~$15-25)
- Provides both Ethernet AND additional USB ports
- More expensive but more versatile
- Good if you need multiple USB devices

### Option 2: Ethernet and USB Hub HAT/pHAT ⭐ **PROFESSIONAL OPTION**

**pHAT (Hardware Attached on Top)** - Connects to GPIO pins, more permanent solution

**Recommended HATs:**

1. **Waveshare Ethernet / USB HUB HAT** (~$25-30) ⭐ **BEST VALUE**
   - 10/100M Ethernet port
   - 3x USB 2.0 ports
   - Fits Pi Zero 2 W perfectly
   - Professional appearance
   - Available from Waveshare

2. **Waveshare PoE Ethernet / USB HUB HAT** (~$35-40) ⭐ **PREMIUM**
   - 10/100M Ethernet port
   - **Power over Ethernet (PoE)** - power via Ethernet cable!
   - 3x USB 2.0 ports
   - No separate power adapter needed (if router supports PoE)
   - Most professional solution

3. **Cytron Ethernet and USB Hub pHAT** (~$25-30)
   - RJ45 Ethernet port
   - 3x USB ports
   - Designed for Pi Zero series
   - Good quality

4. **PiJack Ethernet HAT** (~$15-20) - **BUDGET OPTION**
   - 10Mbps Ethernet (slower, but cheaper)
   - Connects to GPIO
   - Leaves USB port free
   - Basic but functional

**HAT Advantages:**
- ✅ More permanent/professional installation
- ✅ Doesn't use USB port (leaves it free)
- ✅ Often includes extra USB ports
- ✅ Cleaner appearance
- ✅ Some support Power over Ethernet (PoE)

**HAT Disadvantages:**
- ⚠️ More expensive than USB adapter
- ⚠️ Makes Pi larger (may not fit in some cases)
- ⚠️ Requires GPIO connection (more complex)

### Option 3: Adapter Board

**Adapter Board** (~$20-30)
- Transforms Pi Zero 2 W into Pi 3/4 form factor
- Adds full-sized USB ports + Ethernet
- Example: Spotpear adapter board
- **Note:** Significantly increases size

## Compatibility

### Automatic Detection

Raspberry Pi OS **automatically detects** most USB-to-Ethernet adapters:
- ASIX AX88179 (most common)
- Realtek RTL8152/8153
- Many others

**No driver installation needed** - just plug it in!

### Check if Detected

After plugging in:

```bash
# Check if Ethernet interface appears
ip link show

# Should see "eth0" or "enp0s..." interface
# Example output:
# 2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> ...
```

### If Not Detected

Some adapters need drivers:

```bash
# Install drivers for ASIX adapters
sudo apt update
sudo apt install -y linux-modules-extra-raspi

# Or for Realtek
sudo apt install -y r8152-dkms

# Reboot
sudo reboot
```

## Power Considerations

**Important:** Pi Zero 2 W may need more power when using USB Ethernet adapter.

### Option 1: Use Powered USB Hub
- USB hub with its own power supply
- Provides power to both Pi and Ethernet adapter
- Most reliable option

### Option 2: High-Capacity Power Supply
- Use **2.5A or higher** power supply (official Pi supply recommended)
- Should handle Ethernet adapter + Pi

### Option 3: Power via USB Hub Port
- Some USB hubs can power the Pi via USB
- Check hub specifications

## Shopping List

**Minimum Setup:**
- ✅ Raspberry Pi Zero 2 W
- ✅ USB-to-Ethernet adapter (~$10)
- ✅ Micro USB to USB-A adapter/OTG cable (~$3)
- ✅ Ethernet cable (~$5)
- ✅ Power supply (2.5A+ recommended)

**Total:** ~$18 extra for Ethernet capability

## Setup Instructions

### Step 1: Connect Adapter

1. **Plug Ethernet cable** into adapter
2. **Plug adapter** into Pi Zero 2 W USB port (via adapter cable if needed)
3. **Plug Ethernet cable** into router
4. **Power on** Pi Zero 2 W

### Step 2: Verify Connection

```bash
# Check if Ethernet interface is detected
ip link show

# Check IP address
hostname -I

# Test connectivity
ping -c 3 8.8.8.8
```

### Step 3: Configure (If Needed)

Ethernet should work automatically via DHCP. If you need static IP:

```bash
# Edit network config
sudo nano /etc/dhcpcd.conf

# Add:
interface eth0
static ip_address=192.168.0.200/24
static routers=192.168.0.1
static domain_name_servers=192.168.0.1 8.8.8.8

# Reboot
sudo reboot
```

## For Your Use Case (End Users)

**Recommendation:** Include USB-to-Ethernet adapter in package

**Why:**
- ✅ More reliable than WiFi
- ✅ No WiFi password needed
- ✅ Easier for non-technical users
- ✅ Plug and play

**Package Contents:**
- ✅ Raspberry Pi Zero 2 W
- ✅ Case
- ✅ Power adapter
- ✅ **USB-to-Ethernet adapter** (add this!)
- ✅ **Micro USB to USB-A adapter** (if needed)
- ✅ Ethernet cable
- ✅ Instruction sheet

**Cost Impact:** ~$10-15 per unit

## Alternative: Use WiFi Instead

If you want to avoid the adapter:

1. **Pre-configure WiFi** on SD card (via Raspberry Pi Imager)
2. **Enable SSH** on SD card
3. **Boot and connect** via WiFi automatically
4. **User doesn't need to configure anything**

**Trade-off:**
- ⚠️ User needs WiFi password (but you can pre-configure)
- ⚠️ WiFi can be less reliable than Ethernet
- ✅ No extra hardware needed

## Recommendation

**For selling to non-technical users:**

**Option A: Include Ethernet Adapter (Recommended)**
- More reliable
- Easier setup (just plug in)
- Worth the extra $10-15

**Option B: Pre-Configure WiFi**
- No extra hardware
- User just needs to plug in power
- WiFi must be pre-configured on SD card

**Best of Both:** Pre-configure WiFi AND include Ethernet adapter as backup option.

## Quick Reference

**Adapter to Buy (Best Option):**
- **Plugable USB2-OTGE100** (~$12-15) ⭐
- ASIX AX88772A chipset
- Includes micro USB connector (no adapter needed!)
- Specifically tested with Pi Zero 2 W
- Works out of the box

**Alternative:**
- UGREEN USB 2.0 to Ethernet Adapter (~$10)
- ASIX AX88179 chipset
- Works out of the box
- May need micro USB adapter

**Connection:**
```
Router → Ethernet Cable → USB Adapter → Micro USB Adapter → Pi Zero 2 W
```

**Verification:**
```bash
ip link show  # Should see eth0
hostname -I   # Should show IP address
```

