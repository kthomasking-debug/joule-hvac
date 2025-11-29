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
} from "lucide-react";
import {
  loadThermostatSettings,
  saveThermostatSettings,
  updateThermostatSetting,
  DEFAULT_THERMOSTAT_SETTINGS,
} from "../lib/thermostatSettings";
import ScheduleEditor from "./ScheduleEditor";

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
  "thresholds.compressorMinCycleOff":
    "Minimum time compressor must stay off between cycles (protects compressor from short cycling)",
  "thresholds.heatDifferential":
    "Dead band for heating: how far below setpoint before heat turns on",
  "thresholds.coolDifferential":
    "Dead band for cooling: how far above setpoint before cooling turns on",
  "thresholds.heatMinOnTime":
    "Minimum time heating must run once turned on (prevents short cycles)",
  "thresholds.coolMinOnTime":
    "Minimum time cooling must run once turned on (prevents short cycles)",
  "thresholds.temperatureCorrection":
    "Offset to apply to temperature readings (useful for sensor calibration)",
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
            ⚡ Energy Saver
          </button>
          <button
            onClick={() => applyPreset("comfort")}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
          >
            😌 Comfort
          </button>
          <button
            onClick={() => applyPreset("aggressive")}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
          >
            ⚡ Aggressive
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
                />
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
                />
                <SettingInput
                  label="Compressor Reverse Staging"
                  type="checkbox"
                  value={settings.thresholds.compressorReverseStaging}
                  onChange={(v) =>
                    updateSetting("thresholds.compressorReverseStaging", v)
                  }
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
}) {
  const [showHelp, setShowHelp] = useState(false);
  const helpText = helpKey ? SETTINGS_HELP[helpKey] : null;
  const isDifferent =
    showComparison &&
    defaultValue !== undefined &&
    JSON.stringify(value) !== JSON.stringify(defaultValue);

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
      </label>
      <div className="relative">
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
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
