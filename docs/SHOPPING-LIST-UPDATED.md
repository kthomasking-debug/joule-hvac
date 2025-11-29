# Updated Shopping List - Android Tablet Thermostat System

**Last Updated:** Based on complete system documentation  
**Purpose:** Main HVAC installation + Window AC testing setup

---

## 🎯 Priority 1: Core Installation Items (Required)

### Main Components

| Item                                         | Price  | Status     | Notes                                        |
| -------------------------------------------- | ------ | ---------- | -------------------------------------------- |
| **ONN Surf 7" Tablet (32GB, 3GB RAM)**       | $45.00 | ✅ In Cart | 2024 model, good specs                       |
| **8CH USB Serial Port Relay Module (CH340)** | $16.41 | ✅ In Cart | DC 24V version, 8 channels                   |
| **AC24V to DC5V 3A 15W USB Converter**       | $22.00 | ✅ In Cart | Powers tablet from furnace transformer       |
| **24VAC to 12VDC Converter**                 | $18.99 | ✅ In Cart | Powers relay module from furnace transformer |
| **USB A to B Cable (1.5m)**                  | $3.69  | ✅ In Cart | Connects relay to USB hub                    |
| **USB-C to USB-A OTG Adapter**               | $5.49  | ✅ In Cart | Tablet to USB hub connection                 |
| **360° Rotation Tablet Wall Mount**          | $11.98 | ✅ In Cart | Mounts tablet on wall                        |

**Subtotal (Core Items):** $123.56

---

## 🎯 Priority 2: Temperature & USB Hub (Required)

### Temperature Sensor

| Item                                         | Price  | Status      | Notes                                                         |
| -------------------------------------------- | ------ | ----------- | ------------------------------------------------------------- |
| **DS18B20 USB ASCII Thermometer**            | $35.00 | ⚠️ **ADD!** | USB serial, ASCII output, 5m cable, Web Serial API compatible |
| **OR AHT20 USB Temperature/Humidity Sensor** | $20-25 | Alternative | Web HID API, includes humidity                                |

**Recommendation:** DS18B20 USB ASCII Thermometer ⭐

- Works with Web Serial API (same as your relay!)
- ASCII format = easy to parse
- PL-2303TA chip (well-supported on Android)
- Can use same USB hub as relay

### USB Hub

| Item                               | Price  | Status      | Notes                                   |
| ---------------------------------- | ------ | ----------- | --------------------------------------- |
| **Anker 4-Port Powered USB Hub**   | $20-25 | ⚠️ **ADD!** | Powered hub recommended for reliability |
| **OR Generic Powered USB 3.0 Hub** | $15-20 | Alternative | Must be powered, 4+ ports               |

**Recommendation:** Anker 4-Port Powered USB Hub ⭐

- Reliable power for multiple devices
- Works well with USB OTG
- Prevents brownouts when relay switches

**Subtotal (Priority 2):** $55-60

---

## 🎯 Priority 3: Testing Setup (Window AC Unit)

### Window AC Unit for Testing

| Item                                 | Price   | Status       | Notes                                |
| ------------------------------------ | ------- | ------------ | ------------------------------------ |
| **Window AC Unit (5,000-8,000 BTU)** | $50-100 | Optional     | For testing before main HVAC install |
| **OR Use Existing Window AC**        | $0      | If Available | Any window AC unit works for testing |

**Note:** You mentioned a wall-mounted mobile AC unit ($59.80) - this works too!

### Testing Accessories

| Item                                         | Price | Status      | Notes                                              |
| -------------------------------------------- | ----- | ----------- | -------------------------------------------------- |
| **Extension Cord (12-16 AWG, 10-15A rated)** | $8-15 | ⚠️ **ADD!** | For safe AC unit testing, modify for relay control |
| **Wire Nuts (Assorted, #22-18 AWG)**         | $5-8  | ⚠️ **ADD!** | For secure wire connections                        |
| **Electrical Tape**                          | $3-5  | ⚠️ **ADD!** | For safety and wire protection                     |

**Subtotal (Testing Items):** $16-28

---

## 🎯 Priority 4: High-Power AC Protection (If Needed)

### Contactor/SSR for High-Power AC Units

**⚠️ Only needed if your window AC draws >10A!**

| Item                                     | Price  | Status      | Notes                                |
| ---------------------------------------- | ------ | ----------- | ------------------------------------ |
| **24VAC Coil Contactor (15-20A)**        | $15-25 | Optional    | If AC >10A, use contactor for safety |
| **OR Solid-State Relay (SSR-25DA, 25A)** | $10-20 | Alternative | For AC loads, no moving parts        |
| **OR 120VAC Coil Contactor**             | $15-25 | Alternative | If using 120VAC directly             |

**Check your AC unit's label first!**

- Small (5,000 BTU): ~5A - ✅ Your relay can handle this
- Medium (8,000 BTU): ~7A - ✅ Your relay can handle this
- Large (12,000 BTU): ~10A - ⚠️ At limit, consider contactor
- Very Large (18,000+ BTU): 12-15A - ⚠️ **Need contactor/SSR!**

**Subtotal (If Needed):** $10-25

---

## 🎯 Priority 5: Installation Accessories (Recommended)

### Wiring & Mounting

| Item                                   | Price  | Status      | Notes                                |
| -------------------------------------- | ------ | ----------- | ------------------------------------ |
| **Junction Box (4" × 4" × 2.5")**      | $5-10  | Recommended | Mount power converters behind tablet |
| **Strain Reliefs (0.5" diameter)**     | $3-5   | Recommended | For wire pass-throughs               |
| **Cable Ties (4" length, pack of 50)** | $3-5   | Recommended | Wire management inside enclosure     |
| **Wire Strippers**                     | $5-10  | If Needed   | For preparing wires                  |
| **Multimeter**                         | $15-30 | Recommended | For testing voltage and continuity   |

**Subtotal (Installation Accessories):** $31-60

---

## 📋 Complete Shopping List Summary

### Required Items (Must Have)

1. ✅ ONN Surf Tablet (32GB, 3GB RAM) - $45.00
2. ✅ 8CH USB Relay Module (CH340) - $16.41
3. ✅ AC24V to DC5V USB Converter - $22.00
4. ✅ 24VAC to 12VDC Converter - $18.99
5. ✅ USB A to B Cable - $3.69
6. ✅ USB-C OTG Adapter - $5.49
7. ✅ Tablet Wall Mount - $11.98
8. ⚠️ **DS18B20 USB ASCII Thermometer - $35.00** ← ADD!
9. ⚠️ **Anker 4-Port Powered USB Hub - $20-25** ← ADD!

**Total Required:** ~$183-188

### Testing Items (Recommended)

10. ⚠️ Extension Cord (12-16 AWG) - $8-15
11. ⚠️ Wire Nuts (Assorted) - $5-8
12. ⚠️ Electrical Tape - $3-5

**Total Testing:** ~$16-28

### Optional Items (If Needed)

13. Contactor/SSR (if AC >10A) - $10-25
14. Junction Box - $5-10
15. Strain Reliefs - $3-5
16. Cable Ties - $3-5
17. Multimeter - $15-30

**Total Optional:** ~$36-75

---

## 💰 Cost Breakdown

### Minimum Setup (Required Only)

- **Core Components:** $123.56
- **Temperature Sensor:** $35.00
- **USB Hub:** $20-25
- **Total:** ~$178-183

### Recommended Setup (Required + Testing)

- **Required Items:** ~$183-188
- **Testing Items:** ~$16-28
- **Total:** ~$199-216

### Complete Setup (Everything)

- **Required Items:** ~$183-188
- **Testing Items:** ~$16-28
- **Optional Items:** ~$36-75
- **Total:** ~$235-291

---

## 🛒 eBay/Amazon Search Terms

### Temperature Sensor

- "DS18B20 USB ASCII thermometer"
- "DS18B20 USB serial temperature sensor"
- "USB temperature sensor PL-2303"

### USB Hub

- "Anker 4-port powered USB hub"
- "Powered USB 3.0 hub 4 port"
- "USB hub with power adapter"

### Testing Items

- "12 AWG extension cord 15A"
- "Wire nuts assorted 22-18 AWG"
- "Electrical tape 3M"

### Contactor/SSR (If Needed)

- "24VAC contactor 15A"
- "SSR-25DA solid state relay"
- "AC contactor relay 120VAC"

---

## ✅ Pre-Checkout Checklist

### Remove from Cart (If Present)

- [ ] ❌ ONN Surf Tablet (16GB, 1GB RAM) - $33.00 - **DUPLICATE!**
- [ ] ❌ "12V/24V to 5V USB C Adapter" - $15.80 - **WRONG TYPE!**

### Add to Cart (Missing Items)

- [ ] ⚠️ DS18B20 USB ASCII Thermometer - $35.00
- [ ] ⚠️ Anker 4-Port Powered USB Hub - $20-25
- [ ] ⚠️ Extension Cord (for testing) - $8-15
- [ ] ⚠️ Wire Nuts (assorted) - $5-8
- [ ] ⚠️ Electrical Tape - $3-5

### Verify in Cart

- [x] ✅ ONN Surf Tablet (32GB, 3GB RAM) - $45.00
- [x] ✅ 8CH USB Relay Module (CH340, DC 24V) - $16.41
- [x] ✅ AC24V to DC5V USB Converter - $22.00
- [x] ✅ 24VAC to 12VDC Converter - $18.99
- [x] ✅ USB A to B Cable (1.5m) - $3.69
- [x] ✅ USB-C OTG Adapter - $5.49
- [x] ✅ Tablet Wall Mount - $11.98

---

## 📝 Installation Notes

### Power Setup

1. Connect R and C wires from furnace to both converters
2. AC24V to USB converter → powers tablet (5V, 3A)
3. 24VAC to 12VDC converter → powers relay module (12VDC, 1A)

### USB Connections

1. Tablet (USB-C) → OTG Adapter (USB-A)
2. OTG Adapter → USB Hub (USB-A)
3. USB Hub Port 1 → Relay Module (USB-B)
4. USB Hub Port 2 → DS18B20 Temperature Sensor (USB-A)

### HVAC Wiring

1. Relay 1 Common → R (24VAC Hot)
2. Relay 1 NO → W (Heat) → Furnace
3. Relay 2 Common → R (24VAC Hot)
4. Relay 2 NO → Y (Cool) → Furnace
5. Relay 3 Common → R (24VAC Hot)
6. Relay 3 NO → G (Fan) → Furnace

### Testing Setup (Window AC)

1. Cut extension cord in middle
2. Wire relay into hot wire (black)
3. Connect AC unit to modified extension cord
4. Test with multimeter before plugging in
5. Use React app to control AC on/off

---

## 🎯 Quick Reference

### What You're Building

- **Android tablet thermostat** running your React app
- **USB relay control** for HVAC contactors (W, Y, G)
- **USB temperature sensor** for room temperature
- **Furnace-powered** (no batteries, always on)
- **Professional installation** (wall-mounted, clean wiring)

### Testing Strategy

1. **Test on window AC unit first** (safer, portable)
2. **Validate temperature control** (sensor readings)
3. **Test relay reliability** (on/off cycles)
4. **Verify thermostat logic** (heating/cooling cycles)
5. **Then install on main HVAC** (with confidence!)

---

## 🚀 You're Ready!

Once you have all the required items:

1. ✅ Remove duplicate/wrong items from cart
2. ✅ Add missing temperature sensor and USB hub
3. ✅ Add testing items (extension cord, wire nuts, tape)
4. ✅ Review total cost (~$200-220 for recommended setup)
5. ✅ Place order and start building!

**See these docs for detailed setup:**

- `docs/ANDROID-TABLET-THERMOSTAT.md` - Complete setup guide
- `docs/CH340-RELAY-SETUP.md` - Relay module wiring
- `docs/WINDOW-AC-TESTING.md` - Testing on window AC
- `docs/USB-TEMPERATURE-HUMIDITY-SENSORS.md` - Sensor integration
- `docs/FURNACE-POWER-SETUP.md` - Power from furnace transformer
- `docs/THERMOSTAT-ENCLOSURE-SPEC.md` - Enclosure & mounting specs

**Good luck with your build!** 🎉
