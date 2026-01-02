# HomeKit Bridge Implementation Plan

## Overview

Implement a HomeKit Bridge in Joule that exposes Joule-controlled devices (thermostat, air purifier, dehumidifier) as HomeKit accessories, similar to Home Assistant's HomeKit Bridge integration.

## Current State

**What we have:**
- HomeKit Controller (`aiohomekit.controller.Controller`) - controls Ecobee via HomeKit
- Devices controlled: Ecobee thermostat (via HomeKit), Blueair (via cloud API), Dehumidifier (via relay)

**What we need:**
- HomeKit Bridge/Accessory Server - exposes Joule devices as HomeKit accessories
- This allows devices to be controlled from Apple's Home app OR from Joule app (if it acts as controller)

## Architecture

### Option 1: Dual Mode (Recommended)
- **Bridge Mode**: Expose Joule devices as HomeKit accessories
- **Controller Mode**: Control HomeKit devices (Ecobee) - already implemented
- **Result**: Joule can both control HomeKit devices AND expose its own devices as HomeKit accessories

### Option 2: Bridge Only
- Expose Joule devices as HomeKit accessories
- Remove controller functionality (not recommended - we need to control Ecobee)

## Implementation Approach

### Library Choice

**Option A: HAP-python** (Most Popular)
- Used by Home Assistant
- Full HomeKit Accessory Protocol implementation
- Supports creating bridges and accessories
- Well-documented and maintained

**Option B: pyhap** (Alternative)
- Similar to HAP-python
- May have different API

**Option C: Extend aiohomekit**
- Currently only supports Controller mode
- Would need to check if it supports Accessory/Driver mode

### Recommended: HAP-python

```python
from pyhap.accessory import Accessory, Bridge
from pyhap.accessory_driver import AccessoryDriver
```

## Devices to Expose

### 1. Thermostat Accessory
- **Type**: `Thermostat`
- **Characteristics**:
  - Current Temperature (from Ecobee via HomeKit controller)
  - Target Temperature (writable)
  - Target Heating Cooling State (writable: Off, Heat, Cool, Auto)
  - Current Heating Cooling State (read-only)

### 2. Air Purifier Accessory
- **Type**: `Fan` or `AirPurifier`
- **Characteristics**:
  - Active (on/off)
  - Rotation Speed (fan speed 0-3)
  - Current Air Quality (PM2.5, if available)
  - Filter Life Level (if available)

### 3. Dehumidifier Accessory
- **Type**: `HumidifierDehumidifier` (dehumidifier mode)
- **Characteristics**:
  - Active (on/off)
  - Current Relative Humidity (from system state)
  - Target Relative Humidity (writable)

### 4. Temperature/Humidity Sensors
- **Type**: `TemperatureSensor`, `HumiditySensor`
- **Characteristics**:
  - Current Temperature
  - Current Relative Humidity

## Implementation Steps

### Phase 1: Setup HAP-python Bridge

1. **Install HAP-python**
   ```bash
   pip install HAP-python
   ```

2. **Create Bridge Server**
   - Initialize AccessoryDriver
   - Create Bridge accessory
   - Add individual accessories (Thermostat, AirPurifier, etc.)

3. **mDNS Advertisement**
   - Advertise bridge via mDNS
   - Generate pairing QR code and PIN
   - Handle pairing process

### Phase 2: Create Accessories

1. **Thermostat Accessory**
   - Read from Ecobee (via existing HomeKit controller)
   - Write changes back to Ecobee
   - Sync state bidirectionally

2. **Air Purifier Accessory**
   - Read from Blueair API or local ESP32
   - Control fan speed and power
   - Report air quality metrics

3. **Dehumidifier Accessory**
   - Control via relay
   - Read humidity from system state
   - Implement interlock logic

### Phase 3: Integration with Existing Bridge

1. **Run Both Services**
   - Keep existing HomeKit controller (for Ecobee)
   - Add new HomeKit bridge (for exposing devices)
   - Both can run simultaneously on different ports

2. **State Synchronization**
   - Bridge accessories read from existing bridge state
   - Changes from HomeKit update existing bridge
   - Maintain consistency between both systems

### Phase 4: Joule App Integration

1. **HomeKit Controller in App**
   - Add HomeKit controller to Joule app
   - Discover and pair with Joule Bridge
   - Control devices via HomeKit protocol

2. **Alternative: Direct API**
   - Keep existing HTTP API
   - HomeKit bridge is optional enhancement
   - Users can use either interface

## Benefits

1. **Apple Home App Integration**
   - Control Joule devices from Apple Home app
   - Siri voice control
   - HomeKit automations
   - Apple Watch control

2. **Joule App as Controller**
   - Joule app can act as HomeKit controller
   - Control devices via HomeKit protocol
   - Unified interface

3. **Ecosystem Integration**
   - Works with other HomeKit devices
   - HomeKit scenes and automations
   - Apple Shortcuts integration

## Challenges

1. **Dual Protocol Support**
   - Maintain both HTTP API and HomeKit bridge
   - Keep state synchronized
   - Handle conflicts gracefully

2. **Pairing Complexity**
   - Users need to pair bridge with Apple Home app
   - QR code generation and display
   - PIN code management

3. **State Management**
   - Bridge needs to reflect current device state
   - Handle updates from multiple sources (HTTP API, HomeKit, interlock logic)

4. **Library Compatibility**
   - HAP-python vs aiohomekit
   - May need both libraries
   - Ensure no conflicts

## Example Implementation

```python
from pyhap.accessory import Accessory, Bridge
from pyhap.accessory_driver import AccessoryDriver
from pyhap.const import CATEGORY_THERMOSTAT, CATEGORY_FAN

class JouleThermostatAccessory(Accessory):
    """Expose Joule thermostat as HomeKit accessory"""
    
    category = CATEGORY_THERMOSTAT
    
    def __init__(self, *args, bridge_api, **kwargs):
        super().__init__(*args, **kwargs)
        self.bridge_api = bridge_api  # Reference to bridge HTTP API
        
        # Add thermostat service
        service = self.add_preload_service('Thermostat')
        
        # Characteristics
        self.current_temp = service.get_characteristic('CurrentTemperature')
        self.target_temp = service.get_characteristic('TargetTemperature')
        self.target_state = service.get_characteristic('TargetHeatingCoolingState')
        self.current_state = service.get_characteristic('CurrentHeatingCoolingState')
        
        # Set callbacks
        self.target_temp.setter_callback = self.set_target_temp
        self.target_state.setter_callback = self.set_target_state
        
    def set_target_temp(self, value):
        """Called when HomeKit sets target temperature"""
        # Update via bridge API
        self.bridge_api.set_temperature(value)
        
    def set_target_state(self, value):
        """Called when HomeKit sets mode"""
        # Update via bridge API
        self.bridge_api.set_mode(value)
        
    @Accessory.run_at_interval(10)  # Update every 10 seconds
    def update_state(self):
        """Poll bridge API for current state"""
        state = self.bridge_api.get_thermostat_status()
        self.current_temp.set_value(state['temperature'])
        self.target_temp.set_value(state['target_temperature'])
        self.current_state.set_value(state['current_mode'])

# Initialize bridge
bridge = Bridge(display_name="Joule Bridge")
bridge.add_accessory(JouleThermostatAccessory(bridge_api=bridge_api))

# Start driver
driver = AccessoryDriver(port=51826, persist_file='joule-bridge.state')
driver.add_accessory(accessory=bridge)
driver.start()
```

## Next Steps

1. **Research HAP-python**
   - Review documentation
   - Test basic bridge creation
   - Verify compatibility with existing code

2. **Prototype**
   - Create simple bridge with one accessory
   - Test pairing with Apple Home app
   - Verify state synchronization

3. **Full Implementation**
   - Add all accessories
   - Integrate with existing bridge
   - Add UI for pairing in Joule app

4. **Documentation**
   - User guide for pairing
   - Troubleshooting guide
   - API documentation

## Questions to Answer

1. Should Joule app act as HomeKit controller too?
2. Do we want to support both HTTP API and HomeKit simultaneously?
3. Should this be optional or required?
4. How to handle pairing UI in web app?
5. Should we generate QR codes for pairing?




