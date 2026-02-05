# QR Code Display Feature

## Overview

The Pi HMI e-paper display now includes a QR code screen that displays a scannable code linking to the bridge's web interface at `http://192.168.0.103:8080/home`.

## Features

- **Third Navigation Button**: Press the right-most button on the e-paper display to view the QR code
- **Bridge URL**: Automatically generated from the detected bridge IP address
- **Easy Access**: Scan with any smartphone to quickly access the web UI

## Installation

The QR code feature requires the `qrcode` library:

```bash
pip install qrcode[pil]
```

Or on the Pi HMI device, run:

```bash
cd ~/git/joule-hvac/pi-hmi
pip install -r requirements.txt
```

## How to Use

1. **On the Pi e-paper display:**
   - Navigate to the Status, Energy, or QR Code pages using the bottom button bar
   - Press the **right button** (or third button from the left) to display the QR code

2. **Scan the QR Code:**
   - Use any smartphone camera or QR code reader app
   - The QR code links to: `http://192.168.0.103:8080/home`
   - Tap the notification to open the bridge web UI in your browser

3. **Access the Web UI:**
   - View thermostat status
   - Control HVAC settings
   - Pair Ecobee devices
   - Configure bridge settings

## Customization

To change the target URL, modify the bridge IP in the app:

```python
# In app.py, line 1016 (in _render_qr method)
bridge_url = f"http://YOUR_IP:8080/home"
```

Or set the bridge IP dynamically from the status:

```python
bridge_url = f"http://{self.status.bridge_ip}:8080/home" if self.status.bridge_ip else "http://192.168.0.103:8080/home"
```

## Troubleshooting

### "QR code library not installed"

Install qrcode with Pillow support:
```bash
pip install qrcode[pil]
```

### QR code doesn't scan

- Ensure your phone has a working camera
- Try different QR code reader apps
- Check that the bridge IP address is correct and reachable
- Move the display closer to better lighting for scanning

### QR code display is garbled

This could indicate a rendering issue. Check:
- E-paper display is working correctly
- Pillow image library is functioning
- Bridge IP address is valid
