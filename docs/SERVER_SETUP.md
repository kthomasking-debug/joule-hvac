# Local Development Server

> ⚠️ **This guide is for developers only.** End users should visit `https://joule.netlify.app` or their Pi's local URL.

This document explains how to run the app locally for development and testing. It's **not** required for end users.

## For End Users

Simply visit one of these URLs - no setup needed:

| Scenario | URL |
|----------|-----|
| **From anywhere (Internet)** | `https://joule.netlify.app` |
| **On home WiFi (Pi installed)** | `http://192.168.0.103:8080` |

That's it. No servers to start, no building required.

---

## For Developers: Local Testing

If you're developing or testing locally, you can run a standalone server on your machine.

### Build the App

```bash
cd /home/thomas/git/joule-hvac
npm run build
```

This creates optimized production files in `dist/`.

### Run the Server

```bash
node server.js
```

The server will start and show:

```
🚀 App running at http://localhost:5173
📱 Also available at http://192.168.0.108:5173

✅ This server will keep running independently of Cursor
   Stop with: CTRL-C
```

## How It Works

The `server.js` file is a simple Express.js server that:

1. **Serves static files** from the `dist/` directory
2. **Handles client-side routing** - all routes return `index.html` so the React router works
3. **Runs independently** - doesn't require Cursor, VS Code, or any development tools

## Accessing the App

| Device | URL |
|--------|-----|
| Your computer | `http://localhost:5173` |
| Other computers on WiFi | `http://192.168.0.108:5173` |
| Mobile phone on WiFi | `http://192.168.0.108:5173` |

## Development Workflow

1. **Make code changes** in your editor
2. **Build**: `npm run build`
3. **Server automatically serves new files** (just refresh browser)

Or to watch for changes automatically:

```bash
# Terminal 1: Watch for changes and auto-build
npm run build -- --watch

# Terminal 2: Run the server
node server.js
```

## Stopping the Server

Press `CTRL-C` in the terminal running `node server.js`

The server will gracefully shut down. You can restart it anytime by running `node server.js` again.

## Deploying to Pi

To deploy to the Pi:

```bash
# Build the app
npm run build

# Deploy to Pi
./update-remote-bridge.sh
```

This copies the `dist/` files to the Pi at `/home/pi/git/joule-hvac/dist/`. The Pi's prostat-bridge also serves these files on port 8080.

## Troubleshooting

### "Port 5173 already in use"

Kill any existing process on that port:

```bash
lsof -i :5173
kill -9 <PID>
```

Then restart with `node server.js`

### "Cannot find module 'express'"

Make sure you've installed dependencies:

```bash
npm install
```

### Routes return 404

Make sure you rebuilt after making changes:

```bash
npm run build
node server.js
```

### API calls fail (e.g., `/api/status`)

- **Localhost**: Bridge must be running on same machine with CORS headers
- **Network access**: Bridge (Pi) must be reachable from your device
- **Check logs**: See [docs/ARCHITECTURE.md](ARCHITECTURE.md) for bridge troubleshooting
