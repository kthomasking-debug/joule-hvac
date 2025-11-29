# Diagnostic Sensors & Data Availability

## What Sensors Are Typically Available

### ✅ Standard Thermostat Sensors (Usually Available)
- **Indoor temperature** - Main thermostat sensor
- **Target/setpoint temperature** - User's desired temp
- **HVAC mode** - Heat, cool, auto, off
- **System running status** - Is HVAC currently active
- **Outdoor temperature** - If weather service connected

### ❌ Advanced Diagnostic Sensors (Usually NOT Available)
These require specialized equipment or professional installation:

- **Supply air temperature** - Requires sensor in ductwork
- **Return air temperature** - Requires sensor in return duct
- **CFM (Cubic Feet per Minute)** - Requires airflow meter
- **Watt draw/power consumption** - Requires current clamp or power meter
- **Compressor stage** - Requires communication with outdoor unit
- **COP (Coefficient of Performance)** - Calculated from multiple sensors
- **Outdoor coil temperature** - Requires sensor on outdoor unit
- **Duty cycle** - Requires runtime logging
- **Auxiliary heat runtime** - Requires separate relay monitoring
- **Lockout temperature settings** - Requires thermostat API access
- **Aux threshold settings** - Requires thermostat configuration access

## How to Answer Diagnostic Questions

When asked about unavailable sensors:

1. **Acknowledge the question is valid**
   - "That's a great diagnostic question"
   - "I understand you want to check [metric]"

2. **Explain what's missing**
   - "I don't have a [specific sensor] installed"
   - "That requires [equipment] which isn't available in this system"

3. **Explain why it's missing**
   - "Supply air temperature requires a sensor installed in the ductwork"
   - "Real-time watt monitoring requires a current clamp or power meter"

4. **Suggest alternatives (if any)**
   - "I can't measure that directly, but I can tell you [related info]"
   - "Based on [available data], I can estimate..."

5. **Provide what you CAN tell them**
   - "I can tell you the indoor temperature is X°F"
   - "I can see the system is running in heat mode"
   - "Based on your system specs, typical CFM would be..."

## Example Responses

**Q: "What's the supply air temperature?"**
**A:** "I don't have a supply air temperature sensor installed. That requires a sensor placed in the ductwork near the air handler, which isn't part of standard thermostat installations. I can tell you the indoor temperature is 72°F and the system is running in heat mode, but I can't measure the actual air coming out of the vents."

**Q: "What's the current watt draw of the heat strips?"**
**A:** "I don't have real-time power monitoring for the auxiliary heat strips. That would require a current clamp or power meter installed on the strip heat circuit. I can tell you that typical strip heat draws 10-15 kW when active, but I can't show you the exact real-time draw without that equipment."

**Q: "What's the current compressor stage?"**
**A:** "I don't have access to the compressor stage information. That requires direct communication with the outdoor unit's control board, which most thermostats don't provide. I can tell you the system is running in heat mode, but I can't see whether it's stage 1 or stage 2 without that connection."

