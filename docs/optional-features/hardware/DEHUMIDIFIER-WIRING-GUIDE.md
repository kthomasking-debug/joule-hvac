# 🔌 Dehumidifier Relay Control Wiring Guide

> **Complete guide for wiring a dehumidifier to your smart thermostat relay system, including internal component diagrams and wiring schematics.**

---

## 📑 Table of Contents

- [Overview](#overview)
- [Safety First](#-safety-first)
- [Parts Needed](#-parts-needed)
- [Understanding Dehumidifier Internal Wiring](#-understanding-dehumidifier-internal-wiring)
  - [Standard Dehumidifier Electrical Diagram](#standard-dehumidifier-electrical-diagram)
  - [Component Breakdown](#component-breakdown)
  - [How It Works](#how-it-works-simplified-operation)
- [Wiring Options for Smart Thermostat Integration](#-wiring-options-for-smart-thermostat-integration)
- [Relay Terminal Assignment](#-relay-terminal-assignment)
- [Hacking the Controls](#-hacking-the-controls)
- [Venting Condenser Heat Out Window](#-venting-condenser-heat-out-window)
- [Testing Procedure](#-testing-procedure)
- [Configuration in App](#️-configuration-in-app)
- [Monitoring](#-monitoring)
- [Troubleshooting](#-troubleshooting)
- [Power Considerations](#-power-considerations)
- [Next Steps](#-next-steps)
- [Additional Resources](#-additional-resources)

---

## Overview

This guide explains how to wire a dehumidifier (HUMSURE 30 Pints Portable Dehumidifier) to your smart thermostat relay system for automated humidity control. It also covers the internal electrical components and wiring of typical dehumidifier units.

**What you'll learn:**

- Internal wiring diagram of standard dehumidifiers
- How to integrate with your smart thermostat relay system
- Safety procedures and best practices
- Troubleshooting common issues

---

## ⚠️ Safety First

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

---

## 📋 Parts Needed

### Required Components

| Item                   | Description                                         | Notes                           |
| ---------------------- | --------------------------------------------------- | ------------------------------- |
| **Dehumidifier**       | HUMSURE 30 Pints Portable Dehumidifier (or similar) | 30-pint capacity recommended    |
| **Relay Module**       | CH340 8CH USB Relay Module                          | Already in your system          |
| **Wire**               | 14-16 AWG wire                                      | For 120VAC connections          |
| **Wire Nuts**          | Standard wire connectors                            | Don't use electrical tape alone |
| **Electrical Tape**    | High-quality electrical tape                        | For additional insulation       |
| **Multimeter**         | Digital multimeter                                  | For testing connections         |
| **Window Exhaust Kit** | Optional - for venting condenser heat               | DIY or commercial kit           |

### Optional Components

- Window exhaust kit or DIY ducting (for venting condenser heat)
- Wire strippers
- Screwdrivers (various sizes)
- Voltage tester

---

## 🔌 Understanding Dehumidifier Internal Wiring

### Standard Dehumidifier Electrical Diagram

Wiring diagram for a dehumidifier unit operating on **115 VAC, 60 Hz, single phase power**. It illustrates the electrical connections between the power source, fan motor, compressor, fan switch, dehumidistat, defrost thermostat, and run capacitor.

#### Primary Wiring Diagrams

![Dehumidifier Wiring Diagram](/images/dehumidifier/wiring%20diagram%20for%20dehumidifier.jpg)

_Main wiring diagram showing complete electrical circuit_

![Dehumidifier Diagram 1](/images/dehumidifier/dehumidifier%20diagram.png)

_Standard dehumidifier internal wiring schematic_

![Dehumidifier Diagram 2](/images/dehumidifier/dehumidifier%20diagram%20from%20diy.png)

_DIY-friendly wiring diagram with component labels_

![Additional Diagram](/images/dehumidifier/another%20diagram%20for%20dehu.png)

_Alternative wiring configuration diagram_

#### Detailed Component Diagrams

![ChatGPT Diagram 1](/images/dehumidifier/ChatGPT%20Image%20Nov%2026,%202025,%2011_55_45%20AM.png)

_Component layout and connections - Diagram 1_

![ChatGPT Diagram 2](/images/dehumidifier/ChatGPT%20Image%20Nov%2026,%202025,%2012_00_46%20PM.png)

_Component layout and connections - Diagram 2_

![ChatGPT Diagram 3](/images/dehumidifier/ChatGPT%20Image%20Nov%2026,%202025,%2012_04_44%20PM.png)

_Component layout and connections - Diagram 3_

---

### Component Breakdown

#### Power Source

**115 VAC, 60 Hz, Single Phase** power connected via a plug with:

| Wire Color      | Function      | Connection               |
| --------------- | ------------- | ------------------------ |
| **Black (BLK)** | Line/Hot wire | Carries 115V power       |
| **White (WHT)** | Neutral wire  | Return path for current  |
| **Green (GRN)** | Ground wire   | Safety ground connection |

#### Fan Motor

The fan motor has connections for:

- **Black wire** - High Speed (routed through the Fan Switch)
- **White wire** - Neutral
- **Green wire** - Ground

**Function:** Circulates air through the dehumidifier to facilitate moisture removal.

#### Fan Switch

A three-position switch with terminals for:

| Position              | Terminal   | Function                                                                         |
| --------------------- | ---------- | -------------------------------------------------------------------------------- |
| **FAN ON (3)**        | Terminal 3 | Directly connects the Black (Hot) wire to the fan motor for continuous operation |
| **Position 2**        | Terminal 2 | Intermediate position (function varies by model)                                 |
| **FAN AUTO (1)**      | Terminal 1 | Connects the fan motor to be controlled by the Dehumidistat                      |
| **BLU (Blue wire)**   | -          | Connects to the Dehumidistat                                                     |
| **ORG (Orange wire)** | -          | Connects to the Dehumidistat                                                     |

**Function:** Allows user to select fan operation mode (continuous or automatic).

#### Dehumidistat

A humidity-sensing switch that opens or closes its contacts based on the relative humidity:

- Has connections for **BLU** and **ORG** wires from the Fan Switch
- Has a **BLK** wire going to the Compressor circuit
- When humidity is high, contacts close to allow compressor operation
- When humidity is low, contacts open to stop compressor

**Function:** Monitors room humidity and controls when dehumidification is needed.

#### Defrost Thermostat

A temperature-sensing switch that opens or closes its contacts based on the temperature of the evaporator coil:

- Located in **series** with the BLK wire going to the Compressor circuit
- Opens when coil temperature drops too low (prevents ice buildup)
- Closes when temperature rises (allows normal operation)

**Function:** Prevents ice buildup on the evaporator coil by interrupting compressor operation when coil temperature is too low.

#### Compressor

The compressor has three terminals:

| Terminal         | Wire Color   | Connection                         | Function                 |
| ---------------- | ------------ | ---------------------------------- | ------------------------ |
| **C (Common)**   | White (WHT)  | Connected to Neutral               | Common connection point  |
| **S (Start)**    | Yellow (YEL) | Connected to Run Capacitor         | Start winding connection |
| **R (Run)**      | Red (RED)    | Connected to Run Capacitor + Power | Run winding connection   |
| **GRN (Ground)** | Green (GRN)  | Ground                             | Safety ground            |

**Function:** Compresses refrigerant to create the cooling effect needed for dehumidification.

#### Run Capacitor

Connected in series with the Start and Run windings of the compressor motor:

- Provides the necessary **phase shift** for starting and running
- Essential for single-phase motor operation
- Creates a phase difference between Start and Run windings
- Typically rated: 15-30 µF for small compressors

**Function:** Enables single-phase motor to develop starting torque and run efficiently.

---

### How It Works (Simplified Operation)

#### 1. Fan Operation

The Fan Switch allows the user to select:

- **"FAN ON"**: Continuous fan operation regardless of humidity
- **"FAN AUTO"**: Fan runs when the dehumidistat calls for dehumidification
- **Position 2**: Intermediate setting (varies by model)

**In "FAN AUTO" mode:** The fan will run when the dehumidistat detects high humidity and calls for dehumidification.

#### 2. Dehumidification Cycle

When the Dehumidistat senses high humidity:

1. Its contacts **close**
2. Power flows through the Defrost Thermostat to the Run winding of the Compressor
3. The compressor starts and begins removing moisture from the air
4. Fan circulates air through the system
5. Moisture condenses on the evaporator coil and drains away

#### 3. Compressor Start-up

The Run Capacitor assists in starting the compressor motor:

- Creates a **phase difference** between the current in the Start and Run windings
- This phase shift is necessary for single-phase motors to develop starting torque
- Once running, the capacitor continues to optimize motor efficiency
- Prevents excessive starting current draw

#### 4. Defrost Cycle

If the evaporator coil temperature drops too low:

1. The Defrost Thermostat **opens**, interrupting power to the compressor
2. The compressor stops, allowing any ice buildup to melt
3. Fan may continue running to assist defrosting
4. Once the temperature rises, the thermostat **closes**
5. The dehumidification cycle can resume

**This diagram illustrates a typical control circuit for a dehumidifier, coordinating the operation of the fan and compressor based on humidity and temperature conditions.**

---

## 🔧 Wiring Options for Smart Thermostat Integration

### Option 1: Control Power to Entire Unit (Recommended)

**How it works:**

- Relay controls the dehumidifier's power supply
- Wire relay in series with the hot wire (120VAC)
- When relay closes -> dehumidifier gets power -> runs
- When relay opens -> dehumidifier loses power -> stops

**Simple Wiring Diagram:**

```
Wall Outlet (120VAC)
    |
    |-- Hot Wire (Black) --> Relay Terminal (NO - Normally Open)
    |                           |
    |                           |-- Hot Wire --> Dehumidifier Power Cord
    |
    |-- Neutral Wire (White) -----------------> Dehumidifier Power Cord
    |
    |-- Ground Wire (Green) ------------------> Dehumidifier Ground
```

**Step-by-Step Instructions:**

1. **Unplug dehumidifier** from wall outlet
2. **Cut the power cord** about 6 inches from the dehumidifier
3. **Strip wire ends** (about 1/2 inch)
4. **Identify hot and neutral wires**:
   - Hot wire: Usually black or red (smooth side on polarized plugs)
   - Neutral wire: Usually white (ribbed side on polarized plugs)
   - Ground wire: Usually green or bare (connect to ground, not through relay)
5. **Connect hot wire to relay**:
   - From wall outlet -> Relay NO terminal
   - From Relay Common (C) terminal -> Dehumidifier
6. **Connect neutral wire directly** (bypass relay):
   - From wall outlet -> Dehumidifier (use wire nut)
7. **Connect ground wire** (if present):
   - From wall outlet -> Dehumidifier ground (use wire nut)
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

---

### Option 2: Control via Internal Control Board (Advanced)

If the dehumidifier has low-voltage control terminals (like some commercial units), you can control it directly without switching 120VAC.

**Note:** Most consumer dehumidifiers don't have this feature. Check the unit's manual.

**Advantages:**

- ✅ More precise control
- ✅ Lower power consumption for relay
- ✅ Can integrate with dehumidifier's existing controls

**Disadvantages:**

- ⚠️ Requires opening the unit (voids warranty)
- ⚠️ More complex wiring
- ⚠️ Not available on most consumer units

---

## 🔌 Relay Terminal Assignment

For the CH340 8CH Relay Module, assign a relay terminal for the dehumidifier:

| Relay        | Terminal | Reserved For             | Available?         |
| ------------ | -------- | ------------------------ | ------------------ |
| **Relay 1**  | W        | Heating/AC power control | ❌ Reserved        |
| **Relay 2**  | Y2       | **Dehumidifier control** | ✅ **Recommended** |
| **Relay 3**  | G        | Fan control              | ❌ Reserved        |
| **Relay 4+** | -        | Other functions          | ✅ Available       |

**Recommended Configuration:**

```javascript
dehumidifier: {
  enabled: true,
  relayTerminal: "Y2", // Use Relay 2
  humidityDeadband: 5, // Turn on when RH > setpoint + 5%
  minOnTime: 300, // Minimum 5 minutes on
  minOffTime: 300, // Minimum 5 minutes off
}
```

---

## 🛠️ Hacking the Controls

### Bypassing Built-in Controls

Most dehumidifiers have built-in humidity sensors and controls. To use your smart thermostat instead:

#### Option A: Set dehumidifier to "Always On" mode (Recommended)

- This bypasses the built-in sensor
- Your relay controls power, so it only runs when you want
- **No modifications required**
- **Does not void warranty**

#### Option B: Disable built-in controls (Advanced)

⚠️ **WARNING:** This may void warranty

**Steps:**

1. Locate the control board
2. Find the humidity sensor connection
3. Disconnect or short the sensor to make it think humidity is always high
4. **Research your specific model** before attempting

#### Option C: Use continuous drain mode

- Most dehumidifiers have a drain hose connection
- Connect a drain hose so it can run continuously
- Your relay controls when it actually runs
- **No modifications required**

---

## 🌬️ Venting Condenser Heat Out Window

To turn the dehumidifier into a spot cooler, vent the hot condenser air outside:

### Materials Needed

| Item                   | Description                                 | Where to Get             |
| ---------------------- | ------------------------------------------- | ------------------------ |
| **Window Exhaust Kit** | Commercial kit (like portable AC units use) | Hardware store or online |
| **OR DIY Materials**   | Foam board, duct tape, flexible ducting     | Hardware store           |
| **Flexible Ducting**   | 4-6 inch diameter, 3-5 feet long            | HVAC supply store        |

### Step-by-Step Instructions

1. **Locate the condenser exhaust** on the dehumidifier (usually back or top)
2. **Measure the exhaust opening** (typically 4-6 inches)
3. **Create window adapter**:
   - Cut foam board to fit window opening
   - Cut hole for ducting (match dehumidifier exhaust size)
   - Seal around window edges with weatherstripping
4. **Connect ducting**:
   - Attach flexible ducting to dehumidifier exhaust
   - Route through window adapter
   - Seal all connections with duct tape
5. **Test airflow**:
   - Run dehumidifier
   - Check that hot air is venting outside
   - Check that room is getting cooler air

### Performance Expectations

| Metric               | Value                       | Notes                           |
| -------------------- | --------------------------- | ------------------------------- |
| **Cooling capacity** | ~3,000-5,000 BTU equivalent | Lower than dedicated AC         |
| **Efficiency**       | Moderate                    | Functional but not optimal      |
| **Dehumidification** | Full capacity               | Still removes moisture (bonus!) |

---

## 🔧 Testing Procedure

### Test 1: Relay Control

**Objective:** Verify relay can control dehumidifier power

**Steps:**

1. Wire relay to dehumidifier (see Option 1 above)
2. Connect relay module to tablet via USB
3. Open thermostat app
4. Enable dehumidifier in settings
5. Set humidity setpoint to 50%
6. Set current humidity to 60% (or wait for actual high humidity)
7. ✅ Verify relay closes and dehumidifier starts
8. Set current humidity to 45%
9. ✅ Verify relay opens and dehumidifier stops

**Expected Results:**

- Relay closes when humidity is above setpoint
- Dehumidifier starts running
- Relay opens when humidity is below setpoint
- Dehumidifier stops running

---

### Test 2: Humidity Sensor Integration

**Objective:** Verify automatic humidity control works

**Steps:**

1. Connect humidity sensor to tablet (via USB hub)
2. Verify humidity readings appear in app
3. Test automatic control:
   - Set setpoint to 50%
   - When humidity > 55%, dehumidifier should turn on
   - When humidity < 45%, dehumidifier should turn off

**Expected Results:**

- Sensor readings update in real-time
- Dehumidifier responds to humidity changes
- Deadband prevents rapid cycling

---

### Test 3: Venting System

**Objective:** Verify condenser heat is being vented outside

**Steps:**

1. Set up window exhaust (see above)
2. Run dehumidifier for 30 minutes
3. Check that:
   - Hot air is venting outside
   - Room temperature is decreasing
   - Room humidity is decreasing
4. Monitor energy usage

**Expected Results:**

- Hot air exits through window
- Room temperature decreases
- Room humidity decreases
- Energy usage is reasonable

---

## ⚙️ Configuration in App

### Enable Dehumidifier Control

**Steps:**

1. Open thermostat settings
2. Navigate to "Dehumidifier" section
3. Enable dehumidifier control
4. Set relay terminal (default: Y2)
5. Set humidity deadband (default: 5%)
6. Set minimum on/off times (default: 5 minutes each)

### Set Humidity Setpoints

**Recommended Settings:**

| Mode      | Humidity Setpoint | Reason                      |
| --------- | ----------------- | --------------------------- |
| **Home**  | 50%               | Comfortable for most people |
| **Away**  | 60%               | Energy saving when not home |
| **Sleep** | 50%               | Comfortable for sleeping    |

### Control Logic

The thermostat uses this priority:

1. **Temperature control** (heating/cooling) - **highest priority**
2. **Humidity control** (dehumidifier) - only when temp is satisfied
3. **Fan control** - **lowest priority**

**This ensures temperature comfort is maintained before addressing humidity.**

---

## 📊 Monitoring

The app displays:

- **Current humidity (%)** - Real-time humidity reading
- **Target humidity setpoint (%)** - Desired humidity level
- **Dehumidifier status (ON/OFF)** - Current operating state
- **Energy usage** - If monitoring enabled

**Monitoring Tips:**

- Check humidity trends over time
- Monitor energy consumption
- Watch for rapid cycling (may indicate issues)
- Track defrost cycles

---

## 🔍 Troubleshooting

### Dehumidifier Not Starting

**Checklist:**

- ✓ Check relay wiring (use multimeter)
- ✓ Verify relay terminal assignment (Y2)
- ✓ Check dehumidifier power cord connection
- ✓ Verify dehumidifier's built-in controls aren't interfering
- ✓ Check circuit breaker
- ✓ Verify defrost thermostat is closed (not stuck open)
- ✓ Check run capacitor (may need replacement if bulging or leaking)

**Common Causes:**

- Loose wire connections
- Faulty relay
- Defrost thermostat stuck open
- Bad run capacitor
- Circuit breaker tripped

---

### Dehumidifier Not Stopping

**Checklist:**

- ✓ Check relay is opening (use multimeter)
- ✓ Verify humidity sensor readings
- ✓ Check humidity deadband settings
- ✓ Verify minimum on-time hasn't expired
- ✓ Check dehumidistat contacts (may be stuck closed)

**Common Causes:**

- Relay contacts stuck closed
- Humidity sensor reading incorrectly
- Deadband set too wide
- Minimum on-time not expired
- Dehumidistat contacts welded closed

---

### Not Cooling Effectively

**Checklist:**

- ✓ Check condenser exhaust is venting outside
- ✓ Verify window seal is tight
- ✓ Check ducting isn't kinked or blocked
- ✓ Verify dehumidifier is running (compressor should be on)
- ✓ Check compressor operation (listen for running sound)
- ✓ Verify fan motor is operating

**Common Causes:**

- Condenser heat not venting properly
- Blocked or kinked ducting
- Compressor not running
- Fan not operating
- Insufficient airflow

---

### Humidity Sensor Issues

**Checklist:**

- ✓ Check USB connection
- ✓ Verify sensor is reading correctly (compare with known good sensor)
- ✓ Check sensor placement (away from dehumidifier exhaust)

**Common Causes:**

- Loose USB connection
- Sensor calibration drift
- Poor sensor placement
- Sensor failure

---

### Compressor Issues

**Checklist:**

- ✓ Check run capacitor (test with multimeter)
- ✓ Verify compressor terminals (C, S, R) connections
- ✓ Check defrost thermostat (should be closed during normal operation)
- ✓ Verify power is reaching compressor (use multimeter)
- ✓ Listen for compressor start attempts (clicking or humming)

**Common Causes:**

- Bad run capacitor
- Loose terminal connections
- Defrost thermostat stuck open
- No power to compressor
- Compressor motor failure

---

## ⚡ Power Considerations

### Dehumidifier Power Draw

| Component                | Power Draw               | Notes                  |
| ------------------------ | ------------------------ | ---------------------- |
| **Typical 30-pint unit** | 300-500W (2.5-4A @ 120V) | Running power          |
| **Your relay rating**    | 10A @ 250VAC             | Plenty of headroom     |
| **Relay module**         | ~500mA @ 12V = 6W        | Control power          |
| **Tablet**               | ~2A @ 5V = 10W           | Control system         |
| **Total system load**    | ~416W                    | From 24VAC transformer |

### Transformer Capacity

- Verify your 24VAC transformer can handle the load
- If not, use a separate transformer for dehumidifier power

### Compressor Starting Current

**Important:** Compressors draw **3-5x** their running current during startup

| Running Current | Starting Current | Notes         |
| --------------- | ---------------- | ------------- |
| 4A              | 12-20A           | Typical surge |
| 3A              | 9-15A            | Smaller units |
| 5A              | 15-25A           | Larger units  |

**Requirements:**

- Ensure your circuit breaker can handle this surge
- Verify wiring can handle starting current
- The run capacitor helps reduce starting current

---

## 🎯 Next Steps

1. ✅ Complete wiring following this guide
2. ✅ Test relay control
3. ✅ Set up window venting (optional)
4. ✅ Configure app settings
5. ✅ Monitor for 24-48 hours
6. ✅ Fine-tune humidity setpoints and deadbands

**After Setup:**

- Monitor energy consumption
- Adjust setpoints based on comfort
- Check for any issues or improvements needed
- Document your specific configuration

---

## 📚 Additional Resources

### Documentation

- [`docs/SMART_THERMOSTAT_BUILD_GUIDE.md`](/docs/SMART_THERMOSTAT_BUILD_GUIDE.md) - Main build guide
- [`docs/USB-RELAY-OPTIONS.md`](/docs/USB-RELAY-OPTIONS.md) - Relay module details
- [`docs/CH340-RELAY-SETUP.md`](/docs/CH340-RELAY-SETUP.md) - CH340 relay setup guide

### Code References

- `src/lib/thermostatSettings.js` - Settings structure
- `src/pages/SmartThermostatDemo.jsx` - Control logic

### External Resources

- [HVAC Electrical Basics](https://www.hvac.com/) - General HVAC electrical information
- [Dehumidifier Maintenance](https://www.energy.gov/) - Energy efficiency tips

---

## Document Information

| Field                | Value                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| **Document Version** | 2.0                                                                              |
| **Last Updated**     | 2025                                                                             |
| **Compatibility**    | CH340 Relay Module, HUMSURE 30 Pints Dehumidifier, Standard 115VAC Dehumidifiers |
| **Author**           | Engineering Tools Team                                                           |

---

**Need help?** Check the [Troubleshooting](#-troubleshooting) section or refer to the [Additional Resources](#-additional-resources).
