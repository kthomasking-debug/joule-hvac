# IFTTT Ecobee Integration Setup Guide

## Overview

This guide walks you through connecting your Ecobee thermostat to the Engineering Tools app using IFTTT as a middleman. **No Ecobee developer account required!**

## Why IFTTT?

- ✅ No Ecobee developer account needed
- ✅ Simple webhook-based integration
- ✅ Free IFTTT account works
- ✅ Real-time temperature updates
- ✅ Includes humidity and HVAC mode

---

## Step 1: Enable IFTTT Webhooks

### A. Create IFTTT Account

1. Go to https://ifttt.com
2. Sign up for a free account
3. Connect your Ecobee account to IFTTT

### B. Enable Webhooks Service

1. Visit https://ifttt.com/maker_webhooks
2. Click **"Connect"** to enable the Webhooks service
3. Click **"Documentation"** in the top right
4. **Save your webhook key** - you'll need this later (looks like `abc123xyz`)

---

## Step 2: Expose Your Server to the Internet

IFTTT needs to reach your local server. Choose one option:

### Option A: ngrok (Recommended for Testing)

**Install ngrok:**

```powershell
# Download from https://ngrok.com/download
# Or install via npm
npm install -g ngrok
```

**Run ngrok:**

```powershell
# Make sure your temperature server is running first
node server/temperature-server.js

# In a new terminal, start ngrok
ngrok http 3001
```

**Copy the ngrok URL:**

```
Forwarding  https://abc123.ngrok.io -> http://localhost:3001
```

Your webhook URL will be: `https://abc123.ngrok.io/api/ecobee-webhook`

> ⚠️ **Note:** Free ngrok URLs change every time you restart. For permanent deployment, see Option B or C.

### Option B: Deploy to Cloud (Recommended for Production)

**Heroku (Free Tier):**

```powershell
# Install Heroku CLI
# Deploy your server
git init
heroku create your-app-name
git push heroku main
```

Your webhook URL: `https://your-app-name.herokuapp.com/api/ecobee-webhook`

**Railway.app:**

1. Go to https://railway.app
2. Connect your GitHub repo
3. Deploy automatically

**Vercel/Netlify:**

- Convert to serverless function
- Deploy via GitHub integration

### Option C: Port Forwarding (If You Have Static IP)

1. Log into your router
2. Forward port 3001 to your local machine's IP
3. Use your public IP: `http://YOUR_PUBLIC_IP:3001/api/ecobee-webhook`

> ⚠️ **Security Warning:** Only do this if you understand the security implications!

---

## Step 3: Create IFTTT Applets

To get frequent updates, create multiple applets for different temperature ranges.

### Temperature Rise Applets

Create one applet for each 2°F increment:

#### Applet 1: Temperature Above 60°F

1. Go to https://ifttt.com/create
2. Click **"If This"**
   - Search for **"Ecobee"**
   - Choose **"Current temperature rises above"**
   - Temperature: **60°F**
   - Select your thermostat
3. Click **"Then That"**
   - Search for **"Webhooks"**
   - Choose **"Make a web request"**
   - **URL:** `https://your-ngrok-url.ngrok.io/api/ecobee-webhook`
   - **Method:** `POST`
   - **Content Type:** `application/json`
   - **Body:**
     ```json
     {
       "temperature": "{{CurrentTemperature}}",
       "humidity": "{{CurrentHumidity}}",
       "hvacMode": "{{CurrentClimateMode}}",
       "trigger": "temp_above_60"
     }
     ```
4. Click **"Continue"** and **"Finish"**

#### Repeat for Multiple Temperatures

Create similar applets for:

- Temperature above: 62, 64, 66, 68, 70, 72, 74, 76°F
- Temperature below: 74, 72, 70, 68, 66, 64, 62, 60°F

**Why so many?** More triggers = more frequent updates! Each temperature crossing triggers an update.

### Humidity Change Applet

1. **If This:** Ecobee → "Current humidity rises above" → 40%
2. **Then That:** Webhooks → Same as above, change trigger to `"humidity_above_40"`

Repeat for humidity levels: 45%, 50%, 55%, 60%, 65%

### HVAC Mode Change Applet

1. **If This:** Ecobee → "Climate changes to" → Heating
2. **Then That:** Webhooks → Same as above, change trigger to `"mode_heating"`

Repeat for modes: Cooling, Auto, Off

---

## Step 4: Test the Integration

### A. Start Your Server

```powershell
node server/temperature-server.js
```

You should see:

```
🌡️  Temperature API running on port 3001
   IFTTT Webhook: http://localhost:3001/api/ecobee-webhook
   History: http://localhost:3001/api/ecobee/history
```

### B. Start ngrok (if using)

```powershell
ngrok http 3001
```

### C. Trigger an Update

**Option 1: Change your thermostat temperature**

- Adjust your Ecobee to cross one of your trigger thresholds
- Wait 15-30 seconds for IFTTT to process

**Option 2: Manual test**

```powershell
curl -X POST http://localhost:3001/api/ecobee-update `
  -H "Content-Type: application/json" `
  -d '{"temperature": 72, "humidity": 45, "hvacMode": "heat"}'
```

### D. Verify Data Received

**Check console output:**

```
📡 Received Ecobee update: {
  temperature: 72,
  humidity: 45,
  hvacMode: 'heat',
  lastUpdate: 2025-11-20T16:00:00.000Z,
  updateCount: 1
}
```

**Check in browser:**

```
http://localhost:3001/api/temperature/ecobee
http://localhost:3001/api/ecobee/history
http://localhost:3001/api/health
```

---

## Step 5: View in React App

1. Build and start the app server:

   ```bash
   npm run build
   node server.js
   ```

2. Navigate to http://localhost:5173

3. You should see the **TemperatureDisplay** component

4. Click the **Ecobee** button to switch sources

5. Your live Ecobee data should appear!

---

## IFTTT Applet Templates

### Complete JSON Bodies for Each Applet Type

#### Standard Temperature Update

```json
{
  "temperature": "{{CurrentTemperature}}",
  "humidity": "{{CurrentHumidity}}",
  "hvacMode": "{{CurrentClimateMode}}",
  "trigger": "temp_above_68"
}
```

#### Humidity Focus Update

```json
{
  "temperature": "{{CurrentTemperature}}",
  "humidity": "{{CurrentHumidity}}",
  "hvacMode": "{{CurrentClimateMode}}",
  "trigger": "humidity_change"
}
```

#### Mode Change Update

```json
{
  "temperature": "{{CurrentTemperature}}",
  "humidity": "{{CurrentHumidity}}",
  "hvacMode": "{{CurrentClimateMode}}",
  "trigger": "mode_to_heating"
}
```

---

## Recommended Applet Strategy

### Minimum Setup (6 applets)

- Temp above: 65, 70, 75°F
- Temp below: 75, 70, 65°F

### Standard Setup (16 applets)

- Temp above: 60, 62, 64, 66, 68, 70, 72, 74°F
- Temp below: 74, 72, 70, 68, 66, 64, 62, 60°F

### Maximum Coverage (30+ applets)

- All of the above
- Humidity changes (5 applets)
- Mode changes (4 applets)
- Time-based checks (1 per hour)

**Pro Tip:** Start with Minimum Setup, then add more applets as needed. More applets = more frequent updates!

---

## Troubleshooting

### No Data Appearing in App

1. **Check server is running:**

   ```powershell
   curl http://localhost:3001/api/health
   ```

2. **Check ngrok is running:**

   ```powershell
   curl https://your-ngrok-url.ngrok.io/api/health
   ```

3. **Verify IFTTT applet is enabled:**

   - Go to https://ifttt.com/my_applets
   - Check applets are "On"

4. **Check IFTTT activity log:**
   - Each applet page shows recent runs
   - Look for errors or failures

### Data Not Updating

1. **Temperature hasn't crossed a threshold:**

   - Wait for temp to change by 2°F
   - Or manually change thermostat

2. **IFTTT delay:**

   - IFTTT can take 15-60 seconds to trigger
   - Free accounts may be slower

3. **Webhook URL changed:**
   - If using ngrok, URL changes on restart
   - Update all IFTTT applets with new URL

### Server Errors

1. **Port 3001 already in use:**

   ```powershell
   # Find process using port 3001
   netstat -ano | findstr :3001

   # Kill the process (replace PID)
   taskkill /PID <PID> /F
   ```

2. **CORS errors:**
   - Server already has CORS enabled
   - Check browser console for specific errors

---

## Security Considerations

### For Testing (ngrok)

- ✅ Use ngrok's HTTPS URL
- ✅ Fine for development
- ⚠️ URL is publicly accessible (but hard to guess)

### For Production

1. **Add authentication to webhook:**

   ```javascript
   app.post("/api/ecobee-webhook", (req, res) => {
     const authToken = req.headers["authorization"];
     if (authToken !== "Bearer YOUR_SECRET_TOKEN") {
       return res.status(401).json({ error: "Unauthorized" });
     }
     // ... rest of code
   });
   ```

2. **Use HTTPS only:**

   - Deploy to Heroku/Railway (automatic HTTPS)
   - Or use reverse proxy with SSL certificate

3. **Rate limiting:**

   ```javascript
   import rateLimit from "express-rate-limit";

   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100, // limit each IP to 100 requests per windowMs
   });

   app.use("/api/ecobee-webhook", limiter);
   ```

4. **Validate webhook source:**
   - Check IFTTT's IP ranges
   - Verify request format

---

## API Endpoints Reference

### POST /api/ecobee-webhook

**Purpose:** Receive IFTTT webhook data  
**Body:**

```json
{
  "temperature": "72.5",
  "humidity": "45",
  "hvacMode": "heat",
  "trigger": "temp_above_70"
}
```

### POST /api/ecobee-update

**Purpose:** Manual testing without IFTTT  
**Body:**

```json
{
  "temperature": 72,
  "humidity": 45,
  "hvacMode": "heat"
}
```

### GET /api/temperature/ecobee

**Purpose:** Fetch current Ecobee data  
**Response:**

```json
{
  "temperature": 72,
  "humidity": 45,
  "hvacMode": "heat",
  "lastUpdate": "2025-11-20T16:00:00.000Z",
  "updateCount": 42,
  "source": "ecobee"
}
```

### GET /api/ecobee/history

**Purpose:** Fetch update history  
**Query Params:** `?limit=50` (default: 50)  
**Response:**

```json
{
  "history": [
    {
      "temperature": 72,
      "humidity": 45,
      "hvacMode": "heat",
      "trigger": "temp_above_70",
      "timestamp": "2025-11-20T16:00:00.000Z"
    }
  ],
  "total": 15
}
```

### GET /api/health

**Purpose:** Server status check  
**Response:**

```json
{
  "status": "ok",
  "service": "temperature-api",
  "ecobeeConnected": true,
  "lastEcobeeUpdate": "2025-11-20T16:00:00.000Z",
  "updateCount": 42,
  "historySize": 15
}
```

---

## Next Steps

1. ✅ Set up IFTTT applets (start with 6, add more later)
2. ✅ Start server and ngrok
3. ✅ Test with manual curl command
4. ✅ Trigger real update by changing thermostat
5. ✅ View data in React app
6. ✅ Monitor history endpoint
7. 🔮 Deploy to cloud for permanent access

---

## Resources

- [IFTTT Webhooks Documentation](https://ifttt.com/maker_webhooks)
- [Ecobee IFTTT Service](https://ifttt.com/ecobee)
- [ngrok Documentation](https://ngrok.com/docs)
- [Express.js CORS Guide](https://expressjs.com/en/resources/middleware/cors.html)

---

**Happy Monitoring! 🌡️**

_Last Updated: November 20, 2025_
