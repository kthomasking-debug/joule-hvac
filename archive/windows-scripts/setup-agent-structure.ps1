# PowerShell script to create agent directory structure

Write-Host "Creating agent directory structure..." -ForegroundColor Green

# Create directories
New-Item -ItemType Directory -Force -Path "agent" | Out-Null
New-Item -ItemType Directory -Force -Path "state" | Out-Null
New-Item -ItemType Directory -Force -Path "config" | Out-Null
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
New-Item -ItemType Directory -Force -Path "knowledge" | Out-Null
New-Item -ItemType Directory -Force -Path "docs\wiring_diagrams" | Out-Null
New-Item -ItemType Directory -Force -Path "docs\manufacturer_specs" | Out-Null

Write-Host "Directories created" -ForegroundColor Green

# Create .gitkeep files
New-Item -ItemType File -Force -Path "agent\.gitkeep" | Out-Null
New-Item -ItemType File -Force -Path "state\.gitkeep" | Out-Null
New-Item -ItemType File -Force -Path "config\.gitkeep" | Out-Null
New-Item -ItemType File -Force -Path "logs\.gitkeep" | Out-Null
New-Item -ItemType File -Force -Path "knowledge\.gitkeep" | Out-Null
New-Item -ItemType File -Force -Path "docs\.gitkeep" | Out-Null

Write-Host "Structure ready" -ForegroundColor Green

Write-Host ""
Write-Host "Directory structure:" -ForegroundColor Cyan
Get-ChildItem -Path agent,state,config,logs,knowledge,docs -Directory -Recurse -Depth 1 | Select-Object FullName

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
