# Local Thermostat Data - No Internet Required

You don't need IFTTT, webhooks, or ngrok if you're only working locally. Use these scripts instead:

---

## Option 1: Quick Manual Updates

**Script:** `update-thermostat.ps1`

### Basic usage (prompts for values):

```powershell
.\update-thermostat.ps1
```

### With parameters (no prompts):

```powershell
.\update-thermostat.ps1 -Temperature 72 -Humidity 45 -Mode heat
```

### Examples:

```powershell
# Set to heating mode
.\update-thermostat.ps1 -Temperature 68 -Humidity 42 -Mode heat

# Set to cooling mode
.\update-thermostat.ps1 -Temperature 74 -Humidity 50 -Mode cool

# Auto mode
.\update-thermostat.ps1 -Temperature 71 -Humidity 48 -Mode auto
```

---

## Option 2: Continuous Polling

**Script:** `poll-ecobee.ps1`

Continuously reads thermostat data and updates the server.

### Default (updates every 60 seconds):

```powershell
.\poll-ecobee.ps1
```

### Custom interval (every 30 seconds):

```powershell
.\poll-ecobee.ps1 -IntervalSeconds 30
```

### Manual input mode (prompts each time):

```powershell
.\poll-ecobee.ps1 -IntervalSeconds 0
```

**To stop:** Press `Ctrl+C`

---

## Customizing the Polling Script

Edit `poll-ecobee.ps1` and replace the `Get-EcobeeData` function with one of these:

### If you have Ecobee API access:

```powershell
function Get-EcobeeData {
    $token = "YOUR_ECOBEE_API_TOKEN"
    $response = Invoke-RestMethod -Uri "https://api.ecobee.com/1/thermostat?json={selection:{selectionType:'registered',selectionMatch:'',includeRuntime:true,includeSettings:true}}" -Headers @{Authorization="Bearer $token"}

    return @{
        temperature = $response.thermostatList[0].runtime.actualTemperature / 10
        humidity = $response.thermostatList[0].runtime.actualHumidity
        mode = $response.thermostatList[0].settings.hvacMode
    }
}
```

### If you use Home Assistant:

```powershell
function Get-EcobeeData {
    $token = "YOUR_HOME_ASSISTANT_TOKEN"
    $response = Invoke-RestMethod -Uri "http://homeassistant.local:8123/api/states/climate.ecobee" -Headers @{Authorization="Bearer $token"}

    return @{
        temperature = $response.attributes.current_temperature
        humidity = $response.attributes.current_humidity
        mode = $response.state
    }
}
```

### If you use SmartThings:

```powershell
function Get-EcobeeData {
    $token = "YOUR_SMARTTHINGS_TOKEN"
    $deviceId = "YOUR_DEVICE_ID"
    $response = Invoke-RestMethod -Uri "https://api.smartthings.com/v1/devices/$deviceId/status" -Headers @{Authorization="Bearer $token"}

    return @{
        temperature = $response.components.main.temperatureMeasurement.temperature.value
        humidity = $response.components.main.relativeHumidityMeasurement.humidity.value
        mode = $response.components.main.thermostatMode.thermostatMode.value
    }
}
```

---

## Quick Start (No Configuration Needed)

1. **Start the temperature server:**

   ```powershell
   node server/temperature-server.js
   ```

2. **Update thermostat data:**

   ```powershell
   .\update-thermostat.ps1 -Temperature 72 -Humidity 45 -Mode heat
   ```

3. **Open your app:**
   - Go to http://localhost:5173
   - Click "Ecobee" button
   - See your data!

---

## Comparison: Local vs IFTTT

### Local Scripts (No Internet)

✅ Works offline  
✅ Instant updates  
✅ Free forever  
✅ Full control  
❌ Requires manual updates or custom API integration

### IFTTT + Webhooks (Internet)

✅ Automatic updates from Ecobee  
✅ No coding required  
❌ Requires internet  
❌ Free tier limits (2 applets, 15 min polling)  
❌ Requires ngrok or cloud deployment

---

## Advanced: Schedule Updates

Create a scheduled task to update every 5 minutes:

```powershell
# Create scheduled task
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File C:\Users\Thomas\calculators\engineering-tools\poll-ecobee.ps1 -IntervalSeconds 300"
$trigger = New-ScheduledTaskTrigger -AtStartup
Register-ScheduledTask -TaskName "EcobeePoll" -Action $action -Trigger $trigger
```

---

## Troubleshooting

### Server not responding

```powershell
# Check if server is running
Invoke-RestMethod -Uri http://localhost:3001/api/health

# If not, start it:
node server/temperature-server.js
```

### View current data

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/temperature/ecobee | Format-List
```

### View update history

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/ecobee/history?limit=10
```

---

## Files Created

- `update-thermostat.ps1` - Quick manual updates
- `poll-ecobee.ps1` - Continuous polling script (customize for your setup)

**No IFTTT, ngrok, or internet required!** 🎉
