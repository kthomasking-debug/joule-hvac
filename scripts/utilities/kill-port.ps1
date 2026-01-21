# Kill processes on a specific port (default: 5173)
# Usage: .\scripts\kill-port.ps1 [port]
# Example: .\scripts\kill-port.ps1 5173

param(
    [int]$Port = 5173
)

Write-Host "🔍 Checking for processes on port $Port..." -ForegroundColor Cyan

# Find processes using the port
$connections = netstat -ano | findstr ":$Port"

if ($connections) {
    Write-Host "⚠️  Found processes on port $Port:" -ForegroundColor Yellow
    $connections | ForEach-Object {
        Write-Host "  $_" -ForegroundColor Gray
    }
    
    # Extract PIDs (last column)
    $pids = $connections | ForEach-Object {
        $parts = $_ -split '\s+'
        $parts[-1]
    } | Sort-Object -Unique
    
    # Kill each process
    foreach ($pid in $pids) {
        if ($pid -match '^\d+$') {
            Write-Host "🔪 Killing process $pid..." -ForegroundColor Red
            try {
                taskkill /PID $pid /F 2>&1 | Out-Null
                Write-Host "  ✓ Process $pid terminated" -ForegroundColor Green
            } catch {
                Write-Host "  ✗ Failed to kill process $pid" -ForegroundColor Red
            }
        }
    }
    
    Write-Host "✅ Port $Port should now be free" -ForegroundColor Green
} else {
    Write-Host "✓ Port $Port is already free" -ForegroundColor Green
}




