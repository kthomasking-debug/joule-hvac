# Zombie Process Fix

## The Problem

When you hit `Ctrl+C` or close the terminal, Vite dev server processes sometimes don't die fast enough. This causes "zombie processes" that keep port 5173 busy, forcing Vite to move to 5174, 5175, etc.

## The Solution

### 1. **Automatic Fix (Recommended)**

Use the `dev:clean` script which kills zombies before starting:

```bash
npm run dev:clean
```

This will:
- Kill any process on port 5173
- Start the dev server on port 5173

### 2. **Manual Kill Script**

Kill zombies manually before starting dev server:

**Windows (PowerShell):**
```bash
npm run kill-port:5173
# or
.\scripts\kill-port.ps1 5173
```

**Linux/macOS:**
```bash
chmod +x scripts/kill-port.sh
./scripts/kill-port.sh 5173
```

### 3. **Vite Configuration**

Vite is now configured to:
- **Force port 5173** (won't move to 5174, 5175, etc.)
- **Fail if port is busy** (`strictPort: true`) - forces you to kill zombies instead of chasing ports

### 4. **Cursor Terminal Fix (Lazy Method)**

1. Click the **trash can icon** in the Cursor terminal to kill the session
2. Wait 2 seconds
3. Open a new terminal
4. Run `npm run dev`

This usually cleans up the port automatically.

## Why This Matters

- **Clean browser history**: Always uses port 5173, so your browser remembers the URL
- **No port chasing**: Vite won't silently move to 5174, 5175, etc.
- **Faster debugging**: You know exactly which port to use

## Quick Reference

```bash
# Kill zombies and start dev server
npm run dev:clean

# Just kill zombies (manual)
npm run kill-port:5173

# Start dev server (will fail if port is busy - forces you to kill zombies)
npm run dev
```




