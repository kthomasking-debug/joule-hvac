<#
clean-node-install.ps1

Removes node_modules and attempts to run 'npm ci --legacy-peer-deps' with retries.
This helps address errors like ENOTEMPTY when node_modules cannot be removed cleanly.

Usage: powershell -File scripts/clean-node-install.ps1
#>

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-ErrorAndExit($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red; exit 1 }

Write-Info "Running clean-node-install.ps1"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Resolve-Path | Split-Path -Parent
Set-Location $repoRoot

Write-Info "Working directory: $(Get-Location)"

function Run-Command($exe, $args) {
    $proc = Start-Process -FilePath $exe -ArgumentList $args -NoNewWindow -PassThru -Wait -ErrorAction SilentlyContinue
    return $proc.ExitCode
}

Write-Info "Removing node_modules if present"
try {
    if (Test-Path "$repoRoot\node_modules") {
        # Use cmd 'rmdir /s /q' as it's more reliable when folders contain open files
        cmd /c "rmdir /s /q \"$repoRoot\node_modules\""
        Start-Sleep -Seconds 1
        if (Test-Path "$repoRoot\node_modules") {
            Write-Warn "node_modules still present after rmdir; attempting Remove-Item"
            Remove-Item -Path "$repoRoot\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
        }
        Write-Info "node_modules removed"
    } else {
        Write-Info "node_modules not found; skipping removal"
    }
} catch {
    Write-Warn "Failed to remove node_modules cleanly: $_.Exception.Message"
}

Write-Info "Clearing npm cache"
try { npm cache clean --force } catch { Write-Warn "npm cache clean returned an error, continuing anyway" }

Write-Info "Attempting 'npm ci --legacy-peer-deps' with retries (max 3)"
$attempt = 0
$maxAttempts = 3
while ($attempt -lt $maxAttempts) {
    $attempt++
    Write-Info "npm ci attempt #$attempt"
    $exit = Run-Command npm "ci --legacy-peer-deps"
    if ($exit -eq 0) { Write-Info "npm ci succeeded"; exit 0 }
    Write-Warn "npm ci failed with exit code $exit"
    Start-Sleep -Seconds 2
    # Retry by removing node_modules and clearing cache again
    Write-Info "Retry: removing node_modules and clearing npm cache"
    try { cmd /c "rmdir /s /q \"$repoRoot\node_modules\"" } catch {}
    try { npm cache clean --force } catch {}
}

Write-ErrorAndExit "npm ci failed after $maxAttempts attempts. Please inspect the errors above or run 'npm ci --legacy-peer-deps' manually."
