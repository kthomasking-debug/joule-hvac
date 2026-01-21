# 🎯 START HERE - Ubuntu Bridge Installation

## Your Machine

```
Device:     dev-machine / tom-pc-P150HMx
IP Address: 192.168.0.106
OS:         Ubuntu 24.04.3 LTS
Password:   [Configured]
```

---

## Installation in 3 Steps

### STEP 1: Open Terminal on Ubuntu

On your Ubuntu machine:
- Press: `Ctrl + Alt + T`
- Or click: Applications → Terminal

### STEP 2: Copy & Paste This Command

```bash
bash install-bridge-ubuntu.sh
```

**If you're not in the right directory:**
```bash
cd ~/joule-hvac && bash install-bridge-ubuntu.sh
```

**If you don't have the file yet:**
```bash
git clone https://github.com/your-org/joule-hvac.git
cd joule-hvac
bash install-bridge-ubuntu.sh
```

### STEP 3: Follow Prompts

- When asked for password: `!Tk1234!`
- Wait for completion (3-5 minutes)
- See "Installation Complete!" message

---

## Verify It Works

After installation completes, run:

```bash
curl http://localhost:3002/health | jq
```

**You should see:**
```json
{
  "status": "ok",
  "mode": "groq-powered",
  "hasApiKey": false,
  "timestamp": "2026-01-20T..."
}
```

✅ If you see this, **your bridge is working!**

---

## Connect from React App

1. Open Joule React app
2. Go to **Settings** → **Bridge & AI**
3. Enter URL: `http://192.168.0.106:3002`
4. Click **Save**
5. Should show: ✅ **Connected**

---

## Troubleshooting

### Bridge Won't Start?

```bash
# Check what went wrong
sudo systemctl status joule-bridge

# View detailed logs
sudo journalctl -u joule-bridge -n 50

# Try to restart
sudo systemctl restart joule-bridge
```

### Can't Connect from React App?

```bash
# 1. Make sure bridge is running
curl http://localhost:3002/health

# 2. Allow firewall
sudo ufw allow 3002

# 3. Check your IP
hostname -I

# 4. Test from another machine
curl http://192.168.0.106:3002/health
```

---

## What Just Got Installed?

- ✅ **Node.js v20** - Bridge server
- ✅ **Python 3.12+** - HMI system
- ✅ **Express.js** - Web framework
- ✅ **Systemd Services** - Auto-start
- ✅ **Groq SDK** - AI integration

---

## Important Locations

```
Bridge:      ~/joule-bridge/
Settings:    ~/joule-bridge/settings/joule-settings.json
Logs:        journalctl -u joule-bridge
Services:    /etc/systemd/system/joule-bridge.service
```

---

## Key Commands

```bash
# Status
sudo systemctl status joule-bridge

# Logs
sudo journalctl -u joule-bridge -f

# Restart
sudo systemctl restart joule-bridge

# Test
curl http://localhost:3002/health | jq
curl http://localhost:3002/api/status | jq
```

---

## Next Steps

1. ✅ Run installer
2. ✅ Verify with `curl http://localhost:3002/health`
3. ✅ Configure Groq API key (optional):
   - Get from: https://console.groq.com/
   - Set: `export GROQ_API_KEY=your_key`
4. ✅ Connect from React app
5. ✅ Test HVAC controls

---

## Need More Help?

### Visual Step-by-Step
→ See: `UBUNTU-BRIDGE-VISUAL-GUIDE.md`

### Detailed Setup Instructions
→ See: `UBUNTU-BRIDGE-SETUP.md`

### Quick Reference
→ See: `UBUNTU-BRIDGE-QUICKSTART.md`

### API Documentation
→ See: `BRIDGE_ENDPOINTS_COMPLETE.md`

---

## Still Having Issues?

Try this:

1. **Check bridge status:**
   ```bash
   sudo systemctl status joule-bridge
   ```

2. **View full error logs:**
   ```bash
   sudo journalctl -u joule-bridge -n 100
   ```

3. **Restart the service:**
   ```bash
   sudo systemctl restart joule-bridge
   ```

4. **Verify port is open:**
   ```bash
   sudo lsof -i :3002
   ```

5. **Check firewall:**
   ```bash
   sudo ufw status
   sudo ufw allow 3002
   ```

---

## That's It! 🎉

Your Ubuntu Bridge is now ready for production.

**Bridge URL:** `http://192.168.0.106:3002`

**Next:** Connect your React app and start controlling your HVAC!

---

Questions? Check the documentation files or review the logs with:
```bash
sudo journalctl -u joule-bridge -f
```
