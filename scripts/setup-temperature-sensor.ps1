# Setup DS18B20 USB Temperature Sensor
# This script helps configure the temperature sensor for thermostat functionality

Write-Host "=== DS18B20 Temperature Sensor Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if usbtemp is installed
Write-Host "Checking for usbtemp package..." -ForegroundColor Yellow
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$hasUsbtemp = $packageJson.dependencies.PSObject.Properties.Name -contains "usbtemp" -or 
              $packageJson.devDependencies.PSObject.Properties.Name -contains "usbtemp"

if (-not $hasUsbtemp) {
    Write-Host "usbtemp not found in package.json" -ForegroundColor Red
    Write-Host "Installing usbtemp..." -ForegroundColor Yellow
    npm install usbtemp
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ usbtemp installed successfully" -ForegroundColor Green
    } else {
        Write-Host "✗ Failed to install usbtemp" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✓ usbtemp already installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Available COM Ports ===" -ForegroundColor Cyan
$ports = [System.IO.Ports.SerialPort]::GetPortNames()
if ($ports.Count -eq 0) {
    Write-Host "No COM ports found. Make sure your DS18B20 USB device is plugged in." -ForegroundColor Red
} else {
    Write-Host "Found $($ports.Count) COM port(s):" -ForegroundColor Green
    foreach ($port in $ports) {
        Write-Host "  - $port" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Plug in your DS18B20 USB temperature sensor" -ForegroundColor White
Write-Host "2. Note the COM port from the list above (or check Device Manager)" -ForegroundColor White
Write-Host "3. Start the relay server with temperature sensor enabled:" -ForegroundColor White
Write-Host ""
Write-Host '   $env:TEMP_SENSOR_ENABLED = "true"' -ForegroundColor Yellow
Write-Host '   $env:RELAY_ENABLED = "true"' -ForegroundColor Yellow
Write-Host '   $env:RELAY_SECRET = "abc123"' -ForegroundColor Yellow
Write-Host '   $env:RELAY_PORT = "COM3"  # Change to your relay COM port if using hardware' -ForegroundColor Yellow
Write-Host '   node scripts/relay-server.js' -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Test temperature reading:" -ForegroundColor White
Write-Host ""
Write-Host "   curl http://localhost:3005/api/temperature" -ForegroundColor Yellow
Write-Host ""
Write-Host "5. In the app, enable Auto Thermostat Mode in ShortCycleTest" -ForegroundColor White
Write-Host ""
Write-Host "For more details, see docs/relay-setup.md" -ForegroundColor Cyan
