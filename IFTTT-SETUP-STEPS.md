# 🚀 IFTTT Ecobee Integration - Setup Steps

**Status:** ✅ Temperature server is running on port 3001

## Step 1: Install ngrok

Since ngrok isn't installed yet, follow these steps:

### Option A: Download Manually (Recommended)

1. Go to https://ngrok.com/download
2. Download the Windows version (zip file)
3. Extract `ngrok.exe` to a folder (e.g., `C:\ngrok`)
4. Add the folder to your PATH or run from that directory

### Option B: Use Scoop Package Manager

```powershell
# Install Scoop if you don't have it
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Install ngrok
scoop install ngrok
```

## Step 2: Sign up for ngrok (Free)

1. Go to https://dashboard.ngrok.com/signup
2. Create a free account
3. Copy your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken
4. Run: `ngrok config add-authtoken YOUR_TOKEN_HERE`

## Step 3: Start ngrok Tunnel

```powershell
ngrok http 3001
```

**You'll see output like:**

```
Forwarding   https://abc123.ngrok.io -> http://localhost:3001
```

**Copy that https URL!** (e.g., `https://abc123.ngrok.io`)

## Step 4: Create IFTTT Applets

### 4.1: Go to IFTTT

1. Visit https://ifttt.com/create
2. Log in with your account (or create one - it's free!)

### 4.2: Create Temperature Trigger Applet

**IF (Trigger):**

1. Click "Add" for the IF section
2. Search for "Ecobee" and select it
3. Choose trigger: **"Current temperature rises above"**
4. Set temperature: `70°F` (or your preference)
5. Select your thermostat
6. Click "Create trigger"

**THEN (Action):**

1. Click "Add" for the THEN section
2. Search for "Webhooks" and select it
3. Choose action: **"Make a web request"**
4. Fill in the details:
   - **URL:** `https://YOUR-NGROK-URL.ngrok.io/api/ecobee-webhook`
     (Replace with the URL from Step 3)
   - **Method:** `POST`
   - **Content Type:** `application/json`
   - **Body:**
   ```json
   {
     "temperature": "{{CurrentTemperature}}",
     "humidity": "{{CurrentHumidity}}",
     "hvacMode": "{{CurrentClimateMode}}",
     "trigger": "temp_above_70"
   }
   ```
5. Click "Create action"
6. Click "Continue" and give it a name like "Ecobee Temp to Bench"
7. Click "Finish"

### 4.3: Create More Applets (Optional)

You can create multiple applets for different triggers:

**Humidity Change:**

- Trigger: "Current humidity rises above 50%"
- Body: `{"temperature":"{{CurrentTemperature}}","humidity":"{{CurrentHumidity}}","hvacMode":"{{CurrentClimateMode}}","trigger":"humidity_above_50"}`

**Temperature Drop:**

- Trigger: "Current temperature drops below 68°F"
- Body: `{"temperature":"{{CurrentTemperature}}","humidity":"{{CurrentHumidity}}","hvacMode":"{{CurrentClimateMode}}","trigger":"temp_below_68"}`

**Mode Change:**

- Trigger: "Climate changes to heat"
- Body: `{"temperature":"{{CurrentTemperature}}","humidity":"{{CurrentHumidity}}","hvacMode":"{{CurrentClimateMode}}","trigger":"mode_changed_to_heat"}`

## Step 5: Test the Integration

### 5.1: Trigger Manually (Quick Test)

Use curl to simulate IFTTT sending data:

```powershell
curl.exe -X POST http://localhost:3001/api/ecobee-webhook `
  -H "Content-Type: application/json" `
  -d '{"temperature":"72.5","humidity":"45","hvacMode":"heat","trigger":"manual_test"}'
```

### 5.2: Check the Server Response

```powershell
curl.exe http://localhost:3001/api/ecobee/history
```

You should see your test data!

### 5.3: Test in the UI

1. Open your app at http://localhost:5173 (or your dev server)
2. Go to the Home page or Contactor Demo page
3. Click the **"Ecobee"** button in the TemperatureDisplay
4. You should see the test temperature: **72.5°F**

### 5.4: Test with Real Thermostat

1. Change your thermostat temperature to trigger the IFTTT applet
2. Wait 1-2 minutes for IFTTT to detect the change and send the webhook
3. Watch your app UI update automatically!

## Step 6: Monitor Activity

### Check Server Logs

The terminal running the temperature server will show webhook activity:

```
📡 Received Ecobee update: {
  temperature: 72.5,
  humidity: 45,
  hvacMode: 'heat',
  trigger: 'temp_above_70',
  ...
}
```

### Check IFTTT Activity

1. Go to https://ifttt.com/activity
2. You'll see when applets trigger and if webhooks succeeded

### Check Update History

```powershell
curl.exe http://localhost:3001/api/ecobee/history?limit=10
```

## Troubleshooting

### IFTTT Applet Not Triggering

- IFTTT checks conditions every 15 minutes (free tier)
- Make sure your thermostat temperature crosses the threshold
- Check IFTTT activity log for errors

### Webhook Not Received

- Verify ngrok is still running (it might disconnect)
- Check the ngrok URL hasn't changed
- Update IFTTT applet with new URL if needed
- Look for errors in the temperature server logs

### UI Not Updating

- Make sure you've selected "Ecobee" source in the UI
- Check browser console for errors (F12)
- Verify the server is returning data: `curl http://localhost:3001/api/temperature/ecobee`

## Production Deployment (Optional)

For permanent deployment without ngrok:

### Heroku (Free Tier)

```powershell
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

heroku create your-app-name
git add server/temperature-server.js package.json
git commit -m "Add temperature server"
git push heroku main
```

Your webhook URL will be: `https://your-app-name.herokuapp.com/api/ecobee-webhook`

### Railway (Free Tier)

1. Go to https://railway.app
2. Connect your GitHub repo
3. Deploy the server
4. Use the Railway URL in your IFTTT applets

## Next Steps

✅ Temperature server running
⏳ Install ngrok
⏳ Start ngrok tunnel
⏳ Create IFTTT applets
⏳ Test with real thermostat data
⏳ Deploy to production (optional)

---

**Your IFTTT Webhook Key:** `c1gvsWQtAwFA-XBP7urs8w`

**Questions?** Check the comprehensive guide in `docs/IFTTT-ECOBEE-SETUP.md`
