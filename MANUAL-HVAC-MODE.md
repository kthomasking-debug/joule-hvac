# Manual HVAC Mode Setter

**New Endpoint:** `POST /api/ecobee/hvac-mode`

Use this endpoint to manually set the HVAC mode when IFTTT free tier doesn't include climate/mode ingredients.

---

## Usage

### Set Mode to Heat

```powershell
$body = '{"mode":"heat"}'
Invoke-RestMethod -Uri http://localhost:3001/api/ecobee/hvac-mode -Method POST -Body $body -ContentType "application/json"
```

### Set Mode to Cool

```powershell
$body = '{"mode":"cool"}'
Invoke-RestMethod -Uri http://localhost:3001/api/ecobee/hvac-mode -Method POST -Body $body -ContentType "application/json"
```

### Set Mode to Auto

```powershell
$body = '{"mode":"auto"}'
Invoke-RestMethod -Uri http://localhost:3001/api/ecobee/hvac-mode -Method POST -Body $body -ContentType "application/json"
```

### Set Mode to Off

```powershell
$body = '{"mode":"off"}'
Invoke-RestMethod -Uri http://localhost:3001/api/ecobee/hvac-mode -Method POST -Body $body -ContentType "application/json"
```

---

## Via ngrok (Remote)

```powershell
$body = '{"mode":"heat"}'
Invoke-RestMethod -Uri https://centrally-augmented-doreatha.ngrok-free.dev/api/ecobee/hvac-mode -Method POST -Body $body -ContentType "application/json"
```

---

## Via curl

```powershell
curl.exe -X POST http://localhost:3001/api/ecobee/hvac-mode `
  -H "Content-Type: application/json" `
  -d '{"mode":"cool"}'
```

---

## Response Format

```json
{
  "status": "ok",
  "mode": "cool",
  "data": {
    "temperature": 72,
    "humidity": 45,
    "hvacMode": "cool",
    "trigger": "manual",
    "timestamp": "2025-11-20T17:33:59.783Z",
    "lastUpdate": "2025-11-20T17:33:59.787Z",
    "updateCount": 3
  }
}
```

---

## Workflow with IFTTT Free Tier

Since IFTTT free tier temperature triggers don't include HVAC mode:

1. **IFTTT Applet** sends temperature (and optionally humidity):

   ```json
   {
     "temperature": "{{IndoorTemperature}}",
     "humidity": "{{IndoorHumidity}}",
     "trigger": "temp_above_70"
   }
   ```

2. **Manually set mode** when you change your thermostat:

   ```powershell
   # When you switch to heat
   $body = '{"mode":"heat"}'
   Invoke-RestMethod -Uri http://localhost:3001/api/ecobee/hvac-mode -Method POST -Body $body -ContentType "application/json"
   ```

3. **UI displays** the most recent mode along with IFTTT temperature updates

---

## Alternative: Create Simple UI Toggle

You could add a mode selector in your UI that calls this endpoint, so you click "Heat/Cool/Auto/Off" buttons instead of running PowerShell commands.

Would you like me to create a simple mode selector component for the UI?

---

## Accepted Mode Values

Common HVAC modes:

- `heat`
- `cool`
- `auto`
- `off`
- `auxHeatOnly` (emergency heat)
- `heatCool` (some thermostats)

The endpoint accepts any string; your UI will display whatever you set.

---

## Verify Current Mode

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/temperature/ecobee
```

Check the `hvacMode` field in the response.

---

## History Tracking

Mode changes are logged to history with trigger `manual_mode`:

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/ecobee/history?limit=5
```

---

## Error Handling

**Missing mode parameter:**

```json
{
  "error": "Missing mode parameter",
  "message": "Provide mode or hvacMode in request body"
}
```

**Fix:** Include `mode` or `hvacMode` in request body.

---

## Quick Commands Reference

```powershell
# Set to heat
Invoke-RestMethod -Uri http://localhost:3001/api/ecobee/hvac-mode -Method POST -Body '{"mode":"heat"}' -ContentType "application/json"

# Set to cool
Invoke-RestMethod -Uri http://localhost:3001/api/ecobee/hvac-mode -Method POST -Body '{"mode":"cool"}' -ContentType "application/json"

# Set to auto
Invoke-RestMethod -Uri http://localhost:3001/api/ecobee/hvac-mode -Method POST -Body '{"mode":"auto"}' -ContentType "application/json"

# Check current data
Invoke-RestMethod -Uri http://localhost:3001/api/temperature/ecobee | Format-List
```
