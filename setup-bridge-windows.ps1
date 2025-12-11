# Setup Bridge for Windows - Automated Script
# This script helps set up the Joule Bridge locally on Windows

Write-Host "🚀 Joule Bridge Windows Setup" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js installed: $nodeVersion" -ForegroundColor Green
}
catch {
    Write-Host "❌ Node.js not found. Please install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check Ollama
Write-Host "Checking Ollama..." -ForegroundColor Yellow
try {
    $ollamaVersion = ollama --version
    Write-Host "✅ Ollama installed: $ollamaVersion" -ForegroundColor Green
}
catch {
    Write-Host "⚠️  Ollama not found. Installing Ollama is required for Local LLM Bridge." -ForegroundColor Yellow
    Write-Host "   Download from: https://ollama.com/download" -ForegroundColor Yellow
    $installOllama = Read-Host "Continue anyway? (y/n)"
    if ($installOllama -ne "y") {
        exit 1
    }
}

# Check if model is installed
Write-Host ""
Write-Host "Checking Ollama model (llama3.2:3b)..." -ForegroundColor Yellow
try {
    ollama list | Select-String "llama3.2:3b" | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Model llama3.2:3b is installed" -ForegroundColor Green
    }
    else {
        Write-Host "⚠️  Model llama3.2:3b not found" -ForegroundColor Yellow
        $pullModel = Read-Host "Pull the model now? (~2GB download) (y/n)"
        if ($pullModel -eq "y") {
            Write-Host "Downloading llama3.2:3b..." -ForegroundColor Yellow
            ollama pull llama3.2:3b
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Model downloaded successfully" -ForegroundColor Green
            }
            else {
                Write-Host "❌ Failed to download model" -ForegroundColor Red
                exit 1
            }
        }
    }
}
catch {
    Write-Host "⚠️  Could not check Ollama models" -ForegroundColor Yellow
}

# Install bridge dependencies
Write-Host ""
Write-Host "Installing bridge dependencies..." -ForegroundColor Yellow
Set-Location pi-bridge
if (Test-Path "node_modules") {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
}
else {
    Write-Host "Installing npm packages..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Dependencies installed" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Create docs directory if it doesn't exist
if (-not (Test-Path "docs")) {
    New-Item -ItemType Directory -Path "docs" | Out-Null
    Write-Host "✅ Created docs directory" -ForegroundColor Green
}

# Test Ollama connection
Write-Host ""
Write-Host "Testing Ollama connection..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -ErrorAction Stop
    Write-Host "✅ Ollama is running" -ForegroundColor Green
}
catch {
    Write-Host "⚠️  Ollama is not running or not accessible" -ForegroundColor Yellow
    Write-Host "   Make sure Ollama is running (check Start Menu or run 'ollama serve')" -ForegroundColor Yellow
}

# Summary
Write-Host ""
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the bridge, run:" -ForegroundColor Yellow
Write-Host "  cd pi-bridge" -ForegroundColor White
Write-Host "  npm start" -ForegroundColor White
Write-Host ""
Write-Host "The bridge will run on: http://localhost:3002" -ForegroundColor Cyan
Write-Host ""
Write-Host "Then configure your app:" -ForegroundColor Yellow
Write-Host "  1. Open http://localhost:5173" -ForegroundColor White
Write-Host "  2. Go to Settings → Local LLM" -ForegroundColor White
Write-Host "  3. Set Bridge URL to: http://localhost:3002" -ForegroundColor White
Write-Host ""
Write-Host "For full instructions, see: BRIDGE_WINDOWS_SETUP.md" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan

Set-Location ..

