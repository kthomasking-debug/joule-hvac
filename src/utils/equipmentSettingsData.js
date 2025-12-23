/**
 * Equipment Settings Data
 * Source data for Equipment Settings Guide page
 * 
 * This file contains structured data for:
 * - Equipment types and their configurations
 * - Wiring scenarios and solutions
 * - Model compatibility information
 * - Installation guides
 */

export const EQUIPMENT_SETTINGS_DATA = {
  // Boiler/Radiator Systems
  boiler: {
    name: "Boiler/Radiator",
    description: "Hydronic heating systems with boilers and radiators",
    wiringScenarios: {
      twoWireDryContact: {
        name: "2-Wire Dry Contact",
        description: "Boiler with only 2 wires (switch loop, no voltage)",
        commonModels: [
          "Zeus Superior 24",
          "Most European boilers",
          "Radiant floor heating systems",
        ],
        solutions: {
          separateRcRh: {
            name: "Solution 1: Separate Rc/Rh Terminals",
            description: "Use separate Rc/Rh terminals if Ecobee supports it",
            compatibleModels: [
              "Ecobee3 Lite",
              "Ecobee Enhanced",
              "Ecobee Smart Thermostat Premium",
            ],
            incompatibleModels: [
              "Ecobee Essentials (may not have separate Rc/Rh)",
            ],
            components: [
              "24VAC plug-in transformer (Jameco ReliaPro or similar)",
            ],
            wiring: {
              ecobee: {
                Rc: "Transformer wire 1 (24VAC hot)",
                C: "Transformer wire 2 (24VAC common)",
                Rh: "Boiler wire from terminal 40",
                W1: "Boiler wire from terminal 41",
              },
              boiler: {
                terminal40: "Rh wire (dry contact)",
                terminal41: "W1 wire (dry contact)",
              },
            },
            settings: {
              equipmentType: "Boiler/Radiator",
              heatType: "Conventional",
              cooling: "None",
              fan: "None",
              w1: "Heat Call",
            },
            warnings: [
              "Verify Rc/Rh are NOT bridged internally",
              "Test with voltmeter before connecting boiler",
              "Never send 24VAC to boiler terminals",
            ],
          },
          isolationRelay: {
            name: "Solution 2: Isolation Relay",
            description: "Use relay for isolation (safer, works with all models)",
            compatibleModels: ["All Ecobee models"],
            components: [
              "24VAC plug-in transformer (Jameco ReliaPro or similar)",
              "24VAC coil isolation relay (RIB U1C or similar)",
            ],
            wiring: {
              ecobee: {
                Rc: "Transformer wire 1 (24VAC hot)",
                C: "Transformer wire 2 (24VAC common)",
                W1: "Relay coil terminal A",
                C_relay: "Relay coil terminal B",
              },
              relay: {
                coilA: "W1 from Ecobee",
                coilB: "C from Ecobee",
                contact1: "Boiler terminal 40",
                contact2: "Boiler terminal 41",
              },
              boiler: {
                terminal40: "Relay contact 1",
                terminal41: "Relay contact 2",
              },
            },
            settings: {
              equipmentType: "Boiler/Radiator",
              heatType: "Conventional",
              cooling: "None",
              fan: "None",
              w1: "Heat Call",
            },
            warnings: [
              "Relay must have dry contacts (no voltage)",
              "Verify relay contacts are isolated from coil",
            ],
          },
        },
        criticalWarnings: [
          "Boiler expects DRY CONTACT (switch loop) - no voltage",
          "Do NOT send 24VAC to boiler terminals",
          "Backfeeding 24VAC can damage boiler board",
          "Test with voltmeter before final connection",
        ],
      },
    },
    settings: {
      installation: {
        equipmentType: "Boiler/Radiator",
        heatType: "Conventional",
        cooling: "None",
        fan: "None",
        w1: "Heat Call (single stage)",
      },
      thresholds: {
        heatDifferential: "1.0°F (prevents short cycling)",
        heatMinOnTime: "5 minutes (protects boiler)",
        heatMinOffTime: "5 minutes (protects boiler)",
      },
      comfort: {
        heatingSetpoint: "68-72°F typical",
        schedule: "Lower at night, raise in morning",
      },
    },
  },

  // Heat Pump Systems
  heatPump: {
    name: "Heat Pump",
    description: "Air-source or ground-source heat pump systems",
    wiringScenarios: {
      standard: {
        name: "Standard Heat Pump",
        description: "Heat pump with reversing valve",
        terminals: {
          R: "24VAC power",
          C: "24VAC common",
          Y1: "Compressor Stage 1",
          O: "Reversing valve (most brands - energized on cool)",
          B: "Reversing valve (Rheem/Ruud - energized on heat)",
          W1: "Auxiliary heat (if available)",
          G: "Fan control",
        },
        settings: {
          equipmentType: "Heat Pump",
          heatType: "Heat Pump",
          cooling: "Yes",
          reversingValve: "O (most brands) or B (Rheem/Ruud)",
          auxHeat: "Yes (if available)",
        },
      },
    },
    settings: {
      installation: {
        equipmentType: "Heat Pump",
        heatType: "Heat Pump",
        cooling: "Yes",
        oB: "O (most brands) or B (Rheem/Ruud)",
        auxHeat: "Yes (if available)",
      },
      thresholds: {
        compressorMinOutdoorTemp: "Typically -10°F to -20°F",
        auxHeatMaxOutdoorTemp: "Typically 35-40°F",
        heatDifferential: "1.0°F",
      },
    },
  },

  // Conventional Systems
  conventional: {
    name: "Conventional",
    description: "Furnace/Air Handler with separate AC",
    wiringScenarios: {
      standard: {
        name: "Standard Conventional",
        description: "Furnace with separate air conditioner",
        terminals: {
          R: "24VAC power",
          C: "24VAC common",
          Y: "Cooling (AC compressor)",
          W: "Heating (furnace)",
          G: "Fan control",
        },
        settings: {
          equipmentType: "Furnace/Air Handler",
          heatType: "Conventional",
          cooling: "Yes (if AC present)",
          fan: "Yes",
        },
      },
    },
    settings: {
      installation: {
        equipmentType: "Furnace/Air Handler",
        heatType: "Conventional",
        cooling: "Yes (if AC present)",
        fan: "Yes",
      },
      thresholds: {
        heatDifferential: "1.0°F",
        coolDifferential: "1.0°F",
      },
    },
  },

  // Model Compatibility
  ecobeeModels: {
    "Ecobee3 Lite": {
      hasSeparateRcRh: true,
      hasPEK: true,
      hasHumidifier: false,
      hasDehumidifier: false,
      notes: "Has separate Rc/Rh terminals, good for boiler installations",
    },
    "Ecobee Enhanced": {
      hasSeparateRcRh: true,
      hasPEK: true,
      hasHumidifier: true,
      hasDehumidifier: true,
      notes: "Full feature set, separate Rc/Rh terminals",
    },
    "Ecobee Smart Thermostat Premium": {
      hasSeparateRcRh: true,
      hasPEK: true,
      hasHumidifier: true,
      hasDehumidifier: true,
      notes: "Latest model with all features",
    },
    "Ecobee Essentials": {
      hasSeparateRcRh: false,
      hasPEK: true,
      hasHumidifier: false,
      hasDehumidifier: false,
      notes: "May not have separate Rc/Rh - use relay solution for boilers",
    },
  },

  // Component Recommendations
  components: {
    transformer: {
      name: "24VAC Plug-in Transformer",
      recommendations: [
        "Jameco ReliaPro 24VAC adapter",
        "Any UL-listed 24VAC plug-in transformer",
        "Must output 24VAC (not 24VDC)",
      ],
      specifications: {
        voltage: "24VAC",
        current: "Minimum 500mA (check Ecobee requirements)",
        certification: "UL-listed recommended",
      },
    },
    relay: {
      name: "24VAC Coil Isolation Relay",
      recommendations: [
        "RIB U1C (Functional Devices)",
        "Any 24VAC coil relay with dry contacts",
        "Must have NO (normally open) contacts",
      ],
      specifications: {
        coilVoltage: "24VAC",
        contactType: "Dry contact (no voltage)",
        isolation: "Must isolate coil from contacts",
      },
    },
  },
};

/**
 * Get equipment settings for a specific equipment type
 */
export function getEquipmentSettings(equipmentType) {
  return EQUIPMENT_SETTINGS_DATA[equipmentType]?.settings || null;
}

/**
 * Get wiring scenario for equipment type and scenario name
 */
export function getWiringScenario(equipmentType, scenarioName) {
  const equipment = EQUIPMENT_SETTINGS_DATA[equipmentType];
  if (!equipment) return null;
  return equipment.wiringScenarios?.[scenarioName] || null;
}

/**
 * Check if Ecobee model has separate Rc/Rh terminals
 */
export function hasSeparateRcRh(ecobeeModel) {
  const model = EQUIPMENT_SETTINGS_DATA.ecobeeModels[ecobeeModel];
  return model?.hasSeparateRcRh || false;
}

/**
 * Get all compatible Ecobee models for a solution
 */
export function getCompatibleModels(solutionType) {
  const models = EQUIPMENT_SETTINGS_DATA.ecobeeModels;
  const compatible = [];
  
  for (const [model, data] of Object.entries(models)) {
    if (solutionType === "separateRcRh" && data.hasSeparateRcRh) {
      compatible.push(model);
    } else if (solutionType === "isolationRelay") {
      compatible.push(model); // All models work with relay
    }
  }
  
  return compatible;
}


