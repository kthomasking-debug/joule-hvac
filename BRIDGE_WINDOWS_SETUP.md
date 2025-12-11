# Bridge Setup Guide for Windows

This guide walks you through setting up the Joule Bridge locally on Windows. The bridge provides:
- **Local LLM API** (RAG) - Ask Joule queries using Ollama instead of Groq
- **HomeKit HAP Controller** - Local thermostat control (via prostat-bridge)

---

## Prerequisites

1. **Node.js** (v16 or higher)
   - Download from: https://nodejs.org/
   - Verify installation:
     ```powershell
     node --version
     npm --version
     ```

2. **Ollama** (for Local LLM Bridge)
   - Download from: https://ollama.com/download
   - Install the Windows version
   - Verify installation:
     ```powershell
     ollama --version
     ```

---

## Option 1: Local LLM Bridge (pi-bridge)

This bridge provides a local alternative to Groq API for Ask Joule queries.

### Step 1: Install Ollama Model

1. Open PowerShell
2. Pull the Llama 3.2 3B model:
   ```powershell
   ollama pull llama3.2:3b
   ```
   This will download ~2GB. Wait for it to complete.

3. Test Ollama:
   ```powershell
   ollama run llama3.2:3b "Hello, how are you?"
   ```
   If it responds, Ollama is working!

### Step 2: Install Bridge Dependencies

1. Navigate to the bridge directory:
   ```powershell
   cd pi-bridge
   ```

2. Install Node.js dependencies:
   ```powershell
   npm install
   ```

### Step 3: Configure the Bridge

The bridge uses these default settings:
- **Port**: 3002
- **Ollama Host**: http://localhost:11434
- **Model**: llama3.2:3b

You can override these with environment variables:
```powershell
$env:PORT = "3002"
$env:OLLAMA_HOST = "http://localhost:11434"
$env:MODEL = "llama3.2:3b"
```

### Step 4: Start the Bridge

```powershell
npm start
```

You should see:
```
🚀 Joule Local RAG Bridge running on port 3002
📚 Model: llama3.2:3b
🔗 Ollama: http://localhost:11434
📁 Docs directory: C:\Users\Thomas\calculators\Cursor\engineering-tools\pi-bridge\docs
✅ Ready to handle requests!
   Health: http://localhost:3002/health
   API: http://localhost:3002/api/ask-joule
```

### Step 5: Test the Bridge

Open a new PowerShell window and test:

```powershell
# Health check
Invoke-RestMethod -Uri http://localhost:3002/health

# Test Ask Joule query
$body = @{
    query = "What's my balance point?"
    context = @{
        userSettings = @{
            homeSize = 1800
            insulation = "average"
        }
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3002/api/ask-joule -Method POST -Body $body -ContentType "application/json"
```

### Step 6: Configure Your App

1. Open your React app: http://localhost:5173
2. Go to **Settings** page
3. Scroll to **"Local LLM (Joule Bridge/Core)"** section
4. Set the **Raspberry Pi Bridge URL** to: `http://localhost:3002`
5. The app will automatically detect and connect to the bridge

---

## Option 2: HomeKit HAP Controller (prostat-bridge)

This bridge provides local HomeKit control for Ecobee thermostats.

### Step 1: Install Python Dependencies

1. Make sure Python 3 is installed:
   ```powershell
   python --version
   ```

2. Navigate to the bridge directory:
   ```powershell
   cd prostat-bridge
   ```

3. Install Python dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

### Step 2: Start the Bridge

```powershell
python server.py
```

The service will start on `http://localhost:8080`

### Step 3: Pair with Ecobee

1. On your Ecobee thermostat:
   - Go to **Menu → Settings → HomeKit**
   - Select **"Enable Pairing"**
   - Note the 8-digit pairing code (format: XXX-XX-XXX)

2. Discover devices:
   ```powershell
   Invoke-RestMethod -Uri http://localhost:8080/api/discover
   ```

3. Pair with your Ecobee:
   ```powershell
   $body = @{
       device_id = "XX:XX:XX:XX:XX:XX"  # From discover step
       pairing_code = "123-45-678"       # From Ecobee
   } | ConvertTo-Json

   Invoke-RestMethod -Uri http://localhost:8080/api/pair -Method POST -Body $body -ContentType "application/json"
   ```

4. Verify pairing:
   ```powershell
   Invoke-RestMethod -Uri http://localhost:8080/api/paired
   ```

---

## Running Both Bridges

You can run both bridges simultaneously:

1. **Terminal 1** - Local LLM Bridge:
   ```powershell
   cd pi-bridge
   npm start
   ```

2. **Terminal 2** - HomeKit Bridge:
   ```powershell
   cd prostat-bridge
   python server.py
   ```

3. **Terminal 3** - Your React app:
   ```powershell
   npm run dev
   ```

---

## Troubleshooting

### Ollama Not Responding

1. Check if Ollama is running:
   ```powershell
   Get-Process ollama
   ```

2. Restart Ollama service:
   - Open Ollama app from Start Menu
   - Or restart the service:
     ```powershell
     Stop-Service -Name "Ollama" -ErrorAction SilentlyContinue
     Start-Service -Name "Ollama" -ErrorAction SilentlyContinue
     ```

3. Test Ollama directly:
   ```powershell
   ollama run llama3.2:3b "test"
   ```

### Bridge Port Already in Use

If port 3002 is already in use:

1. Find what's using it:
   ```powershell
   netstat -ano | findstr :3002
   ```

2. Change the bridge port:
   ```powershell
   $env:PORT = "3003"
   npm start
   ```

3. Update your app settings to use the new port

### Bridge Not Connecting from App

1. Check bridge is running:
   ```powershell
   Invoke-RestMethod -Uri http://localhost:3002/health
   ```

2. Check app settings:
   - Go to Settings → Local LLM
   - Verify URL is `http://localhost:3002` (not `raspberrypi.local`)

3. Check browser console for CORS errors
   - The bridge should have CORS enabled (it does by default)

### Slow Responses from Local LLM

The Llama 3.2 3B model runs locally and may be slower than Groq:
- **Expected**: 13-21 tokens/second on Raspberry Pi 5
- **On Windows**: Should be faster, but depends on your CPU
- **First token latency**: 140-250ms is normal

If it's too slow, you can:
- Use a smaller model: `ollama pull llama3.2:1b`
- Or continue using Groq API (set in app settings)

---

## Adding Documents to RAG

The bridge can use documents for context. Add `.txt` or `.md` files to:

```
pi-bridge/docs/
```

Or use the ingest API:

```powershell
$body = @{
    filename = "ashrae-standards.txt"
    content = "Your document content here..."
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3002/api/ingest -Method POST -Body $body -ContentType "application/json"
```

---

## Running as a Windows Service (Optional)

To run the bridge automatically on startup:

1. Install `node-windows`:
   ```powershell
   npm install -g node-windows
   ```

2. Create a service script (save as `install-service.ps1`):
   ```powershell
   npm install -g node-windows
   node install-service.js
   ```

3. Or use Task Scheduler:
   - Open Task Scheduler
   - Create Basic Task
   - Set trigger: "When computer starts"
   - Set action: "Start a program"
   - Program: `node`
   - Arguments: `C:\Users\Thomas\calculators\Cursor\engineering-tools\pi-bridge\server.js`
   - Start in: `C:\Users\Thomas\calculators\Cursor\engineering-tools\pi-bridge`

---

## Next Steps

- ✅ Bridge is running and accessible at http://localhost:3002
- ✅ App is configured to use the bridge
- ✅ Test Ask Joule queries to verify local LLM is working
- ✅ (Optional) Pair Ecobee for local HomeKit control

For more information, see:
- `pi-bridge/README.md` - Bridge-specific documentation
- `prostat-bridge/README.md` - HomeKit controller documentation

