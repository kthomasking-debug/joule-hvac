# Rapid Testing Questions

## Will Strips Trigger?

### Temperature Step Testing
**"If I increase setpoint by 3 degrees right now, will strips activate?"**

Factors to consider:
- Current outdoor temperature (below balance point = more likely)
- Current indoor vs target temp
- Aux heat threshold setting (typically 2-3°F)
- Recovery settings (adaptive recovery may prevent it)

**Answer:** "A 3°F increase may trigger auxiliary heat, especially if outdoor temp is below 35°F or if your aux threshold is set to 2-3°F. I'd recommend a smaller increase (1-2°F) to avoid strips."

### Safe Temperature Steps
**"How big a temperature step can I safely request without triggering strips?"**

Safe steps:
- **1-2°F:** Usually safe, heat pump can handle
- **3°F:** May trigger strips depending on conditions
- **4+°F:** Very likely to trigger strips

**Answer:** "For your heat pump, I'd recommend keeping temperature changes to 1-2°F to avoid triggering auxiliary heat. Larger steps (3+°F) often activate the strips during recovery, which costs 3-4x more."

### Recovery Testing
**"If I disable Smart Recovery, what would heating profile look like tomorrow morning?"**

Without Smart Recovery:
- System starts heating at scheduled time
- May need aux heat for faster recovery
- Less predictable, may overshoot or undershoot setpoint

With Smart Recovery:
- System starts early to reach setpoint on time
- More likely to use heat pump only
- Smoother, more predictable

**Answer:** "Without Smart Recovery, the system would start heating at the scheduled time (e.g., 6 AM). If you have a 2+°F setback, it may need auxiliary heat to recover quickly, which increases costs. Smart Recovery starts early (e.g., 5:30 AM) to give the heat pump time to recover without strips."

### Recovery Time Estimation
**"Given current outdoor temp, how long to heat 5 degrees without strips?"**

Heat pump recovery rate:
- **1-2°F per hour** (typical)
- **5°F = 2.5-5 hours** without strips
- Faster with strips, but costs 3-4x more

**Answer:** "At the current outdoor temperature, a heat pump typically raises temperature 1-2°F per hour. To heat 5°F without strips would take approximately 2.5-5 hours. If you need faster recovery, the system may use auxiliary heat, which costs significantly more."

### Nighttime Setback Testing
**"Would a nighttime setback trigger strips in the morning?"**

Depends on:
- **Setback size:** 1-2°F usually safe, 3+°F may trigger strips
- **Outdoor temperature:** Colder = more likely to need strips
- **Recovery time:** Longer recovery window = less likely to need strips

**Answer:** "A nighttime setback may trigger strips in the morning if it's large (3+°F) or if outdoor temp is very cold. I'd recommend a small setback (1-2°F) and enable Smart Recovery to minimize strip usage. This gives the heat pump time to recover without expensive aux heat."

