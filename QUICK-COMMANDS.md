# 🚀 IFTTT Ecobee Integration - Quick Commands

## ✅ Current Status

- Temperature Server: **RUNNING** ✅
- Test Webhook: **SUCCESSFUL** ✅
- Server tested with: 72.5°F, 45% humidity, heat mode

---

## 📝 Quick Command Reference

### Start Temperature Server (if not running)

```powershell
node server/temperature-server.js
```

### Download ngrok

https://ngrok.com/download

### Start ngrok Tunnel

```powershell
ngrok http 3001
```

Copy the `https://xxxxx.ngrok.io` URL that appears!

### Test Local Webhook

```powershell
$data = '{"temperature":"74.0","humidity":"48","hvacMode":"cool","trigger":"test"}'
Invoke-RestMethod -Uri http://localhost:3001/api/ecobee-webhook -Method POST -Body $data -ContentType "application/json"
```

### Test via ngrok (after starting ngrok)

```powershell
$data = '{"temperature":"74.0","humidity":"48","hvacMode":"cool","trigger":"test"}'
Invoke-RestMethod -Uri https://YOUR-NGROK-URL.ngrok.io/api/ecobee-webhook -Method POST -Body $data -ContentType "application/json"
```

### Check Current Data

```powershell
# Ecobee data
Invoke-RestMethod -Uri http://localhost:3001/api/temperature/ecobee

# CPU temperature
Invoke-RestMethod -Uri http://localhost:3001/api/temperature/cpu

# Health check
Invoke-RestMethod -Uri http://localhost:3001/api/health

# Last 5 updates
Invoke-RestMethod -Uri http://localhost:3001/api/ecobee/history?limit=5
```

---

## 🔗 IFTTT Applet Configuration

**Create applet at:** https://ifttt.com/create

**Trigger:** Ecobee → Current temperature rises above → 70°F

**Action:** Webhooks → Make a web request

**Settings:**

- URL: `https://YOUR-NGROK-URL.ngrok.io/api/ecobee-webhook`
- Method: `POST`
- Content Type: `application/json`
- Body:

```json
{
  "temperature": "{{CurrentTemperature}}",
  "humidity": "{{CurrentHumidity}}",
  "hvacMode": "{{CurrentClimateMode}}",
  "trigger": "temp_above_70"
}
```

---

## 🎯 Useful Links

- ngrok Download: https://ngrok.com/download
- ngrok Dashboard: https://dashboard.ngrok.com
- Create IFTTT Applet: https://ifttt.com/create
- IFTTT Activity Log: https://ifttt.com/activity
- Your IFTTT Webhook Key: `c1gvsWQtAwFA-XBP7urs8w`

---

## 📄 Documentation Files

- `NEXT-STEPS.md` - Detailed step-by-step guide (START HERE)
- `docs/IFTTT-ECOBEE-SETUP.md` - Comprehensive setup guide
- `IFTTT-QUICKSTART.md` - 15-minute quick start
- `IFTTT-SETUP-STEPS.md` - Alternative setup guide

---

## ✨ What's Working

✅ Temperature server on port 3001  
✅ CPU temperature endpoint  
✅ Ecobee data endpoint  
✅ IFTTT webhook receiver  
✅ History tracking (last 100 updates)  
✅ Update counting  
✅ All 16 Playwright tests passing

## 🎯 What You Need To Do

1. ⏳ Download & install ngrok
2. ⏳ Sign up for ngrok account (free)
3. ⏳ Start ngrok tunnel
4. ⏳ Create IFTTT applet
5. ⏳ Test with your thermostat

---

**Time to complete: ~20 minutes total**

**Need help?** See `NEXT-STEPS.md` for detailed instructions!
