# Quick Start: Ecobee + IFTTT Integration

Get your Ecobee thermostat data into the Engineering Tools app in **15 minutes**!

## Prerequisites

- ✅ Ecobee thermostat
- ✅ IFTTT account (free tier works)
- ✅ Temperature server running

## 5-Step Setup

### 1️⃣ Start Temperature Server

```powershell
cd C:\Users\Thomas\calculators\engineering-tools
node server/temperature-server.js
```

### 2️⃣ Start ngrok (in new terminal)

```powershell
ngrok http 3001
```

Copy the HTTPS URL shown (e.g., `https://abc123.ngrok.io`)

### 3️⃣ Create IFTTT Applet

Go to: https://ifttt.com/create

**IF:**

- Service: **Ecobee**
- Trigger: **Current temperature rises above**
- Temperature: **68°F**

**THEN:**

- Service: **Webhooks**
- Action: **Make a web request**

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
  "trigger": "temp_above_68"
}
```

Click **Continue** → **Finish**

### 4️⃣ Test It

**Option A: Change thermostat**

- Adjust your Ecobee above 68°F
- Wait 15-30 seconds

**Option B: Manual test**

```powershell
curl -X POST http://localhost:3001/api/ecobee-update `
  -H "Content-Type: application/json" `
  -d '{"temperature": 72, "humidity": 45, "hvacMode": "heat"}'
```

Watch server console for:

```
📡 Received Ecobee update: { temperature: 72, ... }
```

### 5️⃣ View in App

```powershell
npm run dev
```

Navigate to: http://localhost:5173

1. Find **TemperatureDisplay** component
2. Click **Ecobee** button
3. See your live data! 🎉

## What's Next?

### Add More Triggers

Create additional IFTTT applets for:

- Temperature below 68°F
- Temperature above 70°F, 72°F, 74°F
- Temperature below 66°F, 64°F, 62°F
- Humidity changes
- HVAC mode changes

**More applets = More frequent updates!**

### Check History

```powershell
curl http://localhost:3001/api/ecobee/history
```

### Monitor Health

```powershell
curl http://localhost:3001/api/health
```

## Common Issues

**No data appearing?**

- ✅ Check server is running
- ✅ Check ngrok is running
- ✅ Temperature crossed trigger threshold
- ✅ IFTTT applet is enabled

**Data not updating?**

- ⏰ IFTTT can take 15-60 seconds
- 🌡️ Temperature must cross threshold
- 🔄 Add more trigger applets

## Full Documentation

See: `docs/IFTTT-ECOBEE-SETUP.md` for:

- Deployment options (Heroku, Railway)
- Security configuration
- Advanced applet strategies
- Troubleshooting guide

---

**🎯 Goal:** Get real Ecobee data flowing in 15 minutes  
**✅ Status:** Ready to go!
