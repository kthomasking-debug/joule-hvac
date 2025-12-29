# WiFi Setup for Mini Computer (Headless)

This guide covers connecting your mini computer to WiFi when you don't have a keyboard/screen.

## Method 1: Pre-Configure WiFi (Before First Boot) - Raspberry Pi

If you're using a Raspberry Pi and haven't booted it yet, you can pre-configure WiFi:

### Step 1: Create WiFi Configuration File

1. **Insert the SD card** into your computer
2. **Create a file** named `wpa_supplicant.conf` in the `boot` partition (the one you can see in Windows/Mac)
3. **Add this content** (replace with your WiFi details):

```conf
country=US
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1

network={
    ssid="YOUR_WIFI_NAME"
    psk="YOUR_WIFI_PASSWORD"
    scan_ssid=1
}
```

**Important:**
- Replace `YOUR_WIFI_NAME` with your actual WiFi network name (SSID)
- Replace `YOUR_WIFI_PASSWORD` with your actual WiFi password
- Change `country=US` to your country code if different (e.g., `GB`, `CA`, `AU`)

### Step 2: Enable SSH (Also Before First Boot)

Create an empty file named `ssh` (no extension) in the `boot` partition. This enables SSH on first boot.

### Step 3: Boot the Pi

Insert the SD card and power on. The Pi will:
- Connect to WiFi automatically
- Enable SSH
- You can then SSH in using the IP address from your router

## Method 2: Connect via Ethernet First (Then Configure WiFi)

If the mini computer is already running or you can't pre-configure:

### Step 1: Connect Ethernet Cable

1. Connect an Ethernet cable from your router to the mini computer
2. Wait 30 seconds for it to get an IP address
3. Check your router's settings page for the connected device's IP
4. Or use network scanner: `nmap -sn 192.168.1.0/24`

### Step 2: SSH In

```bash
ssh username@MINI_COMPUTER_IP
```

### Step 3: Configure WiFi via SSH

**For Raspberry Pi OS (Raspbian):**

```bash
# Use raspi-config (interactive menu)
sudo raspi-config
# Navigate to: System Options → Wireless LAN
# Enter your SSID and password
```

**Or manually edit wpa_supplicant.conf:**

```bash
sudo nano /etc/wpa_supplicant/wpa_supplicant.conf
```

Add:
```conf
network={
    ssid="YOUR_WIFI_NAME"
    psk="YOUR_WIFI_PASSWORD"
}
```

Save (Ctrl+X, Y, Enter), then:
```bash
sudo wpa_cli -i wlan0 reconfigure
```

**For Ubuntu/Debian:**

```bash
# Use nmtui (text-based network manager)
sudo nmtui

# Or use netplan (Ubuntu 18.04+)
sudo nano /etc/netplan/50-cloud-init.yaml
```

Add WiFi configuration:
```yaml
network:
  version: 2
  wifis:
    wlan0:
      dhcp4: true
      access-points:
        "YOUR_WIFI_NAME":
          password: "YOUR_WIFI_PASSWORD"
```

Then apply:
```bash
sudo netplan apply
```

## Method 3: Use NetworkManager (Modern Linux)

If your system uses NetworkManager:

```bash
# Interactive tool
sudo nmtui

# Or command line
sudo nmcli device wifi list
sudo nmcli device wifi connect "YOUR_WIFI_NAME" password "YOUR_WIFI_PASSWORD"
```

## Method 4: Check Current Connection Status

Once connected, verify:

```bash
# Check WiFi connection
iwconfig

# Check IP address
hostname -I
# or
ip addr show wlan0

# Test connectivity
ping -c 3 8.8.8.8
```

## Troubleshooting

### WiFi Not Showing Up

```bash
# Check if WiFi is enabled
rfkill list

# Unblock if soft-blocked
sudo rfkill unblock wifi

# Check WiFi interface
ip link show
```

### Can't Connect to WiFi

1. **Check password is correct** - WiFi passwords are case-sensitive
2. **Check SSID is correct** - Some networks hide SSID, you may need `scan_ssid=1`
3. **Check WiFi adapter** - Some mini computers need USB WiFi adapter
4. **Check router settings** - Some routers block new devices (MAC filtering)

### Find WiFi Network Name (SSID)

If you don't know your WiFi name:
- Check your router's settings page
- Check another connected device's WiFi settings
- Use `sudo iwlist wlan0 scan` to see available networks

### Get IP Address After Connecting

```bash
# Check IP
hostname -I

# Or more detailed
ip addr show wlan0 | grep "inet "

# Check router's DHCP client list
# (Log into router settings page)
```

## Quick Reference

**Pre-configure (Raspberry Pi):**
1. Create `wpa_supplicant.conf` on SD card boot partition
2. Create empty `ssh` file on boot partition
3. Boot - automatically connects

**Post-boot (Any Linux):**
1. Connect Ethernet cable
2. SSH in via Ethernet IP
3. Configure WiFi using `raspi-config`, `nmtui`, or `netplan`
4. Disconnect Ethernet, WiFi takes over

**Verify Connection:**
```bash
hostname -I  # Shows IP address
ping 8.8.8.8  # Tests internet connectivity
```

## Next Steps

Once WiFi is connected:
1. ✅ Note the IP address: `hostname -I`
2. ✅ You can disconnect Ethernet (if used)
3. ✅ SSH in via WiFi IP
4. ✅ Continue with bridge installation from `INSTALL.txt`

