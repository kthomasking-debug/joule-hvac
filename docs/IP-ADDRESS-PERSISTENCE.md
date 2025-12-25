# IP Address Persistence After Power Outage

## The Problem

After a power outage and restart, your mini computer's IP address **might change**. This depends on how your router assigns IP addresses.

## How IP Addresses Work

### DHCP (Default - IP Can Change)

Most routers use **DHCP** (Dynamic Host Configuration Protocol):
- Router assigns IP addresses automatically
- When device restarts, router may assign a **different IP**
- Router tries to give same IP to same device (based on MAC address), but **not guaranteed**

**Result:** Your mini computer might get a new IP like `192.168.0.105` instead of `192.168.0.100`

### Static IP (Guaranteed - IP Never Changes)

You can configure the mini computer to use a **static IP**:
- IP address is fixed and never changes
- Even after power outage, same IP
- Requires configuration on the mini computer

## Solutions

### Solution 1: DHCP Reservation (Recommended - Easiest)

Configure your **router** to always assign the same IP to your mini computer:

1. **Log into your router** (usually `http://192.168.0.1` or `http://192.168.1.1`)
2. **Find "DHCP Reservations"** or **"Static DHCP"** or **"Address Reservation"**
3. **Find your mini computer** in the connected devices list
4. **Reserve IP `192.168.0.100`** for your mini computer's MAC address
5. **Save settings**

**Benefits:**
- ✅ IP address never changes
- ✅ No configuration needed on mini computer
- ✅ Works automatically after restart
- ✅ Easy to set up

**How it works:**
- Router remembers: "MAC address XX:XX:XX:XX:XX:XX always gets 192.168.0.100"
- Even after power outage, router assigns same IP

### Solution 2: Static IP on Mini Computer

Configure the mini computer itself to use a static IP:

**For Raspberry Pi OS (Raspbian):**

**Option A: NetworkManager (Raspberry Pi OS Bookworm 2024+)**
```bash
sudo nmtui
# Navigate to: Edit a connection → Select your connection
# Set IPv4 configuration to: Manual
# Set IP address: 192.168.0.100
# Set Gateway: 192.168.0.1 (your router)
# Set DNS: 192.168.0.1 8.8.8.8
```

**Option B: Legacy Method (Pre-Bookworm)**
```bash
sudo nano /etc/dhcpcd.conf
```

Add:
```
interface wlan0  # or eth0 for Ethernet
static ip_address=192.168.0.100/24
static routers=192.168.0.1
static domain_name_servers=192.168.0.1 8.8.8.8
```

Then:
```bash
sudo reboot
```

**For Ubuntu/Debian:**
```bash
sudo nano /etc/netplan/50-cloud-init.yaml
```

Add:
```yaml
network:
  version: 2
  wifis:
    wlan0:
      dhcp4: false
      addresses:
        - 192.168.0.100/24
      routes:
        - to: default
          via: 192.168.0.1
      nameservers:
        addresses: [192.168.0.1, 8.8.8.8]
```

Then:
```bash
sudo netplan apply
```

**Important:** Make sure the IP you choose (e.g., `192.168.0.100`) is:
- ✅ Not already in use by another device
- ✅ Outside your router's DHCP range (check router settings)
- ✅ On the same subnet (192.168.0.x if your network is 192.168.0.0/24)

### Solution 3: Dynamic DNS (Advanced)

Use a service like DuckDNS or No-IP to get a hostname that always points to your mini computer:
- Set up dynamic DNS client on mini computer
- Use hostname like `mybridge.duckdns.org` instead of IP
- Hostname updates automatically if IP changes

**Not recommended** for local network use - DHCP reservation is simpler.

## What Happens If IP Changes?

### If IP Changes and You Don't Update Web App:

1. **Web app tries to connect** to old IP (`192.168.0.100`)
2. **Connection fails** - bridge not found
3. **User sees:** "Bridge Status: Not Available"
4. **Solution:** User needs to update bridge URL in Settings

### How to Find New IP After Restart:

1. **Check router admin page:**
   - Log into router
   - Look at "Connected Devices"
   - Find your mini computer (look for hostname or MAC address)

2. **Scan network:**
   ```bash
   nmap -sn 192.168.0.0/24
   # Look for device with port 8080 open
   nmap -p 8080 192.168.0.0/24
   ```

3. **From mini computer (if you can access it):**
   ```bash
   hostname -I
   ```

## Best Practice: DHCP Reservation

**Recommended approach:**
1. ✅ Set up DHCP reservation on router (Solution 1)
2. ✅ IP address never changes
3. ✅ No configuration needed on mini computer
4. ✅ Works automatically after power outage

## Testing After Power Outage

After a power outage and restart:

1. **Wait 1-2 minutes** for mini computer to boot and connect
2. **Check if bridge is running:**
   ```bash
   curl http://192.168.0.100:8080/health
   ```
3. **If IP changed, find new IP:**
   - Check router admin page
   - Or scan network for port 8080
4. **Update web app** with new IP (if changed)

## Summary

| Method | IP Changes? | Setup Difficulty | Recommended? |
|--------|-------------|------------------|--------------|
| DHCP (default) | ⚠️ May change | ✅ None | ❌ No |
| DHCP Reservation | ✅ Never changes | ✅ Easy | ✅ **Yes** |
| Static IP | ✅ Never changes | ⚠️ Medium | ✅ Yes |
| Dynamic DNS | ✅ Never changes | ❌ Complex | ❌ Overkill |

**Recommendation:** Use **DHCP Reservation** on your router - it's the easiest and most reliable solution.

