# Simple Manual Update Script
# Quick way to update thermostat data without IFTTT

param(
    [Parameter(Mandatory=$false)]
    [float]$Temperature,
    
    [Parameter(Mandatory=$false)]
    [int]$Humidity,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('heat', 'cool', 'auto', 'off', 'auxHeatOnly')]
    [string]$Mode,
    
    [string]$ServerUrl = "http://localhost:3001"
)

Write-Host "`n🌡️  Manual Thermostat Update" -ForegroundColor Cyan
Write-Host "============================`n" -ForegroundColor Cyan

# If no parameters provided, prompt for them
if (-not $Temperature) {
    $Temperature = [float](Read-Host "Temperature (°F)")
}

if (-not $Humidity) {
    $Humidity = [int](Read-Host "Humidity (%)")
}

if (-not $Mode) {
    Write-Host "`nAvailable modes: heat, cool, auto, off" -ForegroundColor Gray
    $Mode = Read-Host "HVAC Mode"
}

Write-Host "`nUpdating server..." -ForegroundColor Yellow

try {
    # Update temperature and humidity
    $tempBody = @{
        temperature = $Temperature.ToString()
        humidity = $Humidity.ToString()
    } | ConvertTo-Json
    
    $tempResponse = Invoke-RestMethod -Uri "$ServerUrl/api/ecobee-update" -Method POST -Body $tempBody -ContentType "application/json"
    
    # Update HVAC mode
    $modeBody = @{
        mode = $Mode
    } | ConvertTo-Json
    
    $modeResponse = Invoke-RestMethod -Uri "$ServerUrl/api/ecobee/hvac-mode" -Method POST -Body $modeBody -ContentType "application/json"
    
    Write-Host "`n✅ Update successful!" -ForegroundColor Green
    Write-Host "  Temperature: ${Temperature}°F" -ForegroundColor White
    Write-Host "  Humidity: ${Humidity}%" -ForegroundColor White
    Write-Host "  Mode: $Mode" -ForegroundColor White
    Write-Host "  Update count: $($modeResponse.data.updateCount)" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "View in UI:" -ForegroundColor Cyan
    Write-Host "  1. Open http://localhost:5173" -ForegroundColor White
    Write-Host "  2. Click 'Ecobee' button to switch source" -ForegroundColor White
    Write-Host ""
}
catch {
    Write-Host "`n❌ Error: $_" -ForegroundColor Red
    Write-Host "`nMake sure the temperature server is running:" -ForegroundColor Yellow
    Write-Host "  node server/temperature-server.js`n" -ForegroundColor White
}
