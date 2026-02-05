# Server Setup & Deployment

> **Important:** This app runs on a standalone Node.js server that's **independent of any IDE or development tool**. You don't need Cursor, VS Code, or any dev server running.

## Quick Start

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
| Local computer | `http://localhost:5173` |
| Other computers on WiFi | `http://192.168.0.108:5173` |
| Mobile phone on WiFi | `http://192.168.0.108:5173` |

## Workflow for Development

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
