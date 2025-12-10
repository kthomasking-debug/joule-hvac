import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Home,
  ThermometerSun,
  Flame,
  Mic,
  Snowflake,
  HelpCircle,
  Shield,
  FileText,
  Crown,
  Lock,
  CheckCircle2,
  Trash2,
  RotateCcw,
  XCircle,
  Server,
  Circle,
  DollarSign,
  ExternalLink,
  Plus,
  Edit2,
  Zap,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  fetchGroqModels,
  suggestModel,
  formatModelLabel,
  getModelDescription,
  getBestModel,
} from "../lib/groqModels";
import { fullInputClasses } from "../lib/uiClasses";
import { DashboardLink } from "../components/DashboardLink";
import { Toast } from "../components/Toast";
import { useOutletContext } from "react-router-dom";
import { resizeToCover } from "../lib/imageProcessing";
import {
  saveCustomHeroBlob,
  getCustomHeroUrl,
  deleteCustomHero,
} from "../lib/userImages";
import ThermostatSettingsPanel from "../components/ThermostatSettingsPanel";
import EcobeeSettings from "../components/EcobeeSettings";
import JouleBridgeSettings from "../components/JouleBridgeSettings";
import StorageUsageIndicator from "../components/StorageUsageIndicator";
import { EBAY_STORE_URL } from "../utils/rag/salesFAQ";
import AutoSettingsMathEquations from "../components/AutoSettingsMathEquations";
import { setProCode, clearProCode, hasProAccess } from "../utils/demoMode";
import { getStorageUsage, cleanupOldAnalyses } from "../utils/storageCleanup";
import { useAutoSave } from "../hooks/useAutoSave";
import ValidatedInput from "../components/ValidatedInput";
import UnitSystemToggle from "../components/UnitSystemToggle";

const Section = ({ title, icon, description, children, ...props }) => (
  <div
    className="bg-[#0C1118] border border-slate-800 rounded-xl p-6 space-y-4"
    {...props}
  >
    <div>
      <h2 className="text-[18px] font-medium text-[#E8EDF3] flex items-center gap-3">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
            {icon}
          </div>
        )}
        {title}
      </h2>
      {description && (
        <p className="text-xs text-[#A7B0BA] mt-1 mb-3 max-w-2xl leading-relaxed">
          {description}
        </p>
      )}
    </div>
    {children}
  </div>
);

const ProCodeInput = () => {
  const [code, setCode] = useState(() => {
    try {
      return localStorage.getItem('proCode') || '';
    } catch {
      return '';
    }
  });
  const [proAccess, setProAccess] = useState({ hasAccess: false, source: null });
  const [message, setMessage] = useState('');
  const location = useLocation();

  useEffect(() => {
    checkAccess();
  }, []);

  // Scroll to Joule Bridge section when navigated to with #joule-bridge hash
  useEffect(() => {
    if (location.hash === '#joule-bridge') {
      // Scroll to joule-bridge section after a brief delay to ensure it's rendered
      setTimeout(() => {
        const jouleBridgeElement = document.getElementById('joule-bridge');
        if (jouleBridgeElement) {
          jouleBridgeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [location.hash]);

  const checkAccess = async () => {
    const access = await hasProAccess();
    setProAccess(access);
  };

  const handleSetCode = async () => {
    if (!code.trim()) {
      setMessage('Please enter a Pro code');
      return;
    }

    const success = setProCode(code.trim());
    if (success) {
      setMessage('Pro code saved! Checking access...');
      await checkAccess();
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage('Failed to save Pro code');
    }
  };

  const handleClearCode = () => {
    clearProCode();
    setCode('');
    setMessage('Pro code cleared');
    checkAccess();
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
        <p className="text-sm text-amber-900 dark:text-amber-200 font-semibold mb-1">
          Hardware Owners
        </p>
        <p className="text-xs text-amber-800 dark:text-amber-300">
          Enter the code included with your Bridge ($129) or Sovereign ($299) device to unlock advanced features.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
          Pro Code
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter code from device"
            className="flex-1 p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono uppercase"
            aria-label="Pro Code"
          />
          <button
            type="button"
            onClick={handleSetCode}
            className="px-4 py-2 bg-[#1E4CFF] hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-semibold"
          >
            Save
          </button>
          {code && (
            <button
              type="button"
              onClick={handleClearCode}
              className="px-3 py-2 rounded-lg border border-red-500/50 hover:bg-red-500/10 text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className={`text-sm ${message.includes('saved') || message.includes('cleared') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {message}
        </div>
      )}

      {proAccess.hasAccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            <div>
              <div className="text-sm font-semibold text-green-900 dark:text-green-200">
                Pro Access Active
              </div>
              <div className="text-xs text-green-700 dark:text-green-300">
                Unlocked via {proAccess.source === 'bridge' ? 'Joule Bridge hardware' : 'Pro code'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const VoicePicker = () => {
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(() => {
    try {
      return localStorage.getItem("askJouleVoice") || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const voices = window.speechSynthesis.getVoices();
        // Filter to English voices and sort by preference (British first)
        const englishVoices = voices
          .filter((v) => v.lang.startsWith("en"))
          .sort((a, b) => {
            // Prioritize British English
            const aIsGB = a.lang === "en-GB" || a.name.toLowerCase().includes("uk") || a.name.toLowerCase().includes("british");
            const bIsGB = b.lang === "en-GB" || b.name.toLowerCase().includes("uk") || b.name.toLowerCase().includes("british");
            if (aIsGB && !bIsGB) return -1;
            if (!aIsGB && bIsGB) return 1;
            // Then prioritize male voices (deeper/more authoritative)
            const aIsMale = a.name.toLowerCase().includes("male");
            const bIsMale = b.name.toLowerCase().includes("male");
            if (aIsMale && !bIsMale) return -1;
            if (!aIsMale && bIsMale) return 1;
            return a.name.localeCompare(b.name);
          });
        setAvailableVoices(englishVoices);
      }
    };

    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const handleVoiceChange = (e) => {
    const voiceName = e.target.value;
    setSelectedVoice(voiceName);
    try {
      if (voiceName) {
        localStorage.setItem("askJouleVoice", voiceName);
      } else {
        localStorage.removeItem("askJouleVoice");
      }
    } catch (err) {
      console.warn("Failed to save voice preference:", err);
    }
  };

  const getVoiceLabel = (voice) => {
    const lang = voice.lang === "en-GB" ? "🇬🇧 British" : voice.lang === "en-US" ? "🇺🇸 American" : "🇬🇧/🇺🇸";
    const gender = voice.name.toLowerCase().includes("male") ? "♂ Male" : voice.name.toLowerCase().includes("female") ? "♀ Female" : "";
    return `${lang} ${gender ? `- ${gender}` : ""} - ${voice.name}`;
  };

  if (availableVoices.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Loading voices...
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="voice-picker"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        Voice Persona
      </label>
      <select
        id="voice-picker"
        value={selectedVoice}
        onChange={handleVoiceChange}
        className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
        aria-label="Voice persona selection"
      >
        <option value="">Default (Auto-select best voice)</option>
        {availableVoices.map((voice) => (
          <option key={voice.name} value={voice.name}>
            {getVoiceLabel(voice)}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-xs text-[#A7B0BA] max-w-2xl leading-relaxed">
        Choose a voice for Ask Joule. British English voices sound more formal and authoritative (JARVIS-like).
      </p>
    </div>
  );
};

const DeleteAllDataButton = ({ setToast }) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      // Clear all localStorage data
      localStorage.clear();
      
      // Clear IndexedDB if available
      if (typeof window !== "undefined" && window.indexedDB) {
        try {
          const databases = await window.indexedDB.databases();
          for (const db of databases) {
            if (db.name) {
              const deleteReq = window.indexedDB.deleteDatabase(db.name);
              await new Promise((resolve, reject) => {
                deleteReq.onsuccess = () => resolve();
                deleteReq.onerror = () => reject(deleteReq.error);
                deleteReq.onblocked = () => resolve(); // Continue even if blocked
              });
            }
          }
        } catch (error) {
          console.warn("Failed to clear IndexedDB:", error);
        }
      }

      setToast?.({ 
        message: "All data has been deleted. The page will reload.", 
        type: "success" 
      });

      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error("Failed to delete all data:", error);
      setToast?.({ 
        message: "Failed to delete all data. Please try again.", 
        type: "error" 
      });
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div>
      {!showConfirm ? (
        <button
          onClick={handleDelete}
          className="px-4 py-2 bg-red-600/80 hover:bg-red-600 border border-red-500/50 text-white rounded-lg font-semibold transition-colors"
        >
          Delete All Data
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-red-400">
            Are you absolutely sure? This cannot be undone!
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600/80 hover:bg-red-600 disabled:bg-red-600/40 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors border border-red-500/50"
            >
              {isDeleting ? "Deleting..." : "Yes, Delete Everything"}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isDeleting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/50 disabled:cursor-not-allowed text-[#E8EDF3] rounded-lg font-semibold transition-colors border border-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const TTSEngineToggle = () => {
  const [useBrowserTTS, setUseBrowserTTS] = useState(() => {
    try {
      return localStorage.getItem("useBrowserTTS") === "true";
    } catch {
      return false; // Default to ElevenLabs
    }
  });

  const handleToggle = (e) => {
    const useBrowser = e.target.checked;
    setUseBrowserTTS(useBrowser);
    try {
      localStorage.setItem("useBrowserTTS", useBrowser.toString());
      // Dispatch event to notify other components
      window.dispatchEvent(new Event("ttsEngineChanged"));
    } catch (err) {
      console.warn("Failed to save TTS engine preference:", err);
    }
  };

  return (
    <div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={useBrowserTTS}
          onChange={handleToggle}
          className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Use Browser TTS (instead of ElevenLabs)
        </span>
      </label>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6">
        {useBrowserTTS
          ? "Using browser's built-in text-to-speech. No API credits used."
          : "Using ElevenLabs for high-quality voice synthesis. API credits will be used."}
      </p>
    </div>
  );
};

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
      <p className="text-xs text-[#7C8894] max-w-md">
        (How long voice input listens before auto-stopping)
      </p>
    </div>
  );
};

const FunSafeModeToggle = () => {
  const [funSafeMode, setFunSafeMode] = useState(() => {
    try {
      return localStorage.getItem("funSafeMode") !== "false";
    } catch {
      return true; // Default to safe mode
    }
  });

  const handleToggle = (e) => {
    const isSafe = e.target.checked;
    setFunSafeMode(isSafe);
    try {
      if (isSafe) {
        localStorage.removeItem("funSafeMode"); // Remove or set to anything but "false"
      } else {
        localStorage.setItem("funSafeMode", "false");
      }
    } catch (err) {
      console.warn("Failed to save fun safe mode preference:", err);
    }
  };

  return (
    <div>
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={funSafeMode}
          onChange={handleToggle}
          className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Fun Safe Mode (Family-Friendly Responses)
        </span>
      </label>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-7">
        {funSafeMode
          ? "Using toned-down, family-friendly responses. Disable for full-strength chaotic Joule humor (PG-13)."
          : "Full-strength chaotic Joule enabled. Responses may include PG-13 humor and references."}
      </p>
    </div>
  );
};

// Zone Management Component
const ZoneManagementSection = ({ setToast }) => {
  const [zones, setZones] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("zones") || "[]");
    } catch {
      return [];
    }
  });
  const [activeZoneId, setActiveZoneId] = useState(() => {
    try {
      return localStorage.getItem("activeZoneId") || (zones.length > 0 ? zones[0].id : "zone1");
    } catch {
      return "zone1";
    }
  });
  const [editingZone, setEditingZone] = useState(null);

  // Initialize default zone if empty
  useEffect(() => {
    if (zones.length === 0) {
      const defaultZone = {
        id: "zone1",
        name: "Main Zone",
        squareFeet: 1500,
        insulationLevel: 1.0,
        primarySystem: "heatPump",
        capacity: 36,
        hasCSV: false,
      };
      setZones([defaultZone]);
      localStorage.setItem("zones", JSON.stringify([defaultZone]));
      localStorage.setItem("activeZoneId", defaultZone.id);
    }
  }, []);

  const addZone = () => {
    const newZone = {
      id: `zone${zones.length + 1}`,
      name: `Zone ${zones.length + 1}`,
      squareFeet: 1000,
      insulationLevel: 1.0,
      primarySystem: "heatPump",
      capacity: 24,
      hasCSV: false,
    };
    const updatedZones = [...zones, newZone];
    setZones(updatedZones);
    localStorage.setItem("zones", JSON.stringify(updatedZones));
  };

  const removeZone = (zoneId) => {
    if (zones.length <= 1) {
      setToast?.({ message: "You must have at least one zone", type: "error" });
      return;
    }
    const updatedZones = zones.filter(z => z.id !== zoneId);
    setZones(updatedZones);
    localStorage.setItem("zones", JSON.stringify(updatedZones));
    
    // Clean up zone-specific localStorage data
    const keysToRemove = [
      'spa_resultsHistory',
      'spa_parsedCsvData',
      'spa_labels',
      'spa_diagnostics',
      'spa_filename',
      'spa_uploadTimestamp'
    ];
    keysToRemove.forEach(key => {
      localStorage.removeItem(`${key}_${zoneId}`);
    });
    
    // Switch to first zone if active zone was deleted
    if (activeZoneId === zoneId && updatedZones.length > 0) {
      setActiveZoneId(updatedZones[0].id);
      localStorage.setItem("activeZoneId", updatedZones[0].id);
    }
  };

  const updateZone = (zoneId, updates) => {
    const updatedZones = zones.map(z => 
      z.id === zoneId ? { ...z, ...updates } : z
    );
    setZones(updatedZones);
    localStorage.setItem("zones", JSON.stringify(updatedZones));
    setEditingZone(null);
  };

  const checkZoneHasCSV = (zoneId) => {
    try {
      const hasData = localStorage.getItem(`spa_parsedCsvData_${zoneId}`);
      return !!hasData;
    } catch {
      return false;
    }
  };

  // Update hasCSV flags
  useEffect(() => {
    const updatedZones = zones.map(z => ({
      ...z,
      hasCSV: checkZoneHasCSV(z.id)
    }));
    if (JSON.stringify(updatedZones) !== JSON.stringify(zones)) {
      setZones(updatedZones);
      localStorage.setItem("zones", JSON.stringify(updatedZones));
    }
  }, []);

  return (
    <Section title="Zone Management" icon={<Home size={20} />}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
          If you have multiple thermostats or zones, you can manage them here. Each zone can have its own settings and analysis.
        </p>
        
        <div className="space-y-3">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {editingZone?.id === zone.id ? (
                      <input
                        type="text"
                        value={editingZone.name}
                        onChange={(e) => setEditingZone({ ...editingZone, name: e.target.value })}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-gray-100"
                        onBlur={() => {
                          if (editingZone.name.trim()) {
                            updateZone(zone.id, { name: editingZone.name.trim() });
                          } else {
                            setEditingZone(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (editingZone.name.trim()) {
                              updateZone(zone.id, { name: editingZone.name.trim() });
                            }
                          } else if (e.key === "Escape") {
                            setEditingZone(null);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <>
                        {zone.name}
                        {zone.id === activeZoneId && (
                          <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </>
                    )}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {zone.hasCSV && (
                    <span className="text-xs text-green-600 dark:text-green-400">✓ CSV</span>
                  )}
                  <button
                    onClick={() => setEditingZone({ ...zone })}
                    className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                    title="Edit zone name"
                  >
                    <Edit2 size={16} />
                  </button>
                  {zones.length > 1 && (
                    <button
                      onClick={() => removeZone(zone.id)}
                      className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      title="Remove zone"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                <div>
                  <span className="font-medium">Size:</span> {zone.squareFeet} sq ft
                </div>
                <div>
                  <span className="font-medium">Capacity:</span> {zone.capacity || "N/A"} kBTU
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addZone}
          className="flex items-center gap-2 px-4 py-2 bg-[#1E4CFF] hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
        >
          <Plus size={18} />
          Add Zone / Thermostat
        </button>

        <p className="text-xs text-[#A7B0BA] max-w-2xl leading-relaxed italic">
          If you have multiple thermostats, create a zone for each one. You can upload data for each zone separately in the System Performance Analyzer.
        </p>
      </div>
    </Section>
  );
};

const ByzantineModeToggle = ({ setToast }) => {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem("byzantineMode") === "true";
    } catch {
      return false;
    }
  });

  const handleToggle = (e) => {
    const newValue = e.target.checked;
    setEnabled(newValue);
    try {
      localStorage.setItem("byzantineMode", newValue ? "true" : "false");
    } catch {}
    
    if (newValue) {
      setToast?.({
        message: "🕯️ Rejoice, Oh Coil Unfrosted! Byzantine Mode activated.",
        type: "success",
      });
    } else {
      setToast?.({
        message: "Byzantine Mode disabled. Joule returns to normal speech.",
        type: "info",
      });
    }
  };

  return (
    <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-[#E8EDF3] flex items-center gap-2">
            🕯️ Byzantine Liturgical Mode
          </p>
          <p className="text-xs text-[#A7B0BA] mt-1 italic">
            When enabled, Joule responds in the style of Orthodox liturgical chants — an easter egg for those who want something different.
          </p>
          {enabled && (
            <p className="text-xs text-purple-400 mt-2 italic">
              "Rejoice, Oh Coil Unfrosted! Glory to Thee, Oh Scroll Compressor!"
            </p>
          )}
        </div>
        <label className="inline-flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={enabled}
            onChange={handleToggle}
          />
        </label>
      </div>
    </div>
  );
};

const LocalLLMSettings = () => {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem("useLocalBackend") === "true" || localStorage.getItem("useLocalLLM") === "true";
    } catch {
      return false;
    }
  });
  const [bridgeUrl, setBridgeUrl] = useState(() => {
    try {
      return localStorage.getItem("localBackendUrl") || localStorage.getItem("jouleBridgeUrl") || "http://raspberrypi.local:3002";
    } catch {
      return "http://raspberrypi.local:3002";
    }
  });
  const [model, setModel] = useState(() => {
    try {
      return localStorage.getItem("localLLMModel") || "llama3.2:1b";
    } catch {
      return "llama3.2:1b";
    }
  });
  const [connectionStatus, setConnectionStatus] = useState("unknown"); // "unknown" | "connected" | "disconnected"
  const [testing, setTesting] = useState(false);

  const availableModels = [
    { id: "llama3.2:1b", label: "Llama 3.2 1B (Fast, 1GB RAM)", description: "Fastest option, good for simple queries" },
    { id: "llama3.2:3b", label: "Llama 3.2 3B (Better, 3GB RAM)", description: "Better quality, requires more RAM" },
    { id: "phi3:mini", label: "Phi-3 Mini (Balanced, 2GB RAM)", description: "Microsoft's efficient model" },
    { id: "tinyllama", label: "TinyLlama (Ultra-light, 500MB)", description: "Smallest model, basic functionality only" },
  ];

  const testConnection = async () => {
    setTesting(true);
    setConnectionStatus("unknown");
    
    try {
      // Test health endpoint first
      const healthResponse = await fetch(`${bridgeUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        setConnectionStatus("connected");
        console.log("[Local LLM] Bridge connected:", healthData);
      } else {
        setConnectionStatus("disconnected");
      }
    } catch (error) {
      console.error("[Local LLM] Connection test failed:", error);
      setConnectionStatus("disconnected");
    } finally {
      setTesting(false);
    }
  };

  const handleEnabledChange = (e) => {
    const newValue = e.target.checked;
    setEnabled(newValue);
    try {
      localStorage.setItem("useLocalBackend", newValue ? "true" : "false");
      localStorage.setItem("useLocalLLM", newValue ? "true" : "false"); // Backward compatibility
      if (newValue) {
        // Test connection when enabling
        testConnection();
      }
    } catch {}
  };

  const handleBridgeUrlChange = (e) => {
    const val = e.target.value.trim();
    setBridgeUrl(val);
    try {
      localStorage.setItem("localBackendUrl", val);
      localStorage.setItem("jouleBridgeUrl", val); // Backward compatibility
    } catch {}
  };

  const handleModelChange = (e) => {
    const selectedModel = e.target.value;
    setModel(selectedModel);
    try {
      localStorage.setItem("localLLMModel", selectedModel);
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
            Use Local LLM (Joule Bridge/Core)
          </label>
          <p className="text-xs text-[#A7B0BA] mb-3 max-w-2xl leading-relaxed">
            Run RAG locally on Raspberry Pi (Zero 2 W or Pi 5). Zero 2 W uses Groq API for fast inference (500+ t/s). Pi 5 runs fully local with Ollama. Both keep your data private.
          </p>
        </div>
        <label className="inline-flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={enabled}
            onChange={handleEnabledChange}
          />
        </label>
      </div>

      {enabled && (
        <>
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              Raspberry Pi Bridge URL
            </label>
            <input
              type="text"
              value={bridgeUrl}
              onChange={handleBridgeUrlChange}
              placeholder="http://raspberrypi.local:3002"
              className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              aria-label="Raspberry Pi Bridge URL"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              URL of your Raspberry Pi 5 running the Joule Local RAG Bridge. 
              Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">raspberrypi.local</code> or the Pi's IP address.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">
              Default: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">http://raspberrypi.local:3002</code>
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              Local LLM Model
            </label>
            <select
              value={model}
              onChange={handleModelChange}
              className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              aria-label="Select Local LLM Model"
            >
              {availableModels.map((modelOption) => (
                <option key={modelOption.id} value={modelOption.id}>
                  {modelOption.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {availableModels.find((m) => m.id === model)?.description}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing}
              className="px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm text-[#E8EDF3] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
            {connectionStatus === "connected" && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 size={16} />
                <span>Connected to Pi Bridge</span>
              </div>
            )}
            {connectionStatus === "disconnected" && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <XCircle size={16} />
                <span>Cannot reach Pi Bridge</span>
              </div>
            )}
          </div>
        </>
      )}

      <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
        <p className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
          ℹ️ Local LLM Benefits
        </p>
        <ul className="list-disc list-inside space-y-1 mb-2">
          <li>No API keys required</li>
          <li>Works offline (no internet needed)</li>
          <li>Unlimited queries (no rate limits)</li>
          <li>Complete privacy (queries never leave your network)</li>
          <li>No vendor lock-in</li>
        </ul>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          📖 See <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">pi-setup/install.sh</code> for setup instructions. 
          Requires Raspberry Pi 5 16GB with Ollama installed.
        </p>
      </div>
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
      return localStorage.getItem("groqModel") || "llama-3.3-70b-versatile";
    } catch {
      return "llama-3.3-70b-versatile";
    }
  });
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState(null);

  // Fetch models from Groq API when API key is available
  useEffect(() => {
    const fetchModels = async () => {
      if (!value || !value.trim()) {
        setAvailableModels([]);
        setModelError(null);
        return;
      }

      setLoadingModels(true);
      setModelError(null);

      try {
        const models = await fetchGroqModels(value);
        
        // Filter out decommissioned models
        // Note: Models are fetched dynamically from Groq API, so deprecated models
        // should already be excluded. This is a safety filter.
        const activeModels = models.filter((m) => {
          const decommissioned = ["llama-3.1-70b-versatile"]; // Add more as they're deprecated
          return !decommissioned.includes(m.id);
        });

        setAvailableModels(activeModels);

        // Use dynamic best model selection if no model is set or current model is unavailable
        const currentModelExists = activeModels.some((m) => m.id === model);
        if (!currentModelExists && activeModels.length > 0) {
          // Try dynamic best model selection first
          try {
            const bestModel = await getBestModel(value);
            if (bestModel) {
              setModel(bestModel);
              localStorage.setItem("groqModel", bestModel);
              window.dispatchEvent(new Event("storage"));
            } else {
              // Fallback to suggestModel if getBestModel returns null
              const suggested = suggestModel(activeModels);
              if (suggested) {
                setModel(suggested);
                localStorage.setItem("groqModel", suggested);
                window.dispatchEvent(new Event("storage"));
              }
            }
          } catch (error) {
            console.warn("[Settings] Failed to get best model, using suggestModel:", error);
            // Fallback to suggestModel
            const suggested = suggestModel(activeModels);
            if (suggested) {
              setModel(suggested);
              localStorage.setItem("groqModel", suggested);
              window.dispatchEvent(new Event("storage"));
            }
          }
        } else if (!model || model === "llama-3.3-70b-versatile") {
          // If using default, try to get best model dynamically
          try {
            const bestModel = await getBestModel(value);
            if (bestModel && bestModel !== "llama-3.3-70b-versatile") {
              setModel(bestModel);
              localStorage.setItem("groqModel", bestModel);
              window.dispatchEvent(new Event("storage"));
            }
          } catch (error) {
            // Silently fail - keep default
            console.warn("[Settings] Failed to get best model:", error);
          }
        }
      } catch (error) {
        console.error("Failed to fetch Groq models:", error);
        setModelError(error.message);
        // Use fallback model if fetch fails
        setAvailableModels([
          { id: "llama-3.3-70b-versatile", object: "model" },
        ]);
      } finally {
        setLoadingModels(false);
      }
    };

    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

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
      // Clear fallback state when user manually changes model
      import("../lib/groqModelFallback.js").then(({ clearFallbackState }) => {
        clearFallbackState();
      });
      // Trigger storage event for other components to pick up the change
      window.dispatchEvent(new Event("storage"));
    } catch {}
  };

  const clearKey = () => {
    setValue("");
    setAvailableModels([]);
    setModelError(null);
    try {
      localStorage.removeItem("groqApiKey");
    } catch {}
  };

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
            className="px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm text-[#E8EDF3] transition-colors"
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
        {loadingModels ? (
          <div className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-500">
            Loading available models...
          </div>
        ) : availableModels.length > 0 ? (
          <>
            <select
              value={model}
              onChange={handleModelChange}
              className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              aria-label="Select Groq Model"
            >
              {availableModels.map((modelOption) => (
                <option key={modelOption.id} value={modelOption.id}>
                  {formatModelLabel(modelOption.id)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {getModelDescription(model)}
            </p>
          </>
        ) : value ? (
          <div className="w-full p-2 rounded border border-yellow-300 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 text-sm text-yellow-700 dark:text-yellow-300">
            {modelError
              ? `Error loading models: ${modelError}. Using default model.`
              : "Enter your API key above to see available models"}
          </div>
        ) : (
          <div className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500">
            Enter your API key to see available models
          </div>
        )}
      </div>

      <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg text-xs text-gray-700 dark:text-gray-300">
        <p className="font-semibold text-blue-700 dark:text-blue-300 mb-2">
          ℹ️ What's this for?
        </p>
        <p className="mb-2">
          Ask Joule can optionally use Groq's LLM API for advanced natural
          language understanding when built-in parsing can't handle complex
          questions.
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
          🔒 Your API key is stored locally in your browser and never sent to
          our servers. All Groq API calls are made directly from your browser to
          Groq.
        </p>
      </div>
      {value && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 size={16} />
          <span>
            API key configured with {formatModelLabel(model)} ✓
          </span>
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
    return () => {
      mounted = false;
    };
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const blob = await resizeToCover(file, {
        width: 1600,
        height: 900,
        type: "image/png",
        quality: 0.92,
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
        type: "error",
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
        <div className="w-24 h-24 rounded-full border-2 border-blue-500 overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          {customHeroUrl ? (
            <img
              src={customHeroUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
              ?
            </div>
          )}
        </div>
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

const BuildingCharacteristics = ({ settings, onSettingChange, outletContext }) => {
  // Local state for manual heat loss input to allow free editing
  const [manualHeatLossInput, setManualHeatLossInput] = useState(
    String(settings.manualHeatLoss ?? 314)
  );
  
  // Sync local state when settings change externally
  useEffect(() => {
    setManualHeatLossInput(String(settings.manualHeatLoss ?? 314));
  }, [settings.manualHeatLoss]);
  
  const calculatedHeatLossFactor = useMemo(() => {
    const BASE_BTU_PER_SQFT_HEATING = 22.67;
    const ceilingMultiplier = 1 + ((settings.ceilingHeight ?? 8) - 8) * 0.1;
    const designHeatLoss = Math.round(
      (settings.squareFeet ?? 800) *
      BASE_BTU_PER_SQFT_HEATING *
      (settings.insulationLevel ?? 1.0) *
      (settings.homeShape ?? 1.0) *
      ceilingMultiplier
    );
    // Convert to BTU/hr/°F (heat loss factor)
    return Math.round(designHeatLoss / 70);
  }, [settings.squareFeet, settings.insulationLevel, settings.homeShape, settings.ceilingHeight]);

  return (
    <Section title="Building Characteristics" icon={<Home size={20} />}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
            Home Size (sq ft)
          </label>
          <input
            type="number"
            min={100}
            max={50000}
            step={1}
            placeholder="Enter square footage"
            value={settings.squareFeet ?? 2000}
            onChange={(e) => {
              const val = e.target.value;
              // Allow empty input while typing
              if (val === "" || val === "-") {
                onSettingChange("squareFeet", null);
                return;
              }
              const numVal = Number(val);
              if (!isNaN(numVal) && numVal >= 100 && numVal <= 50000) {
                onSettingChange("squareFeet", Math.round(numVal));
              }
            }}
            onBlur={(e) => {
              // Ensure we have a valid value on blur
              const val = e.target.value.trim();
              if (val === "" || val === "-" || isNaN(Number(val))) {
                onSettingChange("squareFeet", settings.squareFeet ?? 2000);
              } else {
                const numVal = Number(val);
                if (numVal < 100) {
                  onSettingChange("squareFeet", 100);
                } else if (numVal > 50000) {
                  onSettingChange("squareFeet", 50000);
                } else {
                  onSettingChange("squareFeet", Math.round(numVal));
                }
              }
            }}
            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={settings.useManualHeatLoss}
          />
          {settings.useManualHeatLoss && (
            <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
              Disabled when using manual heat loss entry
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
            Insulation Quality
          </label>
          <div className="flex gap-2">
            <select
              value={[1.4, 1.0, 0.65].includes(settings.insulationLevel ?? 1.0) ? (settings.insulationLevel ?? 1.0) : "custom"}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  // Keep current custom value, just show input
                  return;
                }
                onSettingChange("insulationLevel", Number(val));
              }}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={settings.useManualHeatLoss}
            >
              <option value={1.4}>Poor (pre-1980, minimal upgrades) - 1.4×</option>
              <option value={1.0}>Average (1990s-2000s, code-min) - 1.0×</option>
              <option value={0.65}>Good (post-2010, ENERGY STAR) - 0.65×</option>
              <option value="custom">Custom value...</option>
            </select>
            {(![1.4, 1.0, 0.65].includes(settings.insulationLevel ?? 1.0)) && (
              <input
                type="number"
                min={0.1}
                max={2.0}
                step={0.05}
                value={settings.insulationLevel ?? 1.0}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!isNaN(val) && val >= 0.1 && val <= 2.0) {
                    onSettingChange("insulationLevel", val);
                  }
                }}
                className="w-24 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={settings.useManualHeatLoss}
                placeholder="Custom"
              />
            )}
          </div>
          <p className="text-xs text-[#A7B0BA] mt-1.5 max-w-md">
            <strong>Current:</strong> {settings.insulationLevel?.toFixed(2) ?? "1.00"}× (lower = better insulation). Values &lt;0.65 (e.g., 0.50×) are very aggressive and may not account for real-world infiltration/window losses that DOE includes. For typical homes, 0.70-0.80× is more realistic than 0.50×.
          </p>
        </div>
      </div>
      
      {/* Building Shape and Ceiling Height */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
            Building Shape
          </label>
          <select
            value={settings.homeShape ?? 1.0}
            onChange={(e) => onSettingChange("homeShape", Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={settings.useManualHeatLoss}
          >
            <option value={0.9}>Two-Story (less exterior surface)</option>
            <option value={1.0}>Split-Level / Standard</option>
            <option value={1.1}>Ranch / Single-Story (more exterior surface)</option>
            <option value={1.15}>Manufactured Home</option>
            <option value={1.25}>Cabin / A-Frame</option>
          </select>
          <p className="text-xs text-[#A7B0BA] mt-1.5">
            Affects surface area exposure and heat loss. Single-story homes have more roof/floor area per square foot.
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
            Average Ceiling Height
          </label>
          <select
            value={settings.ceilingHeight ?? 8}
            onChange={(e) => onSettingChange("ceilingHeight", Number(e.target.value))}
            className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={settings.useManualHeatLoss}
          >
            <option value={8}>8 feet (standard)</option>
            <option value={9}>9 feet</option>
            <option value={10}>10 feet</option>
            <option value={12}>12 feet (vaulted)</option>
            <option value={16}>16+ feet (cathedral)</option>
          </select>
          <p className="text-xs text-[#A7B0BA] mt-1.5">
            Higher ceilings increase the volume to heat and energy needs (+10% per foot above 8').
          </p>
        </div>
      </div>
      
      {/* Heat Loss Source Selection */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
          Heat Loss Source
        </label>
        <p className="text-xs text-[#A7B0BA] mb-4 max-w-2xl leading-relaxed">
          Select which method to use for heat loss calculations. Only one option can be active at a time.
        </p>
        
        <div className="space-y-3">
          {/* Calculated (DoE) Option - Recommended */}
          <div className="flex items-start gap-3">
            <label className="inline-flex items-center gap-2 mt-1">
              <input
                type="radio"
                name="heatLossSource"
                className="h-4 w-4"
                checked={!!settings.useCalculatedHeatLoss || (!settings.useManualHeatLoss && !settings.useAnalyzerHeatLoss)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onSettingChange("useManualHeatLoss", false);
                    onSettingChange("useAnalyzerHeatLoss", false);
                    onSettingChange("useCalculatedHeatLoss", true);
                    // Mark that user has made an explicit choice - never auto-select again
                    localStorage.setItem('heatLossMethodUserChoice', 'true');
                  }
                }}
              />
            </label>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                ○ Calculated (DOE Data) - Recommended
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Most accurate for typical homes. Based on square footage, insulation, home shape, and ceiling height.
              </p>
              {(settings.useCalculatedHeatLoss || (!settings.useManualHeatLoss && !settings.useAnalyzerHeatLoss)) && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 font-mono">
                  Current value: {calculatedHeatLossFactor.toLocaleString()} BTU/hr/°F
                  {calculatedHeatLossFactor > 0 && (
                    <span className="ml-2">
                      ({Math.round(calculatedHeatLossFactor * 70).toLocaleString()} BTU/hr @ 70°F ΔT)
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Manual Entry Option */}
          <div className="flex items-start gap-3">
            <label className="inline-flex items-center gap-2 mt-1">
              <input
                type="radio"
                name="heatLossSource"
                className="h-4 w-4"
                checked={!!settings.useManualHeatLoss}
                onChange={(e) => {
                  if (e.target.checked) {
                    onSettingChange("useCalculatedHeatLoss", false);
                    onSettingChange("useAnalyzerHeatLoss", false);
                    onSettingChange("useManualHeatLoss", true);
                    // Mark that user has made an explicit choice - never auto-select again
                    localStorage.setItem('heatLossMethodUserChoice', 'true');
                  }
                }}
              />
            </label>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                ○ Manual Entry
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                For users with professional energy audits. Enter exact heat loss in BTU/hr/°F.
              </p>
              {settings.useManualHeatLoss && (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={10}
                      max={10000}
                      step={1}
                      value={manualHeatLossInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Allow free editing - update local state immediately
                        setManualHeatLossInput(val);
                        // Only update settings if it's a valid number
                        if (val !== "" && val !== "-") {
                          const numVal = parseFloat(val);
                          if (!isNaN(numVal) && numVal >= 10 && numVal <= 10000) {
                            onSettingChange("manualHeatLoss", numVal);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // On blur, ensure we have a valid value
                        const val = e.target.value.trim();
                        if (val === "" || val === "-") {
                          // If empty, restore to current value or default
                          const restoreVal = settings.manualHeatLoss ?? 314;
                          setManualHeatLossInput(String(restoreVal));
                          onSettingChange("manualHeatLoss", restoreVal);
                          return;
                        }
                        const numVal = parseFloat(val);
                        if (isNaN(numVal) || numVal < 10) {
                          // Too low, set to minimum
                          setManualHeatLossInput("10");
                          onSettingChange("manualHeatLoss", 10);
                        } else if (numVal > 10000) {
                          // Too high, set to maximum
                          setManualHeatLossInput("10000");
                          onSettingChange("manualHeatLoss", 10000);
                        } else {
                          // Valid, ensure it's saved
                          const finalVal = Math.round(numVal);
                          setManualHeatLossInput(String(finalVal));
                          onSettingChange("manualHeatLoss", finalVal);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-[#7C8894] whitespace-nowrap">
                      BTU/hr/°F
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Analyzer CSV Option */}
          {(() => {
            // Check if analyzer has measured data (not fallback/estimated)
            const analyzerSource = settings.analyzerHeatLossSource || outletContext?.analyzerHeatLossSource;
            const isMeasured = analyzerSource === 'measured';
            const hasAnalyzerData = outletContext?.heatLossFactor || settings.analyzerHeatLoss;
            const isDisabled = !hasAnalyzerData || !isMeasured;
            
            return (
              <div className={`flex items-start gap-3 ${isDisabled ? 'opacity-50' : ''}`}>
                <label className="inline-flex items-center gap-2 mt-1">
                  <input
                    type="radio"
                    name="heatLossSource"
                    className="h-4 w-4"
                    checked={!!settings.useAnalyzerHeatLoss && !isDisabled}
                    disabled={isDisabled}
                    onChange={(e) => {
                      if (e.target.checked && !isDisabled) {
                        onSettingChange("useManualHeatLoss", false);
                        onSettingChange("useCalculatedHeatLoss", false);
                        onSettingChange("useAnalyzerHeatLoss", true);
                        // Mark that user has made an explicit choice - never auto-select again
                        localStorage.setItem('heatLossMethodUserChoice', 'true');
                      }
                    }}
                  />
                </label>
                <div className="flex-1">
                  <label className={`block text-xs font-semibold ${isDisabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                    ○ From CSV Analyzer
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Uses your uploaded thermostat data from System Performance Analyzer for data-driven accuracy.
                  </p>
                  
                  {isDisabled && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                      {!hasAnalyzerData ? (
                        <span>
                          No analyzer data available.{" "}
                          <Link 
                            to="/performance-analyzer" 
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Upload CSV in System Performance Analyzer →
                          </Link>
                        </span>
                      ) : (
                        <span>
                          <strong>Unavailable:</strong> Your CSV data didn't contain a valid 3+ hour coast-down period. 
                          Upload data with a longer "heat off" period to enable this option.{" "}
                          <Link 
                            to="/performance-analyzer" 
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Re-analyze in System Performance Analyzer →
                          </Link>
                        </span>
                      )}
                    </p>
                  )}
                  
                  {!isDisabled && settings.useAnalyzerHeatLoss && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                      Current value: {Number(outletContext?.heatLossFactor || settings.analyzerHeatLoss).toFixed(1)} BTU/hr/°F
                      <span className="ml-2 text-emerald-500 dark:text-emerald-300">(Measured from coast-down)</span>
                    </p>
                  )}
                  
                  {!isDisabled && !settings.useAnalyzerHeatLoss && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                      Measured CSV data available ({Number(outletContext?.heatLossFactor || settings.analyzerHeatLoss).toFixed(1)} BTU/hr/°F). Click to use it.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </Section>
  );
};

const CostSettings = ({ settings, onSettingChange, userSettings }) => {
  // Get location for average rate hints
  const location = userSettings?.location || userSettings?.city;
  const state = userSettings?.state || "US";
  const avgRate = state === "GA" ? 0.12 : state === "CA" ? 0.28 : state === "TX" ? 0.11 : 0.15;
  
  return (
    <Section 
      title="Cost Settings" 
      icon={<DollarSign size={20} />}
      description="Used for 7-day cost forecasts, annual estimates, and gas vs heat pump comparisons."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
            Cost per kWh ($)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[#A7B0BA]">$</span>
            <input
              type="number"
              min={0.05}
              max={1.0}
              step={0.01}
              value={settings.utilityCost != null ? Number(settings.utilityCost).toFixed(2) : "0.10"}
              onChange={(e) => {
                const val = Math.min(1.0, Math.max(0.05, Number(e.target.value)));
                const rounded = Math.round(val * 100) / 100;
                onSettingChange("utilityCost", rounded);
              }}
              className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="0.15"
            />
            <span className="text-xs text-[#7C8894]">/kWh</span>
          </div>
          {location && (
            <p className="text-xs text-blue-400 mt-1.5 max-w-md">
              💡 {location}, {state} average: ${avgRate.toFixed(2)}/kWh (EIA data)
            </p>
          )}
          {!location && (
            <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
              Used for budget calculations and cost estimates
            </p>
          )}
        </div>
      <div>
        <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
          Gas Cost per Therm ($)
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[#A7B0BA]">$</span>
          <input
            type="number"
            min={0.5}
            max={5.0}
            step={0.01}
            value={settings.gasCost != null ? Number(settings.gasCost).toFixed(2) : "1.20"}
            onChange={(e) => {
              const val = Math.min(5.0, Math.max(0.5, Number(e.target.value)));
              const rounded = Math.round(val * 100) / 100;
              onSettingChange("gasCost", rounded);
            }}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="1.20"
          />
          <span className="text-xs text-[#7C8894]">/therm</span>
        </div>
          {location && (
            <p className="text-xs text-blue-400 mt-1.5 max-w-md">
              💡 {location}, {state} average: ~$1.20/therm (EIA data)
            </p>
          )}
          {!location && (
            <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
              Used for gas furnace cost comparisons
            </p>
          )}
        </div>
      </div>
    </Section>
  );
};

const AdvancedEquipmentProfile = ({ settings, onSettingChange, setToast }) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    if (!expanded) {
      // Enable custom profile when expanding
      onSettingChange("useCustomEquipmentProfile", true);
    }
    setExpanded(!expanded);
  };

  const handleInputChange = (key, value) => {
    const numValue = value === "" ? null : Number(value);
    onSettingChange(key, numValue);
  };

  const hasRequiredData = 
    settings.capacity47 && 
    settings.capacity17 && 
    settings.cop47 && 
    settings.cop17;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Advanced: Custom COP Curve (Optional)
            </p>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="COP (Coefficient of Performance) measures heat pump efficiency. A COP curve shows how efficiency changes at different outdoor temperatures. Higher COP = more efficient."
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Upload NEEP data or manually enter capacity/COP at different temperatures for more accurate balance point calculations.
          </p>
        </div>
        <button
          onClick={handleToggle}
          className="ml-4 p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={!!settings.useCustomEquipmentProfile}
                onChange={(e) => onSettingChange("useCustomEquipmentProfile", e.target.checked)}
                className="h-4 w-4"
              />
              Enable Custom Equipment Profile
            </label>
            {hasRequiredData && (
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 size={14} />
                Profile Complete
              </span>
            )}
          </div>

          {settings.useCustomEquipmentProfile && (
            <div className="space-y-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">
                Required: Capacity and COP at 47°F and 17°F
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Capacity at 47°F */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
                    Capacity @ 47°F (BTU/hr)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200000}
                    step={100}
                    value={settings.capacity47 ?? ""}
                    onChange={(e) => handleInputChange("capacity47", e.target.value)}
                    placeholder="e.g., 36000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
                    Rated capacity (from NEEP or spec sheet)
                  </p>
                </div>

                {/* Capacity at 17°F */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
                    Capacity @ 17°F (BTU/hr)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200000}
                    step={100}
                    value={settings.capacity17 ?? ""}
                    onChange={(e) => handleInputChange("capacity17", e.target.value)}
                    placeholder="e.g., 28000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
                    Cold climate capacity
                  </p>
                </div>

                {/* COP at 47°F */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
                    COP @ 47°F
                  </label>
                  <input
                    type="number"
                    min={1.0}
                    max={6.0}
                    step={0.1}
                    value={settings.cop47 ?? ""}
                    onChange={(e) => handleInputChange("cop47", e.target.value)}
                    placeholder="e.g., 4.2"
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
                    Coefficient of Performance at rated temp
                  </p>
                </div>

                {/* COP at 17°F */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
                    COP @ 17°F
                  </label>
                  <input
                    type="number"
                    min={1.0}
                    max={6.0}
                    step={0.1}
                    value={settings.cop17 ?? ""}
                    onChange={(e) => handleInputChange("cop17", e.target.value)}
                    placeholder="e.g., 2.8"
                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-xs text-[#7C8894] mt-1.5 max-w-md">
                    COP at cold temperature
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                <p className="text-xs text-blue-800 dark:text-blue-200 font-semibold mb-1">
                  💡 How to find this data:
                </p>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 ml-4 list-disc">
                  <li>NEEP Cold-Climate Heat Pump Database: neep.org</li>
                  <li>Manufacturer submittal sheets or product data catalogs</li>
                  <li>AHRI Directory for matched system performance</li>
                </ul>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                  <strong>Result:</strong> Your balance point and cost calculations become dead accurate instead of using generic "average" efficiency curves.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const HvacSystemConfig = ({ settings, onSettingChange, setToast }) => {
  const [showAfueTooltip, setShowAfueTooltip] = useState(false);
  const capacities = { 18: 1.5, 24: 2, 30: 2.5, 36: 3, 42: 3.5, 48: 4, 60: 5 };

  return (
    <Section
      title="HVAC System Configuration"
      icon={<ThermometerSun size={20} />}
    >
      <div className="space-y-4">
        {/* Primary System Selection */}
        <div>
          <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
            Primary Heating System
          </label>
          <p className="text-xs text-[#A7B0BA] mb-3 max-w-2xl">
            Select how your home is heated.
          </p>
          <div className="inline-flex rounded-lg overflow-hidden border border-slate-700">
            <button
              onClick={() => onSettingChange("primarySystem", "heatPump")}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors ${
                settings.primarySystem === "heatPump"
                  ? "bg-[#1E4CFF] text-white"
                  : "bg-slate-900 text-[#A7B0BA] hover:text-white hover:bg-slate-800"
              }`}
            >
              ⚡ Heat Pump
            </button>
            <button
              onClick={() => onSettingChange("primarySystem", "gasFurnace")}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors ${
                settings.primarySystem === "gasFurnace"
                  ? "bg-[#1E4CFF] text-white"
                  : "bg-slate-900 text-[#A7B0BA] hover:text-white hover:bg-slate-800"
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
              <div className="flex items-center gap-1 mb-2">
                <label className="text-sm font-medium text-[#E8EDF3]">
                  Heating Efficiency (HSPF2)
                </label>
                <button
                  type="button"
                  className="text-[#7C8894] hover:text-[#A7B0BA]"
                  title="HSPF2 (Heating Seasonal Performance Factor) measures heat pump heating efficiency. Higher = more efficient. Typical range: 8-10.5 for modern systems."
                >
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
              <input
                type="number"
                min={6}
                max={13}
                step={0.1}
                value={settings.hspf2 ?? 8.5}
                onChange={(e) =>
                  onSettingChange(
                    "hspf2",
                    Math.min(13, Math.max(6, Number(e.target.value)))
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <div className="flex items-center gap-1 mb-2">
                <label className="text-sm font-medium text-[#E8EDF3]">
                  Cooling Efficiency (SEER2)
                </label>
                <button
                  type="button"
                  className="text-[#7C8894] hover:text-[#A7B0BA]"
                  title="SEER2 (Seasonal Energy Efficiency Ratio) measures A/C cooling efficiency. Higher = more efficient. Typical range: 14-18 for modern systems."
                >
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
              <input
                type="number"
                min={14}
                max={22}
                step={1}
                value={settings.efficiency ?? 16}
                onChange={(e) =>
                  onSettingChange(
                    "efficiency",
                    Math.min(22, Math.max(14, Number(e.target.value)))
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[#E8EDF3]">
                Capacity (Tons)
              </label>
              <select
                value={settings.capacity ?? settings.coolingCapacity ?? 36}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  onSettingChange("coolingCapacity", v);
                  onSettingChange("capacity", v);
                  setToast?.({
                    message: `Capacity updated: ${capacities[v]} tons (${v}k BTU)`,
                    type: "success",
                  });
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-[#E8EDF3] focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium text-[#E8EDF3]">
                  Furnace AFUE
                </label>
                <button
                  type="button"
                  onClick={() => setShowAfueTooltip(!showAfueTooltip)}
                  className="text-[#7C8894] hover:text-[#A7B0BA] transition-colors"
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
                    AFUE stands for{" "}
                    <strong>Annual Fuel Utilization Efficiency</strong>. It's
                    like your furnace's "gas mileage."
                  </p>
                  <ul className="space-y-1 ml-4 mb-2">
                    <li>
                      <strong>90-98%:</strong> High-efficiency furnace
                    </li>
                    <li>
                      <strong>80%:</strong> Standard, mid-efficiency
                    </li>
                    <li>
                      <strong>&lt; 80%:</strong> Older, less efficient
                    </li>
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
                  onChange={(e) =>
                    onSettingChange(
                      "afue",
                      Math.min(0.99, Math.max(0.6, Number(e.target.value)))
                    )
                  }
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

      </div>
    </Section>
  );
};

const SettingsPage = () => {
  const [toast, setToast] = useState(null);
  const [advancedSettingsExpanded, setAdvancedSettingsExpanded] =
    useState(false);
  const outletCtx = useOutletContext() || {};
  const userSettings = outletCtx.userSettings || {};
  const setUserSetting =
    outletCtx.setUserSetting ||
    ((key, value) => {
      console.warn(`setUserSetting not provided for setting: ${key}`, value);
    });

  const [activeSection, setActiveSection] = useState("home-setup");
  const [showPlans, setShowPlans] = useState(false);
  const sections = [
    { id: "home-setup", label: "Home Setup", number: "1" },
    { id: "system-config", label: "System Configuration", number: "2" },
    { id: "costs-rates", label: "Costs & Rates", number: "3" },
    { id: "thermostat", label: "Thermostat Behavior", number: "4" },
    { id: "bridge-ai", label: "Bridge & AI", number: "5" },
  ];

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      const sectionIds = ["home-setup", "system-config", "costs-rates", "thermostat", "bridge-ai"];
      for (const sectionId of sectionIds) {
        const element = document.getElementById(sectionId);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#050B10]">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-6">
        {/* Page Header */}
        <header className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-[28px] font-semibold text-[#FFFFFF] mb-1">
              Settings
            </h1>
            <p className="text-sm text-[#A7B0BA]">
              Configure your home, system, and preferences
            </p>
          </div>
          <DashboardLink />
        </header>

        {/* Sticky Side Navigation */}
        <div className="hidden lg:block fixed left-4 top-1/2 -translate-y-1/2 z-40">
          <nav className="bg-[#0C1118] border border-slate-800 rounded-xl p-3 shadow-lg">
            <div className="space-y-1">
              {sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const element = document.getElementById(section.id);
                    if (element) {
                      element.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeSection === section.id
                      ? "bg-[#1E4CFF] text-white"
                      : "text-[#A7B0BA] hover:text-white hover:bg-slate-900"
                  }`}
                >
                  <span className="text-xs font-medium w-5">{section.number}</span>
                  <span className="font-medium">{section.label}</span>
                </a>
              ))}
            </div>
          </nav>
        </div>

      {/* Product Tiers - Collapsible */}
      <div className="mb-8 bg-[#0C1118] border border-slate-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowPlans((v) => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-900/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-medium text-[#E8EDF3]">
              Comfort strategy & hardware tiers
            </span>
          </div>
          <ChevronDown className={`w-5 h-5 text-[#A7B0BA] transition-transform ${showPlans ? "rotate-180" : ""}`} />
        </button>
        {showPlans && (
          <div className="p-6 border-t border-slate-800">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-white mb-1">Choose Your Comfort Strategy</h3>
              <p className="text-xs text-[#A7B0BA]">Select a product tier to unlock features</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Free Tier */}
          <div className="bg-[#0C1118] border-2 border-slate-700 rounded-lg p-4 flex flex-col relative">
            <div className="absolute top-3 right-3">
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">Current</span>
            </div>
            <div className="flex items-center justify-between mb-3 min-h-[3rem]">
              <h4 className="font-bold text-lg text-white">Free</h4>
              <span className="text-2xl font-extrabold text-white leading-tight">$0</span>
            </div>
            <p className="text-sm text-slate-300 mb-3 font-semibold">Analyzer</p>
            <p className="text-xs text-slate-400 mb-3">Manual CSV upload • Lead magnet</p>
            <ul className="space-y-2 text-sm flex-grow mb-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300">Manual CSV upload & analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300">Heat loss calculation (BTU/hr/°F)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300">System balance point analysis</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300">Efficiency percentile ranking</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-300">Export results to CSV</span>
              </li>
              <li className="flex items-start gap-2">
                <XCircle size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <span className="text-slate-500">No automatic monitoring</span>
              </li>
            </ul>
          </div>

          {/* Bridge Tier - Controller */}
          <div className="bg-gradient-to-br from-amber-600/20 to-orange-600/20 rounded-lg border-2 border-amber-500/50 p-4 relative flex flex-col">
            <div className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">POPULAR</div>
            <div className="flex items-center justify-between mb-3 min-h-[3rem]">
              <h4 className="font-bold text-lg text-white">Bridge</h4>
              <span className="text-2xl font-extrabold text-amber-400 leading-tight whitespace-nowrap">$129</span>
            </div>
            <p className="text-sm text-amber-200 mb-1 font-semibold">Controller</p>
            <p className="text-xs text-amber-300/80 mb-3">One-time purchase • Pi Zero 2 W • The standard brain</p>
            <ul className="space-y-2 text-sm flex-grow mb-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Everything in Free tier</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Pi Zero 2 W hardware included</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Local control & short cycle protection</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Automatic data logging</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Full thermostat control (setpoints, schedules)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Works completely offline</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Cloud AI ready (bring your own API key)</span>
              </li>
            </ul>
            <a
              href={EBAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto w-full px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-lg transition-colors shadow-lg hover:shadow-xl text-center"
            >
              Buy Now - $129
            </a>
          </div>

          {/* Sovereign Tier - AI Core */}
          <div className="bg-gradient-to-br from-violet-600/20 to-purple-600/20 rounded-lg border-2 border-violet-500/50 p-4 relative flex flex-col opacity-90">
            <div className="absolute top-3 right-3 bg-violet-500 text-white text-xs font-bold px-2 py-1 rounded">COMING SOON</div>
            <div className="flex items-center justify-between mb-3 min-h-[3rem]">
              <h4 className="font-bold text-lg text-white">Sovereign</h4>
              <span className="text-2xl font-extrabold text-violet-400 leading-tight whitespace-nowrap">$299</span>
            </div>
            <p className="text-sm text-violet-200 mb-1 font-semibold">The AI Core</p>
            <p className="text-xs text-violet-300/80 mb-3">Coming Soon • Pi 5 16GB • The genius brain</p>
            <ul className="space-y-2 text-sm flex-grow mb-4">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Everything in Bridge tier</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Pi 5 16GB hardware included</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Voice control (Local Whisper)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">LLM intelligence (on-device)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">100% air-gapped operation</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-slate-200">Maximum privacy & sovereignty</span>
              </li>
            </ul>
            <button
              disabled
              className="mt-auto w-full px-6 py-3 bg-slate-700 text-slate-400 rounded-lg font-bold text-lg cursor-not-allowed text-center"
            >
              Coming Soon
            </button>
          </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 1: Home Setup */}
      <div id="home-setup" className="mb-8 scroll-mt-24">
        <div className="mb-5 pb-3 border-b border-slate-800">
          <h2 className="text-[24px] font-semibold text-[#E8EDF3] mb-1">1. Home Setup</h2>
          <p className="text-sm text-[#A7B0BA]">Configure your home structure and zones</p>
        </div>
        <div className="space-y-5">
          <ZoneManagementSection setToast={setToast} />
          <BuildingCharacteristics
            settings={userSettings}
            onSettingChange={setUserSetting}
            outletContext={outletCtx}
          />
        </div>
      </div>

      {/* Section 2: System Configuration */}
      <div id="system-config" className="mb-8 scroll-mt-24">
        <div className="mb-5 pb-3 border-b border-slate-800">
          <h2 className="text-[24px] font-semibold text-[#E8EDF3] mb-1">2. System Configuration</h2>
          <p className="text-sm text-[#A7B0BA]">Define your HVAC equipment and capabilities</p>
        </div>
        <div className="space-y-5">
          <HvacSystemConfig
            settings={userSettings}
            onSettingChange={setUserSetting}
            setToast={setToast}
          />

          {/* Advanced Equipment Profile (Elite Tier) */}
          {userSettings.primarySystem === "heatPump" && (
            <Section title="Advanced Equipment Profile" icon={<Crown className="w-5 h-5 text-amber-500" />}>
              <AdvancedEquipmentProfile
                settings={userSettings}
                onSettingChange={setUserSetting}
                setToast={setToast}
              />
            </Section>
          )}
        </div>
      </div>

      {/* Section 3: Costs & Rates */}
      <div id="costs-rates" className="mb-8 scroll-mt-24">
        <div className="mb-5 pb-3 border-b border-slate-800">
          <h2 className="text-[24px] font-semibold text-[#E8EDF3] mb-1">3. Costs & Rates</h2>
          <p className="text-sm text-[#A7B0BA]">Set utility rates and pricing preferences</p>
        </div>
        <CostSettings
          settings={userSettings}
          onSettingChange={setUserSetting}
          userSettings={userSettings}
        />
      </div>

      {/* Section 4: Thermostat Behavior */}
      <div id="thermostat" className="mb-8 scroll-mt-24">
        <div className="mb-5 pb-3 border-b border-slate-800">
          <h2 className="text-[24px] font-semibold text-[#E8EDF3] mb-1">4. Thermostat Behavior</h2>
          <p className="text-sm text-[#A7B0BA]">Configure schedule, setbacks, and control logic</p>
        </div>
        <div className="bg-[#0C1118] border border-slate-800 rounded-xl p-6">
          {/* Sticky Summary Bar - Dynamic */}
          {(() => {
            // Compute strategy from thermostat settings
            let strategy = "Constant temp";
            let setback = "Off";
            
            try {
              const thermostatSettings = JSON.parse(localStorage.getItem("thermostatSettings") || "{}");
              if (thermostatSettings.schedule?.enabled) {
                // Check if there's a sleep/away comfort setting that differs from home
                const home = thermostatSettings.comfortSettings?.home;
                const sleep = thermostatSettings.comfortSettings?.sleep;
                if (sleep && home) {
                  const hasSetback = sleep.heatSetPoint !== home.heatSetPoint || sleep.coolSetPoint !== home.coolSetPoint;
                  if (hasSetback) {
                    strategy = "Scheduled";
                    const heatDelta = home.heatSetPoint - sleep.heatSetPoint;
                    const coolDelta = sleep.coolSetPoint - home.coolSetPoint;
                    if (heatDelta > 0) {
                      setback = `${sleep.heatSetPoint}°F (night)`;
                    } else if (coolDelta > 0) {
                      setback = `${sleep.coolSetPoint}°F (night)`;
                    } else {
                      setback = "On";
                    }
                  }
                }
              }
            } catch {
              // Fallback to defaults
            }
            
            return (
              <div className="mb-6 p-4 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-xs font-medium text-slate-400 mb-2">Current Configuration</div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-slate-300">
                    Mode: <span className="font-semibold text-white">{userSettings.primarySystem === "heatPump" ? "Heat pump" : userSettings.primarySystem === "gasFurnace" ? "Gas furnace" : "Unknown"}</span>
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-300">
                    Strategy: <span className="font-semibold text-white">{strategy}</span>
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-300">
                    Night setback: <span className="font-semibold text-white">{setback}</span>
                  </span>
                </div>
              </div>
            );
          })()}
          <ThermostatSettingsPanel />
          <div className="mt-6">
            <AutoSettingsMathEquations />
          </div>
        </div>
      </div>

      {/* Section 5: Bridge & AI */}
      <div id="bridge-ai" className="mb-8 scroll-mt-24">
        <div className="mb-5 pb-3 border-b border-slate-800">
          <h2 className="text-[24px] font-semibold text-[#E8EDF3] mb-1">5. Bridge & AI</h2>
          <p className="text-sm text-[#A7B0BA]">Connect hardware and configure AI features</p>
        </div>
        <div className="space-y-5">
          <Section title="Joule Bridge (Local HomeKit)" icon={<ThermometerSun size={20} />} id="joule-bridge">
            <JouleBridgeSettings />
          </Section>
          <Section title="Ecobee Cloud API (Fallback)" icon={<ThermometerSun size={20} />}>
            <EcobeeSettings />
          </Section>
          <Section title="Pro Access" icon={<Crown className="w-5 h-5 text-amber-500" />}>
            <ProCodeInput />
          </Section>
        </div>
      </div>

      {/* Advanced Settings Section */}
      <div className="bg-[#0C1118] border border-slate-800 rounded-xl">
        <button
          onClick={() => setAdvancedSettingsExpanded(!advancedSettingsExpanded)}
          className="w-full p-6 flex items-center justify-between hover:bg-slate-900/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-[18px] font-medium text-[#E8EDF3]">
              Advanced Settings
            </h2>
          </div>
          <ChevronRight
            className={`text-slate-400 transition-transform ${
              advancedSettingsExpanded ? "rotate-90" : ""
            }`}
          />
        </button>

        {advancedSettingsExpanded && (
          <div className="p-6 border-t border-slate-800 space-y-6">
            <Section title="Local LLM (Joule Bridge/Core)" icon={<Server size={20} />}>
              <LocalLLMSettings />
            </Section>

            <Section title="Groq AI Integration" icon={<Zap size={20} />}>
              <GroqApiKeyInput />
            </Section>

            <Section title="Voice Settings" icon={<Mic size={20} />}>
              <div className="space-y-4">
                <TTSEngineToggle />
                <VoicePicker />
                <VoiceListenDurationInput />
                <FunSafeModeToggle />
              </div>
            </Section>

            <Section title="Display Preferences" icon={<Settings size={20} />}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                    Unit System
                  </label>
                  <UnitSystemToggle />
                  <p className="mt-1.5 text-xs text-[#A7B0BA] max-w-2xl leading-relaxed">
                    US mode: °F, kBTU/h, BTU/hr/°F, kWh. International mode: °C, kW, W/K, Joules (with kWh in parentheses).
                  </p>
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!userSettings.nerdMode}
                      onChange={(e) =>
                        setUserSetting("nerdMode", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Nerd Mode (Joule / SI Units)
                    </span>
                  </label>
                  <p className="mt-1.5 text-xs text-[#A7B0BA] max-w-2xl leading-relaxed ml-6">
                    Show energy values in Joules (MJ/GJ) with kWh in parentheses. Perfect for impressing engineers and physicists on Reddit. Joule stores all energy internally in Joules, then formats for display.
                  </p>
                </div>
              </div>
            </Section>

            {/* Detailed Annual Estimate Toggle */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[#E8EDF3]">
                    Detailed Annual Estimate
                  </p>
                  <p className="text-xs text-[#A7B0BA] mt-1">
                    Use month-by-month calculations for more accurate annual
                    estimates
                  </p>
                </div>
                <label className="inline-flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!userSettings.useDetailedAnnualEstimate}
                    onChange={(e) =>
                      setUserSetting(
                        "useDetailedAnnualEstimate",
                        e.target.checked
                      )
                    }
                  />
                </label>
              </div>
            </div>

            {/* Documentation Link */}
            <div className="mb-4">
              <Link
                to="/hardware"
                className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span className="text-sm font-medium">
                  View Setup Documentation & Guides
                </span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-6">
                Step-by-step instructions for flashing the Bridge and setting it up
              </p>
            </div>

            {/* Byzantine Mode Easter Egg 🕯️ */}
            <ByzantineModeToggle setToast={setToast} />

            {/* Data Management & Privacy Section */}
            <Section title="Data Management & Privacy" icon={<Shield size={20} />}>
              <div className="space-y-4">
                {/* Storage Usage Indicator */}
                <StorageUsageIndicator />
                
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h3 className="font-semibold text-red-900 dark:text-red-200 mb-2 flex items-center gap-2">
                    <Trash2 size={18} />
                    Delete All Data
                  </h3>
                  <p className="text-sm text-red-800 dark:text-red-300 mb-4">
                    This will permanently delete all stored data including:
                  </p>
                  <ul className="text-sm text-red-700 dark:text-red-400 mb-4 space-y-1 list-disc list-inside">
                    <li>All CSV analysis results and history</li>
                    <li>All user settings and preferences</li>
                    <li>All zone configurations</li>
                    <li>All thermostat data and diagnostics</li>
                    <li>All saved analyses and labels</li>
                    <li>Location data and preferences</li>
                    <li>Voice settings and AI preferences</li>
                  </ul>
                  <p className="text-sm font-semibold text-red-900 dark:text-red-200 mb-4">
                    ⚠️ This action cannot be undone!
                  </p>
                  <DeleteAllDataButton setToast={setToast} />
                </div>
              </div>
            </Section>
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
    </div>
  );
};

export default SettingsPage;
