/**
 * HVAC Engineering Knowledge Base
 * Structured knowledge from ACCA Manual J/S/D, ASHRAE 55/62.2, DOE guides, and industry standards
 * Used for RAG (Retrieval-Augmented Generation) in Ask Joule
 */

export const HVAC_KNOWLEDGE_BASE = {
  // ACCA Manual J - Load Calculation
  manualJ: {
    title: "ACCA Manual J - Residential Load Calculation",
    source: "ACCA Manual J, 8th Edition",
    topics: {
      heatLoss: {
        summary:
          "Manual J provides the industry standard for calculating residential heating and cooling loads.",
        keyConcepts: [
          "Heat loss calculation: Q = U × A × ΔT, where U is U-value, A is area, ΔT is temperature difference",
          "Design conditions: 99% heating design temp and 1% cooling design temp from TMY3 data",
          "Heat loss components: conduction through walls/roof/floor, infiltration, ventilation",
          "U-values vary by construction: R-13 wall = U-0.077, R-30 roof = U-0.033",
          "Infiltration: 0.35 ACH (air changes per hour) typical for tight homes, 0.5-0.7 for average",
          "Infiltration definition: Uncontrolled leakage of air through cracks, gaps, and openings in building envelope",
          "Infiltration importance: Often the single largest load component in older homes, can be 30-40% of total heating load",
          "Blower Door Test: Manual J requires ACH50 score (air changes per hour at 50 Pascal pressure difference) for accurate calculation",
          "ACH50 measurement: Standard test measures home tightness - lower ACH50 = tighter home",
          "Tight home: ACH50 < 3 (0.15-0.25 ACH normal conditions)",
          "Average home: ACH50 3-7 (0.35-0.5 ACH normal conditions)",
          "Loose home: ACH50 > 7 (0.5-1.0+ ACH normal conditions)",
          "Qualitative assessment: If Blower Door not available, use Tight/Average/Loose classification",
          "Infiltration penalty: Older homes without air sealing can have 50-100% higher heating loads due to infiltration",
          "Ventilation: ASHRAE 62.2 requires 7.5 CFM per person + 0.03 CFM per sq ft",
        ],
        formulas: {
          totalHeatLoss:
            "Q_total = Q_conduction + Q_infiltration + Q_ventilation",
          conduction: "Q_cond = Σ(U_i × A_i × ΔT_design)",
          infiltration: "Q_inf = 1.08 × CFM × ΔT × ACH × Volume / 60",
        },
      },
      coolingLoad: {
        summary: "Cooling load includes sensible and latent components.",
        keyConcepts: [
          "Sensible load: temperature reduction (BTU/hr)",
          "Latent load: humidity removal (BTU/hr)",
          "Solar gain: varies by window orientation, shading, glazing type",
          "Internal gains: people (230 BTU/hr sensible, 200 BTU/hr latent per person when sitting), appliances, lighting",
          "Occupant load: Manual J assigns approximately 230 BTU sensible and 200 BTU latent per person (sitting/office activity)",
          "Party example: 10 people adds nearly half a ton (4,300 BTU) of cooling load",
          "Metabolic rate: Sitting = 1.0 met, Light activity = 1.2 met, affects sensible heat gain",
          "Design conditions: 1% cooling design temp (typically 90-95°F outdoor, 75°F indoor)",
          "Latent ratio: typically 0.2-0.3 for residential (20-30% of total load is latent)",
        ],
      },
      solarHeatGain: {
        summary:
          "Solar heat gain through windows (fenestration) is a major component of cooling load.",
        keyConcepts: [
          "Fenestration loads: Windows are the largest source of solar heat gain in homes",
          "Direction matters: East/West exposure has higher peak solar gain than South-facing windows",
          "South windows: Lower peak gain but more consistent throughout the day",
          "East/West windows: Higher peak gain in morning (East) and afternoon (West) - typically 2-3x South",
          "Solar Heat Gain Coefficient (SHGC): Measures how much solar radiation passes through glass (0.2-0.8 typical)",
          "Shading: Overhangs, trees, and window treatments significantly reduce solar gain",
          "Glazing type: Double-pane low-E windows reduce SHGC by 30-50% vs single-pane",
          "Manual J tables: Provides SHGC multipliers by orientation, glazing type, and shading",
        ],
        formulas: {
          solarGain:
            "Q_solar = SHGC × Area × Solar_Intensity × Orientation_Multiplier",
        },
      },
      roofColor: {
        summary:
          "Roof color and surface properties affect cooling load through solar absorption.",
        keyConcepts: [
          "Dark roofs: Absorb more solar radiation, increasing Sol-Air temperature significantly",
          "Light roofs: Reflect more solar radiation, reducing cooling load by 20-40%",
          "Sol-Air temperature: Effective temperature accounting for solar radiation absorption",
          "Dark roof example: Can reach 150-180°F surface temp in summer (vs 100-120°F for light)",
          "Radiant barrier: Reflective layer under roof reduces heat transfer to attic by 30-50%",
          "Cool roof rating: Reflectance >0.65 and emittance >0.90 qualifies as 'cool roof'",
          "Impact on load: Dark roof can add 10-20% to cooling load vs light roof with radiant barrier",
          "Manual J: Includes roof color multipliers in load calculations",
        ],
      },
      sizing: {
        summary: "Manual J determines the required equipment capacity.",
        keyConcepts: [
          "Total load = heating load + cooling load (use larger of the two for sizing)",
          "Safety factors: Manual J does NOT add safety factors - use calculated load directly",
          "Oversizing penalty: 10-15% efficiency loss per 10% oversizing",
          "Undersizing: system runs continuously, poor dehumidification, comfort issues",
          "Zoning: each zone calculated separately, then summed for central system",
        ],
      },
    },
  },

  // ACCA Manual S - Equipment Selection
  manualS: {
    title: "ACCA Manual S - Residential Equipment Selection",
    source: "ACCA Manual S",
    topics: {
      equipmentSelection: {
        summary:
          "Manual S guides selection of properly sized HVAC equipment based on Manual J loads.",
        keyConcepts: [
          "Select equipment within 15-20% of calculated load (100-115% of load, maximum 120%)",
          "CRITICAL RULE: Equipment should NOT be oversized by more than 15-20% above calculated load",
          "If load calc = 2.8 tons, maximum equipment = 3.36 tons (20% oversizing limit)",
          "Oversizing penalties: >20% causes poor humidity control, short cycling, efficiency loss",
          "Example: 2.8 ton load → 3.5 ton unit = 25% oversizing = TOO MUCH (violates Manual S)",
          "Heat pumps: select based on heating load at design temp, verify cooling capacity",
          "Gas furnaces: select based on heating load, verify AFUE rating",
          "Oversizing check: if equipment > 115-120% of load, it's oversized (inefficient, poor dehumidification)",
          "Undersizing check: if equipment < 100% of load, it's undersized (won't maintain temp)",
          "Multi-stage equipment: first stage should handle 60-70% of load for efficiency",
        ],
      },
      altitudeDerating: {
        summary:
          "Equipment capacity decreases at high altitude due to reduced air density.",
        keyConcepts: [
          "Air density: Decreases with altitude - less air = less heat transfer capacity",
          "Capacity loss: Approximately 2-4% per 1000 feet of elevation above sea level",
          "Example: At 5000ft elevation, capacity reduced by 10-20% vs sea level",
          "Manual S requirement: Must derate equipment specifications for altitude",
          "Heat pumps: Both heating and cooling capacity affected by altitude",
          "Gas furnaces: Also affected - combustion efficiency decreases at altitude",
          "Solution: Select larger equipment or use altitude-corrected capacity tables",
          "Critical: Failure to derate can result in undersized system at high altitude",
        ],
        formulas: {
          altitudeDerating:
            "Capacity_altitude = Capacity_sea_level × (1 - 0.02 to 0.04 × Elevation_1000ft)",
        },
      },
      heatPumpSizing: {
        summary: "Heat pump sizing requires balance point analysis.",
        keyConcepts: [
          "Balance point: outdoor temp where heat pump capacity = heat loss",
          "Below balance point: aux heat required (electric strip or gas backup)",
          "Design temp sizing: heat pump sized for 47°F (AHRI rating temp), not design temp",
          "Aux heat sizing: sized for design temp minus heat pump capacity at design temp",
          "Example: 36k BTU load at 20°F, 36k BTU heat pump at 47°F → aux needed below ~30°F",
        ],
      },
      capacityDerating: {
        summary:
          "Heat pump capacity decreases significantly at low outdoor temperatures.",
        keyConcepts: [
          "AHRI rating: Heat pump capacity at 47°F is the nominal high-temp capacity (marketing rating)",
          "Critical: You CANNOT rely on 47°F capacity rating for 10°F or 17°F design days",
          "Capacity drop: Heat pump capacity drops 20-40% from 47°F to 17°F depending on model",
          "Cold-climate units: Better derating curves (may only drop 10-20% from 47°F to 17°F)",
          "Standard units: Poor derating - capacity may drop 30-50% at 17°F vs 47°F",
          "Manual S requirement: Must verify capacity at design temperature (typically 17°F or lower), not just 47°F",
          "NEEP data: North East Energy Efficiency Partnerships provides capacity data at multiple temperatures",
          "COP degradation: COP also decreases at low temps (typically 3.0 at 47°F, 2.0 at 17°F)",
          "Example: Unit rated 36k BTU at 47°F may only deliver 24k BTU at 17°F (33% derating)",
          "Solution: Select heat pump based on capacity at design temp, not just nominal rating",
        ],
        warnings: {
          derating:
            "CRITICAL: Always check capacity at design temperature (17°F or lower) - 47°F rating is misleading for cold climates",
        },
      },
      sensibleHeatRatio: {
        summary:
          "Sensible Heat Ratio (SHR) measures temperature cooling vs humidity removal capacity.",
        keyConcepts: [
          "SHR definition: Ratio of sensible (temperature) cooling to total (sensible + latent) cooling capacity",
          "Sensible cooling: Lowers air temperature (measured in BTU/hr)",
          "Latent cooling: Removes moisture/humidity from air (measured in BTU/hr)",
          "SHR formula: SHR = Sensible Capacity / (Sensible Capacity + Latent Capacity)",
          "Ideal SHR: 0.70-0.75 for most homes (70-75% sensible, 25-30% latent)",
          "High SHR problem: If SHR is too high (0.85+), unit cools temperature but doesn't remove humidity",
          "Oversizing effect: Oversized equipment (Manual S violation) runs short cycles, satisfies temperature (sensible) before removing humidity (latent), causing high SHR",
          "Sticky feel at 72°F: If 72°F feels sticky, unit likely has high SHR - satisfying sensible load but not latent load",
          "Short cycling cause: Oversized unit reaches setpoint in 5 minutes, shuts off before dehumidifying properly",
          "Manual S requirement: Equipment must be properly sized to allow full dehumidification cycle",
          "Low SHR needed: For humid climates, need SHR < 0.75 to properly control humidity",
          "Multi-stage benefit: First stage runs longer, allowing proper dehumidification (lower effective SHR)",
        ],
      },
    },
  },

  // ACCA Manual D - Duct Design
  manualD: {
    title: "ACCA Manual D - Residential Duct Design",
    source: "ACCA Manual D",
    topics: {
      ductSizing: {
        summary:
          "Manual D provides duct sizing methodology for proper airflow distribution.",
        keyConcepts: [
          "CFM per ton: 400 CFM per ton for cooling (typical), 350-450 CFM range",
          'Static pressure: 0.5" WC typical for residential, 0.3-0.6" acceptable',
          'Friction rate: 0.1" per 100 ft typical, use friction chart for sizing',
          "Duct sizing: based on CFM, friction rate, and equivalent length",
          "Undersized ducts: high static pressure, poor airflow, noise, efficiency loss",
          "Oversized ducts: low velocity, poor mixing, comfort issues",
        ],
      },
      airflow: {
        summary: "Proper airflow is critical for system performance.",
        keyConcepts: [
          "Supply air temp: 55-60°F for cooling, 100-120°F for heating",
          "Return air: typically 75°F for cooling, 68°F for heating",
          "Delta T: 18-22°F typical for cooling, 30-50°F for heating",
          "Low airflow symptoms: poor cooling, high head pressure, short cycling",
          "High airflow symptoms: poor dehumidification, drafty, noise",
        ],
      },
      faceVelocity: {
        summary:
          "Return grille face velocity limits per Manual D to prevent noise.",
        keyConcepts: [
          "Return grille velocity limit: Manual D recommends keeping return grille face velocity below 400-500 FPM (Feet Per Minute) to prevent noise",
          "Face velocity: Calculated as CFM divided by free area of grille (not total grille area)",
          "Free area: Typical return grilles have 60-75% free area (rest is solid material)",
          "Whistling noise: If return grille is whistling, face velocity is likely exceeding 500 FPM",
          "Problem cause: Return grille is too small for the CFM your system is moving",
          "Solution: Replace with larger return grille, add additional return grilles, or reduce CFM",
          "Manual D standard: 300-400 FPM is ideal for return grilles, 400-500 FPM maximum",
          "Supply grille velocity: Can be higher (600-800 FPM) since noise is less of a concern at supply",
          "Noise vs airflow: Higher velocity = more noise, but too large = poor air distribution",
        ],
      },
      equivalentLength: {
        summary:
          "Equivalent length converts duct fittings into straight pipe length for friction calculations.",
        keyConcepts: [
          "Equivalent length definition: Method to convert fittings (elbows, tees, transitions) into equivalent straight pipe length for friction loss calculations",
          "Why it matters: Fittings add significant friction - must be accounted for in duct design",
          "Hard 90° elbow: Typically has equivalent length of 30-60 feet of straight duct (varies by diameter)",
          "Soft 90° elbow: Lower equivalent length than hard elbow, typically 10-20 feet",
          "Tee fitting: Can have equivalent length of 20-50 feet depending on flow direction",
          "Manual D tables: Provides equivalent length values for various fittings and duct diameters",
          "Flex duct kinks: Kinked flex duct can have equivalent length of 100+ feet - this is why kinks kill airflow",
          "Friction calculation: Total friction = (Straight length + Equivalent length) × Friction rate per 100 ft",
          "Design impact: Poorly designed duct systems with many fittings can double or triple effective duct length",
          "Best practice: Minimize fittings, use smooth transitions, keep flex duct pulled tight without kinks",
        ],
      },
      staticPressure: {
        summary:
          "Static pressure is critical for proper airflow and system longevity.",
        keyConcepts: [
          'Design static pressure: 0.5" WC typical for residential systems',
          'Acceptable range: 0.3-0.6" WC - above 0.6" is problematic',
          'High MERV filters: Increase static pressure significantly (MERV 13+ can add 0.2-0.3" WC)',
          'HEPA filters: Can increase static pressure by 0.3-0.5" WC vs standard filters',
          'Problem: If ducts designed for 0.5" WC and filter adds 0.3" WC, total = 0.8" WC (exceeds limit)',
          "Blower response: High static pressure forces blower to speed up, causing noise and reducing lifespan",
          "Solution: Upgrade to larger filter area, use lower MERV, or redesign ductwork for higher static",
          "Manual D: Duct system must account for filter pressure drop in design",
        ],
        warnings: {
          highPressure:
            'Static pressure >0.6" WC causes blower motor stress, noise, and premature failure',
          filterUpgrade:
            "Upgrading to HEPA/MERV 13+ requires verifying duct system can handle increased static",
        },
      },
      flexDuct: {
        summary: "Flexible ductwork has specific limitations per Manual D.",
        keyConcepts: [
          "Flex duct friction: Much higher friction than rigid duct (2-3x higher)",
          "Maximum length: Manual D recommends keeping flex duct runs short and pulled tight",
          "Sagging: Flex duct must be pulled tight - sagging increases friction and reduces airflow",
          "Excessive length: Long flex duct runs kill airflow due to high friction losses",
          "Best practice: Use rigid duct for long runs, flex only for short connections",
          "Installation: Must be fully extended (no compression), properly supported, no kinks",
          "Manual D rule: Flex duct should not exceed 15-20% of total duct length in well-designed systems",
        ],
        warnings: {
          length:
            "Excessive flex duct length is a common cause of poor airflow and system performance",
          sagging:
            "Sagging flex duct can reduce airflow by 30-50% due to increased friction",
        },
      },
      ventClosing: {
        summary:
          "WARNING: Closing vents is dangerous and violates Manual D design principles.",
        keyConcepts: [
          "CRITICAL: DO NOT close vents in unused rooms - this is a dangerous misconception",
          "Manual D design: Duct system designed for specific CFM distribution - closing vents breaks the design",
          'Static pressure increase: Closing vents increases static pressure, can exceed 0.6" WC limit',
          "Blower motor damage: High static pressure overworks blower motor, can cause failure within weeks",
          "Reduced efficiency: System works harder, uses more energy, reduces equipment lifespan",
          "Proper solutions: Use zoning system, close doors, or install separate system for unused areas",
          "If absolutely necessary: Only close 1-2 vents maximum, monitor system, check for overheating",
        ],
        warnings: {
          critical:
            "NEVER close more than 20% of vents - can cause immediate blower motor failure",
          damage:
            "High static pressure from closed vents can permanently damage blower motor",
          alternative:
            "Instead: close doors, use zoning, or install separate system",
        },
      },
    },
  },

  // ASHRAE Standard 55 - Thermal Comfort
  ashrae55: {
    title:
      "ASHRAE Standard 55 - Thermal Environmental Conditions for Human Occupancy",
    source: "ASHRAE Standard 55-2020",
    topics: {
      comfortZone: {
        summary: "ASHRAE 55 defines acceptable thermal comfort conditions.",
        keyConcepts: [
          "Operative temperature: average of air temp and mean radiant temp",
          "Winter comfort: 68-74°F operative temp at 30-60% RH",
          "Summer comfort: 73-79°F operative temp at 30-60% RH",
          "PMV/PPD: Predicted Mean Vote / Predicted Percentage Dissatisfied",
          "Acceptable range: 80% of occupants satisfied (PPD ≤ 20%)",
          "Clothing: 1.0 clo (winter), 0.5 clo (summer) typical",
          "Activity: 1.0 met (sedentary), 1.2 met (light activity)",
        ],
        recommendations: {
          winter: "68-72°F for occupied, 62-66°F for unoccupied/sleep",
          summer: "74-78°F for occupied, 78-82°F for unoccupied/sleep",
          humidity: "30-60% RH year-round for comfort and health",
        },
      },
      healthHumidity: {
        summary:
          "The Sterling Chart shows optimal humidity range (40-60% RH) for human health.",
        keyConcepts: [
          "Sterling Chart: Research shows 40-60% RH is the ideal zone for health - below 40% viruses and respiratory infections thrive, above 60% mold and dust mites thrive",
          "Below 40% RH: Increased risk of viral infections (influenza, cold viruses), respiratory irritation, dry skin",
          "Above 60% RH: Increased risk of mold growth, dust mite proliferation, bacterial growth",
          "Ideal range: 40-60% RH provides optimal balance between preventing pathogens (viruses, bacteria) and preventing mold/mites",
          "The Sterling Chart (or Sterling/ASHRAE relationship) indicates optimal humidity range for human health based on research",
          "ASHRAE Standard 55: Recommends 30-60% RH for comfort, but Sterling Chart shows 40-60% is optimal for health",
        ],
      },
      radiantAsymmetry: {
        summary:
          "Radiant asymmetry causes discomfort even when air temperature is acceptable.",
        keyConcepts: [
          "Mean Radiant Temperature (MRT): Average temperature of surrounding surfaces",
          "Cold window surfaces: Glass is typically 10-20°F colder than room air in winter",
          "Radiant heat loss: Your body radiates heat to cold surfaces (like windows), making you feel cold",
          "Draft sensation: Feeling cold near windows even when air temp is 72°F is due to radiant asymmetry",
          "ASHRAE 55 limit: Radiant asymmetry should not exceed 5°F for comfort",
          "Solution: Improve window insulation (double/triple pane, low-E), use window treatments",
          "Operative temp: If air is 72°F but window is 55°F, operative temp feels like 63-65°F",
          "This is why you feel cold near windows even when thermostat says 72°F",
        ],
        formulas: {
          operativeTemp: "T_operative = (T_air + T_radiant) / 2",
          radiantAsymmetry: "Asymmetry = |T_surface - T_air|",
        },
      },
      adaptiveComfort: {
        summary:
          "Adaptive comfort model accounts for occupant adaptation to outdoor conditions.",
        keyConcepts: [
          "Applicable when occupants control their environment (windows, clothing, fans)",
          "Comfort temp = 0.31 × T_outdoor + 17.8°C (roughly 0.31 × T_outdoor + 64°F)",
          "Acceptable range: ±2.5°C (±4.5°F) from comfort temp",
          "More flexible than PMV model for naturally ventilated spaces",
        ],
      },
    },
  },

  // ASHRAE Standard 62.2 - Ventilation
  ashrae622: {
    title:
      "ASHRAE Standard 62.2 - Ventilation and Acceptable Indoor Air Quality",
    source: "ASHRAE Standard 62.2-2019",
    topics: {
      ventilationRequirements: {
        summary:
          "ASHRAE 62.2 sets minimum ventilation rates for residential buildings.",
        keyConcepts: [
          "Whole-house ventilation: 0.03 CFM per sq ft + 7.5 CFM per bedroom",
          "Example: 2000 sq ft, 3 bedrooms = 60 + 22.5 = 82.5 CFM minimum",
          "Local exhaust: kitchen 100 CFM, bathroom 50 CFM (intermittent)",
          "Ventilation can be: exhaust-only, supply-only, or balanced (HRV/ERV)",
          "HRV/ERV: Heat/Energy Recovery Ventilator recovers 70-90% of energy",
          "Infiltration: natural air leakage can count toward ventilation if ≥ 0.35 ACH",
        ],
        calculations: {
          wholeHouse: "Q_vent = 0.03 × A_floor + 7.5 × N_bedrooms (CFM)",
          example:
            "2000 sq ft, 3 BR = 0.03 × 2000 + 7.5 × 3 = 60 + 22.5 = 82.5 CFM",
        },
      },
      airQuality: {
        summary: "Proper ventilation maintains indoor air quality.",
        keyConcepts: [
          "CO2 levels: < 1000 ppm acceptable, > 1000 ppm indicates poor ventilation",
          "CO2 at 1000ppm: Upper limit for 'good' air quality per ASHRAE 62.2",
          "CO2 above 1000ppm: Cognitive function declines, drowsiness, reduced productivity",
          "CO2 health effects: 1000-2000ppm = acceptable but not ideal, >2000ppm = poor air quality",
          "Ventilation requirement: ASHRAE 62.2 requires sufficient ventilation to keep CO2 < 1000ppm",
          "Humidity: 30-60% RH prevents mold growth and maintains comfort",
          "Pollutants: VOCs, radon, particulates reduced by proper ventilation",
          "Source control: eliminate sources (smoking, chemicals) before increasing ventilation",
        ],
        standards: {
          ashrae622:
            "ASHRAE 62.2: 1000ppm CO2 is the upper limit for acceptable indoor air quality",
        },
      },
    },
  },

  // DOE Guides and Best Practices
  doeGuides: {
    title: "DOE Energy Efficiency Guides",
    source: "U.S. Department of Energy",
    topics: {
      heatPumpEfficiency: {
        summary: "DOE provides guidance on heat pump efficiency and operation.",
        keyConcepts: [
          "HSPF2: Heating Seasonal Performance Factor (new rating system)",
          "HSPF2 ≥ 8.5: ENERGY STAR qualified",
          "COP: Coefficient of Performance = BTU output / BTU input (electric)",
          "COP at 47°F: typically 3.0-4.5 for modern heat pumps",
          "COP degradation: decreases as outdoor temp drops (COP ~2.0 at 17°F)",
          "Aux heat lockout: set to 30-40°F to maximize heat pump efficiency",
        ],
      },
      thermostatSettings: {
        summary: "DOE recommendations for thermostat programming.",
        keyConcepts: [
          "Setback savings: 1% per degree for 8 hours (heating), 3% per degree (cooling)",
          "Recommended: 68°F winter (occupied), 62°F (unoccupied)",
          "Recommended: 78°F summer (occupied), 85°F (unoccupied)",
          "Programmable thermostats: save 10-15% on heating, 15-20% on cooling",
          "Smart thermostats: additional 8-12% savings through learning and optimization",
        ],
      },
    },
  },

  // NREL BEopt and TMY3 Data
  nrelData: {
    title: "NREL Building Energy Optimization and TMY3 Weather Data",
    source: "National Renewable Energy Laboratory",
    topics: {
      tmy3Data: {
        summary:
          "TMY3 (Typical Meteorological Year) provides representative weather data for energy calculations.",
        keyConcepts: [
          "TMY3: 12 months of actual weather data selected to represent typical year",
          "Design temps: 99% heating (1% of hours colder), 1% cooling (1% of hours hotter)",
          "HDD/CDD: Heating/Cooling Degree Days for annual energy estimates",
          "Solar radiation: direct and diffuse components for load calculations",
          "Used in: Manual J load calcs, BEopt energy modeling, system sizing",
          "Source: NREL (National Renewable Energy Laboratory) maintains TMY3 database",
          "Forecast basis: 7-day cost forecasts use TMY3 data patterns combined with current weather",
        ],
      },
      balancePoint: {
        summary:
          "Balance point is the outdoor temperature where heat loss equals heat pump capacity.",
        keyConcepts: [
          "Definition: Outdoor temperature where home's Heat Loss = Heat Pump's Heating Capacity",
          "Below balance point: Heat pump alone cannot maintain temperature, aux heat required",
          "Above balance point: Heat pump can handle heating load without aux heat",
          "Calculation: Balance Point = f(Heat Loss Factor, Heat Pump Capacity, HSPF2, Outdoor Temp)",
          "Typical range: 25-40°F for most heat pump systems",
          "Source: NREL and OpenEnergyMonitor documentation on heat pump performance",
          "Critical for sizing: Determines how much aux heat capacity is needed",
        ],
        formulas: {
          balancePoint:
            "Balance Point = T where Heat_Loss(T) = Heat_Pump_Capacity(T)",
        },
      },
      thermalDecay: {
        summary:
          "Thermal decay describes how quickly a building loses heat when heating stops.",
        keyConcepts: [
          "Newton's Law of Cooling: Rate of temperature change is proportional to temperature difference",
          "Formula: dT/dt = -k × (T - T_ambient), where k is thermal decay constant",
          "Thermal decay constant: k = Heat_Loss_Factor / (Mass × Specific_Heat)",
          "Practical formula: ΔT/Δt = -Heat_Loss_Factor × ΔT / Thermal_Mass",
          "Example: If heat loss = 500 BTU/hr/°F and thermal mass = 50,000 BTU/°F, decay = 0.01 °F/min",
          "Application: Used to calculate how long building takes to cool down during setbacks",
          "Free heat: After compressor shuts off, residual heat in exchanger continues to heat home (thermal decay in reverse)",
          "Source: Physics/Thermodynamics - Newton's Law of Cooling applied to buildings",
        ],
        formulas: {
          newtonsLaw: "dT/dt = -k × (T - T_ambient)",
          thermalDecay: "ΔT/Δt = -Heat_Loss_Factor × ΔT / Thermal_Mass",
          timeToCool:
            "t = -ln((T_final - T_ambient) / (T_initial - T_ambient)) / k",
        },
      },
      energyModeling: {
        summary: "BEopt and similar tools model annual energy consumption.",
        keyConcepts: [
          "Hourly simulation: calculates energy use for each hour of the year",
          "Inputs: building envelope, equipment efficiency, thermostat schedule, weather",
          "Outputs: annual energy use, monthly bills, peak loads, comfort metrics",
          "Sensitivity analysis: shows which parameters most affect energy use",
        ],
      },
    },
  },

  // Equipment Specifications & Performance Data
  equipmentSpecs: {
    title: "HVAC Equipment Specifications & Performance Data",
    source:
      "Manufacturer Submittal Sheets, AHRI Certificates, Product Data Catalogs",
    // Example models (to be expanded with full database)
    exampleModels: {
      "Carrier-Infinity-19VS": {
        manufacturer: "Carrier",
        model: "Infinity 19VS",
        type: "Heat Pump",
        seer2: 19.5,
        hspf2: 10.5,
        cop: { "47F": 4.2, "17F": 2.8, "5F": 2.1, "-15F": 1.5 },
        capacity: { "47F": 36000, "17F": 28000, "5F": 22000, "-15F": 16000 },
        airflow: { min: 1200, max: 1800 },
        staticPressure: { max: 0.6 },
        refrigerant: { type: "R-410A", charge: 8.5 },
        soundLevel: { low: 52, medium: 58, high: 65 },
        source: "Carrier Product Data Sheet 2024",
      },
      "Mitsubishi-PUMY-P36NKMU2": {
        manufacturer: "Mitsubishi",
        model: "PUMY-P36NKMU2",
        type: "Cold-Climate Heat Pump",
        seer2: 18.5,
        hspf2: 11.5,
        cop: { "47F": 4.5, "17F": 3.2, "5F": 2.5, "-15F": 2.0 },
        capacity: { "47F": 36000, "17F": 32000, "5F": 28000, "-15F": 24000 },
        airflow: { min: 1000, max: 1600 },
        staticPressure: { max: 0.5 },
        refrigerant: { type: "R-410A", charge: 7.2 },
        soundLevel: { low: 48, medium: 55, high: 62 },
        source: "Mitsubishi Submittal Sheet 2024",
        neepCertified: true, // NEEP cold-climate certified
      },
    },
    topics: {
      performanceRatings: {
        summary:
          "Equipment performance ratings vary by temperature and operating conditions.",
        keyConcepts: [
          "HSPF2: Heating Seasonal Performance Factor (new rating system), measured at 47°F, 17°F, 5°F, and -15°F",
          "SEER2: Seasonal Energy Efficiency Ratio (new rating system), measured at 95°F outdoor, 80°F indoor",
          "COP: Coefficient of Performance = BTU output / BTU input (electric), varies with outdoor temperature",
          "EER: Energy Efficiency Ratio (instantaneous), EER ≈ SEER2 × 0.875",
          "Capacity degradation: Heat pump capacity decreases as outdoor temp drops (typically 50-60% at 5°F vs 47°F)",
          "Cold-climate performance: Look for capacity at 5°F and -15°F for cold-climate heat pumps",
          "AHRI ratings: Certified performance data available in AHRI Directory for matched systems",
          "Sound levels: Measured in dB(A) at different fan speeds (typically 50-70 dB(A) for residential units)",
        ],
        formulas: {
          cop: "COP = BTU_output / (kW_input × 3,412)",
          capacityFactor:
            "Capacity_factor = Capacity_at_temp / Capacity_at_47F",
        },
      },
      airflowSpecs: {
        summary:
          "Airflow and static pressure specifications are critical for proper system operation.",
        keyConcepts: [
          "CFM range: Minimum and maximum airflow (CFM) varies by unit size and fan speed",
          "Typical ranges: 1.5 ton = 600-900 CFM, 3 ton = 1,200-1,800 CFM, 5 ton = 2,000-3,000 CFM",
          'Static pressure: Maximum static pressure typically 0.5-0.8" WC for residential units',
          "Fan speeds: Multi-speed and variable-speed units have different CFM at each speed",
          "Low static: System may not deliver proper airflow if static pressure too low",
          "High static: Exceeding maximum static pressure causes blower stress and noise",
        ],
      },
      refrigerants: {
        summary:
          "Refrigerant type and charge amount are specified for each model.",
        keyConcepts: [
          "R-410A: Common refrigerant, being phased out, high GWP (Global Warming Potential)",
          "R-454B: Newer low-GWP alternative to R-410A (A2L mildly flammable)",
          "R-32: Low-GWP refrigerant used in some systems (A2L mildly flammable)",
          "Charge amount: Specified in ounces or pounds for each model (typically 3-15 lbs for residential)",
          "Critical: Must use exact refrigerant type specified - mixing refrigerants damages system",
          "Conversion: R-410A to R-454B conversions require specific procedures and may not be approved",
        ],
      },
    },
  },

  // Installation & Physical Requirements
  installationRequirements: {
    title: "Installation & Physical Requirements",
    source:
      "Installation, Operation & Maintenance (IOM) Manuals, Installer's Guides",
    topics: {
      clearances: {
        summary:
          "Minimum clearances to combustibles and service access are required for safety and maintenance.",
        keyConcepts: [
          'Outdoor units: Typically 12-24" clearance to walls, 36-48" for service access',
          'Indoor units: 6-12" clearance to walls, 30-36" for service access',
          'Combustibles: Minimum clearance to combustible materials (typically 1" for furnaces, 6" for heat pumps)',
          "Ventilation: Adequate clearance for air intake and exhaust (prevents recirculation)",
          "Code requirements: IMC (International Mechanical Code) and IRC specify minimum clearances",
          "Service access: Must allow technician access to all serviceable components",
        ],
      },
      lineSets: {
        summary:
          "Refrigerant line-set length and vertical rise affect system performance.",
        keyConcepts: [
          "Maximum length: Typically 50-100 feet depending on model (longer = capacity loss)",
          "Vertical rise: Maximum 50-80 feet depending on model (affects oil return)",
          "Minimum length: Some models require minimum 15-25 feet for proper operation",
          'Sizing: Line-set diameter must match unit specifications (typically 3/8" liquid, 5/8" or 3/4" suction)',
          "Capacity loss: Each 10 feet of line-set length reduces capacity by 0.5-1%",
          "Oil return: Vertical rise requires proper line-set sizing to ensure compressor oil return",
        ],
      },
      electrical: {
        summary: "Electrical requirements vary by unit size and efficiency.",
        keyConcepts: [
          "MCA: Minimum Circuit Ampacity - minimum wire size and breaker rating",
          "MOP: Maximum Overcurrent Protection - maximum breaker size allowed",
          "Voltage: Typically 208/230V single-phase for residential (some require 3-phase)",
          "Heat pumps: MCA typically 15-50 amps depending on size, MOP 20-60 amps",
          "Gas furnaces: 80% AFUE typically 15-20 amps, 96% AFUE (condensing) 20-30 amps",
          "Dual fuel: Requires separate circuits for heat pump and furnace",
          "Code: NEC (National Electrical Code) specifies requirements",
        ],
      },
      gasRequirements: {
        summary: "Gas furnaces require proper gas line sizing and venting.",
        keyConcepts: [
          "Gas line size: Depends on BTU input, distance from meter, and number of appliances",
          '80% furnaces: Typically 1/2" to 3/4" gas line depending on size (40k-150k BTU input)',
          "96% furnaces: Similar gas line requirements, but different venting (PVC instead of metal)",
          'Gas pressure: Required inlet pressure typically 5-7" WC for natural gas',
          "Venting: 80% = metal B-vent or chimney, 96% = PVC (category IV)",
          "Code: NFPA 54 (National Fuel Gas Code) specifies requirements",
        ],
      },
      dualFuel: {
        summary: "Dual-fuel systems combine heat pump with gas furnace backup.",
        keyConcepts: [
          "Compatibility: Not all heat pumps are approved for dual-fuel with all furnaces",
          "Control: Requires dual-fuel control board or compatible thermostat",
          "Switchover: Typically switches to gas at 30-40°F outdoor temperature",
          "Installation: Requires specific wiring and control setup per manufacturer",
          "Approved combinations: Check manufacturer matching tables for approved pairings",
        ],
      },
      drainRequirements: {
        summary:
          "Proper condensate drainage is required for indoor units in attics and basements.",
        keyConcepts: [
          "Primary drain: Required for all indoor units (air handlers, furnaces with A/C coils)",
          "Auxiliary drain: Required in attics and above finished spaces (safety backup)",
          'Drain pan: Must be sized for unit and have proper slope (1/4" per foot minimum)',
          "Code: IMC requires auxiliary drain pan in attics with float switch",
          "Freezing: Attic installations require heat tape or insulated drain lines in cold climates",
        ],
      },
    },
  },

  // Troubleshooting & Fault Codes
  troubleshooting: {
    title: "Troubleshooting & Fault Codes",
    source:
      "Service Manuals, Service Facts, Fault Code Guides, Technical Service Bulletins",
    // Example fault codes (to be expanded with full database)
    exampleFaultCodes: {
      Carrier: {
        E1: {
          meaning: "Indoor temperature sensor fault",
          causes: [
            "Sensor disconnected",
            "Sensor shorted",
            "Sensor out of range",
          ],
          solution: "Check sensor wiring, replace if faulty",
          source: "Carrier Service Manual 2024",
        },
        E5: {
          meaning: "Communication error between indoor and outdoor units",
          causes: ["Loose connection", "Damaged wire", "Control board fault"],
          solution: "Check communication wire, verify connections",
          source: "Carrier Service Manual 2024",
        },
        dF: {
          meaning: "Defrost fault",
          causes: [
            "Defrost sensor fault",
            "Outdoor coil frozen",
            "Defrost timer fault",
          ],
          solution: "Check defrost sensor, verify defrost operation",
          source: "Carrier Service Manual 2024",
        },
      },
      Trane: {
        "5 flashes": {
          meaning: "Low pressure switch open",
          causes: ["Low refrigerant", "Restriction", "Faulty switch"],
          solution: "Check refrigerant charge, verify switch operation",
          source: "Trane Service Facts 2024",
        },
        "3 flashes": {
          meaning: "High pressure switch open",
          causes: ["Overcharge", "Restriction", "Faulty switch"],
          solution: "Check refrigerant charge, verify switch operation",
          source: "Trane Service Facts 2024",
        },
      },
      Lennox: {
        E200: {
          meaning: "Indoor temperature sensor fault",
          causes: ["Sensor disconnected", "Sensor shorted"],
          solution: "Check sensor wiring, replace if faulty",
          source: "Lennox Service Manual 2024",
        },
        E223: {
          meaning: "Outdoor temperature sensor fault",
          causes: ["Sensor disconnected", "Sensor shorted"],
          solution: "Check sensor wiring, replace if faulty",
          source: "Lennox Service Manual 2024",
        },
      },
    },
    topics: {
      faultCodes: {
        summary:
          "Fault codes indicate specific system problems requiring diagnosis.",
        keyConcepts: [
          "Format varies: LED flashes, error codes (E1, E5, etc.), alphanumeric (dF, Lo, Hi)",
          "Common codes: E1 = sensor fault, E5 = communication error, dF = defrost fault, Lo = low pressure",
          "Brand-specific: Each manufacturer uses different fault code systems",
          "Service manuals: Complete fault code lists available in manufacturer service manuals",
          "TSBs: Technical Service Bulletins provide updated fault code information and fixes",
        ],
      },
      coldAirInHeating: {
        summary:
          "Heat pump blowing cold air in heating mode has several possible causes.",
        keyConcepts: [
          "Defrost cycle: Normal - heat pump reverses to defrost outdoor coil (5-10 minutes)",
          "Outdoor temp too low: Below balance point, system may need aux heat",
          "Reversing valve stuck: Valve not switching properly, requires service",
          "Low refrigerant: Insufficient charge causes poor heating performance",
          "Outdoor coil frozen: Ice buildup prevents heat transfer, check defrost operation",
          "Thermostat setting: Verify heat mode is selected, not cool or auto",
        ],
      },
      ignitionProblems: {
        summary:
          "Furnace ignition problems have specific diagnostic procedures.",
        keyConcepts: [
          "Ignitor glows but no flame: Top 5 causes: 1) Gas valve not opening, 2) No gas supply, 3) Flame sensor dirty, 4) Pressure switch fault, 5) Control board fault",
          "Flame sensor test: Measure microamps (typically 2-10 μA when flame present)",
          "Inducer motor test: Check for proper operation, verify pressure switch activation",
          "Pressure switch test: Should close when inducer runs (continuity test)",
          "Gas valve: Verify 24V signal from control board, check gas supply pressure",
          "Control board: Check for error codes, verify all safety circuits closed",
        ],
      },
      diagnosticProcedures: {
        summary: "Systematic diagnostic procedures for common components.",
        keyConcepts: [
          "Flame sensor: Clean with fine sandpaper, measure microamps (should be 2-10 μA)",
          "Inducer motor: Check for proper rotation, measure amp draw (compare to nameplate)",
          "Pressure switch: Blow into tube - should hear click, verify continuity when closed",
          "Thermocouple/thermopile: Measure millivolts (should be 10-30 mV for standing pilot)",
          "Gas valve: Measure 24V at valve terminals when calling for heat",
          "Control board: Check for diagnostic LEDs, verify all inputs (safety circuits)",
        ],
      },
    },
  },

  // Compatibility & Matching
  compatibility: {
    title: "Equipment Compatibility & Matching",
    source:
      "AHRI Directory, Manufacturer Matching Tables, Approved Combinations Lists",
    topics: {
      ahriMatching: {
        summary:
          "AHRI Directory certifies matched combinations of outdoor and indoor units.",
        keyConcepts: [
          "AHRI number: Unique identifier for each matched system (e.g., 12345678)",
          "Approved combinations: Only specific outdoor/indoor coil combinations are certified",
          "Performance: AHRI ratings show actual SEER2/HSPF2 for the matched combination",
          "Mixing brands: Generally not recommended - use manufacturer-approved combinations",
          "Database: Full AHRI Directory contains ~15-20 GB of certified combination data",
          "Verification: Always verify AHRI number matches your specific combination",
        ],
      },
      variableSpeedMatching: {
        summary:
          "Variable-speed furnaces can be matched with single-stage heat pumps in some cases.",
        keyConcepts: [
          "Compatibility: Depends on control board and thermostat compatibility",
          "Fan control: Variable-speed furnace can provide better airflow control",
          "Efficiency: Variable-speed fan improves overall system efficiency",
          "Approval: Check manufacturer matching tables for approved combinations",
          "Control: May require specific control board or thermostat for proper operation",
        ],
      },
      refrigerantCompatibility: {
        summary:
          "Evaporator coils must be rated for the refrigerant used in the system.",
        keyConcepts: [
          "R-410A coils: Cannot be used with R-454B or R-32 systems",
          "R-454B compatibility: Coil must be specifically rated for R-454B",
          "R-32 compatibility: Coil must be specifically rated for R-32",
          "Conversion: Converting R-410A system to R-454B requires coil replacement",
          "Critical: Using wrong refrigerant in coil can cause leaks and system failure",
        ],
      },
    },
  },

  // Sizing & Load Calculation Support
  sizingSupport: {
    title: "Sizing & Load Calculation Support",
    source:
      "ACCA Manual J/S/D, Manufacturer Sizing Guides, NEEP Cold-Climate Data",
    topics: {
      manualJSizing: {
        summary:
          "Manual J provides the standard method for calculating heating and cooling loads.",
        keyConcepts: [
          "Load calculation: Determines required equipment capacity based on building characteristics",
          "Heating load: Calculated at 99% design temperature (1% of hours colder)",
          "Cooling load: Calculated at 1% design temperature (1% of hours hotter)",
          "Example: 2,200 sq ft home in Chicago (Zone 5) typically needs 2.5-3.5 tons cooling, 60k-90k BTU heating",
          "Factors: Square footage, insulation, windows, orientation, infiltration, internal gains",
          "Software: Manual J calculations done with software (Wrightsoft, CoolCalc, Manual J 8th Ed)",
        ],
      },
      coldClimateSizing: {
        summary:
          "Cold-climate heat pumps require capacity verification at low temperatures.",
        keyConcepts: [
          "5°F capacity: Cold-climate heat pumps maintain 70-100% of rated capacity at 5°F",
          "0°F capacity: Some models maintain 50-70% capacity at 0°F",
          "NEEP data: NEEP ccASHP list provides capacity at 5°F for certified cold-climate models",
          "Zone 5 sizing: 3-ton heat pump in Zone 5 should maintain capacity at 0°F for most homes",
          "Backup sizing: Gas furnace backup typically sized for design temp minus heat pump capacity",
          "Example: 4-ton cold-climate heat pump may need 40k-60k BTU gas backup in Zone 5",
        ],
      },
      typicalSizing: {
        summary: "Typical equipment sizes for common home sizes and climates.",
        keyConcepts: [
          "Rule of thumb: 1 ton per 400-600 sq ft (varies by climate and insulation)",
          "Zone 1-2 (hot): 1 ton per 400-500 sq ft",
          "Zone 3-4 (moderate): 1 ton per 500-600 sq ft",
          "Zone 5-7 (cold): 1 ton per 600-800 sq ft (with cold-climate heat pump)",
          "Gas backup: Typically 40k-80k BTU for 3-5 ton heat pump systems",
          "Important: Always use Manual J for accurate sizing - rules of thumb are rough estimates",
        ],
      },
    },
  },

  // Energy Efficiency, Rebates & Regulatory
  energyEfficiency: {
    title: "Energy Efficiency, Rebates & Regulatory Compliance",
    source:
      "ENERGY STAR Lists, CEE Tier Lists, IRS 25C Database, DOE Regulations",
    topics: {
      taxCredits: {
        summary:
          "Federal and state tax credits are available for high-efficiency HVAC equipment.",
        keyConcepts: [
          "25C Tax Credit: $2,000 federal tax credit for qualified heat pumps (2023-2032)",
          "Qualification: Heat pump must meet SEER2 ≥ 16, HSPF2 ≥ 9, EER ≥ 12",
          "ENERGY STAR Most Efficient: Highest tier, qualifies for maximum rebates",
          "State rebates: Vary by state, check local utility and state energy office",
          "IRS Database: IRS maintains list of 25C qualified products",
          "Documentation: Keep receipts and AHRI certificate for tax filing",
        ],
      },
      seerVsSeer2: {
        summary: "SEER2 is the new rating system replacing SEER (2023).",
        keyConcepts: [
          'SEER2: New rating system accounts for higher external static pressure (0.5" vs 0.1")',
          "SEER vs SEER2: SEER2 ratings are typically 1-2 points lower than SEER for same unit",
          "Example: Unit rated SEER 18 = approximately SEER2 16-17",
          "Requirement: All units sold after 2023 must use SEER2 ratings",
          "Comparison: Cannot directly compare SEER to SEER2 - use same rating system",
        ],
      },
      doeRegulations: {
        summary:
          "DOE regulations set minimum efficiency standards for HVAC equipment.",
        keyConcepts: [
          "May 2025 Rule: New minimum AFUE 95% for gas furnaces in Northern region",
          "Regional standards: Different minimums for North (95% AFUE) vs South (80% AFUE)",
          "Compliance: Only new installations must meet new standards - existing units grandfathered",
          "Heat pumps: Minimum SEER2 14.3, HSPF2 7.5 (2023 standards)",
          "Enforcement: Manufacturers must certify compliance, installers must verify",
        ],
      },
      energyStar: {
        summary:
          "ENERGY STAR certification indicates high-efficiency equipment.",
        keyConcepts: [
          "Heat pumps: SEER2 ≥ 16, HSPF2 ≥ 9, EER ≥ 12 for ENERGY STAR",
          "Most Efficient: Highest tier, SEER2 ≥ 18, HSPF2 ≥ 10",
          "Gas furnaces: AFUE ≥ 95% for ENERGY STAR",
          "Benefits: Lower operating costs, may qualify for rebates and tax credits",
          "Database: ENERGY STAR product finder lists all certified models",
        ],
      },
    },
  },

  // Parts & Replacement
  partsReplacement: {
    title: "Parts & Replacement Components",
    source: "Parts Catalogs, Replacement Component Guides, Supersession Tables",
    topics: {
      partNumbers: {
        summary:
          "HVAC parts have specific part numbers that may be superseded over time.",
        keyConcepts: [
          "Supersession: Old part numbers replaced by new numbers when parts are updated",
          "Cross-reference: Supersession tables show old → new part number mappings",
          "Availability: Obsolete parts may be unavailable - must use superseding part",
          "Compatibility: Superseding parts are designed to be direct replacements",
          "15-year-old units: Parts may be discontinued - check for supersessions or aftermarket alternatives",
        ],
      },
      commonReplacements: {
        summary: "Common replacement parts for older HVAC systems.",
        keyConcepts: [
          "TXV (Thermostatic Expansion Valve): Common replacement for 15+ year old systems",
          "Compressor: May be unavailable for very old units - consider system replacement",
          "Control boards: Often superseded - check manufacturer for compatible replacement",
          "Aftermarket: Some parts available from aftermarket suppliers for discontinued models",
          "Carrier heat pumps: Check Carrier parts catalog for current part numbers",
        ],
      },
    },
  },

  // Safety & Critical Warnings
  safety: {
    title: "Safety Warnings and Critical Protection Devices",
    source: "Industry Safety Standards, NFPA, ASHRAE",
    topics: {
      safetySwitches: {
        summary:
          "Safety switches are critical protection devices that must NEVER be bypassed or disabled.",
        keyConcepts: [
          "CRITICAL WARNING: Safety switches (high limit, pressure switches, flame sensors, rollout switches) are life-safety devices",
          "High limit switch: Prevents furnace from overheating - bypassing can cause fire, equipment destruction, or injury",
          "Pressure switches: Prevent operation with improper airflow - bypassing can cause carbon monoxide buildup or equipment damage",
          "Flame sensor: Ensures gas is burning - bypassing can cause gas accumulation and explosion risk",
          "Rollout switch: Detects flame rollout - bypassing can cause fire and serious injury",
          "IMMEDIATE REFUSAL: If asked about bypassing any safety switch, respond: 'I cannot assist with that. Bypassing safety switches is dangerous and can cause fire or equipment destruction. Call a licensed technician immediately.'",
          "Legal liability: Bypassing safety devices violates codes, voids warranties, creates liability",
          "Proper repair: Safety switches trip for a reason - diagnose and fix the root cause, never bypass",
          "Call professional: All safety switch issues require licensed technician diagnosis and repair",
        ],
        warnings: {
          critical:
            "NEVER bypass, disable, or remove safety switches. This is dangerous and illegal. Call a licensed technician immediately.",
          highLimit:
            "Bypassing high limit switch can cause furnace to overheat, leading to fire or equipment destruction",
          pressureSwitch:
            "Bypassing pressure switches can cause carbon monoxide buildup or equipment damage",
        },
      },
    },
  },

  // General HVAC Engineering Principles
  generalPrinciples: {
    title: "General HVAC Engineering Principles",
    source: "Industry Standards and Best Practices",
    topics: {
      efficiency: {
        summary: "Key efficiency concepts for HVAC systems.",
        keyConcepts: [
          "SEER2: Seasonal Energy Efficiency Ratio (cooling), higher is better",
          "HSPF2: Heating Seasonal Performance Factor, higher is better",
          "AFUE: Annual Fuel Utilization Efficiency (gas furnaces), 90%+ modern",
          "EER: Energy Efficiency Ratio (instantaneous), EER ≈ SEER × 0.875",
          "COP: Coefficient of Performance = output/input (dimensionless)",
          "Efficiency vs. capacity: higher efficiency often means lower capacity at extreme temps",
        ],
      },
      sizing: {
        summary: "Proper sizing is critical for efficiency and comfort.",
        keyConcepts: [
          "Oversizing: short cycling, poor dehumidification, efficiency loss, comfort issues",
          "Undersizing: can't maintain temp, continuous operation, high bills",
          "Right-sizing: 100-115% of calculated load (Manual J/S)",
          "Multi-stage: better efficiency and comfort than single-stage",
          "Variable-speed: best efficiency and comfort, but higher cost",
        ],
      },
      operation: {
        summary: "Optimal operation strategies for efficiency and comfort.",
        keyConcepts: [
          "Setback strategy: 4-6°F setback for 8+ hours saves 5-10%",
          "Aux heat lockout: 30-40°F maximizes heat pump efficiency",
          "Compressor lockout: 0-20°F prevents damage, but may need aux heat",
          "Fan operation: continuous low-speed improves comfort and air quality",
          "Filter maintenance: change every 1-3 months for efficiency and IAQ",
        ],
      },
      autoHeatCool: {
        summary: "Auto Heat/Cool mode automatically switches between heating and cooling based on indoor temperature relative to the setpoint range.",
        keyConcepts: [
          "Auto Heat/Cool definition: A thermostat MODE (like 'Heat', 'Cool', 'Off') that automatically switches between heating and cooling to maintain temperature within a setpoint range - you select 'Auto' as the system mode on your thermostat",
          "What 'Auto' means: When you set your thermostat mode to 'Auto', the system automatically chooses whether to heat or cool based on the current indoor temperature relative to your setpoint range - no manual switching needed",
          "How it works: System heats when temperature drops below the heat setpoint, cools when temperature rises above the cool setpoint, maintains temperature in the 'dead band' between setpoints without running",
          "Setpoint range: Requires both a heat setpoint (e.g., 68°F) and a cool setpoint (e.g., 72°F) with a minimum gap (typically 3-5°F) between them - this creates a comfort zone where neither heating nor cooling runs",
          "Heat/Cool Min Delta: Minimum temperature gap between heat and cool setpoints (typically 3-5°F) to prevent rapid switching between modes - this is a threshold setting, not the actual setpoint gap",
          "Example: Heat setpoint 70°F, Cool setpoint 74°F = 4°F gap - system heats if temp drops below 70°F, cools if temp rises above 74°F, does nothing between 70-74°F",
          "Benefits: Convenient for climates with variable weather, maintains comfort automatically without manual mode switching, ideal for spring/fall when both heating and cooling may be needed",
          "When to use: Best for climates with both heating and cooling needs throughout the day or season (like Georgia), or when you want hands-off operation without thinking about mode switching",
          "When NOT to use: Not recommended for heat pumps in very cold climates where you want to control when aux heat engages, or when you prefer manual control, or when you want to minimize energy use by avoiding same-day heating and cooling",
          "Energy considerations: Can be less efficient than manual mode switching if the setpoint range is too wide, as it may run heating and cooling on the same day - a 4°F gap is reasonable, but 6°F+ gaps waste energy",
          "Heat pump behavior: In Auto mode, heat pump will heat when below heat setpoint and cool when above cool setpoint, with aux heat engaging based on outdoor temperature and lockout settings",
          "Compressor lockout still applies: Even in Auto mode, compressor lockout temperature prevents compressor operation below the lockout temperature (e.g., 22°F), and aux heat will engage if available",
          "Best practices: Set heat setpoint 2-3°F below desired temperature and cool setpoint 2-3°F above desired temperature, maintain 3-5°F gap between setpoints for optimal efficiency",
          "Default setting: Auto Heat/Cool is typically DISABLED by default for safety, as it requires proper setpoint configuration to work effectively - you must enable it in threshold settings AND select Auto mode",
          "How to enable: First enable 'Auto Heat/Cool' in Installation Settings → Thresholds, then select 'Auto' as your system mode on the main thermostat screen",
          "Comfort settings: Auto mode uses the heat and cool setpoints from your active comfort setting (home, away, sleep) - each comfort setting can have different setpoints",
          "Normal operation: Yes, Auto Heat/Cool is a normal and commonly used feature, especially in moderate climates like Georgia where both heating and cooling are needed throughout the year",
        ],
      },
      compressorLockout: {
        summary: "Compressor lockout temperature prevents compressor operation below a minimum outdoor temperature to protect equipment and ensure efficient operation.",
        keyConcepts: [
          "Compressor lockout definition: Minimum outdoor temperature below which the compressor (AC or heat pump) will not run",
          "Purpose: Prevents compressor damage from low-temperature operation, reduces wear, and avoids inefficient operation",
          "Typical range: 0-20°F for most systems, with 15-35°F being common settings",
          "Heat pump cooling lockout: Typically 60-65°F minimum outdoor temperature to prevent compressor operation when cooling is not needed",
          "Heat pump heating lockout: Typically 0-20°F minimum outdoor temperature to prevent operation when efficiency is too low",
          "AC lockout: Typically 60-65°F minimum outdoor temperature, prevents AC operation when outdoor temp is below indoor setpoint",
          "Safety consideration: Below 0°F, compressor oil becomes too viscous, refrigerant pressure issues, and risk of liquid slugging",
          "Efficiency consideration: Below 20-30°F, heat pump COP drops below 2.0, making electric resistance heat more efficient",
          "Balance point relationship: Compressor lockout should be set below the system's balance point to allow heat pump operation when it's efficient",
          "Aux heat requirement: When compressor is locked out, auxiliary heat (electric strips or gas) must be available to maintain comfort",
          "Manufacturer recommendations: Check equipment manual for specific lockout temperature recommendations (varies by model and refrigerant type)",
          "Climate-dependent: Colder climates may use 0-10°F, moderate climates use 15-25°F, warmer climates may not need lockout",
          "Default safe setting: 35°F is a conservative default that protects equipment but may reduce efficiency in moderate climates",
          "Optimal setting: Set lockout 5-10°F below balance point to maximize heat pump efficiency while protecting equipment",
          "Too high lockout: Setting above 40°F wastes heat pump efficiency and forces unnecessary aux heat usage",
          "Too low lockout: Setting below 0°F risks compressor damage and may not provide adequate heating capacity",
          "System type differences: Standard heat pumps typically 0-20°F, cold-climate heat pumps may operate down to -15°F or lower",
          "Refrigerant type: R-410A systems typically lockout at 0-15°F, newer R-32 systems may operate to lower temperatures",
        ],
      },
      shortCycling: {
        summary:
          "Short cycling is excessive on/off cycling that damages equipment and reduces efficiency. Why it happens: System reaches setpoint too quickly, then shuts off before properly conditioning the space.",
        keyConcepts: [
          "NEMA MG-1 standard: Short cycling defined as >3 cycles per hour with <5 minutes runtime per cycle",
          "Primary Causes: 1) Oversized equipment (>20% above calculated load) - most common cause, 2) Incorrect differential settings (too tight temperature band), 3) Poor load matching (equipment capacity much higher than actual heat loss/gain), 4) Low airflow (dirty filters, blocked ducts), 5) Thermostat placement (near vents, sunlight, or heat sources)",
          "Why oversized equipment causes it: System produces too much cooling/heating too quickly, satisfies thermostat in 2-5 minutes, shuts off before dehumidifying or properly circulating air, then restarts when temperature drifts slightly",
          "Why tight differentials cause it: Thermostat activates on tiny temperature swings (0.5-1°F), system can't run long enough to stabilize before hitting setpoint again",
          "Why low airflow causes it: Reduced airflow makes system think it's working harder than it is, compressor cycles on/off rapidly trying to maintain temperature",
          "Symptoms you'll notice: System turns on/off frequently (every 5-10 minutes), high energy bills despite frequent operation, poor humidity control (especially in summer), temperature swings, unusual noises from frequent starts",
          "Effects: 10-15% efficiency loss from startup energy waste, increased wear on compressor (most vulnerable component), reduced equipment lifespan (50% reduction in compressor life), poor dehumidification in cooling mode, higher electricity bills",
          "Detection: Monitor runtime logs - if >3 cycles/hour with <5 min runtime, system is short cycling. Check thermostat history for frequent on/off patterns",
          "Solutions: 1) Verify proper sizing using Manual J/S calculations - equipment should be 100-115% of calculated load (max 120%), 2) Adjust differential settings - widen deadband to 2-3°F, 3) Check airflow - replace filters, inspect ducts for blockages, verify blower speed, 4) Consider multi-stage equipment - first stage handles 60-70% of load for better load matching, 5) Verify thermostat placement - away from vents, sunlight, and heat sources",
          "Minimum runtime: Compressor should run at least 5-10 minutes per cycle for efficiency and proper dehumidification. Systems that regularly run less than 5 minutes are short cycling",
          "Prevention: Always perform Manual J load calculation before selecting equipment, avoid 'bigger is better' mentality, verify airflow during installation, use proper thermostat differential settings (2-3°F minimum)",
        ],
        standards: {
          nemaMG1:
            "NEMA MG-1: Standard for motors and generators - defines acceptable cycling rates for HVAC equipment. More than 3 cycles per hour with less than 5 minutes runtime per cycle indicates short cycling",
        },
      },
      heatDissipation: {
        summary:
          "Heat dissipation time allows scavenging residual heat from the heat exchanger after compressor shutdown.",
        keyConcepts: [
          "Free heat concept: After compressor shuts off, heat exchanger retains residual heat (typically 5-15 minutes)",
          "Heat dissipation time: Delay before allowing compressor to restart, allowing residual heat to transfer indoors",
          "Benefits: Scavenges 'free' heat without running compressor, improves efficiency by 2-5%",
          "Trade-off: Longer dissipation time = more free heat but slower recovery from setbacks",
          "Recommended: 30-60 seconds typical, adjust based on comfort vs efficiency priorities",
          "Too short: Wastes residual heat, reduces efficiency",
          "Too long: Slower recovery, may need aux heat for large setbacks",
          "Calculation: Based on heat exchanger thermal mass and heat loss rate",
        ],
      },
      economicBalancePoint: {
        summary:
          "Economic balance point determines when heat pump is cheaper to run than gas furnace based on utility rates.",
        keyConcepts: [
          "Economic balance point: Outdoor temperature where heat pump cost = gas furnace cost",
          "Formula: Economic BP = (Gas Cost per BTU) / (Electric Cost per BTU × COP)",
          "Gas cost per BTU: (Gas rate $/therm) / 100,000 BTU per therm",
          "Electric cost per BTU: (Electric rate $/kWh) / 3,412 BTU per kWh",
          "COP degradation: COP decreases as outdoor temp drops (typically 3.0 at 47°F, 2.0 at 17°F)",
          "Above economic BP: Heat pump is cheaper, use heat pump",
          "Below economic BP: Gas furnace may be cheaper, but consider comfort and aux heat availability",
          "Example: $0.15/kWh electric, $2.50/therm gas, COP 3.0 → Economic BP ≈ 25°F",
        ],
        formulas: {
          economicBalancePoint:
            "Economic BP = (Gas $/therm / 100,000) / (Electric $/kWh / 3,412 × COP)",
          gasCostPerBTU:
            "Gas Cost/BTU = Gas Rate ($/therm) / 100,000 BTU/therm",
          electricCostPerBTU:
            "Electric Cost/BTU = Electric Rate ($/kWh) / 3,412 BTU/kWh",
        },
      },
      heatCoolMinDelta: {
        summary: "Heat/Cool Min Delta is the minimum temperature gap required between heat and cool setpoints in Auto Heat/Cool mode.",
        keyConcepts: [
          "Heat/Cool Min Delta definition: Minimum temperature difference between heat setpoint and cool setpoint in Auto mode",
          "Purpose: Prevents rapid switching between heating and cooling modes, reducing energy waste and equipment wear",
          "Typical range: 3-5°F is standard, with 5°F being a safe default",
          "Too small: If gap is less than 3°F, system may rapidly switch between heating and cooling, wasting energy",
          "Too large: If gap is more than 10°F, comfort zone becomes too wide and may cause discomfort",
          "Recommended: 3-5°F for most homes, 5°F for homes with variable weather conditions",
          "Example: Heat setpoint 68°F, Cool setpoint 73°F = 5°F delta (good)",
          "Auto mode requirement: Auto Heat/Cool mode requires this minimum gap to function properly",
          "Comfort settings: Each comfort setting (home, away, sleep) can have different setpoints, but delta must be maintained",
        ],
      },
      heatDifferential: {
        summary: "Heat Differential (also called dead band) is the temperature range where the heating system doesn't run.",
        keyConcepts: [
          "Heat Differential definition: Temperature difference between when heat turns on and when it turns off",
          "Purpose: Prevents short cycling by creating a buffer zone around the setpoint",
          "Typical range: 0.5-2.0°F, with 1.0°F being optimal for efficiency",
          "Too small (0.5°F): System cycles frequently, wastes energy, reduces equipment life",
          "Too large (>2°F): Temperature swings become noticeable, comfort issues",
          "Recommended: 1.0-1.5°F for most systems, balances efficiency and comfort",
          "Example: Setpoint 70°F, differential 1.0°F → Heat on at 69°F, off at 71°F",
          "Efficiency benefit: Wider differential reduces short cycling, saves 5-10% on energy",
          "Multi-stage systems: First stage may use tighter differential, second stage uses wider",
        ],
      },
      coolDifferential: {
        summary: "Cool Differential (also called dead band) is the temperature range where the cooling system doesn't run.",
        keyConcepts: [
          "Cool Differential definition: Temperature difference between when cooling turns on and when it turns off",
          "Purpose: Prevents short cycling and allows proper dehumidification",
          "Typical range: 0.5-2.0°F, with 1.0°F being optimal for efficiency",
          "Too small (0.5°F): System cycles frequently, poor dehumidification, wastes energy",
          "Too large (>2°F): Temperature swings become noticeable, comfort issues",
          "Recommended: 1.0-1.5°F for most systems, balances efficiency and comfort",
          "Example: Setpoint 74°F, differential 1.0°F → Cool on at 75°F, off at 73°F",
          "Dehumidification: Wider differential allows longer run times, better humidity removal",
          "Multi-stage systems: First stage may use tighter differential, second stage uses wider",
        ],
      },
      minOnTime: {
        summary: "Minimum On Time settings prevent short cycling by requiring equipment to run for a minimum duration once started.",
        keyConcepts: [
          "Min On Time definition: Minimum duration equipment must run once it starts, before it can turn off",
          "Purpose: Prevents short cycling, protects equipment, improves efficiency and dehumidification",
          "Heat Min On Time: Typically 3-10 minutes (180-600 seconds) for furnaces and heat pumps",
          "Cool Min On Time: Typically 3-10 minutes (180-600 seconds) for air conditioners",
          "Compressor Min On Time: Typically 5-10 minutes (300-600 seconds) for compressors",
          "Aux Heat Min On Time: Typically 3-5 minutes (180-300 seconds) for auxiliary heat",
          "Too short: Equipment cycles too frequently, wastes energy, damages equipment",
          "Too long: System may run unnecessarily after reaching setpoint, wastes energy",
          "Recommended: 5 minutes (300 seconds) is a safe default for most systems",
          "Short cycling prevention: Ensures system runs long enough to properly condition space",
          "Dehumidification: Longer min on time improves humidity removal in cooling mode",
        ],
      },
      minCycleOffTime: {
        summary: "Minimum Cycle Off Time (also called Compressor Min Cycle Off) prevents equipment from restarting too quickly after shutdown.",
        keyConcepts: [
          "Min Cycle Off Time definition: Minimum duration equipment must stay off between cycles",
          "Purpose: Protects compressor from rapid cycling, allows pressure equalization, improves efficiency",
          "Compressor Min Cycle Off: Typically 3-10 minutes (180-600 seconds), 5 minutes (300 seconds) is standard",
          "Too short: Compressor restarts before pressure equalizes, risks damage, wastes energy",
          "Too long: Slower recovery from temperature changes, may need aux heat",
          "Recommended: 5 minutes (300 seconds) is a safe default for most compressors",
          "Pressure equalization: Allows refrigerant pressures to stabilize before restart",
          "Equipment protection: Prevents compressor damage from rapid cycling",
          "Efficiency: Reduces startup energy waste from frequent cycling",
        ],
      },
      dissipationTime: {
        summary: "Dissipation Time allows the fan to continue running after heating or cooling stops to circulate remaining conditioned air.",
        keyConcepts: [
          "Dissipation Time definition: Fan runtime after heating or cooling cycle ends",
          "Purpose: Circulates remaining conditioned air from ducts, improves efficiency and comfort",
          "Heat Dissipation Time: Typically 30-60 seconds, allows residual heat to be distributed",
          "Cool Dissipation Time: Typically 30-60 seconds, allows residual cool air to be distributed",
          "Benefits: Scavenges 'free' conditioned air from ducts, improves efficiency by 2-5%",
          "Too short: Wastes residual conditioned air, reduces efficiency",
          "Too long: Fan runs unnecessarily, wastes energy",
          "Recommended: 30-60 seconds for most systems, adjust based on duct length",
          "Efficiency gain: Distributes residual air without running compressor, saves energy",
        ],
      },
      auxHeatMaxOutdoorTemp: {
        summary: "Aux Heat Max Outdoor Temperature prevents auxiliary heat from running above a specific outdoor temperature to maximize heat pump efficiency.",
        keyConcepts: [
          "Aux Heat Max Outdoor Temp definition: Maximum outdoor temperature above which auxiliary heat will not run",
          "Purpose: Forces heat pump operation when it's efficient, prevents unnecessary aux heat usage",
          "Typical range: 30-50°F, with 35-40°F being optimal for most systems",
          "Too high (>50°F): Allows aux heat when heat pump is very efficient, wastes energy",
          "Too low (<30°F): May prevent aux heat when needed for recovery or comfort",
          "Recommended: 30-40°F for most heat pumps, balances efficiency and comfort",
          "Efficiency benefit: Maximizes heat pump usage when COP is high (above 2.5-3.0)",
          "Heat pump priority: Ensures heat pump is used when it can handle the load efficiently",
          "Recovery: System may still use aux heat below this temperature for faster recovery from setbacks",
        ],
      },
      acOvercoolMax: {
        summary: "AC Overcool Max allows the air conditioner to run past the cool setpoint to reduce humidity.",
        keyConcepts: [
          "AC Overcool Max definition: Maximum temperature below cool setpoint that AC can overcool for dehumidification",
          "Purpose: Improves humidity control by allowing AC to run longer for better dehumidification",
          "Typical range: 0-5°F, with 2°F being a common setting",
          "How it works: AC continues running up to X°F below setpoint to remove more moisture",
          "Benefits: Better humidity control, improved comfort in humid climates",
          "Trade-off: Slightly lower temperature than setpoint, but better humidity control",
          "Recommended: 1-2°F for most systems, 2°F for very humid climates",
          "Energy impact: Slight increase in cooling energy, but significant improvement in comfort",
          "Dehumidification: Longer runtime allows more moisture removal from air",
        ],
      },
      temperatureCorrection: {
        summary: "Temperature Correction adjusts the temperature sensor reading for calibration accuracy.",
        keyConcepts: [
          "Temperature Correction definition: Offset applied to temperature sensor reading (+/- 5°F typically)",
          "Purpose: Calibrates sensor if it consistently reads high or low compared to actual temperature",
          "Range: Typically -5°F to +5°F, some systems allow up to +/- 10°F",
          "When to use: Only if sensor consistently reads the same amount off (e.g., always 2°F high)",
          "When NOT to use: If temperature difference varies, sensor may be faulty and should be replaced",
          "Calibration: Use accurate thermometer to compare, adjust correction to match",
          "Example: Sensor reads 72°F but actual is 70°F → Set correction to -2°F",
          "Warning: Only adjust if difference is consistent, varying differences indicate sensor problems",
        ],
      },
      humidityCorrection: {
        summary: "Humidity Correction adjusts the humidity sensor reading for calibration accuracy.",
        keyConcepts: [
          "Humidity Correction definition: Offset applied to humidity sensor reading (+/- 10% typically)",
          "Purpose: Calibrates sensor if it consistently reads high or low compared to actual humidity",
          "Range: Typically -10% to +10% relative humidity",
          "When to use: Only if sensor consistently reads the same amount off (e.g., always 5% high)",
          "When NOT to use: If humidity difference varies, sensor may be faulty and should be replaced",
          "Calibration: Use accurate hygrometer to compare, adjust correction to match",
          "Example: Sensor reads 55% but actual is 50% → Set correction to -5%",
          "Warning: Only adjust if difference is consistent, varying differences indicate sensor problems",
        ],
      },
      thermalProtect: {
        summary: "Thermal Protect ignores temperature readings from sensors that differ significantly from the main sensor.",
        keyConcepts: [
          "Thermal Protect definition: Maximum temperature difference between sensors before ignoring a reading",
          "Purpose: Prevents bad sensor readings from affecting system operation",
          "Typical range: 5-20°F, with 10°F being a common default",
          "How it works: If a remote sensor reads more than X°F different from main sensor, it's ignored",
          "Benefits: Prevents system from responding to faulty sensor readings",
          "Too small (<5°F): May ignore valid sensors in rooms with different temperatures",
          "Too large (>20°F): May allow bad sensors to affect system operation",
          "Recommended: 10°F for most systems, allows for normal room-to-room variation",
          "Sensor accuracy: Helps maintain system operation when sensors have issues",
        ],
      },
      reverseStaging: {
        summary: "Reverse Staging returns equipment to a lower stage near the setpoint for more efficient operation.",
        keyConcepts: [
          "Reverse Staging definition: Automatically reduces to lower stage as temperature approaches setpoint",
          "Purpose: Improves efficiency by using lower stage for fine-tuning near setpoint",
          "Compressor Reverse Staging: Returns to first stage near setpoint, more efficient than second stage",
          "Heat Reverse Staging: Returns to first stage of furnace near setpoint",
          "Aux Reverse Staging: Disengages aux heat near end of cycle to rely on heat pump",
          "Benefits: More efficient operation, better comfort control, reduced energy use",
          "How it works: System starts with higher stage for faster recovery, switches to lower stage near setpoint",
          "Recommended: Enable for most multi-stage systems to maximize efficiency",
          "Efficiency gain: Lower stages are more efficient for maintaining temperature vs. recovering",
        ],
      },
      staging: {
        summary: "Staging controls how multi-stage equipment operates, either automatically or manually configured.",
        keyConcepts: [
          "Automatic Staging: Thermostat uses algorithms to determine when to use each stage",
          "Manual Staging: User configures specific thresholds for stage activation",
          "Automatic benefits: Smart algorithms optimize for comfort and efficiency",
          "Manual benefits: Fine-grained control over when stages activate",
          "Aux Savings Optimization: In automatic mode with heat pumps, prioritizes savings, comfort, or balanced",
          "Stage 2 Temperature Delta: Temperature difference that triggers second stage activation",
          "Stage 1 Max Runtime: Maximum time first stage can run before second stage activates",
          "Multi-stage systems: Two or more stages allow better load matching and efficiency",
          "Recommended: Start with automatic staging, switch to manual only if needed for specific requirements",
        ],
      },
    },
  },

  // Generic System Metadata & Specifications
  genericSystemSpecs: {
    title: "Generic Split System Heat Pump Specifications & Installation Data",
    source: "Technical Support Manual - Generic Schema-Based Format",
    topics: {
      systemMetadata: {
        summary:
          "Generic split system heat pump metadata including equipment type, refrigerant, efficiency, and voltage specifications.",
        keyConcepts: [
          "Equipment Type: Split System Heat Pump",
          "Refrigerant: R-410A",
          "Efficiency: Standard Efficiency (13-14 SEER)",
          "Voltage: 208/230V Single Phase",
          "Safety Labeling: DANGER = immediate severe injury/death, WARNING = severe injury/death risk, CAUTION = minor injury/property damage, NOTE = enhancement suggestions",
          "Model Number Nomenclature: Product Family + Refrigerant Type + Unit Type + Efficiency Rating + Nominal Capacity (BTUH) + Feature Set + Voltage + Series/Revision",
          "Nominal Capacity codes: 18 = 1.5 Tons, 24 = 2.0 Tons, 30 = 2.5 Tons, 36 = 3.0 Tons, 42 = 3.5 Tons, 48 = 4.0 Tons, 60 = 5.0 Tons",
        ],
      },
      r410aHandling: {
        summary:
          "R-410A refrigerant handling requirements including pressure, charging, and component specifications.",
        keyConcepts: [
          "Pressure: R-410A operates at 50-70% higher pressures than R-22",
          "Tank Color: Rose",
          "Tank Rating: DOT 4BA400 or DOT BW400 (400 psig)",
          "Charging State: Charge with Liquid refrigerant only",
          "Metering: Use commercial-type metering device when charging into suction line",
          "Gauge Set: High-side 750 psig; Low-side 200 psig (520 retard). High-pressure hoses required",
          "Lubricant: POE (Polyol Ester) oil only. Hydroscopic (absorbs moisture); limit atmospheric exposure",
          "Filtration: Liquid line filter-drier required (Min 600 psig working pressure)",
          "Evacuation: Pull vacuum to 500 microns. Break with dry nitrogen",
          "Components: R-410A specific TXV required (Indoor)",
        ],
      },
      electricalInstallation: {
        summary:
          "Standard electrical and installation requirements for split system heat pumps.",
        keyConcepts: [
          "Thermal Protection: Compressor and fan motor equipped with inherent protection",
          "Codes: Install per N.E.C. and local codes",
          "Control Circuit: Class 2, 24V circuit. Minimum 40 VA (60 VA with accessories)",
          "Wiring: Copper conductors only (Min 75°C rating)",
          "Grounding: Grounded secondary transformers must connect to board Common ('C')",
          "Hard Start Kits: Start thermistor (PTC) must be removed if Start Capacitor/Relay are installed",
          "Anti-Short Cycle: Compressor requires 3-minute off time to equalize pressures",
          "Service Valves: Must be open before operation",
        ],
      },
      r410aChargingChart: {
        summary:
          "R-410A charging chart showing required liquid line temperature based on pressure and target subcooling.",
        keyConcepts: [
          "Charging Method: Subcooling method for R-410A systems",
          "Subcooling Targets: 6°F, 8°F, 10°F, 12°F, 14°F, 16°F",
          "Liquid Pressure Range: 251-474 psig",
          "Temperature Range: 68-124°F liquid line temperature",
          "Example: At 326 psig, target 10°F subcooling requires 92°F liquid line temperature",
          "Higher pressure = higher liquid line temperature required",
          "Higher subcooling target = lower liquid line temperature required",
        ],
        formulas: {
          chargingChart:
            "Liquid Line Temp = f(Liquid Pressure, Target Subcooling) - see charging chart table",
        },
        chargingChartData: {
          "251": { "6": 78, "8": 76, "10": 74, "12": 72, "14": 70, "16": 68 },
          "274": { "6": 84, "8": 82, "10": 80, "12": 78, "14": 76, "16": 74 },
          "299": { "6": 90, "8": 88, "10": 86, "12": 84, "14": 82, "16": 80 },
          "326": { "6": 96, "8": 94, "10": 92, "12": 90, "14": 88, "16": 86 },
          "364": { "6": 104, "8": 102, "10": 100, "12": 98, "14": 96, "16": 94 },
          "406": { "6": 112, "8": 110, "10": 108, "12": 106, "14": 104, "16": 102 },
          "450": { "6": 120, "8": 118, "10": 116, "12": 114, "14": 112, "16": 110 },
          "474": { "6": 124, "8": 122, "10": 120, "12": 118, "14": 116, "16": 114 },
        },
      },
      componentSpecsByTonnage: {
        summary:
          "Component specifications grouped by unit capacity (tonnage) for replacement parts.",
        keyConcepts: [
          "1.5 Ton: Compressor (Scroll, R-410A, 1.5T), Condenser Motor (1/12 HP, 1100 RPM, 208-230V), Capacitor (370V 5+30 MFD), Metering Device (Piston .040 Chatleff)",
          "2.0 Ton: Compressor (Scroll, R-410A, 2.0T), Condenser Motor (1/10 HP, 1100 RPM, 208-230V), Capacitor (370V 5+40 MFD), Metering Device (Piston .046 Chatleff)",
          "2.5 Ton: Compressor (Scroll, R-410A, 2.5T), Condenser Motor (1/5 HP, 810 RPM, 208-230V), Capacitor (370V 5+45 MFD), Metering Device (Piston .055)",
          "3.0 Ton: Compressor (Scroll, R-410A, 3.0T), Condenser Motor (1/5 HP, 810 RPM, 208-230V), Capacitor (370V 5+45 MFD), Metering Device (Piston .057 Chatleff)",
          "3.5 Ton: Compressor (Scroll, R-410A, 3.5T), Condenser Motor (1/10 HP, 208-230V), Capacitor (370V 5+45 MFD), Metering Device (Piston .065 Chatleff)",
          "4.0 Ton: Compressor (Scroll, R-410A, 4.0T), Condenser Motor (1/4 HP, 825 RPM, 208-230V), Capacitor (370V 7.5+70 MFD), Metering Device (Piston .065 Chatleff)",
          "5.0 Ton: Compressor (Scroll, R-410A, 5.0T), Condenser Motor (1/4 HP, 825 RPM, 208-230V), Capacitor (370V 7.5+70 Series A or 7.5+80 Series G), Metering Device (Piston .076 Chatleff)",
          "Universal Parts (All Sizes): Contactor (1P 30A 24V, except 5.0 Ton uses 40A), Defrost Control Board, Defrost Sensor, High Pressure Switch, Low Pressure Switch, Reversing Valve Coil (24V)",
        ],
      },
      performanceData: {
        summary:
          "Cooling performance metrics at reference conditions (95°F Outdoor Ambient / 63°F Indoor Wet Bulb).",
        keyConcepts: [
          "1.5 Ton: Total Capacity 17.63 MBh, S/T Ratio 0.74, System Amps 6.01, High Pressure 314 psig, Low Pressure 134 psig",
          "2.0 Ton: Total Capacity 21.98 MBh, S/T Ratio 0.74, System Amps 7.89, High Pressure 323 psig, Low Pressure 131 psig",
          "2.5 Ton: Total Capacity 28.70 MBh, S/T Ratio 0.74, System Amps 10.45, High Pressure 321 psig, Low Pressure 131 psig",
          "3.0 Ton: Total Capacity 32.69 MBh, S/T Ratio 0.75, System Amps 11.81, High Pressure 321 psig, Low Pressure 126 psig",
          "3.5 Ton: Total Capacity 39.39 MBh, S/T Ratio 0.73, System Amps 14.29, High Pressure 340 psig, Low Pressure 132 psig",
          "4.0 Ton: Total Capacity 45.07 MBh, S/T Ratio 0.73, System Amps 16.27, High Pressure 322 psig, Low Pressure 133 psig",
          "5.0 Ton: Total Capacity 57.68 MBh, S/T Ratio 0.72, System Amps 21.17, High Pressure 331 psig, Low Pressure 133 psig",
          "S/T Ratio: Sensible/Total ratio indicates temperature cooling vs humidity removal (0.72-0.75 typical)",
        ],
        performanceTable: {
          "1.5": {
            totalCapacity: 17.63,
            stRatio: 0.74,
            systemAmps: 6.01,
            highPressure: 314,
            lowPressure: 134,
          },
          "2.0": {
            totalCapacity: 21.98,
            stRatio: 0.74,
            systemAmps: 7.89,
            highPressure: 323,
            lowPressure: 131,
          },
          "2.5": {
            totalCapacity: 28.70,
            stRatio: 0.74,
            systemAmps: 10.45,
            highPressure: 321,
            lowPressure: 131,
          },
          "3.0": {
            totalCapacity: 32.69,
            stRatio: 0.75,
            systemAmps: 11.81,
            highPressure: 321,
            lowPressure: 126,
          },
          "3.5": {
            totalCapacity: 39.39,
            stRatio: 0.73,
            systemAmps: 14.29,
            highPressure: 340,
            lowPressure: 132,
          },
          "4.0": {
            totalCapacity: 45.07,
            stRatio: 0.73,
            systemAmps: 16.27,
            highPressure: 322,
            lowPressure: 133,
          },
          "5.0": {
            totalCapacity: 57.68,
            stRatio: 0.72,
            systemAmps: 21.17,
            highPressure: 331,
            lowPressure: 133,
          },
        },
      },
      systemMultiplyingFactors: {
        summary:
          "Adjustment multipliers for Capacity and Amperage when matching outdoor unit with various indoor coils or furnaces.",
        keyConcepts: [
          "Base: 1.0 = Standard matched AHRI system",
          "Usage: Multiply base rating by the factor shown to get system specific performance",
          "1.5 Ton Factors: Standard Match (1.00 all), High Efficiency Coil A (1.00 all), Standard Coil B (0.94/1.00/0.98/0.98), Standard Coil C (0.92/0.98/0.99/0.99), Multi-Pos Coil D (0.96/1.00/0.98/0.98), ECM Motor Furnace Match (0.94/1.03/0.93/0.99)",
          "2.0 Ton Factors: Standard Match (1.00 all), Coil Match A (1.02/1.01/0.98/0.98), Coil Match B (1.01/1.01/0.98/0.98), Variable Speed Indoor (0.96/1.01/0.93/0.98), Standard Furnace Match (0.98/1.03/0.93/0.99)",
          "2.5 Ton Factors: Standard Match (1.00 all), Coil Match A (1.00/1.00/1.02/1.00), Coil Match B (0.98/1.00/1.01/0.99), Coil Match C (1.00/1.00/1.01/0.99), Variable Speed Indoor (1.00/1.00/0.93/0.98)",
          "3.0 Ton Factors: Standard Match (1.00 all), Coil Match A (1.01/1.01/1.01/1.04), Coil Match B (1.02/1.01/1.00/0.99), Coil Match C (1.03/1.01/1.02/1.01), Variable Speed Indoor (0.96/1.00/0.94/0.99)",
          "3.5 Ton Factors: Standard Match (1.00 all), Coil Match A (0.99/1.00/0.99/1.00), Coil Match B (0.99/1.00/0.97/0.98), Coil Match C (0.99/1.00/0.99/0.98), Variable Speed Indoor (0.96/1.00/0.95/0.99)",
          "4.0 Ton Factors: Standard Match (1.00 all), Coil Match A (0.98/1.00/0.98/0.99), Coil Match B (0.98/1.00/0.99/0.99), Coil Match C (0.98/1.00/0.99/0.99), Variable Speed Indoor (0.96/1.00/0.95/0.99)",
          "5.0 Ton Factors: Standard Match (1.00 all), Coil Match A (0.97/0.99/0.98/0.99), Coil Match B (0.97/0.99/0.98/0.99), Variable Speed Indoor (0.97/0.99/1.01/0.99)",
          "Factor Order: Cooling Amps / Cooling Capacity / Heating Amps / Heating Capacity",
          "Variable Speed Indoor: Typically reduces amperage (0.93-0.97) but maintains or slightly increases capacity (0.98-1.01)",
        ],
        multiplyingFactors: {
          "1.5": {
            standardMatch: { coolingAmps: 1.0, coolingCapacity: 1.0, heatingAmps: 1.0, heatingCapacity: 1.0 },
            highEfficiencyCoilA: { coolingAmps: 1.0, coolingCapacity: 1.0, heatingAmps: 1.0, heatingCapacity: 1.0 },
            standardCoilB: { coolingAmps: 0.94, coolingCapacity: 1.0, heatingAmps: 0.98, heatingCapacity: 0.98 },
            standardCoilC: { coolingAmps: 0.92, coolingCapacity: 0.98, heatingAmps: 0.99, heatingCapacity: 0.99 },
            multiPosCoilD: { coolingAmps: 0.96, coolingCapacity: 1.0, heatingAmps: 0.98, heatingCapacity: 0.98 },
            ecmMotorFurnace: { coolingAmps: 0.94, coolingCapacity: 1.03, heatingAmps: 0.93, heatingCapacity: 0.99 },
          },
          "2.0": {
            standardMatch: { coolingAmps: 1.0, coolingCapacity: 1.0, heatingAmps: 1.0, heatingCapacity: 1.0 },
            coilMatchA: { coolingAmps: 1.02, coolingCapacity: 1.01, heatingAmps: 0.98, heatingCapacity: 0.98 },
            coilMatchB: { coolingAmps: 1.01, coolingCapacity: 1.01, heatingAmps: 0.98, heatingCapacity: 0.98 },
            variableSpeedIndoor: { coolingAmps: 0.96, coolingCapacity: 1.01, heatingAmps: 0.93, heatingCapacity: 0.98 },
            standardFurnaceMatch: { coolingAmps: 0.98, coolingCapacity: 1.03, heatingAmps: 0.93, heatingCapacity: 0.99 },
          },
          "2.5": {
            standardMatch: { coolingAmps: 1.0, coolingCapacity: 1.0, heatingAmps: 1.0, heatingCapacity: 1.0 },
            coilMatchA: { coolingAmps: 1.0, coolingCapacity: 1.0, heatingAmps: 1.02, heatingCapacity: 1.0 },
            coilMatchB: { coolingAmps: 0.98, coolingCapacity: 1.0, heatingAmps: 1.01, heatingCapacity: 0.99 },
            coilMatchC: { coolingAmps: 1.0, coolingCapacity: 1.0, heatingAmps: 1.01, heatingCapacity: 0.99 },
            variableSpeedIndoor: { coolingAmps: 1.0, coolingCapacity: 1.0, heatingAmps: 0.93, heatingCapacity: 0.98 },
          },
          "3.0": {
            standardMatch: { coolingAmps: 1.0, coolingCapacity: 1.0, heatingAmps: 1.0, heatingCapacity: 1.0 },
            coilMatchA: { coolingAmps: 1.01, coolingCapacity: 1.01, heatingAmps: 1.01, heatingCapacity: 1.04 },
            coilMatchB: { coolingAmps: 1.02, coolingCapacity: 1.01, heatingAmps: 1.0, heatingCapacity: 0.99 },
            coilMatchC: { coolingAmps: 1.03, coolingCapacity: 1.01, heatingAmps: 1.02, heatingCapacity: 1.01 },
            variableSpeedIndoor: { coolingAmps: 0.96, coolingCapacity: 1.0, heatingAmps: 0.94, heatingCapacity: 0.99 },
          },
          "3.5": {
            standardMatch: { coolingAmps: 1.0, coolingCapacity: 1.0, heatingAmps: 1.0, heatingCapacity: 1.0 },
            coilMatchA: { coolingAmps: 0.99, coolingCapacity: 1.0, heatingAmps: 0.99, heatingCapacity: 1.0 },
            coilMatchB: { coolingAmps: 0.99, coolingCapacity: 1.0, heatingAmps: 0.97, heatingCapacity: 0.98 },
            coilMatchC: { coolingAmps: 0.99, coolingCapacity: 1.0, heatingAmps: 0.99, heatingCapacity: 0.98 },
            variableSpeedIndoor: { coolingAmps: 0.96, coolingCapacity: 1.0, heatingAmps: 0.95, heatingCapacity: 0.99 },
          },
          "4.0": {
            standardMatch: { coolingAmps: 1.0, coolingCapacity: 1.0, heatingAmps: 1.0, heatingCapacity: 1.0 },
            coilMatchA: { coolingAmps: 0.98, coolingCapacity: 1.0, heatingAmps: 0.98, heatingCapacity: 0.99 },
            coilMatchB: { coolingAmps: 0.98, coolingCapacity: 1.0, heatingAmps: 0.99, heatingCapacity: 0.99 },
            coilMatchC: { coolingAmps: 0.98, coolingCapacity: 1.0, heatingAmps: 0.99, heatingCapacity: 0.99 },
            variableSpeedIndoor: { coolingAmps: 0.96, coolingCapacity: 1.0, heatingAmps: 0.95, heatingCapacity: 0.99 },
          },
          "5.0": {
            standardMatch: { coolingAmps: 1.0, coolingCapacity: 1.0, heatingAmps: 1.0, heatingCapacity: 1.0 },
            coilMatchA: { coolingAmps: 0.97, coolingCapacity: 0.99, heatingAmps: 0.98, heatingCapacity: 0.99 },
            coilMatchB: { coolingAmps: 0.97, coolingCapacity: 0.99, heatingAmps: 0.98, heatingCapacity: 0.99 },
            variableSpeedIndoor: { coolingAmps: 0.97, coolingCapacity: 0.99, heatingAmps: 1.01, heatingCapacity: 0.99 },
          },
        },
      },
    },
  },

  // Ecobee Wiring and Installation
  ecobeeWiring: {
    title: "Ecobee Thermostat Wiring",
    source: "Ecobee Installation Guide, HVAC Industry Standards",
    topics: {
      basicWiring: {
        summary: "Standard Ecobee wiring terminals and connections.",
        keyConcepts: [
          "R terminal: 24VAC power (Red wire) - Required for all systems",
          "C terminal: 24VAC common (Blue/Black wire) - Required for Ecobee (provides power return)",
          "G terminal: Fan control (Green wire) - Controls fan independently",
          "Y terminal: Cooling (Yellow wire) - Activates air conditioner compressor",
          "W terminal: Heating (White wire) - Activates furnace/heat pump aux heat",
          "O terminal: Reversing valve (Orange wire) - Most heat pumps (energized on cool)",
          "B terminal: Reversing valve (Brown wire) - Some brands like Rheem/Ruud (energized on heat)",
          "W1/W2: Multi-stage heating terminals",
          "Y1/Y2: Multi-stage cooling terminals",
          "ACC+/ACC-: Accessory terminals for humidifier, dehumidifier, ventilators",
        ],
      },
      heatPumpWiring: {
        summary: "Heat pump specific wiring configurations.",
        keyConcepts: [
          "Heat pumps require O or B terminal for reversing valve",
          "O terminal (Orange): Energized when cooling - used by most brands (Carrier, Trane, Lennox, etc.)",
          "B terminal (Brown): Energized when heating - used by Rheem, Ruud, some older systems",
          "W1 terminal: Auxiliary/emergency heat - activates when heat pump can't keep up",
          "Y1 terminal: Compressor contactor - controls heat pump compressor",
          "Most systems: R, C, O, Y1, W1, G for standard heat pump with aux heat",
          "Check equipment manual to determine O vs B terminal requirement",
        ],
      },
      conventionalWiring: {
        summary: "Conventional heating and cooling system wiring.",
        keyConcepts: [
          "Standard system: R, C, Y (cooling), W (heating), G (fan)",
          "Two-stage systems: Y1/Y2 for cooling stages, W1/W2 for heating stages",
          "Heat only: R, C, W, G",
          "Cool only: R, C, Y, G",
          "Fan control: G terminal allows independent fan operation",
        ],
      },
      accessories: {
        summary: "Wiring for humidifiers, dehumidifiers, and other accessories.",
        keyConcepts: [
          "ACC+ and ACC- terminals provide 24VAC power for accessories",
          "Humidifier: Connects to ACC+ and ACC- terminals",
          "Dehumidifier: May use ACC terminals or dedicated DEHUM terminal",
          "Ventilator: Can use ACC terminals for control",
          "Accessories activate based on Ecobee settings and conditions",
        ],
      },
      installation: {
        summary: "Installation safety and best practices.",
        keyConcepts: [
          "ALWAYS turn off power at breaker before wiring",
          "Take photo of existing wiring before disconnecting",
          "Use 18-22 AWG thermostat wire",
          "Verify wire colors match equipment terminals",
          "C wire (common) is required for Ecobee - provides power return path",
          "If no C wire: May need to use PEK (Power Extender Kit) or install new wire",
          "Test all connections before restoring power",
          "Verify equipment operation after installation",
        ],
      },
    },
  },
};

/**
 * Search the knowledge base for relevant information
 * @param {string} query - Search query
 * @param {boolean} includeUserKnowledge - Whether to include user-added knowledge (default: true)
 * @returns {Array} Array of relevant knowledge snippets
 */
export async function searchKnowledgeBase(query, includeUserKnowledge = true) {
  const lowerQuery = query.toLowerCase();
  const results = [];

  // Extract keywords from query
  const keywords = lowerQuery
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .map((word) => word.replace(/[^\w]/g, ""));

  // Check for model-specific queries (e.g., "Carrier Infinity 19VS", "model XYZ")
  const modelMatch = lowerQuery.match(
    /(?:model|unit)\s+([a-z0-9-]+)|([a-z]+)\s+([a-z0-9-]+)/i
  );

  // Single brand/manufacturer regex (reused everywhere)
  const brandMatch = lowerQuery.match(
    /(carrier|trane|lennox|daikin|mitsubishi|fujitsu|lg|samsung|bosch|gree|midea|rheem|ruud|york|goodman|amana|bryant|american\s+standard|nordyne|payne|heil|tempstar|comfortmaker|arcoaire|keeprite)/i
  );

  // Check for fault code queries (e.g., "E5", "5 flashes", "fault code E1")
  const faultCodeMatch = lowerQuery.match(
    /(?:fault\s+code|error\s+code|code)\s*([a-z0-9]+|[\d]+\s+flashes?)/i
  );

  // Search equipment specifications ONLY if explicitly asking about a specific model
  // Require explicit model query (not just brand mention) to prevent hallucination
  const isExplicitModelQuery = modelMatch || (
    brandMatch && (
      lowerQuery.includes("model") || 
      lowerQuery.includes("spec") || 
      lowerQuery.includes("rating") ||
      lowerQuery.includes("seer") ||
      lowerQuery.includes("hspf") ||
      lowerQuery.includes("cop") ||
      lowerQuery.includes("capacity") ||
      /[a-z0-9-]{6,}/i.test(lowerQuery) // Model number pattern (6+ alphanumeric/dash)
    )
  );
  
  if (isExplicitModelQuery) {
    const equipmentSpecs = HVAC_KNOWLEDGE_BASE.equipmentSpecs;
    if (equipmentSpecs?.exampleModels) {
      for (const [, modelData] of Object.entries(
        equipmentSpecs.exampleModels
      )) {
        const modelName =
          `${modelData.manufacturer} ${modelData.model}`.toLowerCase();
        
        // Improved token-based model matching
        const normalizedName = modelName.replace(/\s+/g, " ").trim();
        const normalizedQuery = lowerQuery.replace(/\s+/g, " ").trim();
        const allQueryTokens = normalizedQuery.split(/\s+/).filter(t => t.length > 1);
        const modelTokens = normalizedName.split(/\s+/).filter(t => t.length > 1);
        
        // Count matching tokens (fuzzy: token contains or is contained)
        const tokenMatchScore = allQueryTokens.filter(queryToken =>
          modelTokens.some(modelToken => 
            modelToken.includes(queryToken) || queryToken.includes(modelToken)
          )
        ).length;
        
        // Match if: exact string match, or 2+ tokens match, or brand + model query
        const isMatch = 
          normalizedName.includes(normalizedQuery) ||
          normalizedQuery.includes(normalizedName) ||
          tokenMatchScore >= 2 ||
          (brandMatch && modelMatch); // Require BOTH brand AND model mention
        
        if (isMatch) {
          // Format model specifications with clear disclaimer
          let specText = `EXAMPLE MODEL SPECIFICATIONS (NOT YOUR SYSTEM):\n`;
          specText += `${modelData.manufacturer} ${modelData.model} (${modelData.type}):\n`;
          if (modelData.seer2) specText += `SEER2: ${modelData.seer2}\n`;
          if (modelData.hspf2) specText += `HSPF2: ${modelData.hspf2}\n`;
          if (modelData.cop) {
            specText += `COP: ${Object.entries(modelData.cop)
              .map(([temp, cop]) => `${temp}: ${cop}`)
              .join(", ")}\n`;
          }
          if (modelData.capacity) {
            specText += `Capacity: ${Object.entries(modelData.capacity)
              .map(([temp, cap]) => `${temp}: ${cap} BTU/hr`)
              .join(", ")}\n`;
          }
          if (modelData.airflow) {
            specText += `Airflow: ${modelData.airflow.min}-${modelData.airflow.max} CFM\n`;
          }
          if (modelData.refrigerant) {
            specText += `Refrigerant: ${modelData.refrigerant.type}, Charge: ${modelData.refrigerant.charge} lbs\n`;
          }
          if (modelData.soundLevel) {
            specText += `Sound Level: Low ${modelData.soundLevel.low} dB(A), High ${modelData.soundLevel.high} dB(A)\n`;
          }
          specText += `Source: ${
            modelData.source || "Manufacturer Data Sheet"
          }\n`;
          specText += `\nNOTE: This is an example model for reference only. Use your actual system specs from Settings.`;

          results.push({
            section: "equipmentSpecs",
            topic: "modelSpecifications",
            title: `Example: ${modelData.manufacturer} ${modelData.model} Specifications`,
            source: modelData.source || "Manufacturer Data Sheet",
            summary: specText,
            keyConcepts: [specText],
            relevanceScore: 10, // High relevance for model-specific queries
          });
        }
      }
    }
  }

  // Search fault codes if fault code mentioned
  if (faultCodeMatch) {
    const troubleshooting = HVAC_KNOWLEDGE_BASE.troubleshooting;
    if (troubleshooting?.exampleFaultCodes) {
      // Normalize fault code (remove spaces, lowercase)
      const rawCode = faultCodeMatch[1]?.toLowerCase() || faultCodeMatch[0]?.toLowerCase();
      const normalizedCode = rawCode.replace(/\s+/g, "").replace(/[^\w]/g, "");
      const brand = brandMatch ? brandMatch[1]?.toLowerCase() : null;

      // Search all brands if no specific brand mentioned, or specific brand if mentioned
      const brandsToSearch = brand
        ? [brand]
        : Object.keys(troubleshooting.exampleFaultCodes);

      for (const brandName of brandsToSearch) {
        const brandCodes = troubleshooting.exampleFaultCodes[brandName];
        if (brandCodes) {
          for (const [codeKey, codeData] of Object.entries(brandCodes)) {
            // Normalize stored code key for comparison
            const normalizedKey = codeKey.replace(/\s+/g, "").replace(/[^\w]/g, "").toLowerCase();
            
            // Match if normalized codes overlap
            if (
              normalizedKey.includes(normalizedCode) ||
              normalizedCode.includes(normalizedKey) ||
              normalizedKey === normalizedCode
            ) {
              let faultText = `${
                brandName.charAt(0).toUpperCase() + brandName.slice(1)
              } Fault Code ${codeKey}:\n`;
              faultText += `Meaning: ${codeData.meaning}\n`;
              faultText += `Causes: ${codeData.causes.join(", ")}\n`;
              faultText += `Solution: ${codeData.solution}\n`;
              faultText += `Source: ${codeData.source}`;

              results.push({
                section: "troubleshooting",
                topic: "faultCodes",
                title: `${
                  brandName.charAt(0).toUpperCase() + brandName.slice(1)
                } Fault Code ${codeKey}`,
                source: codeData.source,
                summary: faultText,
                keyConcepts: [faultText],
                relevanceScore: 10, // High relevance for fault code queries
              });
            }
          }
        }
      }
    }
  }

  // Search through all knowledge sections
  for (const [sectionKey, section] of Object.entries(HVAC_KNOWLEDGE_BASE)) {
    // Skip equipmentSpecs.exampleModels (already handled above)
    if (sectionKey === "equipmentSpecs" && section.exampleModels) {
      // Continue to topics
    }

    for (const [topicKey, topic] of Object.entries(section.topics || {})) {
      // Check if query matches section or topic
      const sectionMatch =
        sectionKey.toLowerCase().includes(lowerQuery) ||
        section.title.toLowerCase().includes(lowerQuery);
      // Convert camelCase topicKey to words BEFORE lowercasing (e.g., "shortCycling" -> "short cycling")
      const topicKeyAsWords = topicKey
        .replace(/([A-Z])/g, " $1")
        .trim()
        .toLowerCase();

      const topicMatch =
        topicKey.toLowerCase().includes(lowerQuery) ||
        topic.summary?.toLowerCase().includes(lowerQuery) ||
        lowerQuery.includes(topicKeyAsWords) ||
        topicKeyAsWords.split(/\s+/).every((word) => lowerQuery.includes(word));

      // Check keyword matches in content
      const contentText = JSON.stringify(topic).toLowerCase();
      const keywordMatches = keywords.filter((kw) => contentText.includes(kw));

      // Also check if query contains key terms from camelCase topic keys (e.g., "short cycling" from "shortCycling")
      const topicKeyWords = topicKeyAsWords
        .split(/\s+/)
        .filter((w) => w.length > 2);
      const queryContainsTopicKeyWords =
        topicKeyWords.length > 0 &&
        topicKeyWords.every(
          (word) =>
            lowerQuery.includes(word) ||
            keywords.some((kw) => kw.includes(word) || word.includes(kw))
        );

      if (
        sectionMatch ||
        topicMatch ||
        keywordMatches.length > 0 ||
        queryContainsTopicKeyWords
      ) {
        // Improved relevance scoring: upweight exact topic matches, cap keyword contribution
        const kwScore = Math.min(keywordMatches.length, 5); // Cap at 5
        const exactTopicMatch = queryContainsTopicKeyWords ? 5 : 0; // Upweight from 3 to 5
        
        results.push({
          section: sectionKey,
          topic: topicKey,
          id: `${sectionKey}.${topicKey}`, // ID for future embedding hooks
          title: `${section.title} - ${topicKey}`,
          source: section.source,
          summary: topic.summary,
          keyConcepts: topic.keyConcepts || [],
          formulas: topic.formulas || {},
          recommendations: topic.recommendations || {},
          tags: topicKeyWords, // Tags for future embedding hooks
          relevanceScore:
            (sectionMatch ? 3 : 0) +
            (topicMatch ? 2 : 0) +
            exactTopicMatch +
            kwScore,
        });
      }
    }
  }

  // Include user-added knowledge if enabled
  if (includeUserKnowledge) {
    try {
      const { searchUserKnowledge } = await import("./userKnowledge.js");
      const userResults = searchUserKnowledge(query);
      
      // Add user results with adjusted format
      userResults.forEach((userEntry) => {
        // Content is already a snippet from searchUserKnowledge (max 800 chars)
        const snippet = userEntry.content || "";
        const summary = snippet.length > 300 
          ? snippet.substring(0, 300) + "..." 
          : snippet;
        
        results.push({
          section: "userKnowledge",
          topic: "userAdded",
          title: userEntry.title,
          source: userEntry.source || "User-uploaded document",
          summary: summary,
          snippet: snippet, // Store full snippet for formatting
          relevanceScore: userEntry.relevanceScore,
          isUserAdded: true,
          id: userEntry.id,
        });
      });
    } catch (error) {
      // Silently fail if user knowledge module isn't available
      if (import.meta.env.DEV) {
        console.warn("[RAG] User knowledge search failed:", error);
      }
    }
  }

  // Sort by relevance score (highest first)
  results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

  return results.slice(0, 5); // Return top 5 results
}

/**
 * Format knowledge results for LLM context
 * @param {Array} results - Search results from searchKnowledgeBase
 * @returns {string} Formatted text for LLM
 */
export function formatKnowledgeForLLM(results) {
  if (results.length === 0) {
    return "No relevant HVAC engineering knowledge found.";
  }

  let formatted = "RELEVANT HVAC ENGINEERING KNOWLEDGE:\n\n";

  for (const result of results) {
    // Add section label for structure (e.g., "[ACCA Manual J / heatLoss]")
    const sectionLabel = result.section && result.topic 
      ? `[${result.section} / ${result.topic}]`
      : result.sourceType === "salesFAQ"
      ? `[Sales FAQ]`
      : `[${result.source}]`;
    
    formatted += `${sectionLabel} ${result.title}\n`;
    
    // For sales FAQ, use the answer directly
    if (result.isSalesFAQ && result.summary) {
      formatted += `${result.summary}\n\n`;
    }
    // For user knowledge, use the snippet directly instead of summary
    else if (result.section === "userKnowledge" && result.snippet) {
      formatted += `${result.snippet}\n\n`;
    } else if (result.summary) {
      formatted += `Summary: ${result.summary}\n\n`;
    }

    // Truncate keyConcepts to top 5 to keep context compact (skip for user knowledge)
    if (result.section !== "userKnowledge" && result.keyConcepts && result.keyConcepts.length > 0) {
      const concepts = result.keyConcepts.slice(0, 5);
      formatted += "Key Concepts:\n";
      concepts.forEach((concept, idx) => {
        // Don't include full document content in keyConcepts
        if (typeof concept === "string" && concept.length < 500) {
          formatted += `  ${idx + 1}. ${concept}\n`;
        }
      });
      if (result.keyConcepts.length > 5) {
        formatted += `  ... (${result.keyConcepts.length - 5} more concepts)\n`;
      }
      formatted += "\n";
    }

    if (result.formulas && Object.keys(result.formulas).length > 0) {
      formatted += "Formulas:\n";
      for (const [name, formula] of Object.entries(result.formulas)) {
        formatted += `  • ${name}: ${formula}\n`;
      }
      formatted += "\n";
    }

    if (
      result.recommendations &&
      Object.keys(result.recommendations).length > 0
    ) {
      formatted += "Recommendations:\n";
      for (const [key, value] of Object.entries(result.recommendations)) {
        formatted += `  • ${key}: ${value}\n`;
      }
      formatted += "\n";
    }

    formatted += "---\n\n";
  }

  return formatted;
}
