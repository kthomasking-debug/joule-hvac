import React, { useEffect, useRef, useState } from "react";
import { 
  Settings, ChevronRight, Home, ThermometerSun, Flame, Mic, 
  Snowflake, HelpCircle, Shield, FileText, Crown, Lock, 
  CheckCircle2, Trash2, RotateCcw, XCircle, Server, Circle 
} from "lucide-react";
import { fullInputClasses } from "../lib/uiClasses";
import { DashboardLink } from "../components/DashboardLink";
import { Toast } from "../components/Toast";
import { useOutletContext } from "react-router-dom";
import { resizeToCover } from "../lib/imageProcessing";
import { saveCustomHeroBlob, getCustomHeroUrl, deleteCustomHero } from "../lib/userImages";
import ThermostatSettingsPanel from "../components/ThermostatSettingsPanel";

const Section = ({ title, icon, children, ...props }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4" {...props}>
    <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
      {icon} {title}
    </h2>
    {children}
  </div>
);

const VoiceListenDurationInput = () => {
  const [value, setValue] = useState(() => {
    const raw = localStorage.getItem("askJouleListenSeconds");
    if (raw === null || raw === undefined) return 5;
    const v = Number(raw);
    return Number.isNaN(v) ? 5 : v;
  });
  const handleChange = (e) => {
    const val = Math.max(2, Math.min(30, Number(e.target.value)));
    setValue(val);
    try { 
      localStorage.setItem("askJouleListenSeconds", String(val)); 
    } catch {}
    window.dispatchEvent(new Event("askJouleListenSecondsChanged"));
  };
  return (
    <div className="flex items-center gap-3">
      <input 
        type="number" 
        min={2} 
        max={30} 
        step={1} 
        value={value} 
        onChange={handleChange} 
        className="w-20 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-center" 
        aria-label="Voice listening duration" 
      />
      <span className="text-sm text-gray-600 dark:text-gray-300">seconds</span>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        (How long voice input listens before auto-stopping)
      </p>
    </div>
  );
};

const GroqApiKeyInput = () => {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem("groqApiKey") || "";
    } catch {
      return "";
    }
  });
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(() => {
    try {
      return localStorage.getItem("groqModel") || "llama-3.1-8b-instant";
    } catch {
      return "llama-3.1-8b-instant";
    }
  });
  
  const handleChange = (e) => {
    const val = e.target.value.trim();
    setValue(val);
    try {
      if (val) {
        localStorage.setItem("groqApiKey", val);
      } else {
        localStorage.removeItem("groqApiKey");
      }
    } catch {}
  };
  
  const handleModelChange = (e) => {
    const selectedModel = e.target.value;
    setModel(selectedModel);
    try {
      localStorage.setItem("groqModel", selectedModel);
      // Trigger storage event for other components to pick up the change
      window.dispatchEvent(new Event("storage"));
    } catch {}
  };
  
  const clearKey = () => {
    setValue("");
    try {
      localStorage.removeItem("groqApiKey");
    } catch {}
  };
  
  const modelOptions = [
    { 
      value: "llama-3.1-8b-instant", 
      label: "Llama 3.1 8B (Fast, Recommended)",
      description: "Best balance of speed and quality"
    },
    { 
      value: "llama-3.1-70b-versatile", 
      label: "Llama 3.1 70B (High Quality)",
      description: "More accurate but slower"
    },
    { 
      value: "mixtral-8x7b-32768", 
      label: "Mixtral 8x7B (Large Context)",
      description: "Good for complex queries"
    }
  ];
  
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Groq API Key (Optional)
        </label>
        <div className="flex items-center gap-2">
          <input 
            type={showKey ? "text" : "password"}
            value={value} 
            onChange={handleChange}
            placeholder="gsk_..." 
            className="flex-1 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono" 
            aria-label="Groq API Key" 
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="px-3 py-2 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
            aria-label={showKey ? "Hide key" : "Show key"}
          >
            {showKey ? "🙈" : "👁️"}
          </button>
          {value && (
            <button
              type="button"
              onClick={clearKey}
              className="px-3 py-2 rounded border border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 dark:text-red-400"
              aria-label="Clear key"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      
      {/* Model Selector */}
      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          AI Model
        </label>
        <select
          value={model}
          onChange={handleModelChange}
          className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          aria-label="Select Groq Model"
        >
          {modelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {modelOptions.find(o => o.value === model)?.description}
        </p>
      </div>
      
      <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
        <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
          ℹ️ What's this for?
        </p>
        <p className="mb-2">
          Ask Joule can optionally use Groq's LLM API for advanced natural language understanding when built-in parsing can't handle complex questions.
        </p>
        <p className="mb-2">
          <strong>Get a free key:</strong> Visit{" "}
          <a 
            href="https://console.groq.com/keys" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800"
          >
            console.groq.com/keys
          </a>
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          🔒 Your API key is stored locally in your browser and never sent to our servers. All Groq API calls are made directly from your browser to Groq.
        </p>
      </div>
      {value && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 size={16} />
          <span>API key configured with {modelOptions.find(o => o.value === model)?.label} ✓</span>
        </div>
      )}
    </div>
  );
};

const UserProfileCard = ({ setToast }) => {
  const [customHeroUrl, setCustomHeroUrl] = useState(null);
  const fileInputRef = useRef(null);
  
  useEffect(() => { 
    let mounted = true; 
    (async () => { 
      const url = await getCustomHeroUrl(); 
      if (mounted) setCustomHeroUrl(url); 
    })(); 
    return () => { mounted = false; }; 
  }, []);
  
  const handleFileChange = async (e) => { 
    const file = e.target.files && e.target.files[0]; 
    if (!file) return; 
    try { 
      const blob = await resizeToCover(file, { 
        width: 1600, 
        height: 900, 
        type: "image/png", 
        quality: 0.92 
      }); 
      const url = await saveCustomHeroBlob(blob); 
      if (url) { 
        setCustomHeroUrl(url); 
        try { 
          localStorage.setItem("onboardingWelcomeTheme", "custom"); 
        } catch (err) {}
        setToast({ message: "Profile picture saved.", type: "success" }); 
      } 
    } catch (err) { 
      setToast({ 
        message: "Could not process that image. Please try a different file.", 
        type: "error" 
      }); 
    } finally { 
      if (fileInputRef.current) fileInputRef.current.value = ""; 
    } 
  };
  
  const removeProfilePicture = async () => { 
    try { 
      await deleteCustomHero(); 
      setCustomHeroUrl(null); 
      try { 
        localStorage.setItem("onboardingWelcomeTheme", "winter"); 
      } catch (err) {}
      setToast({ message: "Profile picture removed.", type: "info" }); 
    } catch (err) { 
      setToast({ message: "Failed to remove profile picture.", type: "error" }); 
    } 
  };
  
  return (
    <Section title="My Profile" icon={<Settings size={20} />}>
      <div className="flex items-center gap-5">
        <img 
          src={customHeroUrl || "/default-avatar.png"} 
          alt="Profile avatar" 
          className="w-24 h-24 rounded-full object-cover border-2 border-blue-500" 
        />
        <div className="flex flex-col gap-2">
          <button 
            onClick={() => fileInputRef.current?.click()} 
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition-colors"
          >
            Upload Picture
          </button>
          {customHeroUrl && (
            <button 
              onClick={removeProfilePicture} 
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileChange} 
      />
    </Section>
  );
};

const BuildingCharacteristics = ({ settings, onSettingChange }) => (
  <Section title="Building Characteristics" icon={<Home size={20} />}>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
          Home Size (sq ft)
        </label>
        <input 
          type="number" 
          value={settings.squareFeet ?? 2000} 
          onChange={(e) => onSettingChange('squareFeet', Number(e.target.value))} 
          className={fullInputClasses} 
        />
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
          Insulation Quality
        </label>
        <select 
          value={settings.insulationLevel ?? 1.0} 
          onChange={(e) => onSettingChange('insulationLevel', Number(e.target.value))} 
          className={fullInputClasses}
        >
          <option value={1.4}>Poor</option>
          <option value={1.0}>Average</option>
          <option value={0.65}>Good</option>
        </select>
      </div>
    </div>
  </Section>
);

const HvacSystemConfig = ({ settings, onSettingChange, setToast }) => {
  const [showAfueTooltip, setShowAfueTooltip] = useState(false);
  const capacities = { 18: 1.5, 24: 2, 30: 2.5, 36: 3, 42: 3.5, 48: 4, 60: 5 };
  const inputClasses = "w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";
  const selectClasses = "w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100";

  return (
    <Section title="HVAC System Configuration" icon={<ThermometerSun size={20} />}>
      <div className="space-y-4">
        {/* Primary System Selection */}
        <div>
          <p className="text-sm font-semibold mb-2 text-gray-600 dark:text-gray-300">
            Primary Heating System
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Select how your home is heated.
          </p>
          <div className="inline-flex rounded-md overflow-hidden border dark:border-gray-600">
            <button 
              onClick={() => onSettingChange("primarySystem", "heatPump")} 
              className={`px-4 py-2 text-sm font-semibold flex items-center gap-1 ${
                settings.primarySystem === "heatPump" 
                  ? "bg-blue-600 text-white" 
                  : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              }`}
            >
              ⚡ Heat Pump
            </button>
            <button 
              onClick={() => onSettingChange("primarySystem", "gasFurnace")} 
              className={`px-4 py-2 text-sm font-semibold flex items-center gap-1 ${
                settings.primarySystem === "gasFurnace" 
                  ? "bg-blue-600 text-white" 
                  : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              }`}
            >
              <Flame size={16} /> Gas Furnace
            </button>
          </div>
        </div>

        {/* Heat Pump Configuration */}
        {settings.primarySystem === "heatPump" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
                Heating Efficiency (HSPF2)
              </label>
              <input
                type="number"
                min={6}
                max={13}
                step={0.1}
                value={settings.hspf2 ?? 8.5}
                onChange={(e) => onSettingChange('hspf2', Math.min(13, Math.max(6, Number(e.target.value))))}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
                Cooling Efficiency (SEER2)
              </label>
              <input
                type="number"
                min={14}
                max={22}
                step={1}
                value={settings.efficiency ?? 16}
                onChange={(e) => onSettingChange('efficiency', Math.min(22, Math.max(14, Number(e.target.value))))}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
                Capacity (Tons)
              </label>
              <select
                value={settings.capacity ?? settings.coolingCapacity ?? 36}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onSettingChange('coolingCapacity', v);
                  onSettingChange('capacity', v);
                  setToast?.({
                    message: `Capacity updated: ${capacities[v]} tons (${v}k BTU)`,
                    type: 'success'
                  });
                }}
                className={selectClasses}
              >
                {[18, 24, 30, 36, 42, 48, 60].map((bt) => (
                  <option key={bt} value={bt}>
                    {bt}k BTU ({capacities[bt]} tons)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Gas Furnace Configuration */}
        {settings.primarySystem === "gasFurnace" && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Furnace AFUE
                </label>
                <button
                  type="button"
                  onClick={() => setShowAfueTooltip(!showAfueTooltip)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  aria-label="What's AFUE?"
                >
                  <HelpCircle size={14} />
                </button>
              </div>

              {showAfueTooltip && (
                <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
                  <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
                    What's AFUE?
                  </p>
                  <p className="mb-2">
                    AFUE stands for <strong>Annual Fuel Utilization Efficiency</strong>.
                    It's like your furnace's "gas mileage."
                  </p>
                  <ul className="space-y-1 ml-4 mb-2">
                    <li><strong>90-98%:</strong> High-efficiency furnace</li>
                    <li><strong>80%:</strong> Standard, mid-efficiency</li>
                    <li><strong>&lt; 80%:</strong> Older, less efficient</li>
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0.6}
                  max={0.99}
                  step={0.01}
                  value={settings.afue ?? 0.95}
                  onChange={(e) => onSettingChange('afue', Math.min(0.99, Math.max(0.6, Number(e.target.value))))}
                  className="flex-grow"
                />
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {Math.round((settings.afue ?? 0.95) * 100)}%
                </span>
              </div>
            </div>

            {/* Cooling System for Gas Furnace */}
            <div>
              <p className="text-xs font-semibold mb-2 text-gray-600 dark:text-gray-300">
                Cooling System
              </p>
              <div className="inline-flex rounded-md overflow-hidden border dark:border-gray-600">
                <button
                  type="button"
                  onClick={() => onSettingChange("coolingSystem", "centralAC")}
                  className={`px-3 py-1 text-xs font-semibold flex items-center gap-1 ${
                    settings.coolingSystem === "centralAC"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  <Snowflake size={14} /> Central A/C
                </button>
                <button
                  type="button"
                  onClick={() => onSettingChange("coolingSystem", "dualFuel")}
                  className={`px-3 py-1 text-xs font-semibold flex items-center gap-1 ${
                    settings.coolingSystem === "dualFuel"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  ⚡ Dual-Fuel HP
                </button>
                <button
                  type="button"
                  onClick={() => onSettingChange("coolingSystem", "none")}
                  className={`px-3 py-1 text-xs font-semibold flex items-center gap-1 ${
                    settings.coolingSystem === "none"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  None/Other
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Thermostat Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t dark:border-gray-700">
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
              Winter Thermostat (°F)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={60}
                max={78}
                value={settings.winterThermostat ?? 70}
                onChange={(e) => onSettingChange('winterThermostat', Number(e.target.value))}
                className="flex-grow"
              />
              <div className="w-14 text-sm font-bold text-blue-600">
                {settings.winterThermostat ?? 70}°
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Typical winter thermostat for heating estimates
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
              Summer Thermostat (°F)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={68}
                max={82}
                value={settings.summerThermostat ?? 74}
                onChange={(e) => onSettingChange('summerThermostat', Number(e.target.value))}
                className="flex-grow"
              />
              <div className="w-14 text-sm font-bold text-blue-600">
                {settings.summerThermostat ?? 74}°
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              Typical summer thermostat for cooling estimates
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
};

const SettingsPage = () => {
  const [toast, setToast] = useState(null);
  const [advancedSettingsExpanded, setAdvancedSettingsExpanded] = useState(false);
  const outletCtx = useOutletContext() || {};
  const userSettings = outletCtx.userSettings || {};
  const setUserSetting = outletCtx.setUserSetting || ((key, value) => { 
    console.warn(`setUserSetting not provided for setting: ${key}`, value); 
  });

  return (
    <div className="settings-page p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings size={28} className="text-blue-600" /> Settings
        </h1>
        <DashboardLink />
      </header>

      <UserProfileCard setToast={setToast} />
      <BuildingCharacteristics settings={userSettings} onSettingChange={setUserSetting} />
      <HvacSystemConfig settings={userSettings} onSettingChange={setUserSetting} setToast={setToast} />

      {/* Advanced Settings Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <button 
          onClick={() => setAdvancedSettingsExpanded(!advancedSettingsExpanded)} 
          className="w-full p-5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-lg"
        >
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Advanced Settings
          </h2>
          <ChevronRight 
            className={`text-gray-500 transition-transform ${
              advancedSettingsExpanded ? "rotate-90" : ""
            }`} 
          />
        </button>
        
        {advancedSettingsExpanded && (
          <div className="p-5 border-t dark:border-gray-700 space-y-6">
            <Section title="Groq AI Integration" icon={<Server size={20} />}>
              <GroqApiKeyInput />
            </Section>
            
            <Section title="Voice Listening Duration" icon={<Mic size={20} />}>
              <VoiceListenDurationInput />
            </Section>
            
            <Section title="Thermostat Settings" icon={<Settings size={20} />}>
              <ThermostatSettingsPanel />
            </Section>

            {/* Detailed Annual Estimate Toggle */}
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-gray-100">
                    Detailed Annual Estimate
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Use month-by-month calculations for more accurate annual estimates
                  </p>
                </div>
                <label className="inline-flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!userSettings.useDetailedAnnualEstimate}
                    onChange={(e) => setUserSetting("useDetailedAnnualEstimate", e.target.checked)}
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
};

export default SettingsPage;