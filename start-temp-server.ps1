# Temperature Server Startup Script
# Keeps the server running and shows status

Write-Host "🚀 Starting Temperature Server..." -ForegroundColor Green
Write-Host ""

# Start the server
$serverProcess = Start-Process -FilePath "node" -ArgumentList "server/temperature-server.js" -PassThru -NoNewWindow

# Wait for server to start
Start-Sleep -Seconds 2

# Test if server is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Temperature Server is running!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Server Endpoints:" -ForegroundColor Cyan
    Write-Host "   CPU Temperature: http://localhost:3001/api/temperature/cpu"
    Write-Host "   Ecobee Data:     http://localhost:3001/api/temperature/ecobee"
    Write-Host "   IFTTT Webhook:   http://localhost:3001/api/ecobee-webhook"
    Write-Host "   Health Check:    http://localhost:3001/api/health"
    Write-Host ""
    Write-Host "🌐 Next Step: Run ngrok to expose this server to the internet" -ForegroundColor Yellow
    Write-Host "   Command: ngrok http 3001" -ForegroundColor White
    Write-Host ""
    Write-Host "📝 For complete setup instructions, see:" -ForegroundColor Cyan
    Write-Host "   IFTTT-SETUP-STEPS.md" -ForegroundColor White
    Write-Host ""
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
    
    # Keep the script running
    Wait-Process -Id $serverProcess.Id
}
catch {
    Write-Host "❌ Failed to start server: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running manually:" -ForegroundColor Yellow
    Write-Host "   node server/temperature-server.js" -ForegroundColor White
}
