# Using Furnace Transformer to Power Tablet & Relay

## Overview

Your furnace has a 24VAC transformer that powers the thermostat. You can use this same power source to:

1. **Charge the Android tablet** (via 24VAC to USB adapter)
2. **Power the USB relay module** (via 24VAC to DC converter)

This eliminates the need for separate power supplies and creates a clean, professional installation!

## Furnace Transformer Basics

**Typical Specs:**

- **Voltage:** 24VAC (alternating current)
- **Power:** 20-40VA (watts)
- **Wires:** R (hot/red) and C (common/blue)
- **Purpose:** Powers thermostat and control circuits

**Your old thermostat used:**

- R (24VAC hot) - Red wire
- C (24VAC common/return) - Blue or black wire
- W (Heat) - White wire
- Y (Cool) - Yellow wire
- G (Fan) - Green wire

## Powering the Tablet

### Option 1: 24VAC to USB Adapter (Simplest)

**What you need:**

- **24VAC to 5V USB Adapter** (~$10-20)
  - Search: "24VAC to USB adapter" or "thermostat USB power"
  - Outputs 5V DC via USB port
  - Rated for 24VAC input

**Wiring:**

```
Furnace Transformer
    │
    ├─ R (Red) ────→ 24VAC to USB Adapter (Input +)
    └─ C (Blue) ───→ 24VAC to USB Adapter (Input -)
                        │
                        └─ USB Port ──→ USB-C Cable ──→ Tablet
```

**Installation:**

1. Turn off furnace power at breaker
2. Remove old thermostat
3. Connect R and C wires to 24VAC to USB adapter
4. Mount adapter in junction box behind tablet
5. Route USB cable to tablet
6. Turn power back on

**Recommended Products:**

- "24VAC to 5V USB Power Adapter" (various brands)
- Look for models with screw terminals for easy wiring
- Ensure output is at least 2A (for tablet charging)

### Option 2: 24VAC to 12V DC, Then USB

If you can't find a direct 24VAC to USB adapter:

1. Use 24VAC to 12VDC converter
2. Then use 12V to USB adapter
3. More components, but more flexible

## Powering the USB Relay Module

The CH340 relay module needs DC power (5V, 12V, or 24V depending on jumper settings).

### Option 1: Use Furnace Transformer (24VAC to DC)

**What you need:**

- **24VAC to 12VDC Converter** (~$10-15)
  - Or 24VAC to 5VDC if module uses 5V
  - Check your relay module's voltage requirement

**Wiring:**

```
Furnace Transformer
    │
    ├─ R (Red) ────→ 24VAC to 12VDC Converter (Input +)
    └─ C (Blue) ───→ 24VAC to 12VDC Converter (Input -)
                        │
                        └─ 12VDC Output ──→ Relay Module Power Terminals
```

**Installation:**

1. Connect R and C to converter input
2. Connect converter DC output to relay module power terminals
3. Set relay module jumper to match voltage (5V/12V/24V)
4. Mount converter in junction box

### Option 2: Share Power with Tablet

If you use a 24VAC to 12VDC converter, you can:

1. Power relay module from 12VDC output
2. Use a 12V to USB adapter to charge tablet
3. One converter powers both!

## Complete Wiring Diagram

Here's how to wire everything using the furnace transformer:

```
Furnace Transformer (24VAC)
    │
    ├─ R (Red) ────┬─→ 24VAC to 12VDC Converter ──→ Relay Module (12V)
    │               │
    │               └─→ 24VAC to USB Adapter ──→ Tablet (5V USB)
    │
    └─ C (Blue) ────┬─→ Converter (Common)
                    └─→ USB Adapter (Common)

Relay Module Outputs:
    ├─ Relay 1 (NO) ──→ W (Heat) ──→ Furnace
    ├─ Relay 2 (NO) ──→ Y (Cool) ──→ Furnace
    ├─ Relay 3 (NO) ──→ G (Fan)  ──→ Furnace
    └─ Common ───────→ C (Common) ──→ Furnace
```

## Power Calculations

**Furnace Transformer Capacity:**

- Typical: 20-40VA (watts)
- At 24VAC: ~0.8-1.7A

**Power Requirements:**

- **Tablet charging:** ~5-10W (1-2A @ 5V)
- **Relay module:** ~1-3W (0.1-0.25A @ 12V)
- **Total:** ~6-13W

**Verdict:** ✅ Furnace transformer has plenty of capacity!

## Safety Considerations

1. **Turn off power** before wiring
2. **Use proper wire gauge:** 18-22 AWG for low voltage
3. **Mount converters in junction box** (not exposed)
4. **Check voltage ratings:** Ensure converters are rated for 24VAC input
5. **Use wire nuts or terminal blocks** for secure connections
6. **Test with multimeter** before connecting tablet/relay

## Recommended Products

### 24VAC to USB Adapter

- Search: "24VAC to 5V USB adapter"
- Brands: Various (check reviews)
- Price: $10-20
- Look for: Screw terminals, 2A+ output

### 24VAC to 12VDC Converter

- Search: "24VAC to 12VDC converter"
- Brands: Mean Well, TRC Electronics
- Price: $10-20
- Look for: Regulated output, screw terminals

### All-in-One Solution

- Some products combine 24VAC to both 12VDC and USB
- More expensive but cleaner installation

## Installation Steps

1. **Turn off furnace power** at breaker
2. **Remove old thermostat** from wall
3. **Identify wires:**
   - R (Red) - 24VAC hot
   - C (Blue/Black) - 24VAC common
   - W, Y, G - Control wires (for relay module)
4. **Install 24VAC to USB adapter:**
   - Connect R and C to adapter input
   - Mount adapter in junction box
5. **Install 24VAC to DC converter (for relay):**
   - Connect R and C to converter input
   - Connect DC output to relay module
   - Set relay module voltage jumper
6. **Wire relay module to furnace:**
   - Relay 1 → W (Heat)
   - Relay 2 → Y (Cool)
   - Relay 3 → G (Fan)
   - Common → C
7. **Route USB cable** from adapter to tablet
8. **Mount tablet** on wall
9. **Turn power back on** and test

## Troubleshooting

### Tablet Not Charging

- Check USB adapter output with multimeter (should be ~5V)
- Verify R and C connections to adapter
- Try different USB cable
- Check tablet charging port

### Relay Module Not Powering

- Check DC converter output voltage
- Verify relay module jumper settings match voltage
- Check power terminal connections
- Test with multimeter

### Furnace Not Responding

- Check relay module wiring to furnace terminals
- Verify relay commands are working (LED indicators)
- Test relays with multimeter (should close when ON)
- Check furnace transformer output (should be ~24VAC)

## Cost Savings

**Without Furnace Power:**

- USB power adapter: $10
- Relay module power supply: $10
- **Total:** $20

**With Furnace Power:**

- 24VAC to USB adapter: $15
- 24VAC to 12VDC converter: $12
- **Total:** $27

**But you get:**

- ✅ Always-on power (no battery concerns)
- ✅ Professional installation
- ✅ No separate power supplies cluttering the wall
- ✅ Same reliability as commercial thermostats

**Worth it!** The small extra cost is worth the professional installation.

## Advantages

✅ **No separate power supplies** - Everything runs from furnace transformer  
✅ **Always powered** - Tablet never runs out of battery  
✅ **Professional installation** - Same as commercial smart thermostats  
✅ **Reliable** - Furnace transformer is designed for 24/7 operation  
✅ **Clean** - No wall warts or power adapters visible

This is exactly how commercial smart thermostats (Nest, Ecobee) are powered - you're just doing it yourself!
