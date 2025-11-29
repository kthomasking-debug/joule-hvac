# Testing on Window AC Unit

## Overview

Testing your thermostat system on a window AC unit is a **great way to validate everything** before installing on your main HVAC system! Window units are simpler and safer to experiment with.

## ⚠️ Safety First!

**Window AC units use 120VAC (household power) - much higher voltage than HVAC 24VAC!**

- ⚠️ **Always unplug the unit before wiring**
- ⚠️ **Use proper wire nuts and electrical tape**
- ⚠️ **Test with a multimeter before plugging in**
- ⚠️ **Consider using a GFCI outlet or extension cord**
- ⚠️ **If unsure, consult an electrician**

## Window AC Unit Basics

Most window AC units have:

- **Power cord** (120VAC)
- **Built-in thermostat** (mechanical dial)
- **Mode switch** (Off/Cool/Fan)
- **Fan speed** (Low/Med/High)

**For testing, you'll:**

1. Bypass the built-in thermostat (or set it to coldest)
2. Control power to the unit via your USB relay
3. Use your DS18B20 temperature sensor to read room temp
4. Let your React app control when the unit runs

## Wiring Options

### Option 1: Control Power to Entire Unit (Easiest) ⭐

**Best for:** Simple testing, no internal wiring needed

**How it works:**

- Use relay to control the AC's power cord
- When relay closes → AC gets power → runs
- When relay opens → AC loses power → stops

**Wiring:**

```
USB Relay Module
    │
    └─ Relay 1 (Y terminal) → Controls AC power
           │
           ├─ Hot wire (120VAC) from outlet
           └─ Hot wire to AC unit
```

**⚠️ Important:**

- Your relay module is rated for **10A/250VAC**
- Most window AC units draw **5-15A** (check your unit's label!)
- **If your AC draws more than 10A, you need a higher-rated relay!**

**Solution for high-power units:**

- Use relay to control a **contactor** (heavy-duty relay)
- Or use a **solid-state relay (SSR)** rated for your AC's amperage

### Option 2: Control Compressor Only (Advanced)

**Best for:** More control, can keep fan running

**How it works:**

- Open the AC unit's case
- Find the compressor wires
- Use relay to control compressor power
- Fan can run independently

**⚠️ Warning:**

- Requires opening the AC unit (voids warranty)
- More complex wiring
- Higher risk if not done correctly

**Recommendation:** Start with Option 1 (control entire unit power)

## Complete Setup

### Hardware Needed

1. **USB Relay Module** (CH340) - ✅ You have this
2. **DS18B20 USB Temperature Sensor** - ✅ You're getting this
3. **USB Hub** - ✅ You're getting this
4. **Android Tablet** - ✅ You have this
5. **Window AC Unit** - ✅ You have this
6. **Extension Cord** (optional, for safety)
7. **Wire Nuts** (for connections)
8. **Electrical Tape** (for safety)

### Wiring Diagram

```
Android Tablet (USB-C)
    │
    └─ USB-C OTG Adapter
           │
           └─ Powered USB Hub
                  │
                  ├─ Port 1: CH340 Relay Module
                  │      │
                  │      └─ Relay 1 (Y terminal)
                  │             │
                  │             ├─ Hot wire from outlet (120VAC)
                  │             └─ Hot wire to AC unit
                  │
                  └─ Port 2: DS18B20 USB Thermometer
                         │
                         └─ Reads room temperature
```

**Power Flow:**

```
Wall Outlet (120VAC)
    │
    ├─ Hot (Black) ──→ Relay 1 ──→ AC Unit Hot
    ├─ Neutral (White) ───────────→ AC Unit Neutral
    └─ Ground (Green) ───────────→ AC Unit Ground
```

## Step-by-Step Setup

### 1. Prepare the Extension Cord (Recommended)

**For safety, use an extension cord you can modify:**

1. **Cut the extension cord** in the middle
2. **Strip wires** on both ends
3. **Connect one end to relay:**
   - Hot (black) wire → Relay 1 Common
   - Neutral (white) → Pass through (don't cut)
   - Ground (green) → Pass through (don't cut)
4. **Connect other end to AC unit:**
   - Hot (black) wire → Relay 1 NO (Normally Open)
   - Neutral (white) → AC unit neutral
   - Ground (green) → AC unit ground

**Result:** Relay controls the hot wire, neutral and ground pass through

### 2. Set Up AC Unit

1. **Set AC mode to "Cool"** (not "Fan" or "Off")
2. **Set built-in thermostat to coldest** (or bypass it - see below)
3. **Set fan speed** (your choice - usually "Auto" or "High")
4. **Plug extension cord into wall outlet** (don't plug AC in yet!)

### 3. Connect USB Devices

1. **Connect relay module to USB hub**
2. **Connect temperature sensor to USB hub**
3. **Connect hub to tablet via OTG adapter**
4. **Power on USB hub** (if using powered hub)

### 4. Test Relay (Without AC Connected!)

1. **Open your React app on tablet**
2. **Connect to relay via Web Serial API**
3. **Test relay:**
   - Send `AT+ON1` → Relay should click ON
   - Send `AT+OFF1` → Relay should click OFF
4. **Verify with multimeter:**
   - When relay ON → continuity between relay terminals
   - When relay OFF → no continuity

### 5. Connect AC Unit

1. **Unplug everything**
2. **Connect AC unit to extension cord** (the end with relay)
3. **Double-check all connections**
4. **Plug extension cord into wall outlet**
5. **AC should NOT turn on yet** (relay is OFF)

### 6. Test Full System

1. **Open React app on tablet**
2. **Connect to relay** (Web Serial API)
3. **Connect to temperature sensor** (Web Serial API)
4. **Set thermostat to 70°F** (or desired temp)
5. **Set room temp to 75°F** (or use actual sensor reading)
6. **Set HVAC mode to "Cool"**
7. **AC should turn ON** (relay closes, power flows)
8. **Wait for room to cool to 70°F**
9. **AC should turn OFF** (relay opens, power stops)

## Bypassing Built-in Thermostat (Optional)

**If the AC's built-in thermostat interferes:**

Most window AC thermostats are simple bimetallic switches. To bypass:

1. **Open AC unit case** (voids warranty!)
2. **Find thermostat wires** (usually connected to mode switch)
3. **Disconnect thermostat** from circuit
4. **Connect mode switch directly to compressor**
5. **Reassemble unit**

**⚠️ Warning:** This is advanced and voids warranty. Only do this if you're comfortable with electronics.

**Alternative:** Just set the built-in thermostat to coldest - your React app will control when power is applied, so the built-in thermostat won't matter.

## Software Configuration

### Update Relay Control

Your existing `webSerialRelay.js` should work, but you might want to add:

```javascript
/**
 * Control window AC unit
 * Relay 1 = AC power (Y terminal)
 */
async toggleAC(on) {
  return this.toggleRelay(0, on, 'at'); // Relay 1 = index 0
}
```

### Update Thermostat Logic

In `ContactorDemo.jsx`, the existing logic should work:

- **HVAC Mode:** Set to "Cool"
- **Thermostat Setting:** Your desired temperature
- **Room Temperature:** From DS18B20 sensor
- **When room temp > setpoint:** Relay closes → AC runs
- **When room temp ≤ setpoint:** Relay opens → AC stops

## Testing Checklist

- [ ] Relay clicks when toggled (without AC connected)
- [ ] Multimeter shows continuity when relay ON
- [ ] Temperature sensor reads room temperature
- [ ] React app displays temperature correctly
- [ ] AC turns ON when room temp > setpoint
- [ ] AC turns OFF when room temp ≤ setpoint
- [ ] No overheating or strange sounds
- [ ] Relay doesn't get hot (check after 10 minutes)

## Troubleshooting

### "AC doesn't turn on"

**Check:**

- Is relay actually closing? (listen for click)
- Is power reaching AC? (use multimeter)
- Is AC's mode switch set to "Cool"?
- Is built-in thermostat set to coldest?

### "AC won't turn off"

**Check:**

- Is relay actually opening? (listen for click)
- Is there a delay in temperature reading? (sensor updates every 10s)
- Is thermostat logic correct? (check `ContactorDemo.jsx`)

### "Relay gets hot"

**Problem:** AC draws more current than relay can handle

**Solution:**

- Check AC's amperage rating (on label)
- If >10A, use a contactor or SSR
- Or use relay to control a contactor (relay controls contactor coil, contactor controls AC power)

### "Temperature reading is wrong"

**Check:**

- Is sensor positioned correctly? (away from AC airflow)
- Is sensor reading in correct units? (Celsius vs Fahrenheit)
- Is there a delay? (sensor updates every 10 seconds)

## Power Considerations

### Relay Rating

Your CH340 relay module is rated:

- **10A @ 250VAC** (max continuous)
- **10A @ 125VAC** (max continuous)

### Window AC Power Draw

Typical window AC units:

- **Small (5,000 BTU):** ~5A @ 120VAC
- **Medium (8,000 BTU):** ~7A @ 120VAC
- **Large (12,000 BTU):** ~10A @ 120VAC
- **Very Large (18,000+ BTU):** 12-15A @ 120VAC

**If your AC draws >10A:**

- Use a **contactor** (heavy-duty relay)
- Or use a **solid-state relay (SSR)** rated for your AC
- Your USB relay controls the contactor/SSR coil (low power)
- Contactor/SSR controls AC power (high power)

## Example: Using a Contactor

```
USB Relay Module (CH340)
    │
    └─ Relay 1 → Contactor Coil (24VAC or 120VAC)
           │
           └─ Contactor contacts → AC Unit Power (120VAC, 15A+)
```

**Contactor options:**

- **24VAC coil contactor** (~$15-25) - Use with 24VAC transformer
- **120VAC coil contactor** (~$15-25) - Use with 120VAC directly
- **Solid-state relay (SSR)** (~$10-20) - For AC loads, no moving parts

## Advantages of Testing on Window AC

1. ✅ **Safer** - Can test without affecting main HVAC
2. ✅ **Portable** - Move it around, test in different rooms
3. ✅ **Simple** - Just power on/off, no complex wiring
4. ✅ **Visible** - You can see/hear when it's working
5. ✅ **Low risk** - If something goes wrong, just unplug it

## Next Steps After Testing

Once you've validated everything works:

1. **Verify temperature control** is accurate
2. **Test different setpoints** (65°F, 70°F, 75°F)
3. **Test mode switching** (Cool, Off, Auto)
4. **Check relay reliability** (does it work consistently?)
5. **Monitor for issues** (overheating, strange behavior)

Then you can confidently install on your main HVAC system!

## Quick Start Commands

**In your React app:**

1. **Connect relay:** Click "Connect USB Relay"
2. **Connect sensor:** Click "Connect Temperature Sensor"
3. **Set mode:** Click "Cool" mode button
4. **Set temperature:** Use slider to set desired temp
5. **Watch it work!** AC should turn on/off automatically

**Voice commands (if enabled):**

- "Set temperature to 70"
- "Switch to cool mode"
- "What's the current temperature?"

---

**This is a perfect way to test your system before the big installation!** 🎉
