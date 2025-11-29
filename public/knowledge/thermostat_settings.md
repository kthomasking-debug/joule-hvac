# Thermostat Settings (Ecobee-Specific)

## Heat Pump Settings

### Minimum Outdoor Temperature
- **Heat pump minimum outdoor temp:** Lowest temp where heat pump operates
- Typical: 0-15°F for modern systems
- Below this, system may use aux heat only

### Heat Pump to Heat/Cool
- **Heat pump to heat enabled:** Allows heat pump in heating mode
- **Heat pump to cool enabled:** Allows heat pump in cooling mode
- Usually both enabled for dual-mode systems

### Compressor Settings
- **Compressor minimum outdoor temp:** Lowest temp for compressor operation
- Typical: 0-10°F
- Below this, may use aux heat only

### Temperature Differential
- **Temperature differential for heat:** Deadband for heating
- Typical: 0.5-2°F
- Larger = less cycling, less precise control

### Staging
- **Staging set to Auto or Manual:**
  - Auto: System decides when to use stage 2
  - Manual: User controls staging
- **Stage 1 to Stage 2 timing:** How long before stage 2 activates
- Typical: 10-20 minutes

## Aux Heat Settings

### Aux Heat Max/Min Outdoor Temp
- **Aux Heat Max Outdoor Temp:** Prevents aux above this temp
- Typical: 30-40°F
- **Aux Heat Min Outdoor Temp:** Allows aux below this temp
- Typical: 15-25°F

### Aux Heat Threshold
- Temperature difference that triggers aux heat
- Typical: 2-3°F
- Lower = more aux usage, faster recovery
- Higher = less aux usage, slower recovery

### Recovery Settings
- **Allow Aux Heat when recovering from setback:** Yes/No
- If No: System won't use strips during recovery
- If Yes: May use strips for faster recovery
- Recommended: Yes for comfort, No for efficiency

### Compressor to Aux Temperature Delta
- How much temp difference before aux activates
- Typical: 2-3°F
- Lower = aux activates sooner
- Higher = aux activates later

### Compressor Try Time
- How long compressor runs before aux kicks in
- Typical: 10-20 minutes
- Longer = more efficient, slower recovery
- Shorter = faster recovery, more aux usage

## Comfort Settings

### Smart Recovery
- **Smart Recovery enabled for heating:** System starts early to reach setpoint
- Helps avoid aux heat during recovery
- Recommended: Yes for heat pumps

### Heat Pump Balance Mode
- **Max Savings:** Minimizes aux heat usage
- **Savings:** Balanced efficiency/comfort
- **Comfort:** Prioritizes comfort over efficiency
- Recommended: "Savings" for most users

### Temperature Offset
- **Heat pump temperature offset:** Adjusts sensor reading
- Used to calibrate if sensor reads incorrectly
- Typical: 0°F (no offset)

### Sensor Settings
- **Which sensors in active comfort group:** Multiple sensors can be averaged
- **Sensor averaging:** Combines readings from multiple sensors
- **False temperature readings:** Check sensor placement, calibration

### Fan Mode During Heating
- **Auto:** Fan runs only when heating/cooling
- **On:** Fan runs continuously
- **Circulate:** Fan runs periodically
- Recommended: Auto for efficiency, On for better air circulation

