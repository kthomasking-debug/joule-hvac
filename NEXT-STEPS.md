# ✅ Temperature Server is Running!

**Status:** Server is active and receiving webhooks successfully

**Test Data Received:**

- Temperature: 72.5°F
- Humidity: 45%
- HVAC Mode: heat
- Last Update: Just now

## 🎯 Next Steps to Complete IFTTT Integration

### Step 1: Download ngrok (5 minutes)

**Option A: Direct Download (Easiest)**

1. Go to https://ngrok.com/download
2. Click "Download for Windows"
3. Extract the zip file to a folder (e.g., `C:\ngrok`)
4. Double-click `ngrok.exe` to make sure it works

**Option B: Install via Scoop**

```powershell
# Install Scoop package manager first
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Then install ngrok
scoop install ngrok
```

### Step 2: Get ngrok Auth Token (2 minutes)

1. Create free account at https://dashboard.ngrok.com/signup
2. Go to https://dashboard.ngrok.com/get-started/your-authtoken
3. Copy your authtoken
4. Run this command (replace YOUR_TOKEN with your actual token):

```powershell
ngrok config add-authtoken YOUR_TOKEN
```

### Step 3: Start ngrok (1 minute)

Open a NEW PowerShell window and run:

```powershell
ngrok http 3001
```

You'll see something like:

```
Forwarding   https://abc123xyz.ngrok.io -> http://localhost:3001
```

**🚨 IMPORTANT: Copy that https URL! You'll need it for IFTTT.**

Example: `https://abc123xyz.ngrok.io`

### Step 4: Create IFTTT Applet (5 minutes)

1. **Go to IFTTT**: https://ifttt.com/create

2. **Set up the IF (Trigger)**:

   - Click "Add" for IF
   - Search for "Ecobee"
   - Choose: **"Current temperature rises above"**
   - Set temperature: `70` (or your preference)
   - Select your thermostat
   - Click "Create trigger"

3. **Set up the THEN (Action)**:

   - Click "Add" for THEN
   - Search for "Webhooks"
   - Choose: **"Make a web request"**
   - Fill in these details:

   **URL:**

   ```
   https://YOUR-NGROK-URL.ngrok.io/api/ecobee-webhook
   ```

   (Replace YOUR-NGROK-URL with the URL from Step 3)

   **Method:** `POST`

   **Content Type:** `application/json`

   **Body:**

   ```json
   {
     "temperature": "{{CurrentTemperature}}",
     "humidity": "{{CurrentHumidity}}",
     "hvacMode": "{{CurrentClimateMode}}",
     "trigger": "temp_above_70"
   }
   ```

4. Click "Create action"
5. Give it a name like "Ecobee to Test Bench"
6. Click "Finish"

### Step 5: Test It! (5 minutes)

**Quick Test (Without Thermostat)**:

```powershell
# Send test data to your ngrok URL
$json = '{"temperature":"73.0","humidity":"50","hvacMode":"cool","trigger":"test"}'
Invoke-RestMethod -Uri https://YOUR-NGROK-URL.ngrok.io/api/ecobee-webhook -Method POST -Body $json -ContentType "application/json"
```

**Real Test (With Thermostat)**:

1. Change your thermostat temperature to trigger the applet (go above 70°F)
2. Wait 1-2 minutes (IFTTT checks every ~15 minutes on free tier)
3. Watch the server window - you'll see the webhook when it arrives!

### Step 6: View Data in Your App

1. Open your app: http://localhost:5173
2. Go to Home page or Contactor Demo page
3. Click the **"Ecobee"** button to switch source
4. You should see your thermostat data!

## 🔍 Monitoring

**Check if server is running:**

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/health
```

**View last 10 updates:**

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/ecobee/history?limit=10
```

**Check current Ecobee data:**

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/temperature/ecobee
```

## 🐛 Troubleshooting

**Server not responding?**

- Check if the PowerShell window with the server is still running
- Restart it: `node server/temperature-server.js`

**ngrok tunnel closed?**

- ngrok free tier tunnels expire after ~2 hours
- Just restart ngrok to get a new URL
- Update the URL in your IFTTT applet

**IFTTT not triggering?**

- IFTTT checks every ~15 minutes (free tier)
- Make sure your temperature crosses the threshold
- Check IFTTT activity log: https://ifttt.com/activity

**Webhook not received?**

- Verify the ngrok URL in your IFTTT applet is correct
- Check ngrok window for incoming requests
- Look for errors in the server window

## 📚 Additional Resources

- Full setup guide: `docs/IFTTT-ECOBEE-SETUP.md`
- Quick start: `IFTTT-QUICKSTART.md`
- All test results: 16/16 IFTTT tests passing ✅

## 🎉 Summary

✅ Temperature server: RUNNING  
✅ Test webhook: SUCCESSFUL  
⏳ ngrok: NEEDED  
⏳ IFTTT applet: TO BE CREATED

You're almost there! Just install ngrok and create the IFTTT applet.
