#!/bin/bash
# setup-2in13-touch-hat.sh
# One-step setup for Waveshare 2.13" Touch E-Paper HAT on fresh 32-bit Raspberry Pi OS (Pi Zero)
# Run as: bash setup-2in13-touch-hat.sh
set -e

# 1. Update system
sudo apt-get update
sudo apt-get upgrade -y

# 2. Enable SPI and I2C (non-interactive)
sudo raspi-config nonint do_spi 0
sudo raspi-config nonint do_i2c 0

# 3. Install Python and dependencies
sudo apt-get install -y python3-pip python3-pil python3-numpy python3-spidev python3-rpi.gpio i2c-tools git

# 4. Clone Waveshare e-Paper repo (if not already present)
if [ ! -d "$HOME/e-Paper" ]; then
  git clone https://github.com/waveshare/e-Paper.git $HOME/e-Paper
fi

# 5. Reboot to apply SPI/I2C changes
echo "Rebooting to apply SPI/I2C changes..."
sleep 2
sudo reboot

# After reboot, run the following manually to test:
# cd ~/e-Paper/RaspberryPi_JetsonNano/python/examples
# python3 epd_2in13_touch_test.py
# (If that script does not exist, try: python3 epd_2in13_test.py)
# To check for touch device: ls /dev/input && cat /proc/bus/input/devices
# To check I2C: sudo i2cdetect -y 1
