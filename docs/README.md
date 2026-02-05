# Documentation

## Quick Start

| I want to... | Read this |
|--------------|-----------|
| Run the app on my machine | [Server Setup](SERVER_SETUP.md) |
| Set up my thermostat | [User Manual](USER_MANUAL.md) |
| Understand the system | [Architecture](ARCHITECTURE.md) |
| Install the bridge | [Bridge Installation](BRIDGE-INSTALLATION-GUIDE.md) |
| Set up the Pi HMI | [Pi E-Ink Guide](PI_EINK_DEPLOYMENT_GUIDE.md) |
| Troubleshoot issues | [Admin Manual](ADMIN_MANUAL.md) |

## Documentation Structure

```
docs/
├── SERVER_SETUP.md          # Running the standalone app server
├── USER_MANUAL.md           # End-user setup guide
├── ADMIN_MANUAL.md          # Support & troubleshooting
├── ARCHITECTURE.md          # System architecture
├── BRIDGE-INSTALLATION-GUIDE.md  # Technical setup
├── QUICK_START_GUIDE.md     # Voice commands cheat sheet
│
├── api/                     # API documentation
├── development/             # Developer guides
├── installation/            # Platform-specific install guides
├── optional-features/       # Optional integrations
│   ├── hardware/           # Relay, sensors, tablets
│   ├── integrations/       # IFTTT, HomeKit, Blueair
│   └── troubleshooting/    # Debug guides
│
└── archive/                 # Old implementation notes
```

## Key Documents

### Getting Started
- [Server Setup](SERVER_SETUP.md) - How to run the app standalone (without Cursor/VS Code)

### For Users
- [User Manual](USER_MANUAL.md) - Complete setup, pairing, voice commands
- [Quick Start Guide](QUICK_START_GUIDE.md) - Voice command reference
- [Thermostat User Manual](THERMOSTAT_USER_MANUAL.md) - Physical controls

### For Support Staff
- [Admin Manual](ADMIN_MANUAL.md) - Remote support, Tailscale
- [Bridge Troubleshooting](BRIDGE-TROUBLESHOOTING-MAINTENANCE.md) - Common issues

### For Developers
- [Architecture](ARCHITECTURE.md) - System overview, network topology
- [Bridge Installation](BRIDGE-INSTALLATION-GUIDE.md) - Technical setup
- [API Documentation](api/BRIDGE_ENDPOINTS_COMPLETE.md) - REST endpoints

## Hardware Reference

| Component | IP | Services |
|-----------|-----|----------|
| Raspberry Pi | 192.168.0.103 | prostat-bridge (8080), pi-hmi |

## Archive

Implementation notes and completed task documentation are in [archive/](archive/). These are kept for historical reference but are not maintained.

