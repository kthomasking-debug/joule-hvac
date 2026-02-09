# Deploy web app and Pi HMI to Raspberry Pi bridge (Windows)
# Builds the production app, copies dist + pi-hmi/app.py, restarts bridge and pi-hmi services.
# Requires: OpenSSH (scp/ssh) on Windows, or set up SSH keys to avoid password prompts.
# Run from project root: .\deploy-to-pi.ps1

$ErrorActionPreference = "Stop"
$PI_USER = "pi"
$PI_HOST = "192.168.0.103"
$REMOTE_BASE = "/home/pi/git/joule-hvac"

# Ensure we're in the project root (has package.json)
if (-not (Test-Path "package.json")) {
    Write-Error "Run this script from the project root (the folder that contains package.json)."
    exit 1
}

Write-Host "Building production web app..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Ensuring Pi directories exist and are writable by pi..." -ForegroundColor Cyan
ssh "${PI_USER}@${PI_HOST}" "sudo mkdir -p ${REMOTE_BASE}/dist ${REMOTE_BASE}/pi-hmi && sudo chown -R pi:pi ${REMOTE_BASE}"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Copying build to Pi..." -ForegroundColor Cyan
scp -r dist "${PI_USER}@${PI_HOST}:${REMOTE_BASE}/"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Restarting bridge service..." -ForegroundColor Cyan
ssh "${PI_USER}@${PI_HOST}" "sudo systemctl restart prostat-bridge"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Deploying Pi HMI..." -ForegroundColor Cyan
scp pi-hmi/app.py "${PI_USER}@${PI_HOST}:${REMOTE_BASE}/pi-hmi/"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
ssh "${PI_USER}@${PI_HOST}" "sudo systemctl restart pi-hmi.service"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Access the app at:"
Write-Host "  - http://joule-bridge.local:8080"
Write-Host "  - http://${PI_HOST}:8080"
Write-Host ""
Write-Host "Bridge API still available at /api/*"
