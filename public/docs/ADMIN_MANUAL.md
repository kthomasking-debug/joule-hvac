# Joule HVAC Support Manual

**For Support Staff**

This manual covers remote support, troubleshooting, and management of Joule HVAC bridges deployed at customer locations.

---

## Table of Contents

1. [Overview](#overview)
2. [Remote Support Architecture](#remote-support-architecture)
3. [Accessing Customer Bridges](#accessing-customer-bridges)
4. [Support Ticket Workflow](#support-ticket-workflow)
5. [Bridge Diagnostics Interface](#bridge-diagnostics-interface)
6. [Remote Actions](#remote-actions)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Tailscale Setup for Customers](#tailscale-setup-for-customers)
9. [Common Issues and Solutions](#common-issues-and-solutions)

---

## Overview

Joule HVAC bridges run on mini PCs at customer locations. Support staff can access these bridges remotely using:

- **Tailscale VPN** (recommended) - Direct remote access
- **Support Tickets** - Customer-submitted diagnostic reports
- **Bridge Diagnostics Interface** - Web-based remote management

---

## Remote Support Architecture

### How Remote Access Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CUSTOMER'S HOME (1000 miles away)                │
│                                                                      │
│   ┌──────────────┐         ┌──────────────────────────────────┐     │
│   │  Customer    │         │  Mini PC Bridge                  │     │
│   │  opens       │         │                                  │     │
│   │  Bridge      │  local  │  Local IP: 192.168.0.106:8080   │     │
│   │  Diagnostics │ ──────► │  Tailscale: 100.102.98.23:8080 │     │
│   └──────────────┘  WiFi   └──────────────────────────────────┘     │
│         │                                                            │
│         │ 1. Customer views diagnostics                             │
│         │ 2. Customer copies diagnostic report                      │
│         │ 3. Customer submits support ticket                       │
│         ▼                                                            │
└─────────────────────────────────────────────────────────────────────┘
          │
          │ Support Ticket (via email)
          │ Contains: diagnostic report, Tailscale IP, logs
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPPORT STAFF LOCATION                      │
│                                                                      │
│   ┌──────────────┐                                                  │
│   │  You receive │  Email: kthomasking@gmail.com                   │
│   │  ticket with │  Contains full diagnostic report                │
│   │  diagnostic  │                                                  │
│   │  report      │                                                  │
│   └──────────────┘                                                  │
│         │                                                            │
│         │ If Tailscale IP provided:                                 │
│         ▼                                                            │
│   ┌──────────────┐                                                  │
│   │  You open    │  Paste: http://100.102.98.23:8080               │
│   │  Bridge      │  into Bridge URL field                          │
│   │  Support     │                                                  │
│   └──────────────┘                                                  │
│         │                                                            │
│         │ Tailscale VPN (if customer has it installed)             │
│         ▼                                                            │
│   Full remote access: OTA updates, logs, diagnostics, restart       │
└─────────────────────────────────────────────────────────────────────┘
```

### Network Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CUSTOMER NETWORK                            │
│                                                                      │
│   ┌──────────────┐                                                  │
│   │   Router     │  192.168.0.1                                     │
│   │   (NAT)      │                                                  │
│   └──────┬───────┘                                                  │
│          │                                                           │
│          ├──► 192.168.0.106  Mini PC (Bridge)                      │
│          │                                                           │
│          └──► 192.168.0.101  Ecobee Thermostat                      │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │  Tailscale VPN (if installed)                                 │ │
│   │  Creates secure tunnel: 100.102.98.23 ──► Internet ──► You   │ │
│   └──────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Accessing Customer Bridges

### Method 1: Via Tailscale (Recommended)

**Prerequisites:**
- Customer has Tailscale installed on their bridge
- Customer has shared their Tailscale network with you OR
- You've added their device to your Tailscale network

**Steps:**

1. **Open Bridge Diagnostics** (`/tools/bridge-support`)
2. **Paste Tailscale IP** into Bridge URL field:
   ```
   http://100.102.98.23:8080
   ```
   Or use DNS name:
   ```
   http://customer-bridge-name.tail5a52ea.ts.net:8080
   ```
3. **Click "Save & Check"**
4. **You now have full remote access!**

**What you can do:**
- ✅ View real-time logs
- ✅ Check system status
- ✅ Run OTA updates
- ✅ Restart the bridge
- ✅ View pairing diagnostics
- ✅ Kill duplicate processes
- ✅ Copy diagnostic reports

### Method 2: Via Support Ticket

**When customer doesn't have Tailscale:**

1. **Customer submits support ticket** via `/tools/support-ticket`
2. **You receive email** at `kthomasking@gmail.com` with:
   - Customer's issue description
   - Complete diagnostic report
   - System information
   - Recent logs
   - Bridge status

3. **Review diagnostic report** to identify issues
4. **Reply with instructions** via email
5. **If needed, ask customer to install Tailscale** for remote access

---

## Support Ticket Workflow

### Step 1: Customer Submits Ticket

```
Customer fills out form:
├── Name & Email
├── Issue Description
└── Diagnostic Information (auto-included)
         │
         ▼
Email sent to: kthomasking@gmail.com
Subject: [Support] [Customer's Subject]
Body: Complete diagnostic report
```

### Step 2: You Receive Ticket

**Email contains:**

```
=== JOULE BRIDGE DIAGNOSTIC REPORT ===
Generated: 2025-12-29T03:22:36.140Z

--- Connection ---
Bridge URL: http://joule-bridge.local:8080
Connected: Yes
Error: None

--- Version ---
Current Version: 7690144b
Service Path: /home/tom-pc/prostat-bridge

--- Updates ---
Current: 7690144b
Latest: 7690144b
Update Available: No

--- Pairing Diagnostics ---
Status: ok
Discovered Devices: da:04:e9:07:e2:d5
Stored Pairings: None
Issues: Devices available for pairing: ['da:04:e9:07:e2:d5']

--- System Info ---
Hostname: tom-pc-P150HMx
Local IP: 192.168.0.106
Tailscale IP: 100.102.98.23 (REMOTE ACCESS AVAILABLE)
Remote URL: http://100.102.98.23:8080
Platform: Linux-6.14.0-37-generic-x86_64-with-glibc2.39
Uptime: 11h 9m
Memory: 13329MB free (17% used)
Disk: 202.9GB free (6% used)

--- Recent Logs (last 10 lines) ---
[Log entries...]

=== END REPORT ===
```

### Step 3: Analyze and Respond

**If Tailscale IP is present:**
- Use it to access bridge remotely
- Run diagnostics directly
- Perform fixes in real-time

**If no Tailscale IP:**
- Review logs and diagnostics
- Identify issue from report
- Provide step-by-step instructions
- Optionally request Tailscale installation

---

## Bridge Diagnostics Interface

### Accessing Bridge Diagnostics

**URL:** `/tools/bridge-support`

**Features:**

1. **Connection Status**
   - Shows if bridge is online/offline
   - Displays version information
   - Shows update availability

2. **Remote Actions**
   - OTA Update - Pull latest code from GitHub
   - Restart Service - Restart bridge without update
   - Kill Duplicates - Remove duplicate bridge processes

3. **Pairing Diagnostics**
   - Discovered devices count
   - Stored pairings count
   - Issues and recommendations

4. **Process Information**
   - Running instances
   - Process IDs
   - Duplicate detection

5. **System Information**
   - Hostname
   - Local IP
   - **Tailscale IP** (if available)
   - Uptime
   - Memory usage
   - Disk usage
   - Platform info

6. **Live Logs**
   - Real-time log viewing
   - Last 50 lines by default
   - Auto-refreshes every 30 seconds

7. **Diagnostic Report**
   - Copy-paste ready report
   - Includes all system info
   - Perfect for support tickets

### Remote Support Access Section

When Tailscale is active, you'll see:

```
┌─────────────────────────────────────────────────────────────────────┐
│  🎉 Tailscale is active! You can access this bridge remotely:       │
│                                                                      │
│  http://100.102.98.23:8080                    [Copy]                  │
│                                                                      │
│  Also available at: customer-bridge.tail5a52ea.ts.net               │
└─────────────────────────────────────────────────────────────────────┘
```

**To use:**
1. Copy the Tailscale URL
2. Paste into Bridge URL field at top of page
3. Click "Save & Check"
4. Full remote access enabled!

---

## Remote Actions

### OTA Update

**What it does:**
- Pulls latest code from GitHub
- Restarts bridge service
- Connection drops briefly during restart

**When to use:**
- Customer needs latest features
- Bug fixes available
- Version mismatch detected

**Steps:**
1. Open Bridge Diagnostics
2. Click "OTA Update" button
3. Wait 30-60 seconds
4. Click "Refresh" to verify update

**Expected behavior:**
```
Before: Current Version: abc123
After:  Current Version: def456 (latest)
```

### Restart Service

**What it does:**
- Restarts bridge without updating code
- Useful for clearing stuck states
- Faster than OTA update

**When to use:**
- Bridge is unresponsive
- Logs show errors
- Need to clear state

**Steps:**
1. Click "Restart Service"
2. Wait 15 seconds
3. Click "Refresh"

### Kill Duplicates

**What it does:**
- Removes duplicate bridge processes
- Prevents port conflicts
- Ensures single instance running

**When to use:**
- Multiple processes detected
- Port already in use errors
- Bridge won't start

**Steps:**
1. Check "Process Information" section
2. If duplicates found, click "Kill Duplicates"
3. Verify single process running

---

## Troubleshooting Guide

### Bridge is Offline

**Symptoms:**
- "Bridge Offline" status
- Cannot connect to bridge URL
- Health check fails

**Diagnosis Flow:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TROUBLESHOOTING FLOW                             │
│                                                                      │
│  1. Check Physical Connection                                       │
│     ├── Mini PC powered on?                                         │
│     ├── Ethernet cable connected?                                   │
│     └── Router lights active?                                       │
│                                                                      │
│  2. Try Alternative URLs                                            │
│     ├── http://joule-bridge.local:8080 (mDNS)                      │
│     ├── http://192.168.0.106:8080 (local IP)                       │
│     ├── http://192.168.1.100:8080 (alt subnet)                     │
│     └── Check router's device list                                  │
│                                                                      │
│  3. Check Service Status                                            │
│     ├── SSH into bridge: ssh user@IP                               │
│     ├── Check service: sudo systemctl status prostat-bridge        │
│     └── Restart if needed: sudo systemctl restart prostat-bridge   │
│                                                                      │
│  4. If Nothing Works                                                │
│     ├── Service may have crashed                                    │
│     ├── User needs physical access                                  │
│     └── Or install Tailscale for remote access                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Solutions:**

1. **Physical Check**
   - Ask customer to verify power/ethernet
   - Check router's connected devices list
   - Try power cycle (unplug 30 seconds, replug)

2. **URL Alternatives**
   - Try mDNS: `http://joule-bridge.local:8080`
   - Try common IPs: `192.168.0.106`, `192.168.1.100`
   - Check router settings panel for actual IP

3. **Service Restart**
   - If customer has SSH access, guide them:
     ```bash
     ssh user@bridge-ip
     sudo systemctl restart prostat-bridge
     ```
   - Or ask them to physically restart mini PC

4. **Install Tailscale**
   - If service is running but unreachable, install Tailscale
   - See "Tailscale Setup for Customers" section

### Pairing Issues

**Symptoms:**
- "Stored Pairings: 0" but device discovered
- Pairing fails with error
- Device shows as "discovered" but not "paired"

**Solutions:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PAIRING TROUBLESHOOTING                          │
│                                                                      │
│  1. Verify HomeKit Enabled on Ecobee                                │
│     Menu → Settings → Installation Settings → HomeKit               │
│                                                                      │
│  2. Check Pairing Code Format                                       │
│     Accepts: "123-45-678" or "12345678"                             │
│     Must be exactly 8 digits                                        │
│                                                                      │
│  3. Ensure Ecobee Screen Shows Pairing Code                         │
│     Keep screen active during pairing                               │
│     Pairing takes up to 45 seconds                                  │
│                                                                      │
│  4. Check Bridge Logs                                               │
│     Look for pairing errors in Recent Logs section                  │
│     Common errors: timeout, invalid code, device busy                │
│                                                                      │
│  5. Clear Stale Pairings                                            │
│     Use "Clear Stale Pairings" button in diagnostics               │
│     Then retry pairing                                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Update Failures

**Symptoms:**
- OTA update fails
- Version doesn't change after update
- Update button disabled

**Solutions:**

1. **Check Internet Connection**
   - Bridge needs internet to pull from GitHub
   - Verify: `curl https://github.com`

2. **Check Git Repository**
   - Ensure bridge has git access
   - Verify repository path is correct

3. **Manual Update**
   - If OTA fails, guide customer:
     ```bash
     ssh user@bridge-ip
     cd /home/user/prostat-bridge
     git pull origin main
     sudo systemctl restart prostat-bridge
     ```

---

## Tailscale Setup for Customers

### When to Recommend Tailscale

**Recommend Tailscale when:**
- Customer needs remote support
- Bridge is behind strict firewall
- Customer has dynamic IP
- You need to perform remote diagnostics

### Setup Instructions for Customer

**Send this to customer:**

```
To enable remote support access, please install Tailscale on your bridge:

1. SSH into your bridge:
   ssh user@your-bridge-ip

2. Install Tailscale:
   curl -fsSL https://tailscale.com/install.sh | sudo sh

3. Authenticate:
   sudo tailscale up

4. Visit the URL shown to log in with your email

5. Share your Tailscale IP with support:
   - Run: tailscale ip -4
   - Send the IP (starts with 100.x.x.x) to support

Once installed, support can access your bridge remotely!
```

### Adding Customer to Your Network

**Option 1: Customer Shares Network**
- Customer adds you to their Tailscale network
- You automatically see their devices

**Option 2: You Add Customer**
- Customer shares their Tailscale IP
- You add their device to your network
- Requires Tailscale dashboard access

**Option 3: Shared Network**
- Create a shared Tailscale network
- Both you and customers join
- All devices visible to all members

---

## Common Issues and Solutions

### Issue: "Bridge URL not configured"

**Cause:** Customer hasn't set bridge URL in settings

**Solution:**
1. Guide customer to Settings → Joule Bridge Settings
2. Enter bridge URL: `http://joule-bridge.local:8080`
3. Or use IP: `http://192.168.0.106:8080`
4. Click Save

### Issue: "Service Status: Not Available"

**Cause:** Bridge service not running or unreachable

**Solution:**
1. Check if bridge is powered on
2. Verify network connection
3. Check service status via SSH:
   ```bash
   sudo systemctl status prostat-bridge
   ```
4. Restart if needed:
   ```bash
   sudo systemctl restart prostat-bridge
   ```

### Issue: "Update Available but OTA Fails"

**Cause:** Network issues or git repository problems

**Solution:**
1. Check internet connectivity on bridge
2. Verify git repository exists
3. Try manual update (see Update Failures section)

### Issue: "Multiple Processes Running"

**Cause:** Bridge started multiple times

**Solution:**
1. Use "Kill Duplicates" button in Bridge Diagnostics
2. Or manually:
   ```bash
   sudo pkill -f "python3.*server.py"
   sudo systemctl restart prostat-bridge
   ```

### Issue: "Tailscale IP Not Showing"

**Cause:** Tailscale not installed or not running

**Solution:**
1. Check if Tailscale is installed:
   ```bash
   which tailscale
   ```
2. Check if running:
   ```bash
   tailscale status
   ```
3. If not installed, follow Tailscale setup instructions
4. If installed but not running:
   ```bash
   sudo tailscale up
   ```

---

## Quick Reference

### Support Email
- **Address:** kthomasking@gmail.com
- **Subject Format:** `[Support] [Customer Issue]`
- **Auto-includes:** Diagnostic report, system info, logs

### Bridge URLs
- **Local (mDNS):** `http://joule-bridge.local:8080`
- **Local (IP):** `http://192.168.0.106:8080` (varies)
- **Tailscale:** `http://100.102.98.23:8080` (varies per customer)

### Common Commands (via SSH)
```bash
# Check service status
sudo systemctl status prostat-bridge

# Restart service
sudo systemctl restart prostat-bridge

# View logs
sudo journalctl -u prostat-bridge -f

# Check Tailscale
tailscale status
tailscale ip -4

# Check bridge health
curl http://localhost:8080/health
```

### Support Ticket Fields
- **Name:** Customer name
- **Email:** Customer email
- **Subject:** Brief issue description
- **Description:** Detailed problem description
- **Diagnostics:** Auto-included (system info, logs, status)

---

## Best Practices

1. **Always request diagnostic report** before troubleshooting
2. **Use Tailscale when possible** for faster resolution
3. **Document solutions** for common issues
4. **Follow up** after remote fixes to confirm resolution
5. **Keep Tailscale network organized** with clear device names

---

## Appendix: ASCII Diagrams Reference

### Network Topology
```
Internet
   │
   ├──► Your Location (Support Staff)
   │    └──► Tailscale Network
   │         └──► Customer Bridges (100.x.x.x)
   │
   └──► Customer Locations
        └──► Local Networks (192.168.x.x)
             ├──► Mini PC Bridge
             └──► Ecobee Thermostat
```

### Support Workflow
```
Customer Issue
     │
     ▼
Customer Submits Ticket
     │
     ▼
You Receive Email
     │
     ├──► Has Tailscale IP?
     │    ├──► YES: Remote Access
     │    │    └──► Fix via Bridge Diagnostics
     │    │
     │    └──► NO: Email Support
     │         └──► Guide Customer
     │
     ▼
Issue Resolved
```

---

**Last Updated:** December 28, 2025  
**Version:** 1.0

