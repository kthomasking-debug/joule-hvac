# Dehumidifier Relay Wiring Guide

## Overview

This guide covers wiring a dehumidifier to the ProStat Bridge using a USB relay module (CH340). This enables **local-only** dehumidifier control with advanced interlock logic.

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│  Ecobee     │────────▶│  ProStat Pi  │────────▶│  Dehumidifier│
│  (HomeKit)  │  WiFi   │  (HAP +     │  Relay  │  (120VAC)    │
│             │         │   Relay)    │         │              │
└─────────────┘         └──────────────┘         └──────────────┘
     Software Control        Hybrid Control         Hardware Control
```

**The Hybrid Approach:**

- **Ecobee**: Handles complex, dangerous HVAC (heating/cooling)
- **ProStat Bridge**: Handles "dumb" accessory (dehumidifier) with smart logic

## Hardware Requirements

- **Raspberry Pi 3** or **Pi Zero 2 W**
- **CH340 USB Relay Module** (8-channel, ~$15-25)
- **Dehumidifier** (120VAC, 3-5A typical)
- **Wire** (14-16 AWG for 120VAC)
- **Wire nuts** and **electrical tape**

## Relay Module Setup

### 1. Connect USB Relay to Pi

```
CH340 Relay Module → USB-B Cable → Raspberry Pi USB Port
```

**Note:** The relay module needs external power (5V/12V/24V depending on model). Check your module's specifications.

### 2. Identify Relay Channel

Default configuration:

- **Relay 1**: Reserved for future use
- **Relay 2**: **Dehumidifier** (Y2 terminal)
- **Relay 3+**: Available for other accessories

## Wiring the Dehumidifier

### Option 1: Control Power to Entire Unit (Recommended)

**How it works:** Relay controls the dehumidifier's power supply. When relay closes → dehumidifier gets power → runs. When relay opens → dehumidifier loses power → stops.

**Wiring Diagram:**

```
Wall Outlet (120VAC)
    │
    ├── Hot Wire (Black) ──▶ Relay 2 (NO - Normally Open)
    │                           │
    │                           └──▶ Hot Wire ──▶ Dehumidifier Power Cord
    │
    ├── Neutral Wire (White) ───────────────────▶ Dehumidifier Power Cord
    │
    └── Ground Wire (Green) ───────────────────▶ Dehumidifier Ground
```

**Step-by-Step:**

1. **Unplug dehumidifier** from wall outlet
2. **Cut the power cord** about 6 inches from the dehumidifier
3. **Strip wire ends** (about 1/2 inch)
4. **Identify wires:**
   - Hot wire: Usually black (smooth side on polarized plugs)
   - Neutral wire: Usually white (ribbed side on polarized plugs)
   - Ground wire: Usually green or bare
5. **Connect hot wire to relay:**
   - From wall outlet → Relay 2 NO terminal
   - From Relay 2 Common (C) terminal → Dehumidifier
6. **Connect neutral wire directly** (bypass relay):
   - From wall outlet → Dehumidifier (use wire nut)
7. **Connect ground wire** (if present):
   - From wall outlet → Dehumidifier ground (use wire nut)
8. **Wrap all connections** in electrical tape
9. **Test with multimeter** before plugging in

**Advantages:**

- ✅ Simple to implement
- ✅ Works with any dehumidifier
- ✅ No need to modify internal components
- ✅ Easy to reverse

**Disadvantages:**

- ⚠️ Dehumidifier's built-in controls may interfere
- ⚠️ May need to set dehumidifier to "Always On" mode

### Option 2: Control via Internal Control Board (Advanced)

If the dehumidifier has low-voltage control terminals, you can control it directly without switching 120VAC.

**Note:** Most consumer dehumidifiers don't have this feature. Check the unit's manual.

## Safety First

> **⚠️ CRITICAL:** Always follow these safety guidelines before starting any electrical work.

- **ALWAYS unplug the dehumidifier before wiring**
- **Verify the dehumidifier's amperage rating** (usually 3-5A for 30-pint units)
- **Your relay is rated for 10A @ 250VAC** - verify it can handle the load
- **Use proper wire gauge**: 14-16 AWG for 120VAC connections
- **Use wire nuts** for all connections (don't just twist wires)
- **Test with a multimeter** before powering on
- **Keep water away** from all electrical connections
- **Work in a well-lit area** with proper tools
- **Double-check all connections** before applying power

## Configuration

### 1. Enable Relay in ProStat Bridge

The relay is automatically detected when the CH340 module is connected via USB.

### 2. Set Dehumidifier Channel

Default is channel 2 (Y2 terminal). To change:

Edit `prostat-bridge/server.py`:

```python
relay_channel = 2  # Change to your relay channel (1-8)
```

### 3. Configure Interlock Logic

The ProStat Bridge implements advanced interlock logic:

**Free Dry Logic:**

- If `outdoor_temp < 65°F` AND `indoor_humidity > 55%` → Run dehumidifier
- Uses cool outdoor air to help dehumidify

**AC Overcool Logic:**

- If `outdoor_temp > 80°F` AND AC is running → Disable dehumidifier
- Let AC handle dehumidification for "free" (it's already running)

**Manual Override:**

- You can still manually control the dehumidifier via the web app
- Interlock logic respects manual overrides

## Testing

### Test 1: Relay Control

1. Connect relay module to Pi
2. Start ProStat Bridge service
3. Open web app → Settings → ProStat Bridge
4. Check relay status (should show "Connected")
5. Manually toggle relay ON/OFF
6. Verify dehumidifier responds

### Test 2: Interlock Logic

1. Set outdoor temperature < 65°F (or mock it)
2. Set indoor humidity > 55%
3. Verify dehumidifier turns ON automatically
4. Set outdoor temperature > 80°F
5. Turn on AC
6. Verify dehumidifier turns OFF (AC handles it)

### Test 3: Safety

1. Verify relay opens when power is cut
2. Test with multimeter: relay should show open circuit when OFF
3. Verify dehumidifier doesn't start unexpectedly

## Troubleshooting

### Relay Not Detected

**Symptoms:** Web app shows "Relay not connected"

**Solutions:**

- Check USB connection: `lsusb` should show CH340 device
- Check permissions: `sudo usermod -a -G dialout pi`
- Restart service: `sudo systemctl restart prostat-bridge`
- Check logs: `journalctl -u prostat-bridge -f`

### Dehumidifier Not Responding

**Symptoms:** Relay shows ON but dehumidifier doesn't run

**Solutions:**

- Check wiring connections
- Verify dehumidifier is set to "Always On" mode
- Test with multimeter: should see 120VAC at dehumidifier when relay is ON
- Check dehumidifier's built-in controls aren't interfering

### Interlock Logic Not Working

**Symptoms:** Dehumidifier doesn't turn on/off automatically

**Solutions:**

- Check system state is being updated: `curl http://localhost:8080/api/relay/status`
- Verify outdoor temperature is being set (may need weather API integration)
- Check logs: `journalctl -u prostat-bridge -f`
- Manually trigger evaluation: `curl -X POST http://localhost:8080/api/interlock/evaluate`

## Power Considerations

### Dehumidifier Power Draw

| Component                | Power Draw               | Notes                  |
| ------------------------ | ------------------------ | ---------------------- |
| **Typical 30-pint unit** | 300-500W (2.5-4A @ 120V) | Running power          |
| **Relay rating**         | 10A @ 250VAC             | Plenty of headroom     |
| **Relay module**         | ~500mA @ 12V = 6W        | Control power          |
| **Pi 3**                 | ~2A @ 5V = 10W           | Control system         |
| **Total system load**    | ~416W                    | From 24VAC transformer |

### Transformer Capacity

- Verify your 24VAC transformer can handle the load
- If not, use a separate transformer for dehumidifier power

## Next Steps

1. ✅ Complete wiring following this guide
2. ✅ Test relay control
3. ✅ Configure interlock logic
4. ✅ Set up outdoor temperature sensor (or weather API)
5. ✅ Monitor for 24-48 hours
6. ✅ Fine-tune interlock rules

## Advanced: Multiple Accessories

The CH340 relay module has 8 channels. You can control multiple accessories:

- **Relay 1**: Reserved
- **Relay 2**: Dehumidifier (Y2)
- **Relay 3**: Future accessory (e.g., humidifier, ERV)
- **Relay 4+**: Available

Each relay can be controlled independently via the API.

## Integration with Web App

The web app automatically detects and uses ProStat Bridge relay control when available. No additional configuration needed - just wire it up and it works!

## Support

For issues or questions:

- Check logs: `journalctl -u prostat-bridge -f`
- Review this guide
- Test API endpoints directly with `curl`
- Check relay module documentation
