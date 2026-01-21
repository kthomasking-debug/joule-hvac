# Archived Windows Scripts

This folder contains PowerShell scripts (.ps1) that were used for Windows development environments.

## What's Archived Here

### Windows Setup Scripts
- **setup-bridge-windows.ps1** - Bridge setup for Windows
- **setup-agent-structure.ps1** - Agent structure setup
- **start-homekit-bridge.ps1** - Start HomeKit bridge on Windows
- **start-temp-server.ps1** - Temporary server launcher
- **update-thermostat.ps1** - Thermostat update script

### Windows Test Scripts
- **test-ifttt.ps1** - IFTTT integration testing
- **poll-ecobee.ps1** - Ecobee polling script

## Why Archived

This project now runs exclusively on Linux (Ubuntu/Raspberry Pi OS):
- Development moved to Ubuntu 24.04.3 LTS
- Deployment targets Raspberry Pi Zero 2W (Raspberry Pi OS)
- Bridge and HMI are Linux-based services

Windows scripts are no longer maintained or tested.

## Linux Equivalents

**Instead of these PowerShell scripts, use:**
- **docs/installation/ubuntu/** - Ubuntu installation guides
- **pi-zero-setup/** - Raspberry Pi setup
- **Bash scripts** in root (*.sh) - Active Linux scripts

## Can I Delete These?

**Keep archived if:**
- You might develop on Windows in the future
- Historical reference for porting logic to Linux

**Safe to delete if:**
- Fully committed to Linux-only development
- No Windows users in your team
