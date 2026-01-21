# RAG Equipment Query Examples

## Overview

This document provides example queries that the RAG system can now answer, along with expected response formats. The knowledge base structure is ready to handle these queries once the full equipment database is ingested.

## Current Capabilities

### ✅ Framework Ready

- Knowledge base structure created for all 7 categories
- RAG search enhanced to handle model-specific queries
- Fault code search implemented
- Trigger keywords configured

### ⏳ Data Ingestion Needed

- Example entries added for 2 models (Carrier Infinity 19VS, Mitsubishi PUMY-P36NKMU2)
- Example fault codes added for 3 brands (Carrier, Trane, Lennox)
- Full database ingestion required for comprehensive coverage

## Example Queries by Category

### 1. Technical Specifications & Performance

**Query:** "What is the HSPF2 of Carrier Infinity 19VS at 5°F?"

**Expected Response:**

```
According to Carrier Product Data Sheet 2024, the Carrier Infinity 19VS heat pump has:
- HSPF2: 10.5
- COP at 5°F: 2.1
- Capacity at 5°F: 22,000 BTU/hr
- Capacity at 47°F: 36,000 BTU/hr

The unit maintains approximately 61% of its rated capacity at 5°F compared to 47°F.
```

**Query:** "What is the maximum airflow and static pressure for Mitsubishi PUMY-P36NKMU2?"

**Expected Response:**

```
According to Mitsubishi Submittal Sheet 2024, the PUMY-P36NKMU2 has:
- Airflow range: 1,000-1,600 CFM
- Maximum static pressure: 0.5" WC
- Sound level: 48-62 dB(A) depending on fan speed

This is a cold-climate heat pump certified by NEEP (Northeast Energy Efficiency Partnerships).
```

**Query:** "What refrigerants are used in Carrier Infinity 19VS and what is the charge amount?"

**Expected Response:**

```
According to Carrier Product Data Sheet 2024, the Carrier Infinity 19VS uses:
- Refrigerant: R-410A
- Charge amount: 8.5 lbs

Note: R-410A is being phased out due to high GWP. Newer models may use R-454B or R-32.
```

### 2. Installation & Physical Requirements

**Query:** "What are the required clearances for Carrier Infinity 19VS?"

**Expected Response:**

```
According to Carrier IOM Manual 2024, the Carrier Infinity 19VS requires:
- Outdoor unit: 12" clearance to walls, 36" for service access
- Indoor unit: 6" clearance to walls, 30" for service access
- Combustibles: 6" minimum clearance to combustible materials

These clearances meet IMC (International Mechanical Code) requirements for safety and maintenance access.
```

**Query:** "What is the maximum line-set length for Mitsubishi PUMY-P36NKMU2?"

**Expected Response:**

```
According to Mitsubishi Installation Manual 2024, the PUMY-P36NKMU2 has:
- Maximum line-set length: 100 feet
- Maximum vertical rise: 80 feet
- Minimum length: 25 feet (for proper operation)
- Line-set sizing: 3/8" liquid line, 5/8" suction line

Note: Each 10 feet of line-set length reduces capacity by approximately 0.5-1%.
```

**Query:** "What size electrical circuit does Carrier Infinity 19VS need?"

**Expected Response:**

```
According to Carrier IOM Manual 2024, the Carrier Infinity 19VS requires:
- Voltage: 208/230V single-phase
- MCA (Minimum Circuit Ampacity): 25 amps
- MOP (Maximum Overcurrent Protection): 35 amps
- Phase: Single-phase

These requirements comply with NEC (National Electrical Code) standards.
```

### 3. Troubleshooting & Fault Codes

**Query:** "What does fault code E5 mean on a Carrier unit?"

**Expected Response:**

```
According to Carrier Service Manual 2024, fault code E5 indicates:
- Meaning: Communication error between indoor and outdoor units
- Common causes:
  1. Loose connection in communication wire
  2. Damaged communication wire
  3. Control board fault
- Solution: Check communication wire connections, verify wire integrity, test control board

This is a critical fault that prevents the system from operating properly.
```

**Query:** "What does 5 flashes mean on a Trane unit?"

**Expected Response:**

```
According to Trane Service Facts 2024, 5 flashes indicates:
- Meaning: Low pressure switch open
- Common causes:
  1. Low refrigerant charge
  2. Refrigerant restriction
  3. Faulty pressure switch
- Solution: Check refrigerant charge, verify switch operation, check for restrictions

This fault typically indicates a refrigerant system problem requiring professional service.
```

**Query:** "Why is my heat pump blowing cold air in heating mode?"

**Expected Response:**

```
There are several possible causes for a heat pump blowing cold air in heating mode:

1. **Defrost cycle (normal)**: Heat pump reverses to defrost outdoor coil (5-10 minutes). This is normal operation.

2. **Outdoor temperature too low**: Below balance point, system may need aux heat. Check if aux heat is functioning.

3. **Reversing valve stuck**: Valve not switching properly, requires service.

4. **Low refrigerant**: Insufficient charge causes poor heating performance.

5. **Outdoor coil frozen**: Ice buildup prevents heat transfer, check defrost operation.

6. **Thermostat setting**: Verify heat mode is selected, not cool or auto.

If the problem persists beyond a normal defrost cycle, contact a qualified technician.
```

### 4. Compatibility & Matching

**Query:** "Is Carrier Infinity 19VS compatible with variable-speed furnaces?"

**Expected Response:**

```
According to Carrier Matching Tables 2024, the Carrier Infinity 19VS can be matched with:
- Variable-speed furnaces: Yes, with compatible control board
- Approved furnaces: Carrier Infinity 80, Carrier Infinity 96
- Dual-fuel: Compatible with approved dual-fuel control setup
- Switchover temperature: Typically 35°F for dual-fuel operation

Check the AHRI Directory for certified matched combinations and performance ratings.
```

**Query:** "Which indoor coils are approved for Mitsubishi PUMY-P36NKMU2?"

**Expected Response:**

```
According to Mitsubishi Matching Tables 2024, the PUMY-P36NKMU2 can be matched with:
- Approved indoor units: Check manufacturer matching tables for specific model numbers
- AHRI certification: Verify AHRI number for matched combination
- Performance: Matched combinations provide certified SEER2/HSPF2 ratings

Always verify the specific AHRI number for your matched combination to ensure proper performance.
```

### 5. Sizing & Load Calculation Support

**Query:** "What size heat pump do I need for a 2,200 sq ft home in Chicago?"

**Expected Response:**

```
For a 2,200 sq ft home in Chicago (Zone 5), a Manual J load calculation is recommended. However, as a rough estimate:

- Typical sizing: 2.5-3.5 tons cooling, 60k-90k BTU heating
- Zone 5 factors: Colder climate requires more heating capacity
- Cold-climate heat pump: Consider a unit that maintains capacity at 5°F and 0°F

**Important**: Always use a Manual J load calculation for accurate sizing. Factors include:
- Insulation quality
- Window type and orientation
- Infiltration rate
- Internal gains

A professional load calculation will provide the exact capacity needed.
```

**Query:** "Will a 3-ton heat pump keep up at 0°F in Zone 5?"

**Expected Response:**

```
For a 3-ton heat pump in Zone 5 at 0°F:

- **Cold-climate heat pump**: If certified by NEEP, should maintain 50-70% capacity at 0°F
- **Standard heat pump**: May only maintain 30-40% capacity at 0°F, requiring aux heat
- **Balance point**: Check if 0°F is above the unit's balance point

**Recommendation**: Use a NEEP-certified cold-climate heat pump that shows capacity at 5°F and -15°F in specifications.

Example: Mitsubishi PUMY-P36NKMU2 maintains 28,000 BTU/hr at 5°F (78% of 47°F capacity).
```

### 6. Energy Efficiency, Rebates & Regulatory

**Query:** "Does Carrier Infinity 19VS qualify for the $2,000 federal 25C tax credit?"

**Expected Response:**

```
According to IRS 25C Qualified Product Database 2024, the Carrier Infinity 19VS:
- SEER2: 19.5 (exceeds 16 minimum) ✅
- HSPF2: 10.5 (exceeds 9 minimum) ✅
- EER: Approximately 17 (exceeds 12 minimum) ✅

**Qualification**: YES - This model qualifies for the $2,000 federal 25C tax credit (2023-2032).

**Requirements met**:
- SEER2 ≥ 16 ✅
- HSPF2 ≥ 9 ✅
- EER ≥ 12 ✅

Keep your receipt and AHRI certificate for tax filing.
```

**Query:** "What is the difference between SEER2 and SEER ratings?"

**Expected Response:**

```
**SEER2 vs SEER**:

- **SEER2**: New rating system (2023) that accounts for higher external static pressure (0.5" vs 0.1")
- **SEER**: Old rating system (pre-2023) used lower static pressure in testing
- **Difference**: SEER2 ratings are typically 1-2 points lower than SEER for the same unit
- **Example**: Unit rated SEER 18 = approximately SEER2 16-17

**Important**: All units sold after 2023 must use SEER2 ratings. You cannot directly compare SEER to SEER2 - use the same rating system for comparisons.
```

### 7. Parts & Replacement

**Query:** "What is the current part number for a TXV replacement on a 15-year-old Carrier heat pump?"

**Expected Response:**

```
For a 15-year-old Carrier heat pump TXV replacement:

1. **Original part number**: Check the unit's nameplate or service manual for the original part number
2. **Supersession**: The original part number may have been superseded - check Carrier supersession tables
3. **Compatibility**: Verify the superseding part is compatible with your specific model
4. **Availability**: Some parts for 15-year-old units may be discontinued

**Recommendation**:
- Contact Carrier parts department with your model number
- Provide the original part number if available
- Check for supersession to current part number
- Consider aftermarket alternatives if OEM part unavailable

**Note**: Very old units may require system replacement if critical parts are unavailable.
```

## Testing Protocol

1. **Test each category** with the example queries above
2. **Verify citations** - responses should cite specific source documents
3. **Check accuracy** - technical details should match knowledge base
4. **Test edge cases** - queries with partial model names, misspellings, etc.
5. **Verify fallbacks** - queries for models not in database should provide helpful guidance

## Next Steps

1. ✅ Knowledge base structure created
2. ✅ Example entries added
3. ✅ Search functions enhanced
4. ⏳ Ingest full manufacturer database
5. ⏳ Add all fault codes
6. ⏳ Update continuously as new models released
