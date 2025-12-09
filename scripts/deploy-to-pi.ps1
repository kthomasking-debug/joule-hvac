# Deploy Joule Dashboard to Raspberry Pi (PowerShell)
# 
# Usage:
#   .\scripts\deploy-to-pi.ps1
#   .\scripts\deploy-to-pi.ps1 -Host joule.local
#   .\scripts\deploy-to-pi.ps1 -Host 192.168.1.100 -User pi

param(
    [string]$Host = "joule.local",
    [string]$User = "pi",
    [string]$RemotePath = "/var/www/joule",
    [switch]$Build
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "🚀 Deploying Joule Dashboard to Raspberry Pi" -ForegroundColor Cyan
Write-Host "   Host: ${User}@${Host}"
Write-Host "   Path: ${RemotePath}"
Write-Host ""

# Step 1: Check if dist/ exists
$distPath = Join-Path $projectRoot "dist"
if (-not (Test-Path $distPath)) {
    Write-Host "❌ Error: dist/ folder not found!" -ForegroundColor Red
    Write-Host "   Run 'npm run build' first to build the app." -ForegroundColor Yellow
    exit 1
}

# Step 2: Build the app (if not already built or if --Build flag is set)
if ($Build -or -not (Test-Path (Join-Path $distPath "index.html"))) {
    Write-Host "📦 Building the app..." -ForegroundColor Cyan
    try {
        Push-Location $projectRoot
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed"
        }
        Write-Host "✅ Build complete!" -ForegroundColor Green
        Write-Host ""
    } catch {
        Write-Host "❌ Build failed!" -ForegroundColor Red
        exit 1
    } finally {
        Pop-Location
    }
}

# Step 3: Test SSH connection
Write-Host "🔌 Testing SSH connection to ${User}@${Host}..." -ForegroundColor Cyan
try {
    $testResult = ssh -o ConnectTimeout=5 "${User}@${Host}" "echo 'Connection successful'" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "SSH connection failed"
    }
    Write-Host "✅ SSH connection successful!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Cannot connect to ${User}@${Host}" -ForegroundColor Red
    Write-Host "   Make sure:" -ForegroundColor Yellow
    Write-Host "   - The Bridge is powered on and connected to network"
    Write-Host "   - SSH is enabled on the Bridge"
    Write-Host "   - You can reach the Bridge from this machine"
    Write-Host "   - SSH keys are set up (or password authentication is enabled)"
    exit 1
}

# Step 4: Create remote directory if it doesn't exist
Write-Host "📁 Ensuring remote directory exists..." -ForegroundColor Cyan
try {
    ssh "${User}@${Host}" "sudo mkdir -p ${RemotePath} && sudo chown ${User}:${User} ${RemotePath}"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create directory"
    }
    Write-Host "✅ Remote directory ready!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Failed to create remote directory" -ForegroundColor Red
    exit 1
}

# Step 5: Copy files
Write-Host "📤 Copying files to Bridge..." -ForegroundColor Cyan
try {
    # Use scp to copy all files
    $distFiles = Join-Path $distPath "*"
    scp -r $distFiles "${User}@${Host}:${RemotePath}/"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to copy files"
    }
    Write-Host "✅ Files copied!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Failed to copy files" -ForegroundColor Red
    exit 1
}

# Step 6: Set permissions
Write-Host "🔐 Setting file permissions..." -ForegroundColor Cyan
try {
    ssh "${User}@${Host}" "sudo chown -R www-data:www-data ${RemotePath} && sudo chmod -R 755 ${RemotePath}"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to set permissions"
    }
    Write-Host "✅ Permissions set!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Failed to set permissions" -ForegroundColor Red
    exit 1
}

# Step 7: Reload Nginx
Write-Host "🔄 Reloading Nginx..." -ForegroundColor Cyan
try {
    ssh "${User}@${Host}" "sudo nginx -t && sudo systemctl reload nginx"
    if ($LASTEXITCODE -ne 0) {
        throw "Nginx reload failed"
    }
    Write-Host "✅ Nginx reloaded!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "⚠️  Warning: Nginx reload failed (may not be configured yet)" -ForegroundColor Yellow
    Write-Host "   See docs/SELF-HOSTING-NGINX.md for Nginx setup instructions" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host "   Visit: http://${Host}"
Write-Host "   Or: http://192.168.1.100 (if mDNS doesn't work)"
Write-Host ""









