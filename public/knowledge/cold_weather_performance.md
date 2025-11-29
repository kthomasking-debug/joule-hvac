# Cold Weather Performance Testing

## Performance Metrics

### Heating Rate
- **Degrees per hour heating rate:** How fast system raises temperature
- Heat pumps: 1-2°F/hour (NORMAL)
- Gas furnaces: 3-5°F/hour
- Varies with outdoor temperature

### Lowest Operating Temperature
- **Lowest outdoor temp where heat pump maintained setpoint:**
- Modern systems: 0-15°F
- Older systems: 15-25°F
- Below this, aux heat is needed

### Performance Degradation
- **Is heat pump performance degrading in cold?**
- Yes, efficiency drops as outdoor temp decreases
- COP decreases from ~3-4 at 50°F to ~1.5-2 at 0°F
- This is NORMAL behavior

### COP Trend
- **COP (Coefficient of Performance) over 24 hours:**
- Requires multiple sensors (outdoor temp, energy usage, heat output)
- Typically not available without specialized equipment
- Can estimate from outdoor temp and system specs

### Losing Ground Against Cold
- **Are we losing ground against the cold?**
- Check if indoor temp is dropping despite system running
- May indicate:
  - System undersized
  - Below balance point (needs aux heat)
  - Insulation issues
  - Extreme cold weather

## Testing Questions

**"How many degrees per hour are we heating at current outdoor temp?"**
- Requires tracking temperature over time
- Can estimate: 1-2°F/hour for heat pumps
- Slower in colder weather

**"What's the lowest outdoor temp where heat pump maintained setpoint this week?"**
- Requires historical data logging
- Can estimate from balance point (typically 25-35°F)

**"Is the heat pump's performance degrading in this cold?"**
- Yes, this is expected
- COP drops as outdoor temp decreases
- Efficiency decreases but system still works

