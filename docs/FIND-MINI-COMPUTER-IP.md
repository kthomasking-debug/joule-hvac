# How to Find Your Mini Computer's IP Address

## Method 1: Check Router Admin Page (Easiest)

1. **Log into your router:**
   - Open browser: `http://192.168.0.1` (or `http://192.168.1.1`)
   - Enter router username/password (check router label)

2. **Look for "Connected Devices" or "DHCP Clients"**

3. **Find your mini computer:**
   - Look for hostname: `tom pc`, `raspberrypi`, `joule-bridge`, etc.
   - Note the IP address next to it

## Method 2: Network Scanner

From your main computer:

```bash
# Scan network
nmap -sn 192.168.0.0/24

# Look for your mini computer in the results
# Or scan for port 8080 (bridge server)
nmap -p 8080 192.168.0.0/24
```

## Method 3: From Mini Computer Itself

If you can access the mini computer (SSH or keyboard/screen):

```bash
# Get IP address
hostname -I

# Or
ip addr show

# Or check which device has port 8080
sudo netstat -tlnp | grep 8080
```

## Method 4: Check Bridge Logs

If the bridge is running, check the logs:

```bash
# SSH into mini computer
ssh pi@MINI_COMPUTER_IP

# Check logs for IP
sudo journalctl -u prostat-bridge | grep -i "listening\|http"
```

## After Finding IP

1. **Test bridge is running:**
   ```bash
   curl http://MINI_COMPUTER_IP:8080/api/paired
   ```

2. **Update web app:**
   - Settings → Joule Bridge Settings
   - Enter: `http://MINI_COMPUTER_IP:8080`
   - Click Save

3. **Verify connection:**
   - Click Refresh
   - Should show "Connected" ✅

## Troubleshooting

**Can't find mini computer:**
- Make sure it's powered ON
- Wait 1-2 minutes after powering on
- Check it's connected to WiFi/Ethernet
- Check router's connected devices list

**IP keeps changing:**
- Set static IP (see `SET-STATIC-IP-MINI-COMPUTER.md`)
- Or use DHCP reservation in router

**Can't access router:**
- Router address is usually `192.168.0.1` or `192.168.1.1`
- Check router label for admin address
- Or ask your internet provider

