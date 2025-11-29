# CPU Temperature Bench Testing Setup

This feature enables bench testing of the thermostat using CPU temperature as the simulated room temperature.

## Overview

The CPU temperature is read from your PC's hardware sensors, divided by 2, and used as the simulated room temperature for thermostat testing. This allows you to test thermostat logic without needing actual HVAC equipment.

## Installation

### 1. Install Dependencies

```bash
npm install
```

This will install:

- `systeminformation` - Reads CPU temperature from hardware sensors
- `cors` - Enables cross-origin requests between React app and temperature server
- `express` - Backend server for exposing temperature data

### 2. Start the Temperature Server

In a separate terminal window:

```bash
npm run temp-server
```

You should see:

```
🌡️  Temperature API running on port 3001
   Access at: http://localhost:3001/api/temperature
```

### 3. Start the Main Application

In your main terminal:

```bash
npm run dev
```

## How It Works

### Backend (Temperature Server)

The server (`server/temperature-server.js`) runs on port 3001 and exposes two endpoints:

- `GET /api/temperature` - Returns CPU temperature data

  ```json
  {
    "main": 32.5, // CPU main temp ÷ 2 (°C)
    "cores": [31, 33], // Core temps ÷ 2 (°C)
    "max": 35.5, // Max temp ÷ 2 (°C)
    "originalMain": 65, // Actual CPU temp before division (°C)
    "originalMax": 71 // Actual max before division (°C)
  }
  ```

- `GET /api/health` - Health check endpoint

### Frontend (React Components)

1. **Hook**: `src/hooks/useCpuTemperature.js`

   - Polls temperature API every 2 seconds
   - Handles connection status and errors
   - Provides Celsius to Fahrenheit conversion

2. **Component**: `src/components/CpuTemperatureDisplay.jsx`

   - Shows live CPU temperature
   - Displays both Celsius and Fahrenheit
   - Connection status indicator
   - Compact mode for tight spaces

3. **Integration**:
   - **Home Page**: Full temperature display with bench test indicator
   - **Contactor Demo**: Compact temperature display showing when contactors engage

## Temperature Display

The component shows:

- **Main Temp**: Primary CPU temperature (÷ 2) in °F and °C
- **Max Temp**: Maximum core temperature (÷ 2) in °F and °C
- **Original Values**: Actual CPU temperatures before division
- **Live Status**: Green checkmark when connected, red X when offline

### Example Output

```
Main Temp: 77.0°F (25.0°C)
Original: 50.0°C

Max Temp: 81.5°F (27.5°C)
Original: 55.0°C
```

## Bench Test Mode

**Temperature Formula**: `Room Temperature = CPU Temperature ÷ 2`

This formula keeps the simulated room temperature in a realistic range:

- CPU at 50°C → 25°C room temp → 77°F
- CPU at 60°C → 30°C room temp → 86°F
- CPU at 70°C → 35°C room temp → 95°F

Perfect for testing:

- ✅ Heating cycles (when room temp < setpoint)
- ✅ Cooling cycles (when room temp > setpoint)
- ✅ Contactor engagement timing
- ✅ Short-cycle prevention
- ✅ Lockout delays

## Testing the Setup

### 1. Verify Temperature Server

```bash
curl http://localhost:3001/api/temperature
```

Should return JSON with temperature data.

### 2. Check Browser Console

Open DevTools console and look for:

```
CPU temperature: {main: 32.5, max: 35.5, ...}
```

### 3. Visual Indicators

- **Home Page**: Should show CPU temperature card with live readings
- **Contactor Demo**: Should show compact temperature display below power indicator

### 4. Offline Behavior

If the server isn't running, you'll see:

```
CPU Temperature Offline
Start server: node server/temperature-server.js
```

## Troubleshooting

### "Failed to read temperature"

**Cause**: Some systems don't expose CPU temperature sensors to Node.js

**Solutions**:

1. Run as administrator (Windows) or with sudo (Linux)
2. Install hardware monitoring tools:
   - Windows: HWMonitor, Core Temp
   - Linux: lm-sensors (`sudo apt-get install lm-sensors`)
3. Check if `systeminformation` supports your system:
   ```bash
   node -e "require('systeminformation').cpuTemperature().then(console.log)"
   ```

### Port 3001 Already in Use

Change the port in `server/temperature-server.js`:

```javascript
const PORT = 3002; // Change to any available port
```

Also update the hook in `src/hooks/useCpuTemperature.js`:

```javascript
const response = await fetch("http://localhost:3002/api/temperature");
```

### CORS Errors

The server includes CORS middleware by default. If you still see CORS errors:

1. Check that the temperature server is running
2. Verify the fetch URL matches the server port
3. Clear browser cache and reload

## Running Both Servers

You can run both servers in the same terminal using concurrently:

```bash
npm install -D concurrently
```

Add to `package.json` scripts:

```json
"dev:all": "concurrently \"npm run temp-server\" \"npm run dev\""
```

Then start both with:

```bash
npm run dev:all
```

## Production Notes

⚠️ **This is for bench testing only!**

- Temperature server runs locally only (localhost:3001)
- Not exposed to external networks
- Not included in production builds
- CPU temperature polling stops when React app is closed

## API Reference

### `useCpuTemperature(intervalMs)`

React hook for fetching CPU temperature.

**Parameters:**

- `intervalMs` (number, default: 2000) - Polling interval in milliseconds

**Returns:**

```javascript
{
  temperature: {
    main: number,        // CPU temp ÷ 2 in °C
    cores: number[],     // Core temps ÷ 2 in °C
    max: number,         // Max temp ÷ 2 in °C
    originalMain: number,
    originalMax: number
  },
  loading: boolean,
  error: string | null,
  isConnected: boolean
}
```

### `celsiusToFahrenheit(celsius)`

Utility function to convert Celsius to Fahrenheit.

**Parameters:**

- `celsius` (number) - Temperature in Celsius

**Returns:** Temperature in Fahrenheit (number)

## Example Usage

### Basic Display

```jsx
import CpuTemperatureDisplay from "../components/CpuTemperatureDisplay";

function MyPage() {
  return (
    <div>
      <CpuTemperatureDisplay />
    </div>
  );
}
```

### Compact Mode

```jsx
<CpuTemperatureDisplay compact className="my-4" />
```

### Custom Hook Usage

```jsx
import {
  useCpuTemperature,
  celsiusToFahrenheit,
} from "../hooks/useCpuTemperature";

function CustomComponent() {
  const { temperature, isConnected } = useCpuTemperature(1000); // Poll every 1 second

  if (!isConnected) return <div>Offline</div>;

  return <div>CPU: {celsiusToFahrenheit(temperature.main).toFixed(1)}°F</div>;
}
```

## See Also

- [Relay Setup Documentation](./relay-setup.md) - For Arduino relay control
- [Thermostat User Manual](./THERMOSTAT_USER_MANUAL.md) - For thermostat operation
- [Contactor Demo](../src/pages/ContactorDemo.jsx) - Visual contactor simulation
