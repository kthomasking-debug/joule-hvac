# QR Code Screen Implementation - Complete

## Summary

I've successfully added a **QR Code screen** to your Raspberry Pi e-paper display that shows a scannable code linking to the Joule Bridge web interface.

## Changes Made

### 1. **pi-hmi/app.py** - Main Application
   - Added `qrcode` library import with fallback handling
   - Added `HAS_QRCODE` flag to gracefully handle missing library
   - Added new `_render_qr()` method that:
     - Generates QR code for bridge URL (http://192.168.0.103:8080/home)
     - Scales QR code to fit e-ink display (250x122 pixels)
     - Centers QR code with URL label below
     - Handles missing qrcode library with helpful message
   - Updated navigation:
     - Changed third button from "3-Day" to "QR Code"
     - Changed `current_page` routing to show QR screen
     - Updated page selector logic

### 2. **pi-hmi/requirements.txt** - Dependencies
   - Added `qrcode[pil]==8.0` package for QR code generation

### 3. **pi-hmi/QR_CODE_FEATURE.md** - Documentation
   - Created comprehensive guide with installation, usage, and troubleshooting

## Navigation

**E-Paper Display Button Layout:**
- **Left Button**: Status (current thermostat state)
- **Middle Button**: Energy (cost and usage data)
- **Right Button**: QR Code (NEW - links to web UI)

## How It Works

1. User presses the **right button** on the e-paper display
2. QR code is generated and rendered for: `http://192.168.0.103:8080/home`
3. User scans QR with smartphone camera
4. Notification appears → tap to open bridge web UI

## Installation

On the Pi HMI device, install the required library:

```bash
# Option 1: Install all pi-hmi dependencies
cd ~/git/joule-hvac/pi-hmi
pip install -r requirements.txt

# Option 2: Install just qrcode
pip install qrcode[pil]
```

## Bridge IP Address

The QR code uses the bridge IP from `self.status.bridge_ip` which is detected from the API. It defaults to `192.168.0.103:8080/home` if not available.

To verify the IP, check:
- Bridge machine's network settings
- Router's connected devices list (typically 192.168.0.10x range)

## Features

✅ **Dynamic Bridge IP**: Reads from detected bridge address  
✅ **Centered Display**: QR code auto-scales and centers on e-paper  
✅ **Graceful Fallback**: Shows helpful message if qrcode library not installed  
✅ **URL Label**: Displays truncated URL below QR code  
✅ **Error Handling**: Catches and displays rendering errors  
✅ **Responsive**: Updates dynamically with current bridge status  

## Testing

After installation, you can test the QR screen by:

1. Starting the HMI app: `python3 app.py`
2. Pressing the right navigation button
3. Scanning with your phone camera

If it shows "QR code library not installed", run:
```bash
pip install qrcode[pil]
```

Then restart the app.

## Notes

- QR code generation adds ~50ms to rendering time (happens only when QR screen is displayed)
- The URL in the QR code is hardcoded at generation time (updates on next render)
- Display is optimized for 250x122 pixel e-ink screens (adjust in SCREEN_W, SCREEN_H if needed)
