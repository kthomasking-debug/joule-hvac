# Bridge Profile UI Guide

## Overview

The Bridge Profile Settings UI allows you to configure your home's energy profile and send it to your Pi bridge for weekly cost calculations displayed on the E-Ink HMI.

## Accessing the Settings

1. Navigate to the Settings page: http://localhost:5173/settings
2. Scroll to section **5. Bridge & AI**
3. Click to expand the section if collapsed
4. Find **Bridge Home Profile** under the Joule Bridge section

## Features

### 1. Bridge URL Configuration

- **Default**: `http://127.0.0.1:8090` (mock server for local development)
- **Production**: Change to your Pi's hostname, e.g., `http://bridge.local:8080` or `http://192.168.1.100:8080`
- Click **Save** to store the URL in localStorage
- Click **Test** to verify the connection

**Connection Status:**
- ✅ Green checkmark: Connected successfully
- ❌ Red X: Connection failed

### 2. Home Energy Profile Form

Enter your utility rates and usage:

| Field | Description | Example |
|-------|-------------|---------|
| **Electric Rate (¢/kWh)** | Your electricity cost per kilowatt-hour | 18.5 ¢/kWh |
| **Gas Rate ($/therm)** | Your natural gas cost per therm | $1.25/therm |
| **Weekly kWh** | Optional: Average weekly electricity usage | 250 kWh |
| **Weekly Therms** | Optional: Average weekly gas usage | 15 therms |
| **Notes** | Optional: System description | "3-ton HP, 92% AFUE furnace" |

**Notes:**
- If you leave weekly usage at 0, the bridge can calculate it from your actual thermostat data
- Rates typically come from your utility bill

### 3. Actions

**Save to Bridge** 
- Sends your profile data to the Pi bridge via POST /profile
- Bridge stores this data persistently
- Shows success toast notification

**Compute Weekly Cost** 
- Calls POST /cost-weekly endpoint
- Bridge calculates:
  - Electric cost = (weekly_kwh × electric_rate_cents_kwh) / 100
  - Gas cost = weekly_therms × gas_rate_per_therm
  - Total cost = electric + gas
- Displays results in a green summary card

### 4. Weekly Cost Display

After computing, you'll see:

```
Weekly Cost Estimate
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Electric          Gas              Total
$46.25           $18.75           $65.00

Based on: 250 kWh @ 18.5¢/kWh, 15.0 therms @ $1.25/therm
```

## Example Workflow

1. **Test your connection:**
   - Ensure mock server is running: `MOCK_PORT=8090 python pi-hmi/mock_server.py`
   - Click **Test** button
   - Verify green checkmark appears

2. **Enter your rates:**
   - Electric Rate: `18.5` ¢/kWh
   - Gas Rate: `1.25` $/therm
   - Weekly kWh: `250`
   - Weekly Therms: `15`

3. **Save to bridge:**
   - Click **Save to Bridge**
   - Wait for success toast
   - Bridge now has your profile stored

4. **Calculate weekly cost:**
   - Click **Compute Weekly Cost**
   - See cost breakdown appear below form

5. **View on HMI:**
   - Your Pi E-Ink display will show the weekly cost estimate
   - Updates automatically when you adjust thermostat or usage changes

## API Endpoints Used

- `GET /profile` - Load saved profile
- `POST /profile` - Save profile data
- `POST /cost-weekly` - Compute weekly cost from profile

See [BRIDGE_PROFILE_API.md](./BRIDGE_PROFILE_API.md) for complete API documentation.

## Troubleshooting

### "Connection failed"
- Verify mock server is running on port 8090
- Check bridge URL is correct
- Ensure no firewall blocking the connection
- For Pi access, ensure Pi is on same network and bridge service is running

### "Failed to save profile"
- Check browser console for errors
- Verify mock server logs show POST request
- Try clicking Test first to verify connection

### Profile doesn't persist
- The mock server stores data in memory only
- Restarting the mock server resets profile to defaults
- Production bridge should use persistent storage (file or database)

### Weekly cost shows $0.00
- Ensure you've saved a profile first
- Check that weekly_kwh and weekly_therms are > 0
- Verify rates are reasonable (electric: 5-50 ¢/kWh, gas: $0.50-$5/therm)

## Next Steps

- **Production Setup**: Deploy bridge to your Pi
- **mDNS**: Configure `bridge.local` hostname for easy access
- **HMI Integration**: Pi app.py polls /profile and displays cost on E-Ink screen
- **Automation**: Bridge can auto-calculate usage from thermostat runtime data
- **History**: Extend bridge to track monthly/yearly costs and trends

## Privacy & Security

- ✅ All data stays on your local network
- ✅ No cloud services involved
- ✅ Profile data stored only on your Pi bridge
- ✅ React app stores only bridge URL in localStorage
