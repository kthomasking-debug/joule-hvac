# Pi Zero 2 W E‑Ink HMI

Simple wall-mounted HMI for Waveshare 2.13" Touch ePaper HAT on Raspberry Pi Zero 2 W.

## Features
- Status page: shows mode, indoor temp, humidity, connection state
- Actions page: quick Heat/Cool toggle, setpoint up/down
- Guide page: step-by-step text/image hints (small-format)
- Touch input via evdev (capacitive controllers) with GPIO fallback
- Partial refresh to reduce ghosting and latency

## Hardware
- Raspberry Pi Zero 2 W (Raspberry Pi OS Lite recommended)
- Waveshare 2.13" Touch ePaper HAT (SPI display + I2C touch)
- SPI enabled; I2C enabled

## Setup

```bash
# Enable SPI/I2C (interactive)
sudo raspi-config
# Interface Options -> SPI: enable, I2C: enable

# Install dependencies
sudo apt-get update
sudo apt-get install -y python3-pip python3-dev libjpeg-dev zlib1g-dev
cd ~/git/joule-hvac/pi-hmi
python3 -m pip install -r requirements.txt

# Clone Waveshare EPD library (drivers)
cd ~/git
git clone https://github.com/waveshare/e-Paper
# We will import driver modules directly from this repo
```

## Configure bridge endpoint
Set environment variables to point at your bridge/service providing status and actions.

```bash
# Example: Joule bridge running locally
export HMI_API_BASE="http://127.0.0.1:8080"
# Optional: poll interval seconds
export HMI_POLL_SECS="15"
```

Expected endpoints (customize in `app.py` as needed):
- GET `$HMI_API_BASE/status` -> `{ mode: "heat|cool|off", temp: 68.5, humidity: 45 }`
- POST `$HMI_API_BASE/mode` body `{ mode: "heat|cool|off" }`
- POST `$HMI_API_BASE/setpoint` body `{ delta: +1 | -1 }`

## Run

```bash
cd ~/git/joule-hvac/pi-hmi
python3 app.py
```

### Touch Calibration

- Connect the touch E‑Ink and enable input. Then run:

```bash
python3 touch_calibrate.py
```

- Follow prompts to tap corners. This generates `pi-hmi/touch_config.json` with min/max and orientation hints.
- The HMI reads this file automatically. To override path, set `HMI_TOUCH_CFG=/path/to/touch_config.json`.

### Partial Refresh

- Many Waveshare drivers support partial update for faster UI. Enable with:

```bash
export HMI_PARTIAL=1
python3 app.py
```

- The app auto-detects common partial methods (e.g., `displayPartial`). If unsupported, it falls back to full refresh.

## Autostart on boot (systemd)
Create and enable service:

```bash
sudo tee /etc/systemd/system/pi-hmi.service > /dev/null <<'UNIT'
[Unit]
Description=Pi E-Ink HMI
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/thomas/git/joule-hvac/pi-hmi
Environment=HMI_API_BASE=http://127.0.0.1:8080
Environment=HMI_POLL_SECS=15
ExecStart=/usr/bin/python3 /home/thomas/git/joule-hvac/pi-hmi/app.py
Restart=on-failure
User=thomas

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable pi-hmi.service
sudo systemctl start pi-hmi.service
```

## Notes
- If touch doesn’t work, verify `/dev/input/event*` devices and permissions, and controller (Goodix, FT6236). Fallback GPIO buttons can be wired to physical inputs.
- For different Waveshare models, adjust the imported driver (`epd2in13_V2`, `epd2in13_V3`, or 2.13 touch driver).
