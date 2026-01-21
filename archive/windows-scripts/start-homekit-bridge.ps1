# HomeKit Bridge (ProStat Bridge) Startup Script for Windows
# Starts the Python HomeKit HAP controller server on port 8080

Write-Host "🚀 Starting HomeKit Bridge (ProStat Bridge)..." -ForegroundColor Cyan
Write-Host ""

# Check Python
Write-Host "Checking Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python installed: $pythonVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ Python not found. Please install from https://www.python.org/downloads/" -ForegroundColor Red
    exit 1
}

# Navigate to prostat-bridge directory
$bridgeDir = Join-Path $PSScriptRoot "prostat-bridge"
if (-not (Test-Path $bridgeDir)) {
    Write-Host "❌ prostat-bridge directory not found at: $bridgeDir" -ForegroundColor Red
    exit 1
}

Set-Location $bridgeDir

# Check if dependencies are installed
Write-Host ""
Write-Host "Checking Python dependencies..." -ForegroundColor Yellow
$depsMissing = $false
try {
    python -c "import aiohomekit" 2>$null
    if ($LASTEXITCODE -ne 0) {
        $depsMissing = $true
    }
}
catch {
    $depsMissing = $true
}

if ($depsMissing) {
    Write-Host "⚠️  Python dependencies not installed" -ForegroundColor Yellow
    Write-Host "Installing dependencies from requirements.txt..." -ForegroundColor Yellow
    python -m pip install -r requirements.txt
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Dependencies installed" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        Write-Host "Try running manually: python -m pip install -r requirements.txt" -ForegroundColor Yellow
        exit 1
    }
}
else {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
}

# Start the server
Write-Host ""
Write-Host "Starting HomeKit Bridge server..." -ForegroundColor Yellow
Write-Host ""

# Start the server in the current window
$serverProcess = Start-Process -FilePath "python" -ArgumentList "server.py" -PassThru -NoNewWindow

# Wait for server to start
Start-Sleep -Seconds 3

# Test if server is running
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8080/health" -UseBasicParsing -ErrorAction Stop
    Write-Host ""
    Write-Host "✅ HomeKit Bridge is running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Server Endpoints:" -ForegroundColor Cyan
    Write-Host "   Health Check:      http://localhost:8080/health" -ForegroundColor White
    Write-Host "   Discover Devices:  http://localhost:8080/api/discover" -ForegroundColor White
    Write-Host "   Paired Devices:    http://localhost:8080/api/paired" -ForegroundColor White
    Write-Host "   Status:            http://localhost:8080/api/status" -ForegroundColor White
    Write-Host ""
    Write-Host "📝 Next Steps:" -ForegroundColor Yellow
    Write-Host "   1. Enable HomeKit on your Ecobee thermostat" -ForegroundColor White
    Write-Host "   2. Discover devices: GET http://localhost:8080/api/discover" -ForegroundColor White
    Write-Host "   3. Pair with device: POST http://localhost:8080/api/pair" -ForegroundColor White
    Write-Host ""
    Write-Host "🔗 Configure your app:" -ForegroundColor Cyan
    Write-Host "   Set Joule Bridge URL to: http://localhost:8080" -ForegroundColor White
    Write-Host ""
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
    
    # Keep the script running
    Wait-Process -Id $serverProcess.Id
}
catch {
    Write-Host ""
    Write-Host "⚠️  Server may still be starting up, or there was an error" -ForegroundColor Yellow
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Check the output above for Python errors" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Try running manually:" -ForegroundColor Yellow
    Write-Host "   cd prostat-bridge" -ForegroundColor White
    Write-Host "   python server.py" -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

