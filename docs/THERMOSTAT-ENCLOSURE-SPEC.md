# Thermostat Enclosure, Wiring & Wall Mount Specifications

## Overview

Complete technical specifications for rendering and building your Android tablet thermostat system. Use these dimensions and layouts in AutoCAD, Fusion 360, or any CAD tool.

---

## 1. Enclosure Specifications

### 1.1 Overall Dimensions

**Recommended Enclosure Size:**

- **Width:** 8.5" (216mm)
- **Height:** 6.5" (165mm)
- **Depth:** 2.5" (64mm)

**Rationale:**

- Fits ONN Surf 7" tablet (7.1" × 4.3" × 0.4")
- Accommodates USB hub, relay module, power converters
- Standard electrical box depth (2.5")
- Professional appearance

### 1.2 Material Specifications

**Recommended:**

- **Material:** ABS Plastic or Polycarbonate (UL94 V-0 rated)
- **Color:** White or light gray (matches HVAC equipment)
- **Finish:** Matte (reduces fingerprints)
- **Wall Thickness:** 0.125" (3mm) minimum

**Alternative:**

- **Aluminum:** More durable, better heat dissipation
- **Steel:** Industrial grade, heavier

### 1.3 Component Layout (Top View)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │                                         │   │
│  │      ONN Surf 7" Tablet (Front)        │   │
│  │      7.1" × 4.3" (180mm × 109mm)       │   │
│  │                                         │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐      │
│  │ USB  │  │ USB  │  │ USB  │  │ USB  │      │
│  │ Hub  │  │Relay │  │24V→5V│  │24V→12│      │
│  │      │  │Module│  │Conv. │  │Conv. │      │
│  └──────┘  └──────┘  └──────┘  └──────┘      │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │      Wiring Channel / Pass-through     │   │
│  │      (HVAC wires, USB cables)         │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
        8.5" (216mm) Width
```

### 1.4 Component Dimensions

**ONN Surf 7" Tablet:**

- Width: 7.1" (180mm)
- Height: 4.3" (109mm)
- Thickness: 0.4" (10mm)

**USB Hub (Anker 4-Port):**

- Width: 3.5" (89mm)
- Height: 1.0" (25mm)
- Depth: 0.8" (20mm)

**CH340 Relay Module:**

- Width: 3.6" (92mm)
- Height: 2.4" (62mm)
- Depth: 0.75" (19mm)

**24VAC to 5V USB Converter:**

- Width: 2.0" (51mm)
- Height: 1.5" (38mm)
- Depth: 1.0" (25mm)

**24VAC to 12VDC Converter:**

- Width: 2.0" (51mm)
- Height: 1.5" (38mm)
- Depth: 1.0" (25mm)

### 1.5 Front Panel Features

**Cutouts:**

- **Tablet Display:** 7.1" × 4.3" (180mm × 109mm) - centered
- **Ventilation:** 0.25" (6mm) holes, 0.5" (12mm) spacing
- **USB Access:** 0.5" × 0.2" (12mm × 5mm) slot for USB-C cable

**Mounting:**

- **Tablet Mount:** Adjustable bracket or adhesive pad
- **Clearance:** 0.1" (2.5mm) gap around tablet edges

### 1.6 Rear Panel Features

**Cutouts:**

- **HVAC Wire Pass-through:** 0.75" (19mm) diameter hole
- **USB Cable Pass-through:** 0.5" (12mm) diameter hole
- **Mounting Holes:** 4 × 0.25" (6mm) diameter, for wall screws

**Mounting Pattern:**

```
        ┌─────────────┐
        │             │
        │   ┌───┐     │
        │   │   │     │
        │   └───┘     │
        │             │
        └─────────────┘
```

**Screw Holes:**

- Top-left: 0.5" (12mm) from top, 0.5" (12mm) from left
- Top-right: 0.5" (12mm) from top, 0.5" (12mm) from right
- Bottom-left: 0.5" (12mm) from bottom, 0.5" (12mm) from left
- Bottom-right: 0.5" (12mm) from bottom, 0.5" (12mm) from right

### 1.7 Internal Component Placement (Side View)

```
Front Panel (Tablet)
│
├─ 0.4" (10mm) - Tablet thickness
│
├─ 0.2" (5mm) - Air gap
│
├─ Component Layer:
│  ├─ USB Hub: 1.0" (25mm) height
│  ├─ Relay Module: 0.75" (19mm) height
│  ├─ Power Converters: 1.0" (25mm) height
│
├─ 0.3" (8mm) - Wiring clearance
│
└─ Rear Panel (Wall mount)
```

**Total Depth:** 2.5" (64mm) = 0.4" tablet + 0.2" gap + 1.0" components + 0.3" wiring + 0.6" rear panel

---

## 2. Wiring Diagram

### 2.1 Power Distribution

```
Furnace Transformer (24VAC, 40VA)
    │
    ├─ R (Red, 24VAC Hot)
    │   │
    │   ├─→ 24VAC to 5V USB Converter (Input +)
    │   │       │
    │   │       └─→ USB-C Cable → Tablet (5V, 2A)
    │   │
    │   └─→ 24VAC to 12VDC Converter (Input +)
    │           │
    │           └─→ Relay Module Power (12VDC, 0.25A)
    │
    └─ C (Blue/Black, 24VAC Common)
        │
        ├─→ 24VAC to 5V USB Converter (Input -)
        └─→ 24VAC to 12VDC Converter (Input -)
```

### 2.2 USB Device Connections

```
Android Tablet (USB-C)
    │
    └─ USB-C OTG Adapter
           │
           └─ USB Hub (Powered, 4-Port)
                  │
                  ├─ Port 1: CH340 Relay Module (USB-B)
                  │      │
                  │      └─ Relay Module Power: 12VDC from converter
                  │
                  ├─ Port 2: DS18B20 USB Thermometer (USB-A)
                  │
                  └─ Port 3: (Optional) USB Hub Power (if needed)
```

### 2.3 HVAC Control Wiring

```
Relay Module (CH340, 8-Channel)
    │
    ├─ Relay 1 (Terminal: W - Heat)
    │   │
    │   ├─ Common → R (24VAC Hot from transformer)
    │   └─ NO (Normally Open) → W Wire → Furnace Control Board
    │
    ├─ Relay 2 (Terminal: Y - Cool/Compressor)
    │   │
    │   ├─ Common → R (24VAC Hot from transformer)
    │   └─ NO → Y Wire → Furnace Control Board
    │
    └─ Relay 3 (Terminal: G - Fan)
        │
        ├─ Common → R (24VAC Hot from transformer)
        └─ NO → G Wire → Furnace Control Board

Furnace Control Board
    │
    ├─ R (24VAC Hot) - Connected to transformer R
    ├─ C (24VAC Common) - Connected to transformer C
    ├─ W (Heat) - Connected to Relay 1 NO
    ├─ Y (Cool) - Connected to Relay 2 NO
    └─ G (Fan) - Connected to Relay 3 NO
```

### 2.4 Complete Wiring Schematic (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│                    Furnace Transformer                       │
│                    24VAC, 40VA                              │
│                                                             │
│  R (Red) ────────────┬──────────────────────────────────┐  │
│                      │                                  │  │
│                      │  ┌──────────────────────────┐  │  │
│                      │  │ 24VAC → 5V USB Converter │  │  │
│                      │  │                          │  │  │
│                      │  └───────┬──────────────────┘  │  │
│                      │          │                      │  │
│                      │          └─ USB-C → Tablet      │  │
│                      │                                │  │
│                      │  ┌──────────────────────────┐  │  │
│                      │  │ 24VAC → 12VDC Converter  │  │  │
│                      │  │                          │  │  │
│                      │  └───────┬──────────────────┘  │  │
│                      │          │                      │  │
│                      │          └─ 12VDC → Relay       │  │
│                      │                                │  │
│  C (Common) ─────────┴────────────────────────────────┴  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Android Tablet                           │
│                    (ONN Surf 7")                           │
│                                                             │
│  USB-C ──→ OTG Adapter ──→ USB Hub ──→ Relay Module        │
│                                                             │
│  USB-C ──→ OTG Adapter ──→ USB Hub ──→ DS18B20 Sensor      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Relay Module (CH340)                     │
│                                                             │
│  Relay 1 (W) ── Common → R ── NO → W Wire → Furnace       │
│  Relay 2 (Y) ── Common → R ── NO → Y Wire → Furnace       │
│  Relay 3 (G) ── Common → R ── NO → G Wire → Furnace       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.5 Wire Gauge & Color Coding

**HVAC Control Wires (24VAC):**

- **R (Red):** 18-22 AWG, Red insulation
- **C (Common):** 18-22 AWG, Blue or Black insulation
- **W (Heat):** 18-22 AWG, White insulation
- **Y (Cool):** 18-22 AWG, Yellow insulation
- **G (Fan):** 18-22 AWG, Green insulation

**DC Power Wires:**

- **12VDC Positive:** 18-22 AWG, Red insulation
- **12VDC Ground:** 18-22 AWG, Black insulation
- **5V USB:** Standard USB-C cable

**USB Cables:**

- **USB-A to USB-B:** For relay module (1.5m)
- **USB-C OTG Adapter:** Tablet to hub
- **USB-A to USB-A:** For temperature sensor (if needed)

### 2.6 Wire Routing Inside Enclosure

```
┌─────────────────────────────────────────┐
│  Front Panel (Tablet)                  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Tablet                         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐        │
│  │ USB  │  │Relay │  │Power │        │
│  │ Hub  │  │Module│  │Conv. │        │
│  └──────┘  └──────┘  └──────┘        │
│                                         │
│  Wiring Channel (bottom):              │
│  ├─ HVAC wires (R, C, W, Y, G)        │
│  ├─ USB cables (hub connections)       │
│  └─ Power wires (12VDC, 5V USB)       │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Wire Pass-through (rear)      │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

---

## 3. Wall Mount Specifications

### 3.1 Mounting Plate Dimensions

**Wall Plate:**

- **Width:** 8.5" (216mm)
- **Height:** 6.5" (165mm)
- **Thickness:** 0.125" (3mm)
- **Material:** Steel or aluminum (for strength)

**Mounting Holes:**

- **Pattern:** 4 holes, rectangular
- **Hole Diameter:** 0.25" (6mm)
- **Screw Size:** #8 or #10 wood screws
- **Screw Length:** 1.5" (38mm) minimum

### 3.2 Drilling Template

```
        ┌─────────────────────────────────────┐
        │                                     │
        │  ●                                 ● │
        │   (0.5", 0.5")              (0.5", 0.5") │
        │                                     │
        │                                     │
        │                                     │
        │                                     │
        │                                     │
        │                                     │
        │  ●                                 ● │
        │   (0.5", 0.5")              (0.5", 0.5") │
        │                                     │
        └─────────────────────────────────────┘
             8.5" (216mm) Width
```

**Hole Coordinates (from top-left corner):**

- **Top-left:** (0.5", 0.5") = (12mm, 12mm)
- **Top-right:** (8.0", 0.5") = (204mm, 12mm)
- **Bottom-left:** (0.5", 6.0") = (12mm, 153mm)
- **Bottom-right:** (8.0", 6.0") = (204mm, 153mm)

### 3.3 Wall Preparation

**For Drywall:**

- **Stud Location:** Mount to stud if possible (16" or 24" centers)
- **Anchors:** If not on stud, use toggle bolts or molly bolts
- **Minimum Anchor Rating:** 50 lbs (22kg) per anchor

**For Masonry:**

- **Drill Bit:** 0.25" (6mm) masonry bit
- **Anchors:** Plastic or metal anchors
- **Screws:** Masonry screws

**For Metal Studs:**

- **Screws:** Self-tapping metal screws
- **Minimum Length:** 1.0" (25mm)

### 3.4 Mounting Bracket Design

**Option 1: Flat Mount (Recommended)**

```
┌─────────────────────────────────────┐
│  Wall Plate (8.5" × 6.5")          │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Enclosure Mounting Area    │   │
│  │  (8.5" × 6.5")              │   │
│  └─────────────────────────────┘   │
│                                     │
│  ●                                 ● │
│  Mounting Holes                     │
│                                     │
└─────────────────────────────────────┘
```

**Option 2: Recessed Mount (In-Wall Box)**

- **Box Depth:** 2.5" (64mm)
- **Box Width:** 8.5" (216mm)
- **Box Height:** 6.5" (165mm)
- **Material:** Metal electrical box or custom enclosure

### 3.5 HVAC Wire Routing

**Wall Cutout:**

- **Size:** 0.75" (19mm) diameter hole
- **Location:** Bottom-center of mounting plate
- **Purpose:** Pass HVAC wires (R, C, W, Y, G) from wall to enclosure

**Wire Routing:**

```
Wall Cavity
    │
    └─ HVAC Wires (from furnace)
           │
           └─ 0.75" Hole in Wall
                  │
                  └─ Enclosure (rear panel)
                         │
                         └─ Relay Module
```

### 3.6 Installation Steps

1. **Mark Mounting Holes:**

   - Use drilling template
   - Mark 4 hole locations
   - Check for studs (use stud finder)

2. **Drill Holes:**

   - Drill 0.25" (6mm) holes
   - Use appropriate bit (wood, masonry, metal)

3. **Install Anchors (if needed):**

   - Insert anchors into holes
   - Tap flush with wall

4. **Mount Plate:**

   - Align mounting plate with holes
   - Insert screws
   - Tighten securely

5. **Route HVAC Wires:**

   - Pass wires through wall cutout
   - Connect to relay module (inside enclosure)

6. **Mount Enclosure:**

   - Attach enclosure to mounting plate
   - Use provided screws or clips

7. **Connect Power:**

   - Connect R and C wires to power converters
   - Verify 24VAC with multimeter

8. **Test System:**
   - Connect tablet
   - Connect USB devices
   - Test relay control
   - Verify temperature reading

---

## 4. CAD File Specifications

### 4.1 Recommended CAD Software

**For 3D Modeling:**

- **Fusion 360** (Free for hobbyists) - ⭐ **RECOMMENDED**
- **SolidWorks** (Professional)
- **AutoCAD** (If you already know it)

**For 2D Drawings:**

- **AutoCAD** (Industry standard)
- **DraftSight** (Free AutoCAD alternative)
- **LibreCAD** (Free, open-source)

### 4.2 Layers/Components to Create

**3D Model Layers:**

1. **Enclosure_Outer** - Main housing
2. **Enclosure_Inner** - Internal structure
3. **Tablet** - ONN Surf 7" tablet
4. **USB_Hub** - USB hub component
5. **Relay_Module** - CH340 relay board
6. **Power_Converters** - 24VAC converters
7. **Wiring** - All wires and cables
8. **Mounting_Plate** - Wall mounting bracket

**2D Drawing Layers:**

1. **Dimensions** - All measurements
2. **Components** - Component outlines
3. **Wiring** - Wire routing
4. **Mounting** - Mounting holes and patterns
5. **Notes** - Text annotations

### 4.3 Export Formats

**For Manufacturing:**

- **STL** - For 3D printing
- **STEP** - For CNC machining
- **DXF** - For laser cutting

**For Documentation:**

- **PDF** - For printing
- **PNG/SVG** - For web/docs
- **DWG** - For AutoCAD

---

## 5. Assembly Instructions

### 5.1 Component Installation Order

1. **Mount Power Converters:**

   - Secure 24VAC to 5V USB converter
   - Secure 24VAC to 12VDC converter
   - Route input wires (R, C) to rear panel

2. **Install USB Hub:**

   - Mount hub in designated location
   - Connect power (if powered hub)
   - Route USB cables to front panel

3. **Install Relay Module:**

   - Mount relay module
   - Connect 12VDC power
   - Route USB-B cable to hub

4. **Install Tablet:**

   - Mount tablet bracket
   - Secure tablet
   - Connect USB-C cable to hub

5. **Route Wires:**

   - Connect HVAC wires to relay terminals
   - Route USB cables through channels
   - Secure wires with cable ties

6. **Close Enclosure:**
   - Attach rear panel
   - Verify all connections
   - Test system

### 5.2 Clearance Requirements

**Minimum Clearances:**

- **Tablet to Enclosure:** 0.1" (2.5mm) all sides
- **Components to Enclosure:** 0.2" (5mm) minimum
- **Wires to Components:** 0.1" (2.5mm) minimum
- **Ventilation:** 0.5" (12mm) around hot components

---

## 6. Safety & Compliance

### 6.1 Electrical Safety

- **Isolation:** Ensure 24VAC and DC circuits are isolated
- **Fusing:** Add inline fuse on 24VAC input (1A fast-blow)
- **Grounding:** Properly ground all metal components
- **Wire Rating:** Use wires rated for 24VAC, 10A minimum

### 6.2 Fire Safety

- **Enclosure Material:** UL94 V-0 rated plastic
- **Ventilation:** Adequate airflow to prevent overheating
- **Component Spacing:** Prevent heat buildup

### 6.3 Mechanical Safety

- **Secure Mounting:** Ensure wall mount can support 2-3 lbs (1-1.5kg)
- **Strain Relief:** Use strain reliefs on all wire pass-throughs
- **Sharp Edges:** Round all sharp edges and corners

---

## 7. Bill of Materials (BOM)

### 7.1 Enclosure Components

| Item              | Quantity | Dimensions           | Material       |
| ----------------- | -------- | -------------------- | -------------- |
| Front Panel       | 1        | 8.5" × 6.5" × 0.125" | ABS Plastic    |
| Rear Panel        | 1        | 8.5" × 6.5" × 0.125" | ABS Plastic    |
| Side Panels       | 2        | 6.5" × 2.5" × 0.125" | ABS Plastic    |
| Top/Bottom Panels | 2        | 8.5" × 2.5" × 0.125" | ABS Plastic    |
| Mounting Plate    | 1        | 8.5" × 6.5" × 0.125" | Steel/Aluminum |
| Screws            | 8        | #8 × 1.5"            | Steel          |
| Standoffs         | 4        | 0.5" height          | Nylon          |

### 7.2 Hardware Components

| Item                      | Quantity | Notes                      |
| ------------------------- | -------- | -------------------------- |
| ONN Surf 7" Tablet        | 1        | 7.1" × 4.3" × 0.4"         |
| USB Hub (4-Port)          | 1        | Powered, Anker recommended |
| CH340 Relay Module        | 1        | 8-channel, 12VDC           |
| 24VAC to 5V USB Converter | 1        | 3A output                  |
| 24VAC to 12VDC Converter  | 1        | 1A output                  |
| DS18B20 USB Thermometer   | 1        | USB serial                 |
| USB-C OTG Adapter         | 1        | USB-C to USB-A             |
| USB A to B Cable          | 1        | 1.5m length                |

### 7.3 Wiring & Connectors

| Item                      | Quantity | Gauge/Type    |
| ------------------------- | -------- | ------------- |
| HVAC Wire (R, C, W, Y, G) | 5        | 18-22 AWG     |
| 12VDC Power Wire          | 2        | 18 AWG        |
| USB-C Cable               | 1        | Standard      |
| Wire Nuts                 | 6        | #22-18 AWG    |
| Cable Ties                | 10       | 4" length     |
| Strain Reliefs            | 2        | 0.5" diameter |

---

## 8. Rendering Checklist

Before building, ensure you have:

- [ ] 3D model of enclosure (Fusion 360, SolidWorks, etc.)
- [ ] 2D wiring diagram (AutoCAD, DraftSight, etc.)
- [ ] Wall mount drilling template (PDF or DXF)
- [ ] Component placement diagram
- [ ] Wire routing diagram
- [ ] Assembly instructions
- [ ] Bill of materials (BOM)
- [ ] Safety compliance checklist

---

## 9. Next Steps

1. **Create 3D Model:**

   - Use Fusion 360 or your preferred CAD tool
   - Import component models (if available)
   - Verify clearances and fit

2. **Generate 2D Drawings:**

   - Create front, top, side views
   - Add dimensions and annotations
   - Export as PDF for reference

3. **Create Wiring Diagram:**

   - Use electrical CAD software
   - Label all connections
   - Add wire colors and gauges

4. **Test Fit:**

   - 3D print enclosure (if possible)
   - Verify component fit
   - Adjust dimensions as needed

5. **Manufacture:**
   - Order custom enclosure (3D printing, injection molding, etc.)
   - Or build from standard electrical boxes

---

**This specification document provides everything you need to render and build your thermostat enclosure, wiring, and wall mount system!**
