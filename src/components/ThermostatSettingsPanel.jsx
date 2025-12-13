import React, { useState, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Settings,
  Thermometer,
  Calendar,
  Bell,
  Lock,
  Info,
  AlertCircle,
  Search,
  HelpCircle,
  ChevronUp,
  Download,
  Upload,
  CheckCircle2,
  ExternalLink,
  Zap,
} from "lucide-react";
import {
  loadThermostatSettings,
  saveThermostatSettings,
  updateThermostatSetting,
  DEFAULT_THERMOSTAT_SETTINGS,
} from "../lib/thermostatSettings";
import { getComfortSettings } from "../lib/ecobeeApi";
import { getEcobeeCredentials } from "../lib/ecobeeApi";
import { getThermostatStatus, checkBridgeHealth } from "../lib/jouleBridgeApi";
import ScheduleEditor from "./ScheduleEditor";

// Settings guide links - maps setting keys to their guide documents
const SETTINGS_GUIDES = {
  "thresholds.heatDifferential": "/docs/THRESHOLD-OPTIMIZATION-GUIDE.md",
  "thresholds.coolDifferential": "/docs/THRESHOLD-OPTIMIZATION-GUIDE.md",
  "thresholds.compressorMinCycleOff": "/docs/THRESHOLD-OPTIMIZATION-GUIDE.md",
  "thresholds.heatMinOnTime": "/docs/THRESHOLD-OPTIMIZATION-GUIDE.md",
  "thresholds.coolMinOnTime": "/docs/THRESHOLD-OPTIMIZATION-GUIDE.md",
  "thresholds.compressorMinOutdoorTemp": "/docs/THRESHOLD-OPTIMIZATION-GUIDE.md",
  "thresholds.auxHeatMaxOutdoorTemp": "/docs/THRESHOLD-OPTIMIZATION-GUIDE.md",
  "thresholds.heatDissipationTime": "/docs/THRESHOLD-OPTIMIZATION-GUIDE.md",
  "thresholds.coolDissipationTime": "/docs/THRESHOLD-OPTIMIZATION-GUIDE.md",
  "thresholds.acOvercoolMax": "/docs/THRESHOLD-OPTIMIZATION-GUIDE.md",
  "thresholds.heatCoolMinDelta": "/docs/THRESHOLD-OPTIMIZATION-GUIDE.md",
  // Add more guides as they are created
};

// Typical/recommended values for settings (when CSV analysis isn't available)
// Based on Building Science, NEMA Standards, and Comfort Psychology
const TYPICAL_VALUES = {
  "thresholds.heatDifferential": 1.0, // 0.5°F causes rapid cycling (6+ cycles/hr). 1.0°F reduces cycles by ~40% with no noticeable comfort loss.
  "thresholds.coolDifferential": 1.0, // Same as heat - prevents short cycling
  "thresholds.compressorMinCycleOff": 600, // 10 min - NEMA MG-1: Motors overheat on startup. Extending rest period allows refrigerant pressures to equalize.
  "thresholds.heatMinOnTime": 300, // 5 min - Oil return. Oil migrates into lines, takes ~3-5 minutes to push back to crankcase.
  "thresholds.coolMinOnTime": 300, // 5 min - Same oil return requirement
  "thresholds.compressorMinOutdoorTemp": 20, // Set to Balance Point. Below balance point, heat pumps run continuously but lose ground.
  "thresholds.auxHeatMaxOutdoorTemp": 35, // Electric strips cost 3x more than heat pumps. Never use above freezing unless emergency.
  "thresholds.heatDissipationTime": 60, // 60s for Electric/HP, 30s for Gas. Heat exchanger still hot when fire stops - scavenge "free" heat.
  "thresholds.coolDissipationTime": 45, // Coil still wet and cold. 45s evaporates water (cooling air) and raises Sensible Heat Ratio.
  "thresholds.acOvercoolMax": 2.5, // 2-3°F. Allows AC to act as dehumidifier. Cold & Dry feels better than Warm & Wet.
  "thresholds.heatCoolMinDelta": 5, // 4-5°F. Prevents "mode fighting." If set to 2°F, AC might overshoot and trigger heat immediately.
  "thresholds.temperatureCorrection": 0, // No correction unless sensor is inaccurate
  "thresholds.humidityCorrection": 0, // No correction unless sensor is inaccurate
  "thresholds.thermalProtect": 10, // Max difference before ignoring sensor (protects against bad readings)
};

// Comprehensive CSV analysis function
const analyzeCSVData = () => {
  try {
    const csvData = localStorage.getItem('spa_parsedCsvData');
    if (!csvData) return null;
    
    const data = JSON.parse(csvData);
    if (!data || data.length === 0) return null;
    
    // Helper to find column by patterns
    const findColumn = (patterns) => {
      if (!data || data.length === 0) return null;
      const sampleRow = data[0];
      const availableCols = Object.keys(sampleRow);
      for (const pattern of patterns) {
        const found = availableCols.find(col => {
          const colLower = col.toLowerCase();
          return typeof pattern === 'string' ? colLower.includes(pattern.toLowerCase()) : pattern.test(col);
        });
        if (found) return found;
      }
      return null;
    };
    
    // Find all relevant columns
    const heatStageCol = findColumn(['heat stage 1', /heat.*stage.*sec/i, 'heat stage']);
    const coolStageCol = findColumn(['cool stage 1', /cool.*stage.*sec/i, 'cool stage', 'compressor stage 1']);
    const auxHeatCol = findColumn(['aux heat 1', /aux.*heat.*sec/i, 'aux heat']);
    const currentTempCol = findColumn(['current temp', 'indoor temp', 'temp']);
    const heatSetTempCol = findColumn(['heat set temp', 'heat setpoint']);
    const outdoorTempCol = findColumn(['outdoor temp', 'outside temp']);
    
    if (!heatStageCol && !coolStageCol) return null; // Need at least one stage column
    
    const analysis = {
      cyclesPerHour: null,
      shortCycles: 0,
      avgRuntime: null,
      minRuntime: null,
      maxRuntime: null,
      heatDifferential: null,
      coolDifferential: null,
      compressorMinOutdoorTemp: null,
      auxHeatMaxOutdoorTemp: null,
      heatDissipationTime: null,
      coolDissipationTime: null,
      compressorMinCycleOff: null,
      heatMinOnTime: null,
      coolMinOnTime: null,
    };
    
    // Analyze heat cycles
    if (heatStageCol) {
      const heatRuns = data.filter(row => parseFloat(row[heatStageCol] || 0) > 0);
      const heatRuntimes = heatRuns.map(row => parseFloat(row[heatStageCol] || 0));
      
      if (heatRuntimes.length > 0) {
        analysis.avgRuntime = heatRuntimes.reduce((a, b) => a + b, 0) / heatRuntimes.length;
        analysis.minRuntime = Math.min(...heatRuntimes);
        analysis.maxRuntime = Math.max(...heatRuntimes);
        
        // Count short cycles (< 240 sec = 4 min)
        analysis.shortCycles = heatRuntimes.filter(rt => rt > 0 && rt < 240).length;
        
        // Calculate cycles per hour (count transitions from off to on)
        let cycleCount = 0;
        let wasRunning = false;
        const recentData = data.slice(-12); // Last hour of data
        recentData.forEach((row) => {
          const runtime = parseFloat(row[heatStageCol] || 0);
          const isRunning = runtime > 0;
          if (isRunning && !wasRunning) cycleCount++;
          wasRunning = isRunning;
        });
        analysis.cyclesPerHour = recentData.length >= 4 ? (cycleCount / recentData.length) * 12 : null;
      }
      
      // Analyze heat differential (how far temp drops below setpoint before heat starts)
      if (currentTempCol && heatSetTempCol) {
        const heatErrors = [];
        let wasOff = true;
        data.forEach((row) => {
          const runtime = parseFloat(row[heatStageCol] || 0);
          const isRunning = runtime > 0;
          const currentTemp = parseFloat(row[currentTempCol] || 0);
          const setTemp = parseFloat(row[heatSetTempCol] || 0);
          
          if (isRunning && wasOff && currentTemp > 0 && setTemp > 0) {
            // Heat just turned on - check how far below setpoint we were
            heatErrors.push(setTemp - currentTemp);
          }
          wasOff = !isRunning;
        });
        if (heatErrors.length > 0) {
          const maxError = Math.max(...heatErrors);
          analysis.heatDifferential = maxError > 1.0 ? Math.min(maxError, 1.5) : 0.5;
        }
      }
      
      // Analyze compressor running in cold weather
      if (outdoorTempCol) {
        const coldRuns = data.filter(row => {
          const runtime = parseFloat(row[heatStageCol] || 0);
          const outdoorTemp = parseFloat(row[outdoorTempCol] || 0);
          return runtime > 0 && outdoorTemp < 35;
        });
        if (coldRuns.length > 0) {
          const coldestRun = Math.min(...coldRuns.map(r => parseFloat(r[outdoorTempCol] || 0)));
          analysis.compressorMinOutdoorTemp = Math.max(30, Math.ceil(coldestRun + 2));
        }
      }
      
      // Analyze heat dissipation (coast-up after heat turns off)
      if (currentTempCol) {
        const coastUps = [];
        let lastHeatTemp = null;
        let lastHeatTime = null;
        data.forEach((row, idx) => {
          const runtime = parseFloat(row[heatStageCol] || 0);
          const currentTemp = parseFloat(row[currentTempCol] || 0);
          const isRunning = runtime > 0;
          
          if (isRunning) {
            lastHeatTemp = currentTemp;
            lastHeatTime = idx;
          } else if (lastHeatTemp !== null && lastHeatTime !== null && idx - lastHeatTime <= 3) {
            // Heat just turned off, check temp rise in next few rows
            if (currentTemp > lastHeatTemp) {
              coastUps.push(currentTemp - lastHeatTemp);
            }
          }
        });
        if (coastUps.length > 0) {
          const avgCoastUp = coastUps.reduce((a, b) => a + b, 0) / coastUps.length;
          if (avgCoastUp > 0.3) {
            analysis.heatDissipationTime = 60; // Significant coast-up, recommend 60 sec
          } else if (avgCoastUp > 0.1) {
            analysis.heatDissipationTime = 30; // Some coast-up, recommend 30 sec
          }
        }
      }
    }
    
    // Analyze aux heat
    if (auxHeatCol && outdoorTempCol) {
      const auxRuns = data.filter(row => parseFloat(row[auxHeatCol] || 0) > 0);
      if (auxRuns.length > 0) {
        const auxOutdoorTemps = auxRuns.map(row => parseFloat(row[outdoorTempCol] || 0));
        const maxAuxTemp = Math.max(...auxOutdoorTemps);
        if (maxAuxTemp > 40) {
          analysis.auxHeatMaxOutdoorTemp = 35; // Aux ran too warm, lower threshold
        } else if (auxRuns.length === 0) {
          analysis.auxHeatMaxOutdoorTemp = 50; // Never ran, can raise threshold
        }
      } else {
        analysis.auxHeatMaxOutdoorTemp = 50; // Never ran, can raise threshold
      }
    }
    
    // Calculate recommendations based on analysis
    if (analysis.shortCycles > 0) {
      analysis.compressorMinCycleOff = 600; // Short cycling detected, increase to 10 min
      analysis.heatMinOnTime = analysis.avgRuntime < 300 ? 600 : 300;
    } else {
      analysis.compressorMinCycleOff = 300; // No short cycling, 5 min is fine
      analysis.heatMinOnTime = analysis.avgRuntime < 300 ? 420 : 300;
    }
    
    // Differential recommendation based on cycles per hour
    // Fix: When cycles are LOW (< 3), use tight comfort (0.5°F)
    // When cycles are HIGH (> 6), use wider differential (1.5°F) to reduce cycling
    if (analysis.cyclesPerHour !== null && !isNaN(analysis.cyclesPerHour) && isFinite(analysis.cyclesPerHour)) {
      if (analysis.cyclesPerHour < 3) {
        // Low cycles = system is efficient, use tight comfort
        analysis.heatDifferential = 0.5;
      } else if (analysis.cyclesPerHour <= 4) {
        analysis.heatDifferential = 0.75;
      } else if (analysis.cyclesPerHour <= 6) {
        analysis.heatDifferential = 1.0;
      } else {
        // High cycles = system is short cycling, use wider differential
        analysis.heatDifferential = 1.5;
      }
    }
    
    return analysis;
  } catch (error) {
    console.warn('Failed to analyze CSV data:', error);
    return null;
  }
};

// Settings help text
const SETTINGS_HELP = {
  "equipment.wiring.hasHeat": "Enable if your system has heating capability",
  "equipment.wiring.hasCool": "Enable if your system has cooling/AC capability",
  "equipment.wiring.hasFan": "Enable if your system has a fan",
  "equipment.heatPump.type":
    "Type of heat pump: Air-to-Air (most common) or Geothermal",
  "equipment.heatPump.reversingValve":
    "O = energized on cool, B = energized on heat. Check your heat pump manual.",
  "equipment.heatPump.auxHeatSimultaneous":
    "Allow auxiliary heat to run with heat pump for faster heating",
  "thresholds.autoHeatCool":
    "Enable Auto mode to automatically switch between heating and cooling",
  "thresholds.heatCoolMinDelta":
    "Minimum temperature gap between heat and cool setpoints in Auto mode (prevents rapid switching)",
  "thresholds.staging":
    "Auto: Ecobee manages staging automatically. Manual: You configure detailed staging parameters.",
  "thresholds.compressorMinCycleOff":
    "Minimum time compressor must stay off between cycles (protects compressor from short cycling)",
  "thresholds.compressorMinOutdoorTemp":
    "Minimum outdoor temperature below which the compressor (AC or heat pump) will not run. Protects equipment.",
  "thresholds.acOvercoolMax":
    "Allows the AC to cool below the set point by this amount to help reduce indoor humidity",
  "thresholds.auxHeatMaxOutdoorTemp":
    "Outdoor temperature above which auxiliary heat will not run. Helps avoid inefficient aux heat when not needed.",
  "thresholds.heatDifferential":
    "Dead band for heating: how far below setpoint before heat turns on. Smaller = more frequent cycles; bigger = longer cycles.",
  "thresholds.heatDissipationTime":
    "After heat call ends, how long the fan continues to run to push out residual warm air from the ducts",
  "thresholds.heatMinOnTime":
    "Minimum time heating must run once turned on (prevents short cycles)",
  "thresholds.coolDifferential":
    "Dead band for cooling: how far above setpoint before cooling turns on. Smaller = more frequent cycles; bigger = longer cycles.",
  "thresholds.coolDissipationTime":
    "How long the fan runs after cooling stops, to make use of remaining cool air in the ducts",
  "thresholds.coolMinOnTime":
    "Minimum time cooling must run once turned on (prevents short cycles)",
  "thresholds.compressorReverseStaging":
    "When enabled, as the thermostat gets close to the set point, it will drop from higher stages to a lower stage to finish more efficiently",
  "thresholds.temperatureCorrection":
    "Offset to apply to temperature readings (useful for sensor calibration). Positive = reads warmer, negative = reads cooler.",
  "thresholds.humidityCorrection":
    "Offset to apply to humidity readings (useful for sensor calibration). Positive = reads more humid, negative = reads less humid.",
  "thresholds.thermalProtect":
    "Maximum difference between the thermostat's temperature reading and remote sensors. If a sensor reads wildly different, it may be ignored. Helps avoid using bad sensors.",
  "comfortSettings.heatSetPoint": "Heating setpoint for this comfort setting",
  "comfortSettings.coolSetPoint": "Cooling setpoint for this comfort setting",
  "comfortSettings.fanMode":
    "Fan mode: Auto (runs with heat/cool) or On (always running)",
};

export default function ThermostatSettingsPanel() {
  const [settings, setSettings] = useState(loadThermostatSettings());
  const [validationErrors, setValidationErrors] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [pullingComfortSettings, setPullingComfortSettings] = useState(false);
  const [comfortSettingsError, setComfortSettingsError] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    equipment: false,
    thresholds: false,
    comfort: false,
    schedule: false,
    preferences: false,
    alerts: false,
    access: false,
  });
  const sectionRefs = useRef({});
  const fileInputRef = useRef(null);

  // Helper to get nested value by path
  const getValueByPath = (obj, path) => {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  };

  // Check if a setting differs from default (available for future use)
   
  const _isDifferent = (path) => {
    const current = getValueByPath(settings, path);
    const defaultValue = getValueByPath(DEFAULT_THERMOSTAT_SETTINGS, path);
    return JSON.stringify(current) !== JSON.stringify(defaultValue);
  };

  useEffect(() => {
    const handleChange = () => {
      setSettings(loadThermostatSettings());
    };
    window.addEventListener("thermostatSettingsChanged", handleChange);
    return () =>
      window.removeEventListener("thermostatSettingsChanged", handleChange);
  }, []);

  // Expand schedule section when navigated to with #schedule hash
  useEffect(() => {
    if (window.location.hash === '#schedule') {
      setExpandedSections(prev => ({ ...prev, schedule: true }));
      // Scroll to schedule section after a brief delay to ensure it's rendered
      setTimeout(() => {
        const scheduleElement = sectionRefs.current.schedule;
        if (scheduleElement) {
          scheduleElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, []);

  // Validate settings
  const validateSettings = (s) => {
    const errors = {};

    // Validate comfort settings: heat setpoint < cool setpoint
    Object.entries(s.comfortSettings).forEach(([key, comfort]) => {
      if (comfort.heatSetPoint >= comfort.coolSetPoint) {
        errors[
          `comfort.${key}.heatCool`
        ] = `Heat setpoint (${comfort.heatSetPoint}°F) must be less than cool setpoint (${comfort.coolSetPoint}°F)`;
      }
      if (comfort.heatSetPoint < 50 || comfort.heatSetPoint > 90) {
        errors[`comfort.${key}.heat`] = `Heat setpoint must be between 50-90°F`;
      }
      if (comfort.coolSetPoint < 50 || comfort.coolSetPoint > 90) {
        errors[`comfort.${key}.cool`] = `Cool setpoint must be between 50-90°F`;
      }
    });

    // Validate thresholds
    if (
      s.thresholds.heatCoolMinDelta < 1 ||
      s.thresholds.heatCoolMinDelta > 10
    ) {
      errors["thresholds.heatCoolMinDelta"] =
        "Heat/Cool Min Delta must be between 1-10°F";
    }
    // Note: isDifferent function is available but not currently used in validation
    if (
      s.thresholds.compressorMinCycleOff < 60 ||
      s.thresholds.compressorMinCycleOff > 1800
    ) {
      errors["thresholds.compressorMinCycleOff"] =
        "Compressor Min Cycle-Off must be between 60-1800 seconds";
    }
    if (
      s.thresholds.heatDifferential < 0.1 ||
      s.thresholds.heatDifferential > 5
    ) {
      errors["thresholds.heatDifferential"] =
        "Heat Differential must be between 0.1-5°F";
    }
    if (
      s.thresholds.coolDifferential < 0.1 ||
      s.thresholds.coolDifferential > 5
    ) {
      errors["thresholds.coolDifferential"] =
        "Cool Differential must be between 0.1-5°F";
    }
    if (s.thresholds.heatMinOnTime < 60 || s.thresholds.heatMinOnTime > 1800) {
      errors["thresholds.heatMinOnTime"] =
        "Heat Min On Time must be between 60-1800 seconds";
    }
    if (s.thresholds.coolMinOnTime < 60 || s.thresholds.coolMinOnTime > 1800) {
      errors["thresholds.coolMinOnTime"] =
        "Cool Min On Time must be between 60-1800 seconds";
    }
    if (
      s.thresholds.temperatureCorrection < -5 ||
      s.thresholds.temperatureCorrection > 5
    ) {
      errors["thresholds.temperatureCorrection"] =
        "Temperature Correction must be between -5 to +5°F";
    }
    if (
      s.thresholds.heatDissipationTime < 0 ||
      s.thresholds.heatDissipationTime > 600
    ) {
      errors["thresholds.heatDissipationTime"] =
        "Heat Dissipation Time must be between 0-600 seconds";
    }
    if (
      s.thresholds.coolDissipationTime < 0 ||
      s.thresholds.coolDissipationTime > 600
    ) {
      errors["thresholds.coolDissipationTime"] =
        "Cool Dissipation Time must be between 0-600 seconds";
    }
    if (
      s.thresholds.humidityCorrection < -10 ||
      s.thresholds.humidityCorrection > 10
    ) {
      errors["thresholds.humidityCorrection"] =
        "Humidity Correction must be between -10 to +10%";
    }
    if (s.thresholds.thermalProtect < 1 || s.thresholds.thermalProtect > 20) {
      errors["thresholds.thermalProtect"] =
        "Thermal Protect must be between 1-20°F";
    }
    if (
      s.thresholds.compressorMinOutdoorTemp < -20 ||
      s.thresholds.compressorMinOutdoorTemp > 60
    ) {
      errors["thresholds.compressorMinOutdoorTemp"] =
        "Compressor Min Outdoor Temp must be between -20 to 60°F";
    }
    if (s.thresholds.acOvercoolMax < 0 || s.thresholds.acOvercoolMax > 5) {
      errors["thresholds.acOvercoolMax"] =
        "AC Overcool Max must be between 0-5°F";
    }
    if (
      s.thresholds.auxHeatMaxOutdoorTemp < 20 ||
      s.thresholds.auxHeatMaxOutdoorTemp > 60
    ) {
      errors["thresholds.auxHeatMaxOutdoorTemp"] =
        "Aux Heat Max Outdoor Temp must be between 20-60°F";
    }

    return errors;
  };

  useEffect(() => {
    setValidationErrors(validateSettings(settings));
  }, [settings]);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    // Scroll to section after a brief delay
    setTimeout(() => {
      sectionRefs.current[section]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 100);
  };

  const scrollToSection = (section) => {
    setExpandedSections((prev) => ({ ...prev, [section]: true }));
    setTimeout(() => {
      sectionRefs.current[section]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  const updateSetting = (path, value) => {
    const updated = updateThermostatSetting(path, value);
    setSettings(updated);
    // Validation will run via useEffect
  };

  // Pull comfort settings from thermostat (Joule Bridge/HomeKit or Ecobee API)
  const pullComfortSettingsFromEcobee = async () => {
    setPullingComfortSettings(true);
    setComfortSettingsError(null);
    
    try {
      // First, try Joule Bridge (HomeKit) - preferred method
      const bridgeAvailable = await checkBridgeHealth();
      
      if (bridgeAvailable) {
        try {
          const status = await getThermostatStatus(null);
          if (status && status.target_temperature !== null && status.target_temperature !== undefined) {
            // HomeKit doesn't have separate comfort settings, so use current target temp for "home"
            const targetTemp = status.target_temperature;
            const mode = status.mode || "heat";
            
            const updatedSettings = { ...settings };
            
            // Use current target temperature for home comfort setting
            if (mode === "heat" || mode === "auto") {
              updatedSettings.comfortSettings.home.heatSetPoint = Math.round(targetTemp);
            }
            if (mode === "cool" || mode === "auto") {
              updatedSettings.comfortSettings.home.coolSetPoint = Math.round(targetTemp + 4); // Typical 4°F spread
            }
            
            saveThermostatSettings(updatedSettings);
            setSettings(updatedSettings);
            
            setImportSuccess(true);
            setTimeout(() => setImportSuccess(false), 3000);
            return;
          }
        } catch (bridgeError) {
          console.debug("Joule Bridge available but failed to get status, trying Ecobee API:", bridgeError);
          // Fall through to Ecobee API
        }
      }
      
      // Fallback to Ecobee API
      const credentials = getEcobeeCredentials();
      if (!credentials.apiKey || !credentials.accessToken) {
        throw new Error(
          "No thermostat connection available. " +
          "Either connect via Joule Bridge (HomeKit) or configure your Ecobee API key in Settings → Bridge & AI → Ecobee Cloud API."
        );
      }

      const comfortSettings = await getComfortSettings();
      
      if (!comfortSettings || (!comfortSettings.home && !comfortSettings.away && !comfortSettings.sleep)) {
        throw new Error("No comfort settings found on Ecobee. Make sure your thermostat has home, away, and sleep climates configured.");
      }

      // Update settings with pulled data
      const updatedSettings = { ...settings };
      
      if (comfortSettings.home) {
        updatedSettings.comfortSettings.home = {
          ...updatedSettings.comfortSettings.home,
          heatSetPoint: comfortSettings.home.heatSetPoint,
          coolSetPoint: comfortSettings.home.coolSetPoint,
          fanMode: comfortSettings.home.fanMode,
        };
      }
      
      if (comfortSettings.away) {
        updatedSettings.comfortSettings.away = {
          ...updatedSettings.comfortSettings.away,
          heatSetPoint: comfortSettings.away.heatSetPoint,
          coolSetPoint: comfortSettings.away.coolSetPoint,
          fanMode: comfortSettings.away.fanMode,
        };
      }
      
      if (comfortSettings.sleep) {
        updatedSettings.comfortSettings.sleep = {
          ...updatedSettings.comfortSettings.sleep,
          heatSetPoint: comfortSettings.sleep.heatSetPoint,
          coolSetPoint: comfortSettings.sleep.coolSetPoint,
          fanMode: comfortSettings.sleep.fanMode,
        };
      }

      saveThermostatSettings(updatedSettings);
      setSettings(updatedSettings);
      
      // Show success message
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (error) {
      console.error("Error pulling comfort settings:", error);
      setComfortSettingsError(error.message || "Failed to pull comfort settings from thermostat");
    } finally {
      setPullingComfortSettings(false);
    }
  };

  // Filter sections based on search query
  const matchesSearch = (sectionKey, sectionLabel) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      sectionLabel.toLowerCase().includes(query) ||
      Object.keys(settings[sectionKey] || {}).some((key) =>
        key.toLowerCase().includes(query)
      )
    );
  };

  // Export settings
  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `thermostat-settings-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import settings
  const importSettings = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result || "{}");
        // Validate structure (basic check)
        if (imported.thresholds && imported.comfortSettings) {
          saveThermostatSettings(imported);
          setSettings(imported);
          setImportSuccess(true);
          setTimeout(() => setImportSuccess(false), 3000);
        } else {
          alert("Invalid settings file format");
        }
      } catch (error) {
        alert("Error importing settings: " + error.message);
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Apply preset
  const applyPreset = (presetName) => {
    let presetSettings = { ...settings };

    switch (presetName) {
      case "energy-saver":
        // Wider differentials, longer cycle times, higher setpoints
        presetSettings.thresholds.heatDifferential = 1.5;
        presetSettings.thresholds.coolDifferential = 1.5;
        presetSettings.thresholds.compressorMinCycleOff = 600; // 10 min
        presetSettings.thresholds.heatMinOnTime = 600;
        presetSettings.thresholds.coolMinOnTime = 600;
        presetSettings.comfortSettings.home.heatSetPoint = 68;
        presetSettings.comfortSettings.home.coolSetPoint = 78;
        presetSettings.comfortSettings.away.heatSetPoint = 60;
        presetSettings.comfortSettings.away.coolSetPoint = 85;
        presetSettings.comfortSettings.sleep.heatSetPoint = 64;
        presetSettings.comfortSettings.sleep.coolSetPoint = 75;
        break;
      case "comfort":
        // Tighter control, optimized setpoints
        presetSettings.thresholds.heatDifferential = 0.5;
        presetSettings.thresholds.coolDifferential = 0.5;
        presetSettings.thresholds.compressorMinCycleOff = 300; // 5 min
        presetSettings.thresholds.heatMinOnTime = 300;
        presetSettings.thresholds.coolMinOnTime = 300;
        presetSettings.comfortSettings.home.heatSetPoint = 72;
        presetSettings.comfortSettings.home.coolSetPoint = 74;
        presetSettings.comfortSettings.away.heatSetPoint = 65;
        presetSettings.comfortSettings.away.coolSetPoint = 80;
        presetSettings.comfortSettings.sleep.heatSetPoint = 68;
        presetSettings.comfortSettings.sleep.coolSetPoint = 72;
        break;
      case "aggressive":
        // Very tight control, fast response
        presetSettings.thresholds.heatDifferential = 0.3;
        presetSettings.thresholds.coolDifferential = 0.3;
        presetSettings.thresholds.compressorMinCycleOff = 180; // 3 min
        presetSettings.thresholds.heatMinOnTime = 180;
        presetSettings.thresholds.coolMinOnTime = 180;
        presetSettings.comfortSettings.home.heatSetPoint = 70;
        presetSettings.comfortSettings.home.coolSetPoint = 74;
        presetSettings.comfortSettings.away.heatSetPoint = 62;
        presetSettings.comfortSettings.away.coolSetPoint = 85;
        presetSettings.comfortSettings.sleep.heatSetPoint = 66;
        presetSettings.comfortSettings.sleep.coolSetPoint = 72;
        break;
      case "default":
        presetSettings = JSON.parse(
          JSON.stringify(DEFAULT_THERMOSTAT_SETTINGS)
        );
        break;
    }

    saveThermostatSettings(presetSettings);
    setSettings(presetSettings);
  };

  return (
    <div className="space-y-4">
      {/* Settings Presets and Export/Import */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Quick Presets:
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1 ${
                showComparison
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-300 dark:border-gray-600"
              }`}
            >
              <Info size={14} />
              {showComparison ? "Hide" : "Compare"} vs Default
            </button>
            <button
              onClick={exportSettings}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-colors flex items-center gap-1"
            >
              <Download size={14} />
              Export
            </button>
            <label className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-colors flex items-center gap-1 cursor-pointer">
              <Upload size={14} />
              Import
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={importSettings}
                className="hidden"
              />
            </label>
          </div>
        </div>
        {importSuccess && (
          <div className="mb-3 p-2 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
            <CheckCircle2 size={16} />
            Settings imported successfully!
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={() => applyPreset("energy-saver")}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
          >
            ⚡ Energy Saver (Model)
          </button>
          <button
            onClick={() => applyPreset("comfort")}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
          >
            😌 Comfort (Model)
          </button>
          <button
            onClick={() => applyPreset("aggressive")}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
          >
            ⚡ Aggressive Savings (Model)
          </button>
          <button
            onClick={() => applyPreset("default")}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            🔄 Default
          </button>
        </div>
      </div>

      {/* Search and Navigation */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Quick Navigation Dropdown */}
          <div className="relative">
            <select
              onChange={(e) => {
                if (e.target.value) scrollToSection(e.target.value);
                e.target.value = "";
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer"
            >
              <option value="">Jump to section...</option>
              <option value="equipment">
                Installation Settings → Equipment
              </option>
              <option value="thresholds">
                Installation Settings → Thresholds
              </option>
              <option value="comfort">Comfort Settings</option>
              <option value="schedule">Schedule</option>
              <option value="preferences">Preferences</option>
              <option value="alerts">Alerts & Reminders</option>
              <option value="access">Access Control</option>
            </select>
          </div>
        </div>
      </div>

      {/* Validation Errors Summary */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={18} className="text-red-600" />
            <span className="font-semibold text-red-900 dark:text-red-100">
              Validation Errors
            </span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-800 dark:text-red-200">
            {Object.values(validationErrors).map((error, idx) => (
              <li key={idx}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Installation Settings → Equipment */}
      {matchesSearch("equipment", "Installation Settings → Equipment") && (
        <div
          ref={(el) => (sectionRefs.current.equipment = el)}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <button
            onClick={() => toggleSection("equipment")}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} className="text-blue-600" />
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                Installation Settings → Equipment
              </span>
            </div>
            {expandedSections.equipment ? (
              <ChevronDown size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
          </button>
          {expandedSections.equipment && (
            <div className="p-4 border-t dark:border-gray-700 space-y-4">
              {/* Wiring */}
              <div>
                <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                  Wiring
                </h4>
                <div className="space-y-2">
                  {Object.entries(settings.equipment.wiring).map(
                    ([key, value]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) =>
                            updateSetting(
                              `equipment.wiring.${key}`,
                              e.target.checked
                            )
                          }
                          className="rounded"
                        />
                        <span className="text-gray-700 dark:text-gray-300">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* Heat Pump */}
              {settings.equipment.wiring.hasHeat && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    Heat Pump Configuration
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Type
                      </label>
                      <select
                        value={settings.equipment.heatPump.type}
                        onChange={(e) =>
                          updateSetting(
                            "equipment.heatPump.type",
                            e.target.value
                          )
                        }
                        className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                      >
                        <option value="air-to-air">Air-to-Air</option>
                        <option value="geothermal">Geothermal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Reversing Valve
                      </label>
                      <select
                        value={settings.equipment.heatPump.reversingValve}
                        onChange={(e) =>
                          updateSetting(
                            "equipment.heatPump.reversingValve",
                            e.target.value
                          )
                        }
                        className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                      >
                        <option value="O">O (energized on cool)</option>
                        <option value="B">B (energized on heat)</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={
                          settings.equipment.heatPump.auxHeatSimultaneous
                        }
                        onChange={(e) =>
                          updateSetting(
                            "equipment.heatPump.auxHeatSimultaneous",
                            e.target.checked
                          )
                        }
                        className="rounded"
                      />
                      <span className="text-gray-700 dark:text-gray-300">
                        Aux Heat Simultaneous Operation
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Installation Settings → Thresholds */}
      {matchesSearch("thresholds", "Installation Settings → Thresholds") && (
        <div
          ref={(el) => (sectionRefs.current.thresholds = el)}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <button
            onClick={() => toggleSection("thresholds")}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} className="text-indigo-600" />
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                Installation Settings → Thresholds
              </span>
            </div>
            {expandedSections.thresholds ? (
              <ChevronDown size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
          </button>
          {expandedSections.thresholds && (
            <div className="p-4 border-t dark:border-gray-700 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingInput
                  label="Auto Heat/Cool"
                  type="checkbox"
                  value={settings.thresholds.autoHeatCool}
                  onChange={(v) => updateSetting("thresholds.autoHeatCool", v)}
                  helpKey="thresholds.autoHeatCool"
                />
                <SettingInput
                  label="Heat/Cool Min Delta (°F)"
                  type="number"
                  value={settings.thresholds.heatCoolMinDelta}
                  onChange={(v) =>
                    updateSetting("thresholds.heatCoolMinDelta", Number(v))
                  }
                  min={1}
                  max={10}
                  helpKey="thresholds.heatCoolMinDelta"
                  settingKey="thresholds.heatCoolMinDelta"
                />
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
                    Configure Staging
                    <div className="relative group">
                      <HelpCircle
                        size={12}
                        className="text-gray-400 hover:text-gray-600 cursor-help"
                      />
                      <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded shadow-lg z-10 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                        {SETTINGS_HELP["thresholds.staging"]}
                      </div>
                    </div>
                  </label>
                  <select
                    value={settings.thresholds.staging}
                    onChange={(e) =>
                      updateSetting("thresholds.staging", e.target.value)
                    }
                    className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                  >
                    <option value="auto">Auto (Ecobee manages staging)</option>
                    <option value="manual">Manual (You configure staging)</option>
                  </select>
                </div>
                <SettingInput
                  label="Compressor Min Cycle-Off (sec)"
                  type="number"
                  value={settings.thresholds.compressorMinCycleOff}
                  onChange={(v) =>
                    updateSetting("thresholds.compressorMinCycleOff", Number(v))
                  }
                  min={60}
                  max={1800}
                  helpKey="thresholds.compressorMinCycleOff"
                  settingKey="thresholds.compressorMinCycleOff"
                />
                <SettingInput
                  label="Compressor Min Outdoor Temp (°F)"
                  type="number"
                  value={settings.thresholds.compressorMinOutdoorTemp}
                  onChange={(v) =>
                    updateSetting(
                      "thresholds.compressorMinOutdoorTemp",
                      Number(v)
                    )
                  }
                  min={-20}
                  max={60}
                  helpKey="thresholds.compressorMinOutdoorTemp"
                  settingKey="thresholds.compressorMinOutdoorTemp"
                />
                <SettingInput
                  label="AC Overcool Max (°F)"
                  type="number"
                  value={settings.thresholds.acOvercoolMax}
                  onChange={(v) =>
                    updateSetting("thresholds.acOvercoolMax", Number(v))
                  }
                  min={0}
                  max={5}
                  step={0.5}
                  helpKey="thresholds.acOvercoolMax"
                  settingKey="thresholds.acOvercoolMax"
                />
                <SettingInput
                  label="Aux Heat Max Outdoor Temp (°F)"
                  type="number"
                  value={settings.thresholds.auxHeatMaxOutdoorTemp}
                  onChange={(v) =>
                    updateSetting("thresholds.auxHeatMaxOutdoorTemp", Number(v))
                  }
                  min={20}
                  max={60}
                  helpKey="thresholds.auxHeatMaxOutdoorTemp"
                  settingKey="thresholds.auxHeatMaxOutdoorTemp"
                />
                <SettingInput
                  label="Heat Differential (°F)"
                  type="number"
                  value={settings.thresholds.heatDifferential}
                  onChange={(v) =>
                    updateSetting("thresholds.heatDifferential", Number(v))
                  }
                  min={0.1}
                  max={5}
                  step={0.1}
                  helpKey="thresholds.heatDifferential"
                  settingKey="thresholds.heatDifferential"
                />
                <SettingInput
                  label="Heat Dissipation Time (sec)"
                  type="number"
                  value={settings.thresholds.heatDissipationTime}
                  onChange={(v) =>
                    updateSetting("thresholds.heatDissipationTime", Number(v))
                  }
                  min={0}
                  max={600}
                  helpKey="thresholds.heatDissipationTime"
                  settingKey="thresholds.heatDissipationTime"
                />
                <SettingInput
                  label="Heat Min On Time (sec)"
                  type="number"
                  value={settings.thresholds.heatMinOnTime}
                  onChange={(v) =>
                    updateSetting("thresholds.heatMinOnTime", Number(v))
                  }
                  min={60}
                  max={1800}
                  helpKey="thresholds.heatMinOnTime"
                  settingKey="thresholds.heatMinOnTime"
                />
                <SettingInput
                  label="Cool Differential (°F)"
                  type="number"
                  value={settings.thresholds.coolDifferential}
                  onChange={(v) =>
                    updateSetting("thresholds.coolDifferential", Number(v))
                  }
                  min={0.1}
                  max={5}
                  step={0.1}
                  helpKey="thresholds.coolDifferential"
                  settingKey="thresholds.coolDifferential"
                />
                <SettingInput
                  label="Cool Dissipation Time (sec)"
                  type="number"
                  value={settings.thresholds.coolDissipationTime}
                  onChange={(v) =>
                    updateSetting("thresholds.coolDissipationTime", Number(v))
                  }
                  min={0}
                  max={600}
                  helpKey="thresholds.coolDissipationTime"
                  settingKey="thresholds.coolDissipationTime"
                />
                <SettingInput
                  label="Cool Min On Time (sec)"
                  type="number"
                  value={settings.thresholds.coolMinOnTime}
                  onChange={(v) =>
                    updateSetting("thresholds.coolMinOnTime", Number(v))
                  }
                  min={60}
                  max={1800}
                  helpKey="thresholds.coolMinOnTime"
                  settingKey="thresholds.coolMinOnTime"
                />
                <SettingInput
                  label="Temperature Correction (°F)"
                  type="number"
                  value={settings.thresholds.temperatureCorrection}
                  onChange={(v) =>
                    updateSetting("thresholds.temperatureCorrection", Number(v))
                  }
                  min={-5}
                  max={5}
                  step={0.5}
                  helpKey="thresholds.temperatureCorrection"
                  settingKey="thresholds.temperatureCorrection"
                />
                <SettingInput
                  label="Compressor Reverse Staging"
                  type="checkbox"
                  value={settings.thresholds.compressorReverseStaging}
                  onChange={(v) =>
                    updateSetting("thresholds.compressorReverseStaging", v)
                  }
                  helpKey="thresholds.compressorReverseStaging"
                />
                <SettingInput
                  label="Humidity Correction (%)"
                  type="number"
                  value={settings.thresholds.humidityCorrection}
                  onChange={(v) =>
                    updateSetting("thresholds.humidityCorrection", Number(v))
                  }
                  min={-10}
                  max={10}
                  step={1}
                  helpKey="thresholds.humidityCorrection"
                  settingKey="thresholds.humidityCorrection"
                />
                <SettingInput
                  label="Thermal Protect (°F)"
                  type="number"
                  value={settings.thresholds.thermalProtect}
                  onChange={(v) =>
                    updateSetting("thresholds.thermalProtect", Number(v))
                  }
                  min={1}
                  max={20}
                  step={1}
                  helpKey="thresholds.thermalProtect"
                  settingKey="thresholds.thermalProtect"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Comfort Settings */}
      {matchesSearch("comfortSettings", "Comfort Settings") && (
        <div
          ref={(el) => (sectionRefs.current.comfort = el)}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <button
            onClick={() => toggleSection("comfort")}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Thermometer size={18} className="text-green-600" />
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                Comfort Settings
              </span>
            </div>
            {expandedSections.comfort ? (
              <ChevronDown size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
          </button>
          {expandedSections.comfort && (
            <div className="p-4 border-t dark:border-gray-700 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure temperature setpoints and fan modes for home, away, and sleep modes.
                </p>
                <button
                  onClick={pullComfortSettingsFromEcobee}
                  disabled={pullingComfortSettings}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {pullingComfortSettings ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Pulling...
                    </>
                  ) : (
                    <>
                      <Download size={16} />
                      Pull from Thermostat
                    </>
                  )}
                </button>
              </div>
              {comfortSettingsError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                  {comfortSettingsError}
                </div>
              )}
              {Object.entries(settings.comfortSettings).map(
                ([key, comfort]) => (
                  <div
                    key={key}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                  >
                    <h4 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300 capitalize">
                      {key}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <SettingInput
                        label="Heat Set Point (°F)"
                        type="number"
                        value={comfort.heatSetPoint}
                        onChange={(v) =>
                          updateSetting(
                            `comfortSettings.${key}.heatSetPoint`,
                            Number(v)
                          )
                        }
                        min={50}
                        max={90}
                      />
                      <SettingInput
                        label="Cool Set Point (°F)"
                        type="number"
                        value={comfort.coolSetPoint}
                        onChange={(v) =>
                          updateSetting(
                            `comfortSettings.${key}.coolSetPoint`,
                            Number(v)
                          )
                        }
                        min={50}
                        max={90}
                      />
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Fan Mode
                        </label>
                        <select
                          value={comfort.fanMode}
                          onChange={(e) =>
                            updateSetting(
                              `comfortSettings.${key}.fanMode`,
                              e.target.value
                            )
                          }
                          className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                        >
                          <option value="auto">Auto</option>
                          <option value="on">On</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* Schedule */}
      {matchesSearch("schedule", "Schedule") && (
        <div
          id="schedule"
          ref={(el) => (sectionRefs.current.schedule = el)}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <button
            onClick={() => toggleSection("schedule")}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-purple-600" />
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                Schedule
              </span>
            </div>
            {expandedSections.schedule ? (
              <ChevronDown size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
          </button>
          {expandedSections.schedule && (
            <div className="p-4 border-t dark:border-gray-700">
              <ScheduleEditor />
            </div>
          )}
        </div>
      )}

      {/* Preferences */}
      {matchesSearch("preferences", "Preferences") && (
        <div
          ref={(el) => (sectionRefs.current.preferences = el)}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <button
            onClick={() => toggleSection("preferences")}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings size={18} className="text-orange-600" />
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                Preferences
              </span>
            </div>
            {expandedSections.preferences ? (
              <ChevronDown size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
          </button>
          {expandedSections.preferences && (
            <div className="p-4 border-t dark:border-gray-700 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingInput
                  label="Display Brightness (1-10)"
                  type="number"
                  value={settings.preferences.display.brightness}
                  onChange={(v) =>
                    updateSetting("preferences.display.brightness", Number(v))
                  }
                  min={1}
                  max={10}
                />
                <SettingInput
                  label="Screen Timeout (sec)"
                  type="number"
                  value={settings.preferences.display.screenTimeout}
                  onChange={(v) =>
                    updateSetting(
                      "preferences.display.screenTimeout",
                      Number(v)
                    )
                  }
                  min={10}
                  max={300}
                />
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Temperature Units
                  </label>
                  <select
                    value={settings.preferences.display.units}
                    onChange={(e) =>
                      updateSetting("preferences.display.units", e.target.value)
                    }
                    className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                  >
                    <option value="F">°F (Fahrenheit)</option>
                    <option value="C">°C (Celsius)</option>
                  </select>
                </div>
                <SettingInput
                  label="Follow Me (Occupancy-based)"
                  type="checkbox"
                  value={settings.preferences.followMe}
                  onChange={(v) => updateSetting("preferences.followMe", v)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alerts/Reminders */}
      {matchesSearch("alerts", "Alerts & Reminders") && (
        <div
          ref={(el) => (sectionRefs.current.alerts = el)}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <button
            onClick={() => toggleSection("alerts")}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-red-600" />
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                Alerts & Reminders
              </span>
            </div>
            {expandedSections.alerts ? (
              <ChevronDown size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
          </button>
          {expandedSections.alerts && (
            <div className="p-4 border-t dark:border-gray-700 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingInput
                  label="Filter Change Reminder"
                  type="checkbox"
                  value={settings.alerts.filterChangeReminder}
                  onChange={(v) =>
                    updateSetting("alerts.filterChangeReminder", v)
                  }
                />
                <SettingInput
                  label="Filter Change Interval (days)"
                  type="number"
                  value={settings.alerts.filterChangeInterval}
                  onChange={(v) =>
                    updateSetting("alerts.filterChangeInterval", Number(v))
                  }
                  min={30}
                  max={365}
                />
                <SettingInput
                  label="Maintenance Reminder"
                  type="checkbox"
                  value={settings.alerts.maintenanceReminder}
                  onChange={(v) =>
                    updateSetting("alerts.maintenanceReminder", v)
                  }
                />
                <SettingInput
                  label="Temperature Alerts"
                  type="checkbox"
                  value={settings.alerts.temperatureAlerts}
                  onChange={(v) => updateSetting("alerts.temperatureAlerts", v)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Access Control */}
      {matchesSearch("accessControl", "Access Control") && (
        <div
          ref={(el) => (sectionRefs.current.access = el)}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
        >
          <button
            onClick={() => toggleSection("access")}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-gray-600" />
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                Access Control
              </span>
            </div>
            {expandedSections.access ? (
              <ChevronDown size={20} />
            ) : (
              <ChevronRight size={20} />
            )}
          </button>
          {expandedSections.access && (
            <div className="p-4 border-t dark:border-gray-700 space-y-4">
              <SettingInput
                label="Require PIN to Change Settings"
                type="checkbox"
                value={settings.accessControl.requirePin}
                onChange={(v) => updateSetting("accessControl.requirePin", v)}
              />
              {settings.accessControl.requirePin && (
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    PIN (4 digits)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={settings.accessControl.pin || ""}
                    onChange={(e) =>
                      updateSetting(
                        "accessControl.pin",
                        e.target.value.replace(/\D/g, "").slice(0, 4)
                      )
                    }
                    className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                    placeholder="0000"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingInput({
  label,
  type,
  value,
  onChange,
  min,
  max,
  step,
  error,
  helpKey,
  defaultValue,
  showComparison,
  settingKey, // New prop: the full setting path (e.g., "thresholds.heatDifferential")
}) {
  const [showHelp, setShowHelp] = useState(false);
  const helpText = helpKey ? SETTINGS_HELP[helpKey] : null;
  const guideLink = settingKey ? SETTINGS_GUIDES[settingKey] : null;
  const isDifferent =
    showComparison &&
    defaultValue !== undefined &&
    JSON.stringify(value) !== JSON.stringify(defaultValue);
  
  // Calculate optimal value based on CSV analysis or typical values
  const handleAutoClick = () => {
    const analysis = analyzeCSVData();
    
    let recommendedValue = null;
    let message = "";
    
    if (analysis) {
      // Use CSV analysis if available, but still provide reference manual explanations
      switch (settingKey) {
        case "thresholds.heatDifferential":
          recommendedValue = analysis.heatDifferential || TYPICAL_VALUES[settingKey];
          message = analysis.cyclesPerHour !== null 
            ? `Auto-set to ${recommendedValue}°F. Default 0.5°F causes rapid cycling (6+ cycles/hr). ${recommendedValue}°F reduces cycles by ~40% with no noticeable comfort loss. Your data shows ${analysis.cyclesPerHour.toFixed(1)} cycles/hour.`
            : `Auto-set to ${recommendedValue}°F. Default 0.5°F causes rapid cycling (6+ cycles/hr). ${recommendedValue}°F reduces cycles by ~40% with no noticeable comfort loss.`;
          break;
        case "thresholds.coolDifferential":
          recommendedValue = analysis.heatDifferential || TYPICAL_VALUES[settingKey]; // Use same logic as heat
          message = `Auto-set to ${recommendedValue}°F. Default 0.5°F causes rapid cycling (6+ cycles/hr). ${recommendedValue}°F reduces cycles by ~40% with no noticeable comfort loss.`;
          break;
        case "thresholds.compressorMinCycleOff":
          recommendedValue = analysis.compressorMinCycleOff || TYPICAL_VALUES[settingKey];
          message = `Auto-set to ${recommendedValue}s (${recommendedValue/60} min). NEMA MG-1: Motors overheat on startup. Extending the rest period allows refrigerant pressures to equalize, reducing startup torque and amp draw. Default 300s (5 min) is too short.`;
          break;
        case "thresholds.heatMinOnTime":
          recommendedValue = analysis.heatMinOnTime || TYPICAL_VALUES[settingKey];
          message = `Auto-set to ${recommendedValue}s (${recommendedValue/60} min). Oil return: The oil in the compressor migrates into the lines. It takes ~3-5 minutes of runtime to push it back to the crankcase. Short runs starve the compressor of oil.`;
          break;
        case "thresholds.coolMinOnTime":
          recommendedValue = TYPICAL_VALUES[settingKey];
          message = `Auto-set to ${recommendedValue}s (${recommendedValue/60} min). Oil return: Same requirement as heat - oil needs time to return to compressor crankcase.`;
          break;
        case "thresholds.compressorMinOutdoorTemp":
          recommendedValue = analysis.compressorMinOutdoorTemp || TYPICAL_VALUES[settingKey];
          message = analysis.compressorMinOutdoorTemp
            ? `Auto-set to ${recommendedValue}°F (Balance Point). Below balance point, heat pumps run continuously but lose ground. Running a compressor at very low temps (unless cold-climate rated) risks oil thickening and mechanical stress for very little heat.`
            : `Auto-set to ${recommendedValue}°F (Balance Point). Below balance point, heat pumps run continuously but lose ground. Set to your system's balance point temperature.`;
          break;
        case "thresholds.auxHeatMaxOutdoorTemp":
          recommendedValue = analysis.auxHeatMaxOutdoorTemp || TYPICAL_VALUES[settingKey];
          message = `Auto-set to ${recommendedValue}°F. Electric strips cost 3x more than heat pumps. Never use them above freezing unless it's an emergency. This is the "Bank Account" defender.`;
          break;
        case "thresholds.heatDissipationTime":
          recommendedValue = analysis.heatDissipationTime || TYPICAL_VALUES[settingKey];
          message = `Auto-set to ${recommendedValue}s. The heat exchanger is still hot when the fire stops. ${recommendedValue}s of fan scavenges that "free" heat into the room. (Gas furnaces may need shorter time to avoid blowing cold air at the end).`;
          break;
        case "thresholds.coolDissipationTime":
          recommendedValue = TYPICAL_VALUES[settingKey];
          message = `Auto-set to ${recommendedValue}s. The coil is still wet and cold. ${recommendedValue}s evaporates the water (cooling the air) and raises the Sensible Heat Ratio for the next run.`;
          break;
        case "thresholds.acOvercoolMax":
          recommendedValue = TYPICAL_VALUES[settingKey];
          message = `Auto-set to ${recommendedValue}°F. Allows the AC to act as a "Dehumidifier." If humidity > target, keep cooling. Cold & Dry feels better than Warm & Wet. Default 0°F disables this feature.`;
          break;
        case "thresholds.heatCoolMinDelta":
          recommendedValue = TYPICAL_VALUES[settingKey];
          message = `Auto-set to ${recommendedValue}°F. Prevents "mode fighting." If set to 2°F, the AC might overshoot and trigger the heat immediately. Range: 4-5°F recommended.`;
          break;
        case "thresholds.temperatureCorrection":
          recommendedValue = TYPICAL_VALUES[settingKey];
          message = `Auto-set to ${recommendedValue}°F (no correction). Use this if your thermostat reads accurately. Adjust if you notice a consistent offset between your thermostat and a calibrated thermometer.`;
          break;
        case "thresholds.humidityCorrection":
          recommendedValue = TYPICAL_VALUES[settingKey];
          message = `Auto-set to ${recommendedValue}% (no correction). Use this if your humidity sensor reads accurately. Adjust if you notice a consistent offset between your sensor and a calibrated hygrometer.`;
          break;
        case "thresholds.thermalProtect":
          recommendedValue = TYPICAL_VALUES[settingKey];
          message = `Auto-set to ${recommendedValue}°F. Maximum difference between the thermostat's temperature reading and remote sensors. If a sensor reads wildly different, it may be ignored. Helps avoid using bad sensors.`;
          break;
        default:
          recommendedValue = TYPICAL_VALUES[settingKey];
          message = recommendedValue 
            ? `Auto-set to ${recommendedValue}${settingKey.includes('Temp') ? '°F' : settingKey.includes('Time') ? 's' : settingKey.includes('Correction') ? (settingKey.includes('Temperature') ? '°F' : '%') : ''} (typical recommendation).`
            : "No recommendation available for this setting.";
      }
    } else {
      // No CSV data - use typical values with reference manual explanations
      recommendedValue = TYPICAL_VALUES[settingKey];
      if (recommendedValue !== undefined && recommendedValue !== null) {
        switch (settingKey) {
          case "thresholds.heatDifferential":
            message = `Auto-set to ${recommendedValue}°F. Default 0.5°F causes rapid cycling (6+ cycles/hr). ${recommendedValue}°F reduces cycles by ~40% with no noticeable comfort loss.`;
            break;
          case "thresholds.coolDifferential":
            message = `Auto-set to ${recommendedValue}°F. Default 0.5°F causes rapid cycling (6+ cycles/hr). ${recommendedValue}°F reduces cycles by ~40% with no noticeable comfort loss.`;
            break;
          case "thresholds.compressorMinCycleOff":
            message = `Auto-set to ${recommendedValue}s (${recommendedValue/60} min). NEMA MG-1: Motors overheat on startup. Extending the rest period allows refrigerant pressures to equalize, reducing startup torque and amp draw. Default 300s (5 min) is too short.`;
            break;
          case "thresholds.heatMinOnTime":
            message = `Auto-set to ${recommendedValue}s (${recommendedValue/60} min). Oil return: The oil in the compressor migrates into the lines. It takes ~3-5 minutes of runtime to push it back to the crankcase. Short runs starve the compressor of oil.`;
            break;
          case "thresholds.coolMinOnTime":
            message = `Auto-set to ${recommendedValue}s (${recommendedValue/60} min). Oil return: Same requirement as heat - oil needs time to return to compressor crankcase.`;
            break;
          case "thresholds.compressorMinOutdoorTemp":
            message = `Auto-set to ${recommendedValue}°F (Balance Point). Below balance point, heat pumps run continuously but lose ground. Running a compressor at very low temps (unless cold-climate rated) risks oil thickening and mechanical stress for very little heat.`;
            break;
          case "thresholds.auxHeatMaxOutdoorTemp":
            message = `Auto-set to ${recommendedValue}°F. Electric strips cost 3x more than heat pumps. Never use them above freezing unless it's an emergency. This is the "Bank Account" defender.`;
            break;
          case "thresholds.heatDissipationTime":
            message = `Auto-set to ${recommendedValue}s. The heat exchanger is still hot when the fire stops. ${recommendedValue}s of fan scavenges that "free" heat into the room. (Gas furnaces may need shorter time to avoid blowing cold air at the end).`;
            break;
          case "thresholds.coolDissipationTime":
            message = `Auto-set to ${recommendedValue}s. The coil is still wet and cold. ${recommendedValue}s evaporates the water (cooling the air) and raises the Sensible Heat Ratio for the next run.`;
            break;
          case "thresholds.acOvercoolMax":
            message = `Auto-set to ${recommendedValue}°F. Allows the AC to act as a "Dehumidifier." If humidity > target, keep cooling. Cold & Dry feels better than Warm & Wet. Default 0°F disables this feature.`;
            break;
          case "thresholds.heatCoolMinDelta":
            message = `Auto-set to ${recommendedValue}°F. Prevents "mode fighting." If set to 2°F, the AC might overshoot and trigger the heat immediately. Range: 4-5°F recommended.`;
            break;
          case "thresholds.temperatureCorrection":
            message = `Auto-set to ${recommendedValue}°F (no correction). Use this if your thermostat reads accurately. Adjust if you notice a consistent offset between your thermostat and a calibrated thermometer.`;
            break;
          case "thresholds.humidityCorrection":
            message = `Auto-set to ${recommendedValue}% (no correction). Use this if your humidity sensor reads accurately. Adjust if you notice a consistent offset between your sensor and a calibrated hygrometer.`;
            break;
          case "thresholds.thermalProtect":
            message = `Auto-set to ${recommendedValue}°F. Maximum difference between the thermostat's temperature reading and remote sensors. If a sensor reads wildly different, it may be ignored. Helps avoid using bad sensors.`;
            break;
          default:
            message = `Auto-set to ${recommendedValue}${settingKey.includes('Temp') ? '°F' : settingKey.includes('Time') ? 's' : ''} (typical recommendation). Upload CSV data in System Performance Analyzer for data-driven optimization.`;
        }
      } else {
        alert("No CSV data available and no typical value for this setting. Please upload thermostat data in the System Performance Analyzer first.");
        return;
      }
    }
    
    if (recommendedValue !== null) {
      onChange(String(recommendedValue));
      alert(message);
    }
  };
  
  // Only show Auto button for settings that support it
  const showAutoButton = settingKey && (
    settingKey === "thresholds.heatDifferential" || 
    settingKey === "thresholds.coolDifferential" ||
    settingKey === "thresholds.compressorMinCycleOff" ||
    settingKey === "thresholds.heatMinOnTime" ||
    settingKey === "thresholds.coolMinOnTime" ||
    settingKey === "thresholds.compressorMinOutdoorTemp" ||
    settingKey === "thresholds.auxHeatMaxOutdoorTemp" ||
    settingKey === "thresholds.heatDissipationTime" ||
    settingKey === "thresholds.coolDissipationTime" ||
    settingKey === "thresholds.acOvercoolMax" ||
    settingKey === "thresholds.heatCoolMinDelta" ||
    settingKey === "thresholds.temperatureCorrection" ||
    settingKey === "thresholds.humidityCorrection" ||
    settingKey === "thresholds.thermalProtect"
  );

  if (type === "checkbox") {
    return (
      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded"
          />
          <span className="text-gray-700 dark:text-gray-300">{label}</span>
          {helpText && (
            <div className="relative group">
              <HelpCircle
                size={14}
                className="text-gray-400 hover:text-gray-600 cursor-help"
                onMouseEnter={() => setShowHelp(true)}
                onMouseLeave={() => setShowHelp(false)}
              />
              {showHelp && (
                <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded shadow-lg z-10">
                  {helpText}
                </div>
              )}
            </div>
          )}
        </label>
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
        {label}
        {helpText && (
          <div className="relative group">
            <HelpCircle
              size={12}
              className="text-gray-400 hover:text-gray-600 cursor-help"
              onMouseEnter={() => setShowHelp(true)}
              onMouseLeave={() => setShowHelp(false)}
            />
            {showHelp && (
              <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded shadow-lg z-10">
                {helpText}
              </div>
            )}
          </div>
        )}
        {guideLink && (
          <a
            href={guideLink}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            title="View guide"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={12} />
          </a>
        )}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            min={min}
            max={max}
            step={step}
            className={`w-full p-2 rounded border ${
              error
                ? "border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/30"
                : isDifferent
                ? "border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            } text-gray-900 dark:text-gray-100`}
          />
          {showComparison && isDifferent && defaultValue !== undefined && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-blue-600 dark:text-blue-400">
              Default: {defaultValue}
            </div>
          )}
        </div>
        {showAutoButton && (
          <button
            onClick={handleAutoClick}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1 whitespace-nowrap"
            title="Auto-calculate based on CSV data analysis (NEMA MG-1 safety limits)"
          >
            <Zap size={12} />
            Auto
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
