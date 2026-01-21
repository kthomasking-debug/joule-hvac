# Archived Tests and Obsolete Files

This folder contains test files, development scripts, and obsolete code that are no longer actively used.

## What's Archived Here

### Test Files (from root)
- **test-*.js** - JavaScript test scripts (26 files)
  - Parser tests, API tests, EIA/NREL integration tests
  - Agent vs prompt comparisons
  - Geocoding and elevation tests
  
- **test_*.py** - Python test scripts
  - Browser fixes, zeroconf tests
  
- **test-output.txt** - Test execution logs
- **test-parser-browser.html** - Browser-based parser testing
- **parse_errors.txt** - Parser error logs
- **tmp_divs_log.txt** - Temporary div debugging

### Test Files (from prostat-bridge/)
- **test_hap_bridge.py** - HomeKit HAP bridge tests
- **test_homekit_bridge.py** - HomeKit integration tests
- **test_simple_bridge.py** - Simple bridge tests
- **TEST_RESULTS.md** - Test results documentation
- **install-bridge-gui.py** - Old GUI installer (obsolete)
- **server.js** - Old Node.js server (replaced by server.py)

### Test Documentation
- **HOMEKIT_BRIDGE_PROGRESS.md** - Development progress notes
- **HOMEKIT_BRIDGE_STATUS.md** - Status tracking
- **HOMEKIT_BRIDGE_SYSTEMD.md** - SystemD setup notes
- **HOMEKIT_BRIDGE_TESTING_CHECKLIST.md** - Testing checklist
- **OTA-UPDATES.md** - OTA update documentation
- **RESTART_INSTRUCTIONS.md** - Restart instructions
- **RUN-INSTALLER.txt** - Old installer instructions

### Obsolete HMI Files (from pi-hmi/)
- **app.py** - Old e-ink display code (replaced by joule_hmi.py)
- **mock_server.py** - Mock server for testing
- **touch_calibrate.py** - Touch calibration utility

## Current Active Files

**pi-hmi/joule_hmi.py** - Current e-ink HMI (707 lines, actively maintained)
**prostat-bridge/server.py** - Current bridge server (186KB, actively maintained)

## Why Archived

These files were development/testing artifacts that:
- Were used during feature development but are no longer needed
- Have been replaced by newer implementations
- Are Windows-specific in a Linux-focused project
- Are test harnesses that passed and are no longer run regularly

## Can I Delete These?

**Keep archived** - They may be useful for:
- Historical reference
- Understanding how features were tested
- Reviving old functionality if needed
- Debugging similar issues in the future

Safe to delete only after:
- Confirming all current tests pass
- Project is stable in production
- No plans to revisit these features
