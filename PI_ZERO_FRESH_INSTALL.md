# Joule Pi Zero Fresh Install Scripts & Commands

This document collects all essential scripts and commands for a clean setup of the Joule project and the Waveshare 2.13" Touch E-Paper HAT on a fresh 32-bit Raspberry Pi OS (Pi Zero/Zero W).

---

## 1. Pi Zero OS Preparation
- Flash latest 32-bit Raspberry Pi OS Lite to SD card.
- Boot, set up Wi-Fi, enable SSH (add empty `ssh` file to boot partition if needed).

---

## 2. One-Step HAT Setup Script
Save as `setup-2in13-touch-hat.sh` and run with `bash setup-2in13-touch-hat.sh`:

```bash
#!/bin/bash
# One-step setup for Waveshare 2.13" Touch E-Paper HAT (Pi Zero)
set -e

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Enable SPI and I2C (non-interactive)
sudo raspi-config nonint do_spi 0
sudo raspi-config nonint do_i2c 0

# Install Python and dependencies
sudo apt-get install -y python3-pip python3-pil python3-numpy python3-spidev python3-rpi.gpio i2c-tools git

# Clone Waveshare e-Paper repo (if not already present)
if [ ! -d "$HOME/e-Paper" ]; then
  git clone https://github.com/waveshare/e-Paper.git $HOME/e-Paper
fi

# Reboot to apply SPI/I2C changes
echo "Rebooting to apply SPI/I2C changes..."
sleep 2
sudo reboot
```

---

## 3. After Reboot: Test Display & Touch

```bash
cd ~/e-Paper/RaspberryPi_JetsonNano/python/examples
# Try the touch test script (if present):
python3 epd_2in13_touch_test.py
# If not present, try:
python3 epd_2in13_test.py
```

---

## Waveshare 2.13" Touch E-Paper HAT (V3) Setup & Troubleshooting

### Golden Test (V3 Driver)
If your screen is the 2.13" Touch V3 (not the "G" variant), always use this test:

```bash
cd ~/e-Paper/RaspberryPi_JetsonNano/python/examples
python3 epd_2in13_V3_test.py
```

**If you use the wrong driver (e.g., "G" variant):**
- The Pi will wait forever for the BUSY pin → blank screen.
- Always sanity-check with the V3 test script above.

### Typical Always-On Display Flow
1. Boot Pi
2. Run a Python script that renders info (thermostat/cost)
3. Update screen every minute
4. Never use HDMI again

### Auto-launch Display Script on Boot
To auto-launch your display script (e.g., display.py) on boot:

```bash
crontab -e
```
Add this line:

```
@reboot python3 /home/pi/joule-hvac/display.py
```

This will run your display script every time the Pi boots.

---
## Troubleshooting
- If the screen is blank or stuck on "e-Paper busy H", check:
  - You are using the correct V3 driver/test script
  - The HAT is properly seated
  - SPI is enabled (`sudo raspi-config` > Interface Options > SPI)
  - Ribbon cable is secure
  - Try power-cycling the Pi
  - Test with the golden command above

---

## 4. Check Touch Device

```bash
ls /dev/input
cat /proc/bus/input/devices
sudo i2cdetect -y 1
```

---

## 5. Joule Project Deployment (from your dev machine)

- **Local deploy (no git on Pi):**
  ```bash
  ./deploy-local-to-pi.sh <pi_ip>
  # Example:
  ./deploy-local-to-pi.sh 192.168.0.103
  ```
- **Or, with git on Pi:**
  ```bash
  bash setup-fresh-pi.sh <pi_ip> <your-repo-url>
  ```

---

## 6. Useful Commands

- Restart HMI: `ssh pi@<pi_ip> "sudo systemctl restart pi-hmi.service"`
- View logs: `ssh pi@<pi_ip> "sudo journalctl -u pi-hmi.service -n 50"`
- Get Cloudflare URL: `ssh pi@<pi_ip> sudo journalctl -u cloudflared | grep 'Route' | tail -1`

---

**Keep this file with your project for fast, repeatable Pi Zero + HAT setup!**
