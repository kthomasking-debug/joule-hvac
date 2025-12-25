# Set Static IP on Mini Computer (No Router Access Needed)

This guide shows how to set a static IP address on your mini computer so it always uses the same IP, even after power outages. **You don't need to access your router** - everything is configured on the mini computer itself.

## Prerequisites

- SSH access to your mini computer (or keyboard/screen)
- Know your current IP address: `hostname -I`
- Know your router's IP address (usually `192.168.0.1` or `192.168.1.1`)

## Step 1: Find Your Current Network Information

SSH into your mini computer and run:

```bash
# Get current IP address
hostname -I

# Get router IP (gateway)
ip route | grep default

# Get DNS servers (usually same as router)
cat /etc/resolv.conf | grep nameserver
```

**Example output:**
```
Current IP: 192.168.0.100
Router IP: 192.168.0.1
DNS: 192.168.0.1
```

**Write these down** - you'll need them!

## Step 2: Choose Your Static IP

Pick an IP address that:
- ✅ Is on the same network (e.g., if current is `192.168.0.100`, use `192.168.0.XXX`)
- ✅ Is not already in use
- ✅ Is outside your router's DHCP range (to avoid conflicts)

**Good choices:**
- `192.168.0.100` (if that's your current IP)
- `192.168.0.200` (high number, less likely to conflict)
- `192.168.0.50` (low number, usually safe)

## Step 3: Set Static IP (Choose Your OS)

### For Raspberry Pi OS (Raspbian) - Bookworm 2024+

**Use NetworkManager (easiest):**

```bash
# Interactive tool
sudo nmtui
```

**Steps in nmtui:**
1. Select "Edit a connection"
2. Select your connection (WiFi or Ethernet)
3. Select "Edit"
4. Go to "IPv4 CONFIGURATION"
5. Change from "Automatic" to "Manual"
6. Select "Addresses" and press Enter
7. Add: `192.168.0.100/24` (replace with your chosen IP)
8. Select "Gateway" and enter: `192.168.0.1` (your router IP)
9. Select "DNS servers" and enter: `192.168.0.1 8.8.8.8`
10. Select "OK"
11. Select "Back"
12. Select "Quit"
13. Reboot: `sudo reboot`

**Or use command line:**
```bash
# For WiFi
sudo nmcli connection modify "Wired connection 1" ipv4.method manual ipv4.addresses 192.168.0.100/24 ipv4.gateway 192.168.0.1 ipv4.dns "192.168.0.1 8.8.8.8"

# For WiFi (connection name might be different)
sudo nmcli connection show
# Find your WiFi connection name, then:
sudo nmcli connection modify "Wi-Fi" ipv4.method manual ipv4.addresses 192.168.0.100/24 ipv4.gateway 192.168.0.1 ipv4.dns "192.168.0.1 8.8.8.8"

# Apply changes
sudo nmcli connection down "Wi-Fi"  # or "Wired connection 1"
sudo nmcli connection up "Wi-Fi"    # or "Wired connection 1"
```

### For Raspberry Pi OS (Raspbian) - Bullseye or Earlier

**Edit dhcpcd.conf:**

```bash
sudo nano /etc/dhcpcd.conf
```

**Add at the end of the file:**

**For WiFi:**
```
interface wlan0
static ip_address=192.168.0.100/24
static routers=192.168.0.1
static domain_name_servers=192.168.0.1 8.8.8.8
```

**For Ethernet:**
```
interface eth0
static ip_address=192.168.0.100/24
static routers=192.168.0.1
static domain_name_servers=192.168.0.1 8.8.8.8
```

**Save and exit:**
- Press `Ctrl+X`
- Press `Y` to confirm
- Press `Enter`

**Reboot:**
```bash
sudo reboot
```

### For Ubuntu/Debian (netplan)

```bash
# Find your netplan config file
ls /etc/netplan/

# Edit it (usually 50-cloud-init.yaml or similar)
sudo nano /etc/netplan/50-cloud-init.yaml
```

**For WiFi, replace the file content with:**
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

**For Ethernet, replace with:**
```yaml
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: false
      addresses:
        - 192.168.0.100/24
      routes:
        - to: default
          via: 192.168.0.1
      nameservers:
        addresses: [192.168.0.1, 8.8.8.8]
```

**Apply changes:**
```bash
sudo netplan apply
```

**If it doesn't work, try:**
```bash
sudo netplan --debug apply
```

## Step 4: Verify Static IP

After reboot or applying changes:

```bash
# Check IP address
hostname -I

# Should show your static IP: 192.168.0.100

# Test internet connectivity
ping -c 3 8.8.8.8

# Test router connectivity
ping -c 3 192.168.0.1
```

## Step 5: Test Bridge Connection

```bash
# Bridge should still be accessible at the new static IP
curl http://192.168.0.100:8080/health
```

## Troubleshooting

### Can't Connect After Setting Static IP

**Problem:** Lost network connection after setting static IP

**Solutions:**
1. **Check IP is correct:**
   ```bash
   hostname -I
   ```

2. **Check gateway is correct:**
   ```bash
   ip route | grep default
   ```

3. **Verify you're on the right network:**
   - Your static IP must be on the same subnet
   - If router is `192.168.0.1`, use `192.168.0.XXX`
   - If router is `192.168.1.1`, use `192.168.1.XXX`

4. **Revert to DHCP (if needed):**
   ```bash
   # Raspberry Pi (old method)
   sudo nano /etc/dhcpcd.conf
   # Comment out or remove the static IP lines
   sudo reboot
   
   # Ubuntu/Debian (netplan)
   sudo nano /etc/netplan/50-cloud-init.yaml
   # Change dhcp4: false to dhcp4: true
   # Remove addresses and routes sections
   sudo netplan apply
   ```

### IP Conflict (Another Device Using Same IP)

**Symptoms:** Can't connect, network errors

**Solution:** Choose a different IP address:
- Try `192.168.0.200` or `192.168.0.50`
- Avoid common IPs like `.1` (router), `.100` (if in use)

### Can't Access Router Admin Page

**If you set static IP and can't access router:**
- Your router IP might be different
- Check: `ip route | grep default` to see gateway
- Try: `192.168.1.1` or `192.168.0.1`

## Quick Reference

**Find current network info:**
```bash
hostname -I              # Current IP
ip route | grep default # Router IP
cat /etc/resolv.conf     # DNS servers
```

**Set static IP (Raspberry Pi - old method):**
```bash
sudo nano /etc/dhcpcd.conf
# Add static IP config
sudo reboot
```

**Set static IP (Raspberry Pi - new method):**
```bash
sudo nmtui
# Use interactive menu
sudo reboot
```

**Set static IP (Ubuntu/Debian):**
```bash
sudo nano /etc/netplan/50-cloud-init.yaml
# Edit YAML config
sudo netplan apply
```

**Verify it worked:**
```bash
hostname -I  # Should show your static IP
ping 8.8.8.8  # Should work
```

## After Setting Static IP

✅ **IP address will never change** - even after power outages
✅ **Bridge will always be at the same IP** - no need to update web app
✅ **Works automatically** - no router configuration needed

**Update your web app:**
- Go to Settings → Joule Bridge Settings
- Enter: `http://192.168.0.100:8080` (your static IP)
- Click Save
- This IP will never change!

