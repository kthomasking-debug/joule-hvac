# Joule HVAC Architecture

## Overview

Joule HVAC is a smart thermostat system consisting of:
1. **Web App** - React/Vite frontend for energy forecasting and thermostat control
2. **Joule Bridge** - Python server running on Raspberry Pi for HomeKit integration
3. **Pi HMI** - E-paper touch display interface on the same Pi

## Hardware

### Raspberry Pi Zero 2W
- **IP Address**: 192.168.0.103 (static)
- **Hostname**: joulepi.local or Joule-Bridge
- **OS**: Raspberry Pi OS Lite (64-bit)

**Attached Hardware:**
- Waveshare 2.13" Touch e-Paper HAT
- Optional: USB relay module for direct HVAC control

## Software Components

### 1. Joule Bridge (`prostat-bridge/`)
**Purpose**: HomeKit thermostat controller and REST API server

| Property | Value |
|----------|-------|
| Port | 8080 |
| Service | `prostat-bridge.service` |
| Entry Point | `/home/pi/prostat-bridge/server.py` |
| Python Env | `/home/pi/prostat-bridge/venv/` |

**Key Files:**
- `server.py` - Main server with all API endpoints
- `homekit_bridge.py` - HomeKit HAP integration
- `asthma_shield.py` - Air quality monitoring

**API Endpoints:**
- `GET /health` - Health check
- `GET /api/thermostat/status` - Current thermostat state
- `POST /api/thermostat/set` - Set temperature
- `GET /api/homekit/devices` - List paired HomeKit devices
- See `prostat-bridge/README.md` for full API docs

### 2. Pi HMI (`pi-hmi/`)
**Purpose**: Touch-enabled e-paper display for local control

| Property | Value |
|----------|-------|
| Service | `pi-hmi.service` |
| Entry Point | `/home/pi/git/joule-hvac/pi-hmi/app.py` |

**Features:**
- Touch navigation between screens (Status, Energy, Settings)
- QR code display for easy web app access
- Real-time thermostat status from bridge API

### 3. Web App (`src/`)
**Purpose**: Full-featured web interface

| Property | Value |
|----------|-------|
| Framework | React 18 + Vite (build tool) |
| Production Server | Node.js with Express (see [SERVER_SETUP.md](SERVER_SETUP.md)) |
| Production | joule.netlify.app |

**Key Features:**
- Energy forecasting (weekly/annual)
- Ask Joule natural language interface
- Thermostat control via bridge API
- Equipment settings management

## Network Topology

```
Internet
    │
    ├── Netlify (joule.netlify.app)
    │       │
    │       │ HTTPS
    │       ▼
    │   ┌──────────────┐
    │   │   Browser    │
    │   └──────────────┘
    │           │
    │           │ HTTP (local network only)
    │           ▼
    └───────────────────────────────────────────┐
                                                │
    Local Network (192.168.0.x)                 │
    ┌───────────────────────────────────────────┼───┐
    │                                           │   │
    │   ┌─────────────────────────────────────┐ │   │
    │   │  Raspberry Pi (192.168.0.103)       │◄┘   │
    │   │                                     │     │
    │   │   ┌─────────────────────────────┐   │     │
    │   │   │  prostat-bridge :8080       │   │     │
    │   │   │  (HomeKit + REST API)       │   │     │
    │   │   └─────────────────────────────┘   │     │
    │   │              │                      │     │
    │   │              │ HomeKit HAP          │     │
    │   │              ▼                      │     │
    │   │   ┌─────────────────────────────┐   │     │
    │   │   │  Ecobee Thermostat          │   │     │
    │   │   │  (HomeKit accessory)        │   │     │
    │   │   └─────────────────────────────┘   │     │
    │   │                                     │     │
    │   │   ┌─────────────────────────────┐   │     │
    │   │   │  pi-hmi                     │   │     │
    │   │   │  (e-paper touch display)    │   │     │
    │   │   └─────────────────────────────┘   │     │
    │   │                                     │     │
    │   └─────────────────────────────────────┘     │
    │                                               │
    └───────────────────────────────────────────────┘
```

## Systemd Services

### prostat-bridge.service
```ini
[Unit]
Description=Joule Bridge HomeKit Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/prostat-bridge
ExecStart=/home/pi/prostat-bridge/venv/bin/python3 /home/pi/prostat-bridge/server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### pi-hmi.service
```ini
[Unit]
Description=Pi E-Ink HMI
After=network.target prostat-bridge.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/git/joule-hvac/pi-hmi
ExecStart=/usr/bin/python3 -u /home/pi/git/joule-hvac/pi-hmi/app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Common Operations

### SSH Access
```bash
ssh pi@192.168.0.103
# Password: (your configured password)
```

### Service Management
```bash
# Check status
sudo systemctl status prostat-bridge pi-hmi

# Restart services
sudo systemctl restart prostat-bridge
sudo systemctl restart pi-hmi

# View logs
sudo journalctl -u prostat-bridge -f
sudo journalctl -u pi-hmi -f
```

### Health Check
```bash
curl http://192.168.0.103:8080/health
# Expected: {"status": "ok"}
```

## File Locations on Pi

```
/home/pi/
├── prostat-bridge/          # Bridge server
│   ├── server.py            # Main server
│   ├── venv/                # Python virtual environment
│   ├── requirements.txt
│   └── logs/                # Server logs
│
├── git/joule-hvac/          # Full repo (for HMI)
│   └── pi-hmi/
│       └── app.py           # HMI entry point
│
└── joule-hvac/              # Alternate install location
    └── pi-hmi/
        └── joule_hmi.py     # Legacy HMI script
```

## Deployment

### Update Bridge
```bash
ssh pi@192.168.0.103
cd ~/prostat-bridge
git pull
sudo systemctl restart prostat-bridge
```

### Update HMI
```bash
ssh pi@192.168.0.103
cd ~/git/joule-hvac
git pull
sudo systemctl restart pi-hmi
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| E-paper not responding | pi-hmi service stopped | `sudo systemctl restart pi-hmi` |
| Web app can't connect | Bridge not running | `sudo systemctl restart prostat-bridge` |
| Bridge health fails | Python error | Check `journalctl -u prostat-bridge` |
| Touch not working after boot | HMI crashed on startup | Check `journalctl -u pi-hmi` |
