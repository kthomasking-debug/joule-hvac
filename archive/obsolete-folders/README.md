# Obsolete Folders Archive

This folder contains directories that are no longer actively used in the project.

## What's Archived Here

### Cursor-Thermostat/
- Empty folder (only .gitattributes)
- Leftover from old project structure

### pi-bridge/
- Old version of bridge server
- **Replaced by:** pi-zero-bridge/ (current Node.js bridge)
- Contains: server.js, package.json, README.md

### pi-setup/
- Old Pi setup scripts
- **Replaced by:** pi-zero-setup/ (current setup with comprehensive guides)
- Contains: install.sh, optimize-pi.sh, README.md

### state/
- Example state file only (current_status.json.example)
- Not actively used - state is now managed in joule-settings.json

### server/
- Standalone services that were moved/consolidated
- energyplus-service.py - EnergyPlus integration
- temperature-server.js - Temperature simulation server
- tts-service.py - Text-to-speech service
- agent-memory.json - Agent memory state

### STT/ (154MB)
- Audio recordings (.wav files)
- 2 large audio files from 2025
- Should these be in a separate storage location?

## Current Active Folders

**Bridge Servers:**
- **prostat-bridge/** - Main Python bridge server (server.py, 186KB)
- **pi-zero-bridge/** - Node.js bridge for Pi Zero 2W

**Pi Setup:**
- **pi-zero-setup/** - Current Pi Zero 2W setup scripts and guides
- **pi-hmi/** - Current e-ink HMI (app.py; joule_hmi.py archived)

## Why Archived

These folders were:
- Duplicates of current implementations
- Old versions replaced by newer code
- Empty or containing only example files
- Not referenced in current codebase

## Can I Delete These?

**Safe to delete:**
- Cursor-Thermostat/ (empty)
- state/ (only example file)

**Review before deleting:**
- pi-bridge/, pi-setup/ - Might have useful logic to reference
- server/ - Services that might be revived
- STT/ - 154MB of audio files (move to external storage?)

**Recommendation:** Keep archived for 6-12 months, then delete if not needed.
