# 🎉 ngrok Tunnel Active!

**Status:** ✅ Ready for IFTTT Integration

## 🔗 Your ngrok URL

**Public URL:** `https://centrally-augmented-doreatha.ngrok-free.dev`

**Webhook Endpoint:** `https://centrally-augmented-doreatha.ngrok-free.dev/api/ecobee-webhook`

**ngrok Dashboard:** http://127.0.0.1:4040 (view all incoming requests)

---

## 📝 Create IFTTT Applet (5 minutes)

### Step 1: Go to IFTTT

🔗 https://ifttt.com/create

### Step 2: Set Up IF (Trigger)

1. Click **"Add"** for the IF section
2. Search for **"Ecobee"** and select it
3. Choose trigger: **"Current temperature rises above"**
4. Set temperature: **70°F** (or your preference)
5. Select your thermostat from the dropdown
6. Click **"Create trigger"**

### Step 3: Set Up THEN (Action)

1. Click **"Add"** for the THEN section
2. Search for **"Webhooks"** and select it
3. Choose action: **"Make a web request"**
4. Fill in these EXACT values:

   **URL:**

   ```
   https://centrally-augmented-doreatha.ngrok-free.dev/api/ecobee-webhook
   ```

   **Method:**

   ```
   POST
   ```

   **Content Type:**

   ```
   application/json
   ```

   **Body:**

   ```json
   {
     "temperature": "{{CurrentTemperature}}",
     "humidity": "{{CurrentHumidity}}",
     "hvacMode": "{{CurrentClimateMode}}",
     "trigger": "temp_above_70"
   }
   ```

   If you do NOT see `CurrentClimateMode` (or any mode/climate ingredient) in the ingredient picker, use the fallback body without `hvacMode`:

   ```json
   {
     "temperature": "{{IndoorTemperature}}",
     "humidity": "{{IndoorHumidity}}",
     "trigger": "temp_above_70"
   }
   ```

   (Ecobee exposes different ingredient names depending on the trigger chosen. Temperature / humidity triggers often omit mode.)

5. Click **"Create action"**
6. Click **"Continue"**
7. Give it a name: **"Ecobee to Test Bench"**
8. Click **"Finish"**

---

## 🧪 Test the Integration

### Option 1: Wait for Real Trigger

1. Change your thermostat to go above 70°F
2. Wait 1-2 minutes (IFTTT checks every ~15 min on free tier)
3. Watch the ngrok dashboard: http://127.0.0.1:4040
4. You'll see the POST request when it arrives!

### Option 2: Test Manually (Quick)

Open the ngrok web interface and use the "Replay" feature, or wait for the first real trigger.

---

## 📊 Monitor Activity

### Check ngrok Dashboard

🔗 http://127.0.0.1:4040

- Shows all HTTP requests in real-time
- See request/response details
- Replay requests for testing

### Check Server Data

```powershell
# Current Ecobee data
Invoke-RestMethod -Uri http://localhost:3001/api/temperature/ecobee

# Last 10 updates
Invoke-RestMethod -Uri http://localhost:3001/api/ecobee/history?limit=10

# Server health
Invoke-RestMethod -Uri http://localhost:3001/api/health
```

### Check IFTTT Activity

🔗 https://ifttt.com/activity

- See when applets trigger
- View success/failure status
- Check error messages

---

## 🎯 View in Your App

1. Open your app: http://localhost:5173
2. Go to **Home** page or **Contactor Demo** page
3. Click the **"Ecobee"** button to switch data source
4. See your live thermostat data! 🌡️

---

## ⚠️ Important Notes

### Keep These Running

- ✅ Temperature server window (node server/temperature-server.js)
- ✅ ngrok tunnel window (ngrok http 3001)

### ngrok Free Tier Limits

- Tunnel expires after ~2 hours of inactivity
- URL changes if you restart ngrok
- If URL changes, update your IFTTT applet with the new URL

### IFTTT Free Tier

- Checks conditions every ~15 minutes
- Not instant - there will be a delay
- Check activity log if nothing happens

---

## 🐛 Troubleshooting

### No webhook received?

1. Check ngrok dashboard - is it receiving requests?
2. Check IFTTT activity log - did the applet trigger?
3. Verify the webhook URL in IFTTT matches your ngrok URL
4. Make sure temperature actually crossed the threshold

### ngrok tunnel closed?

1. Restart ngrok: `ngrok http 3001`
2. Copy the new URL
3. Update IFTTT applet with new URL

### Server not responding?

1. Check if temperature server is still running
2. Restart if needed: `node server/temperature-server.js`

---

## 📚 Additional Applet Ideas

### Temperature Drop

- Trigger: "Current temperature drops below 68°F"
- Body: `{"temperature":"{{CurrentTemperature}}","humidity":"{{CurrentHumidity}}","hvacMode":"{{CurrentClimateMode}}","trigger":"temp_below_68"}`

### Humidity Alert

- Trigger: "Current humidity rises above 50%"
- Body: `{"temperature":"{{CurrentTemperature}}","humidity":"{{CurrentHumidity}}","hvacMode":"{{CurrentClimateMode}}","trigger":"humidity_high"}`

### Mode Change

- Trigger: "Climate changes to heat"
- Body: `{"temperature":"{{CurrentTemperature}}","humidity":"{{CurrentHumidity}}","hvacMode":"{{CurrentClimateMode}}","trigger":"mode_heating"}`

### Capturing HVAC Mode When Not Available In Other Triggers

If your temperature / humidity trigger does not offer a mode ingredient (you only see items like `IndoorTemperature`, `IndoorHumidity`, `DesiredIndoorHeatTemperature`, etc.), create _a second_ applet using one of Ecobee's mode / climate triggers:

1. Trigger: "Climate changes" (or specific: "Climate changes to heat" / "cool" depending on availability).
2. Action (Webhooks) Body:
   ```json
   {
     "hvacMode": "{{CurrentClimateMode}}",
     "trigger": "climate_change"
   }
   ```
3. (Optional) Add current temp / humidity if those ingredients also appear for that trigger.

On the server side these separate updates will still populate history; the last received `hvacMode` will be included in subsequent UI renders.

### Minimal Bodies (When Ingredients Limited)

Use the smallest valid JSON if only temperature is offered:

```json
{ "temperature": "{{IndoorTemperature}}", "trigger": "temp_above_70" }
```

Humidity-only trigger example:

```json
{ "humidity": "{{IndoorHumidity}}", "trigger": "humidity_above_50" }
```

You can safely omit fields that are not present; the server will treat missing values as `null` and keep earlier known values.

All use the same webhook URL: `https://centrally-augmented-doreatha.ngrok-free.dev/api/ecobee-webhook`

---

## ✅ Current Status

- ✅ Temperature server: RUNNING
- ✅ ngrok tunnel: ACTIVE
- ✅ Webhook endpoint: https://centrally-augmented-doreatha.ngrok-free.dev/api/ecobee-webhook
- ⏳ IFTTT applet: READY TO CREATE

**You're all set! Just create the IFTTT applet and you're done!** 🎉
