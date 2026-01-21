# Wake Word Architecture: Browser Demo vs Production

## Current Implementation: Browser Demo (Temporary)

### What We Have Now

- **Location**: React frontend (`src/hooks/useWakeWord.js`)
- **Technology**: Porcupine (Picovoice) Web SDK
- **Wake Word**: "Hey Pico" (built-in, closest to "Hey Joule")
- **Status**: ⚠️ **DEMO MODE ONLY**

### Limitations (Why This Is Temporary)

1. **Browser Coma Problem**

   - Browser privacy restrictions prevent background listening
   - Microphone dies when screen turns off or tab is inactive
   - User must walk to tablet and wake screen before using voice
   - **Defeats the purpose of hands-free voice control**

2. **Picovoice Licensing Trap**

   - Free tier: Only 3 devices/users
   - After 3 devices: Enterprise licensing fees (expensive)
   - Contradicts our "Sovereign" principle (avoid vendor lock-in)
   - Custom wake words require paid training on their platform

3. **Custom Wake Word Problem**
   - Can't easily use "Hey Joule" - would need to train on Picovoice console
   - Custom models expire every 30 days on free tier
   - Requires ongoing maintenance and costs

## Production Implementation: Raspberry Pi (Target)

### Architecture Overview

```
┌─────────────────┐
│  USB Microphone │
│  (Conference    │
│   Puck)         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Raspberry Pi   │
│  (Python)       │
│                 │
│  openWakeWord   │ ◄── Free, open-source, no limits
│  Service        │
└────────┬────────┘
         │
         │ WebSocket
         │ (when wake word detected)
         ▼
┌─────────────────┐
│  React Frontend │
│  (Tablet)       │
│                 │
│  Shows          │
│  "Listening..." │
└─────────────────┘
```

### Why Pi Wins

1. **Always On**

   - Pi never sleeps (runs 24/7)
   - No browser limitations
   - True hands-free operation

2. **Free & Open Source**

   - `openWakeWord` - 100% free, no licensing
   - No user/device limits
   - No API keys required
   - Fully sovereign (no vendor lock-in)

3. **Custom Wake Words**

   - Train "Hey Joule" locally for free
   - Or use "Oh Unfrosted One" (Byzantine mode easter egg)
   - No expiration, no ongoing costs

4. **Better Processing Options**
   - Option A: Pi sends WebSocket → Tablet shows "Listening..." → Tablet processes via Web Speech API
   - Option B: Pi processes audio locally via Whisper → Sends text to frontend
   - Both options work even when tablet screen is off

## Implementation Plan (When Pi Hardware Arrives)

### Step 1: Hardware Setup

- USB conference microphone plugged into Pi
- Test audio input: `arecord -l` to verify device

### Step 2: Install openWakeWord on Pi

```bash
pip install openwakeword
```

### Step 3: Create Python Service

```python
# prostat-bridge/wake_word_service.py
import openwakeword
from pyaudio import PyAudio
import websockets
import asyncio

# Initialize wake word model
oww = openwakeword.Model(wakeword_models=['hey_joule'])

# Listen for wake word
# When detected, send WebSocket message to frontend
```

### Step 4: React Frontend Integration

- Listen for WebSocket message from Pi
- When wake word detected, automatically start listening
- No browser-based wake word needed

## Current Status

✅ **Browser Demo**: Implemented (for testing/demos only)
⏳ **Pi Implementation**: Waiting for hardware
📝 **Documentation**: This file

## Migration Checklist

When Pi hardware arrives:

- [ ] Remove Porcupine dependency from `package.json`
- [ ] Delete `src/hooks/useWakeWord.js` (browser version)
- [ ] Create `prostat-bridge/wake_word_service.py`
- [ ] Add WebSocket endpoint to ProStat Bridge API
- [ ] Update React frontend to listen for WebSocket wake word events
- [ ] Test with USB microphone on Pi
- [ ] Train custom "Hey Joule" wake word model
- [ ] Update documentation

## Key Principle

> **Appliances don't run in Chrome tabs. They run on metal (Linux).**

The wake word detection belongs on the hardware (Pi), not in the browser. The browser is just the UI layer.

---

_This document tracks the architectural decision to move wake word detection from browser to Raspberry Pi for production deployment._
