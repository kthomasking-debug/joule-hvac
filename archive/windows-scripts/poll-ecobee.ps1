# Local Ecobee Polling Script
# Reads thermostat data and updates the temperature server
# No internet connection or IFTTT required

param(
    [int]$IntervalSeconds = 60,
    [string]$ServerUrl = "http://localhost:3001",
    [switch]$TestMode,
    [int]$MaxIterations = 0  # 0 = infinite
)

Write-Host "🌡️  Local Ecobee Polling Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server: $ServerUrl" -ForegroundColor White
Write-Host "Update interval: $IntervalSeconds seconds" -ForegroundColor White
if ($TestMode) {
    Write-Host "Mode: Test (simulated data)" -ForegroundColor Yellow
    if ($MaxIterations -gt 0) {
        Write-Host "Max iterations: $MaxIterations" -ForegroundColor Yellow
    }
} else {
    Write-Host "Mode: Manual input" -ForegroundColor White
}
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

# Function to get Ecobee data
# TODO: Replace this with actual Ecobee API call or local thermostat read
function Get-EcobeeData {
    param(
        [switch]$TestMode
    )
    
    # OPTION 1: If you have Ecobee API access (requires developer account)
    # $response = Invoke-RestMethod -Uri "https://api.ecobee.com/1/thermostat?..." -Headers @{Authorization="Bearer $token"}
    # return @{
    #     temperature = $response.thermostatList[0].runtime.actualTemperature / 10
    #     humidity = $response.thermostatList[0].runtime.actualHumidity
    #     mode = $response.thermostatList[0].settings.hvacMode
    # }
    
    # OPTION 2: Read from local smart home hub (e.g., Home Assistant)
    # $response = Invoke-RestMethod -Uri "http://homeassistant.local:8123/api/states/climate.ecobee" -Headers @{Authorization="Bearer $token"}
    # return @{
    #     temperature = $response.attributes.current_temperature
    #     humidity = $response.attributes.current_humidity
    #     mode = $response.state
    # }
    
    # OPTION 3: Manual input (for testing)
    if (-not $TestMode) {
        Write-Host "Enter current thermostat data:" -ForegroundColor Yellow
        $temp = Read-Host "  Temperature (°F)"
        $humidity = Read-Host "  Humidity (%)"
        $mode = Read-Host "  HVAC Mode (heat/cool/auto/off)"
        
        return @{
            temperature = [float]$temp
            humidity = [int]$humidity
            mode = $mode
        }
    }
    
    # OPTION 4: Simulated data (for automated testing)
    # Generate realistic varying data
    $baseTemp = 72.0
    $tempVariation = (Get-Random -Minimum -2.0 -Maximum 2.0)
    $temp = [math]::Round($baseTemp + $tempVariation, 1)
    
    $baseHumidity = 45
    $humidityVariation = Get-Random -Minimum -3 -Maximum 3
    $humidity = $baseHumidity + $humidityVariation
    
    $modes = @("heat", "cool", "auto")
    $mode = $modes[(Get-Random -Minimum 0 -Maximum 3)]
    
    return @{
        temperature = $temp
        humidity = $humidity
        mode = $mode
    }
}

# Main polling loop
$updateCount = 0
while ($true) {
    try {
        # Get thermostat data
        $data = Get-EcobeeData -TestMode:$TestMode
        
        # Update temperature and humidity
        $tempBody = @{
            temperature = $data.temperature.ToString()
            humidity = $data.humidity.ToString()
        } | ConvertTo-Json
        
        $tempResponse = Invoke-RestMethod -Uri "$ServerUrl/api/ecobee-update" -Method POST -Body $tempBody -ContentType "application/json"
        
        # Update HVAC mode
        $modeBody = @{
            mode = $data.mode
        } | ConvertTo-Json
        
        $modeResponse = Invoke-RestMethod -Uri "$ServerUrl/api/ecobee/hvac-mode" -Method POST -Body $modeBody -ContentType "application/json"
        
        $updateCount++
        $timestamp = Get-Date -Format "HH:mm:ss"
        
        Write-Host "[$timestamp] Update #$updateCount" -ForegroundColor Green
        Write-Host "  Temperature: $($data.temperature)°F" -ForegroundColor White
        Write-Host "  Humidity: $($data.humidity)%" -ForegroundColor White
        Write-Host "  Mode: $($data.mode)" -ForegroundColor White
        Write-Host ""
        
        # Check if max iterations reached
        if ($MaxIterations -gt 0 -and $updateCount -ge $MaxIterations) {
            Write-Host "Reached $MaxIterations iterations. Exiting..." -ForegroundColor Cyan
            break
        }
        
        # Wait before next update (skip for manual input mode)
        if ($IntervalSeconds -gt 0) {
            Write-Host "Next update in $IntervalSeconds seconds..." -ForegroundColor Gray
            Start-Sleep -Seconds $IntervalSeconds
        }
    }
    catch {
        Write-Host "Error updating server: $_" -ForegroundColor Red
        Write-Host "Retrying in $IntervalSeconds seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds $IntervalSeconds
    }
}
