# 📱 Ubuntu Bridge Installation - Step-by-Step Visual Guide

## Before You Start

**You Need:**
- ✅ Ubuntu 24.04.3 LTS machine (192.168.0.106)
- ✅ Internet connection
- ✅ Terminal/Console access
- ✅ Machine password: `!Tk1234!`

**Time Required:** ~5-10 minutes

---

## STEP 1: Open Terminal

**On your Ubuntu machine:**

```
Click: Applications → Terminal
OR
Press: Ctrl + Alt + T
```

You should see a window like:
```
tom@tom-pc:~$
```

---

## STEP 2: Copy & Paste Installation Command

Choose ONE of these options:

### Option A: Full Installer (Recommended)

Copy this entire block and paste into terminal:

```bash
cd ~/Downloads && curl -fsSL https://raw.githubusercontent.com/your-org/joule-hvac/main/install-bridge-ubuntu.sh -o install.sh && chmod +x install.sh && bash install.sh
```

### Option B: If curl doesn't work

```bash
sudo apt-get install -y curl git
# Then try Option A again
```

### Option C: Manual download

1. Visit: https://github.com/your-org/joule-hvac
2. Find `install-bridge-ubuntu.sh`
3. Click "Raw" button
4. Right-click → Save As → Save to Downloads
5. In terminal:
```bash
cd ~/Downloads
chmod +x install-bridge-ubuntu.sh
bash install-bridge-ubuntu.sh
```

---

## STEP 3: Enter Password When Prompted

Terminal will show:
```
[sudo] password for tom:
```

Type your password: `!Tk1234!`

**Note:** Password won't show as you type (this is normal)

Press: **Enter**

---

## STEP 4: Wait for Installation

The script will show progress:

```
🔄 Step 1: Updating system packages...
✅ System updated

🔄 Step 2: Installing Node.js v20...
✅ Node.js installed: v20.10.0

🔄 Step 3: Installing Python 3.11+...
✅ Python installed: Python 3.12.1

🔄 Step 4: Setting up Bridge Server...
✅ Bridge dependencies installed

[...more steps...]
```

**Total time:** ~3-5 minutes (depending on internet speed)

---

## STEP 5: Review Summary

When done, you should see:

```
╔══════════════════════════════════════════════════════════════╗
║              Installation Complete! 🎉                      ║
╚══════════════════════════════════════════════════════════════╝

📍 Locations:
   Bridge: /home/tom/joule-bridge
   HMI:    /home/tom/joule-hmi

🚀 Quick Start Commands:
   Check bridge status:
   sudo systemctl status joule-bridge
   
   Test bridge API:
   curl http://localhost:3002/health | jq

🌐 Network:
   Bridge URL for React app:
   http://192.168.0.106:3002
```

---

## STEP 6: Verify Bridge Is Running

**Copy & paste this command:**

```bash
curl http://localhost:3002/health | jq
```

**Expected output:**
```json
{
  "status": "ok",
  "mode": "groq-powered",
  "hasApiKey": false,
  "timestamp": "2026-01-20T19:30:45Z"
}
```

If you see this → ✅ **Bridge is working!**

---

## STEP 7: Configure Groq API Key

**Optional but recommended** for AI features.

1. Go to: https://console.groq.com/
2. Sign up (free)
3. Create API key
4. Copy the key

In terminal, paste:
```bash
export GROQ_API_KEY=paste_your_key_here
```

Then make it permanent:
```bash
echo 'export GROQ_API_KEY=paste_your_key_here' >> ~/.bashrc
source ~/.bashrc
```

---

## STEP 8: Connect from React App

Now connect your React app to the bridge:

1. **Open React app** (e.g., http://localhost:3173 or your Netlify URL)

2. **Go to Settings**
   - Click: ⚙️ Settings (top right)

3. **Find "Bridge & AI"**
   - Click: Bridge Configuration

4. **Enter Bridge URL**
   - Field: `http://192.168.0.106:3002`

5. **Click Save**

6. **Verify Connection**
   - Should show: ✅ Connected
   - If red X: Check bridge is running (Step 6)

---

## STEP 9: Test Everything

### In Terminal - Test Bridge API

```bash
# Test status endpoint
curl http://localhost:3002/api/status | jq
```

### In React App - Test Controls

1. Find a page with Bridge features (e.g., Settings → Bridge Diagnostics)
2. Try: Get Status button
3. Should see current HVAC state

---

## ✅ Installation Complete!

Your Ubuntu bridge is now:
- ✅ **Running** on port 3002
- ✅ **Connected** to your network
- ✅ **Ready** for React app integration
- ✅ **Auto-starting** on reboot

---

## 🔧 Common Issues & Fixes

### "Command not found: curl"

```bash
sudo apt-get install -y curl
```

### "Permission denied" for script

```bash
chmod +x ~/Downloads/install-bridge-ubuntu.sh
bash ~/Downloads/install-bridge-ubuntu.sh
```

### Bridge not responding

```bash
# Restart service
sudo systemctl restart joule-bridge

# Check status
sudo systemctl status joule-bridge

# View logs
sudo journalctl -u joule-bridge -n 20
```

### Can't reach from React app

```bash
# Verify machine IP
hostname -I

# Allow through firewall
sudo ufw allow 3002

# Test from terminal
curl http://192.168.0.106:3002/health
```

---

## 📞 Need Help?

### Check Logs

```bash
# View live logs (Ctrl+C to exit)
sudo journalctl -u joule-bridge -f
```

### Restart Bridge

```bash
sudo systemctl restart joule-bridge
```

### Check Services

```bash
# All services
sudo systemctl list-units --type=service | grep joule

# Bridge status
sudo systemctl status joule-bridge

# HMI status
sudo systemctl status joule-hmi
```

### Uninstall (if needed)

```bash
sudo systemctl stop joule-bridge
sudo systemctl disable joule-bridge
sudo systemctl stop joule-hmi
sudo systemctl disable joule-hmi
rm -rf ~/joule-bridge ~/joule-hmi
```

---

## 📚 Next Steps

1. **Set up Ecobee pairing** (if using Ecobee thermostat)
   - See: Settings → Ecobee Setup

2. **Configure location** (if not done)
   - See: Settings → Location Setup

3. **Set utility rates** (for cost estimation)
   - See: Settings → Rates & Costs

4. **Try cost estimates** (what-if calculations)
   - See: Tools → Cost Estimator

---

## 📋 Quick Reference

| Task | Command |
|------|---------|
| Check status | `sudo systemctl status joule-bridge` |
| View logs | `sudo journalctl -u joule-bridge -f` |
| Restart | `sudo systemctl restart joule-bridge` |
| Test API | `curl http://localhost:3002/health` |
| Set temperature | `curl -X POST http://localhost:3002/api/setpoint -H "Content-Type: application/json" -d '{"targetTemp": 72}'` |

---

## 🎉 You're All Set!

Your Ubuntu bridge is now running and ready for Joule integration.

**Bridge URL for React app:** `http://192.168.0.106:3002`

Happy automation! 🚀
