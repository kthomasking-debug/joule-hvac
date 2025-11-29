# Quick Start - CPU Temperature Bench Testing

## Start Temperature Server & React App

### Option 1: Two Terminals (Recommended)

**Terminal 1** - Temperature Server:

```bash
npm run temp-server
```

**Terminal 2** - React App:

```bash
npm run dev
```

### Option 2: Background Temperature Server (Windows PowerShell)

```powershell
# Start temperature server in background
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run temp-server"

# Start React app in current terminal
npm run dev
```

### Option 3: Single Command (requires concurrently)

```bash
# Install concurrently
npm install -D concurrently

# Run both servers
npx concurrently "npm run temp-server" "npm run dev"
```

## What You Should See

### Temperature Server Output

```
🌡️  Temperature API running on port 3001
   Access at: http://localhost:3001/api/temperature
```

### React App

Navigate to home page or contactor demo - you should see CPU temperature display with live readings.

## Quick Test

Test the temperature API:

```bash
curl http://localhost:3001/api/temperature
```

Expected response:

```json
{
  "main": 32.5,
  "cores": [31, 33, 34],
  "max": 35.5,
  "originalMain": 65,
  "originalMax": 71
}
```

## Pages with CPU Temperature

1. **Home Dashboard** (`/`) - Full temperature card with bench test indicator
2. **Contactor Demo** (`/contactor-demo`) - Compact temperature display

## Troubleshooting

- **Server won't start**: Port 3001 may be in use. Change port in `server/temperature-server.js`
- **No temperature data**: Some systems don't expose sensors. Try running as admin
- **Offline indicator**: Make sure temperature server is running on port 3001

## See Full Documentation

[CPU Temperature Bench Test Guide](./CPU-TEMPERATURE-BENCH-TEST.md)
