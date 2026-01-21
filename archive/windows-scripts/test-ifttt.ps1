# Quick Test Script for IFTTT Integration
# This simulates IFTTT sending webhook data

Write-Host "🧪 Testing IFTTT Webhook Integration..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Send webhook data
Write-Host "1️⃣  Sending test webhook data..." -ForegroundColor Yellow
$body = @{
    temperature = "72.5"
    humidity = "45"
    hvacMode = "heat"
    trigger = "manual_test"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/ecobee-webhook" -Method POST -Body $body -ContentType "application/json"
    Write-Host "✅ Webhook received successfully!" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "❌ Failed to send webhook: $_" -ForegroundColor Red
    Write-Host "   Is the temperature server running?" -ForegroundColor Yellow
    Write-Host "   Run: .\start-temp-server.ps1" -ForegroundColor White
    exit 1
}

# Test 2: Check Ecobee endpoint
Write-Host "2️⃣  Checking Ecobee endpoint..." -ForegroundColor Yellow
try {
    $ecobeeData = Invoke-RestMethod -Uri "http://localhost:3001/api/temperature/ecobee"
    Write-Host "✅ Ecobee data retrieved:" -ForegroundColor Green
    Write-Host "   Temperature: $($ecobeeData.temperature)°F" -ForegroundColor White
    Write-Host "   Humidity: $($ecobeeData.humidity)%" -ForegroundColor White
    Write-Host "   HVAC Mode: $($ecobeeData.hvacMode)" -ForegroundColor White
    Write-Host "   Trigger: $($ecobeeData.trigger)" -ForegroundColor White
    Write-Host ""
}
catch {
    Write-Host "❌ Failed to retrieve Ecobee data: $_" -ForegroundColor Red
}

# Test 3: Check history
Write-Host "3️⃣  Checking update history..." -ForegroundColor Yellow
try {
    $history = Invoke-RestMethod -Uri "http://localhost:3001/api/ecobee/history?limit=5"
    Write-Host "✅ History retrieved ($($history.Count) updates):" -ForegroundColor Green
    foreach ($update in $history) {
        Write-Host "   - $($update.trigger): $($update.temperature)°F @ $($update.timestamp)" -ForegroundColor White
    }
    Write-Host ""
}
catch {
    Write-Host "❌ Failed to retrieve history: $_" -ForegroundColor Red
}

# Test 4: Check health
Write-Host "4️⃣  Checking server health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/api/health"
    Write-Host "✅ Server health:" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor White
    Write-Host "   Ecobee Connected: $($health.ecobeeConnected)" -ForegroundColor White
    Write-Host "   Total Updates: $($health.updateCount)" -ForegroundColor White
    Write-Host "   History Size: $($health.historySize)" -ForegroundColor White
    Write-Host ""
}
catch {
    Write-Host "❌ Failed to check health: $_" -ForegroundColor Red
}

Write-Host "🎉 All tests passed! Your server is ready for IFTTT integration." -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Install ngrok from https://ngrok.com/download" -ForegroundColor White
Write-Host "   2. Run ngrok http 3001" -ForegroundColor White
Write-Host "   3. Create IFTTT applet - see IFTTT-SETUP-STEPS.md for details" -ForegroundColor White
Write-Host ""
