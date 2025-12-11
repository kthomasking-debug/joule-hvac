# Bridge Quick Start - Windows

Get the Joule Bridge running locally in 5 minutes.

## Prerequisites

1. **Node.js** - https://nodejs.org/ (v16+)
2. **Ollama** - https://ollama.com/download (Windows version)

## Quick Setup

### Step 1: Install Ollama Model

```powershell
ollama pull llama3.2:3b
```

Wait for download (~2GB). Test it:
```powershell
ollama run llama3.2:3b "Hello"
```

### Step 2: Install Bridge

```powershell
cd pi-bridge
npm install
```

### Step 3: Start Bridge

```powershell
npm start
```

You should see:
```
🚀 Joule Local RAG Bridge running on port 3002
✅ Ready to handle requests!
```

### Step 4: Configure App

1. Open your app: http://localhost:5173
2. Go to **Settings** → **Local LLM (Joule Bridge/Core)**
3. Set **Bridge URL** to: `http://localhost:3002`
4. The app will auto-connect!

## Test It

In a new PowerShell window:

```powershell
# Health check
Invoke-RestMethod -Uri http://localhost:3002/health

# Test query
$body = '{"query":"What is a balance point?","context":{}}'
Invoke-RestMethod -Uri http://localhost:3002/api/ask-joule -Method POST -Body $body -ContentType "application/json"
```

## Automated Setup

Or use the setup script:

```powershell
.\setup-bridge-windows.ps1
```

## Troubleshooting

**Ollama not working?**
- Make sure Ollama is running (check Start Menu)
- Test: `ollama run llama3.2:3b "test"`

**Port 3002 in use?**
- Change port: `$env:PORT = "3003"; npm start`
- Update app settings to match

**Bridge not connecting?**
- Check: `Invoke-RestMethod -Uri http://localhost:3002/health`
- Make sure URL in app is `http://localhost:3002` (not `raspberrypi.local`)

## Full Documentation

See `BRIDGE_WINDOWS_SETUP.md` for complete instructions.

