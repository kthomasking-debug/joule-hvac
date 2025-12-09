/**
 * SummerACIssues - Summer-focused AC troubleshooting screen
 * Handles sticky house, high humidity, short cycling issues
 */
import React, { useState, useMemo, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  Droplet,
  Home,
  Zap,
  MapPin,
  Thermometer,
  Gauge,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Wind,
  Settings,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { SeasonProvider, useSeason, SeasonModeToggle } from "../features/forecaster/components";
import { Toast } from "../components/Toast";

const SummerACIssues = () => {
  const outlet = useOutletContext() || {};
  const navigate = useNavigate();
  const { userSettings, setUserSetting } = outlet;
  const thermostatState = JSON.parse(localStorage.getItem("thermostatState") || "{}");

  // Determine thermostat mode for SeasonProvider
  const thermostatMode = "cool"; // Force cooling mode for this screen

  // Get current outdoor temp from forecast if available
  const currentOutdoorTemp = useMemo(() => {
    // Try to get from forecast data if available
    const forecast = localStorage.getItem("lastForecast");
    if (forecast) {
      try {
        const data = JSON.parse(forecast);
        if (data && data.length > 0) {
          return data[0]?.temp;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return undefined;
  }, []);

  return (
    <SeasonProvider thermostatMode={thermostatMode} outdoorTemp={currentOutdoorTemp} defaultMode="cooling">
      <SummerACIssuesContent
        userSettings={userSettings}
        setUserSetting={setUserSetting}
        thermostatState={thermostatState}
        navigate={navigate}
      />
    </SeasonProvider>
  );
};

const SummerACIssuesContent = ({ userSettings, setUserSetting, thermostatState, navigate }) => {
  const { isCoolingView, seasonMode } = useSeason();
  const [selectedIssues, setSelectedIssues] = useState([]);
  const [toast, setToast] = useState(null);
  const [appliedFixes, setAppliedFixes] = useState([]);

  // Mock diagnostic data - in production, this would come from actual thermostat/CSV analysis
  const diagnostics = useMemo(() => {
    return {
      indoorTemp: thermostatState.indoorTemp || 74,
      indoorHumidity: thermostatState.indoorHumidity || 63,
      runtimeToday: 3.2, // hours
      avgCycleOn: 6, // minutes
      avgCycleOff: 7, // minutes
      overcoolSetting: thermostatState.acOvercoolMax || 1, // degrees
      fanMode: thermostatState.fanMode || "on",
      coolMinOnTime: thermostatState.coolMinOnTime || 4, // minutes
      compressorMinOffTime: thermostatState.compressorMinOffTime || 5, // minutes
    };
  }, [thermostatState]);

  // Calculate comfort score
  const comfortScore = useMemo(() => {
    let score = 10;
    if (diagnostics.indoorHumidity > 60) score -= 2;
    if (diagnostics.indoorHumidity > 65) score -= 1.5;
    if (diagnostics.avgCycleOn < 10) score -= 1.5;
    if (diagnostics.indoorTemp > 76) score -= 1;
    return Math.max(0, Math.min(10, score));
  }, [diagnostics]);

  const comfortStatus = useMemo(() => {
    const issues = [];
    if (diagnostics.indoorHumidity > 60) issues.push("Sticky");
    if (diagnostics.indoorHumidity > 65) issues.push("Humid");
    if (diagnostics.avgCycleOn < 10) issues.push("Short Cycling");
    return issues.length > 0 ? issues.join(" + ") : "Comfortable";
  }, [diagnostics]);

  // Root causes based on diagnostics
  const rootCauses = useMemo(() => {
    const causes = [];
    if (diagnostics.avgCycleOn < 10) {
      causes.push({
        severity: "primary",
        text: "AC cycles are short (6 min avg). Short cycling = poor dehumidification.",
        explanation:
          "When the AC runs for less than 10 minutes, the evaporator coil doesn't stay cold long enough to condense significant moisture. This means the AC cools the air but doesn't remove enough humidity.",
      });
    }
    if (diagnostics.overcoolSetting < 2) {
      causes.push({
        severity: "secondary",
        text: "Overcool setting is mild (+1°F). For very humid climates, +2–3°F helps wring out moisture.",
        explanation:
          "Overcooling allows the AC to run longer cycles, keeping the coil cold enough to condense more water vapor from the air. This is especially important in humid climates.",
      });
    }
    if (diagnostics.indoorHumidity > 60) {
      causes.push({
        severity: "context",
        text: "Indoor humidity is high (63%). Outdoor humidity has been high all afternoon; indoor RH is lagging behind.",
        explanation:
          "High outdoor humidity makes it harder for your AC to remove moisture. The system needs longer runtime to catch up.",
      });
    }
    if (diagnostics.fanMode === "on") {
      causes.push({
        severity: "optional",
        text: "Fan is set to ON instead of AUTO — this can blow moisture back off the coil.",
        explanation:
          "When the fan runs continuously, it can blow moisture that condensed on the coil back into the air before it drains away. AUTO mode only runs the fan when cooling is active.",
      });
    }
    return causes;
  }, [diagnostics]);

  // Fix suggestions
  const fixSuggestions = useMemo(() => {
    return [
      {
        id: "longerCycles",
        title: "Longer cooling cycles (better dehumidification)",
        explanation:
          "Set Cool Min On Time to 10 minutes and Compressor Min Off Time to 10 minutes to avoid rapid on/off cycling.",
        current: {
          coolMinOn: diagnostics.coolMinOnTime,
          compMinOff: diagnostics.compressorMinOffTime,
        },
        proposed: {
          coolMinOn: 10,
          compMinOff: 10,
        },
        action: () => {
          handleApplyFix("longerCycles");
        },
      },
      {
        id: "moreOvercool",
        title: "More overcool to fight humidity",
        explanation:
          "Allow AC to cool up to 2–3°F below the setpoint so the coil runs longer and pulls more moisture out.",
        current: {
          overcool: diagnostics.overcoolSetting,
        },
        proposed: {
          overcool: 3,
        },
        action: () => {
          handleApplyFix("moreOvercool");
        },
      },
      {
        id: "fanAuto",
        title: "Fan mode for summer",
        explanation:
          "Set fan to AUTO so it doesn't blow moist air off the coil after the compressor stops.",
        current: {
          fanMode: diagnostics.fanMode,
        },
        proposed: {
          fanMode: "auto",
        },
        action: () => {
          handleApplyFix("fanAuto");
        },
      },
    ];
  }, [diagnostics]);

  const handleApplyFix = (fixId) => {
    const fix = fixSuggestions.find((f) => f.id === fixId);
    if (!fix) return;

    try {
      // Update thermostat state
      const newState = { ...thermostatState };

      if (fixId === "longerCycles") {
        newState.coolMinOnTime = fix.proposed.coolMinOn;
        newState.compressorMinOffTime = fix.proposed.compMinOff;
        setUserSetting("coolMinOnTime", fix.proposed.coolMinOn);
        setUserSetting("compressorMinOffTime", fix.proposed.compMinOff);
      } else if (fixId === "moreOvercool") {
        newState.acOvercoolMax = fix.proposed.overcool;
        setUserSetting("acOvercoolMax", fix.proposed.overcool);
      } else if (fixId === "fanAuto") {
        newState.fanMode = fix.proposed.fanMode;
        setUserSetting("fanMode", fix.proposed.fanMode);
      }

      localStorage.setItem("thermostatState", JSON.stringify(newState));
      setAppliedFixes((prev) => [...prev, fixId]);
      setToast({
        message: `${fix.title} applied successfully!`,
        type: "success",
      });

      // Dispatch event to update UI
      window.dispatchEvent(new CustomEvent("thermostatSettingsUpdated"));
    } catch (error) {
      setToast({
        message: `Failed to apply fix: ${error.message}`,
        type: "error",
      });
    }
  };

  const handleApplyAllFixes = () => {
    fixSuggestions.forEach((fix) => {
      if (!appliedFixes.includes(fix.id)) {
        handleApplyFix(fix.id);
      }
    });
  };

  const toggleIssue = (issueId) => {
    setSelectedIssues((prev) =>
      prev.includes(issueId) ? prev.filter((id) => id !== issueId) : [...prev, issueId]
    );
  };

  return (
    <div className="min-h-screen bg-[#0C0F14]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Header */}
        <SeasonHeader
          title="AC Troubleshooting"
          subtitle="Sticky house, high humidity, or short cycling? Let's fix your summer comfort."
        />

        {/* Issue Selector */}
        <IssueSelector selectedIssues={selectedIssues} onToggleIssue={toggleIssue} />

        {/* Quick Diagnostics Strip */}
        <MetricStrip diagnostics={diagnostics} comfortScore={comfortScore} comfortStatus={comfortStatus} />

        {/* AC Behavior + Humidity Panel */}
        <SummerBehaviorPanel diagnostics={diagnostics} />

        {/* Root Cause Analysis */}
        <RootCauseList causes={rootCauses} />

        {/* Fix Suggestions */}
        <FixSuggestionPanel
          fixes={fixSuggestions}
          appliedFixes={appliedFixes}
          onApplyFix={handleApplyFix}
          onApplyAll={handleApplyAllFixes}
        />

        {/* Comfort Outcome Summary */}
        <ComfortOutcomeSummary />

        {/* Footer Actions */}
        <SeasonFooterActions navigate={navigate} />
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

// Header Component
const SeasonHeader = ({ title, subtitle }) => {
  const { isCoolingView } = useSeason();
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
          <p className="text-gray-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <SeasonModeToggle />
          <div className="px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded-lg">
            <span className="text-xs font-medium text-orange-400">Mode: COOL</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-400">Comfort:</span>
        <span className="text-white font-medium">6.5 / 10</span>
        <span className="text-gray-500">·</span>
        <span className="text-orange-400">"Sticky + Humid"</span>
      </div>
    </div>
  );
};

// Issue Selector Component
const IssueSelector = ({ selectedIssues, onToggleIssue }) => {
  const issues = [
    {
      id: "sticky",
      label: "Sticky House",
      icon: <Droplet className="w-5 h-5" />,
      caption: "Feels clammy even when temp looks fine",
    },
    {
      id: "humidity",
      label: "High Humidity",
      icon: <Gauge className="w-5 h-5" />,
      caption: "Indoor RH > 60%",
    },
    {
      id: "shortCycling",
      label: "Short Cycling (Cool)",
      icon: <Zap className="w-5 h-5" />,
      caption: "AC runs for a few minutes, shuts off, repeats",
    },
    {
      id: "hotRooms",
      label: "Hot Rooms",
      icon: <MapPin className="w-5 h-5" />,
      caption: "Some rooms hotter than others",
    },
  ];

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-4">What's bugging you?</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {issues.map((issue) => {
          const isSelected = selectedIssues.includes(issue.id);
          return (
            <button
              key={issue.id}
              onClick={() => onToggleIssue(issue.id)}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? "border-orange-500 bg-orange-500/10"
                  : "border-[#222A35] bg-[#151A21] hover:border-orange-500/50"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`${isSelected ? "text-orange-400" : "text-gray-400"}`}>
                  {issue.icon}
                </div>
                <span className={`font-medium ${isSelected ? "text-white" : "text-gray-300"}`}>
                  {issue.label}
                </span>
              </div>
              <p className="text-xs text-gray-500">{issue.caption}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Metric Strip Component
const MetricStrip = ({ diagnostics, comfortScore, comfortStatus }) => {
  const metrics = [
    {
      label: "Indoor Temp",
      value: `${diagnostics.indoorTemp}°F`,
      badge: diagnostics.indoorTemp >= 73 && diagnostics.indoorTemp <= 76 ? "OK" : "Warm",
      badgeColor: diagnostics.indoorTemp >= 73 && diagnostics.indoorTemp <= 76 ? "green" : "orange",
      subtext: "Target 73–76°F",
    },
    {
      label: "Indoor Humidity",
      value: `${diagnostics.indoorHumidity}%`,
      badge: diagnostics.indoorHumidity > 60 ? "High" : "OK",
      badgeColor: diagnostics.indoorHumidity > 60 ? "orange" : "green",
      subtext: "Ideal 45–55% for comfort",
    },
    {
      label: "Runtime Today",
      value: `${diagnostics.runtimeToday}h`,
      badge: null,
      subtext: "Expected 2–4h for 85°F outside",
    },
    {
      label: "Cycle Pattern",
      value: `${diagnostics.avgCycleOn} min`,
      badge: diagnostics.avgCycleOn < 10 ? "Risk" : "OK",
      badgeColor: diagnostics.avgCycleOn < 10 ? "orange" : "green",
      subtext: "Avg on-time · Risk of short cycling if <10 min",
    },
    {
      label: "Overcool Setting",
      value: `+${diagnostics.overcoolSetting}°F`,
      badge: null,
      subtext: "More overcool = better dehumidification",
    },
  ];

  return (
    <div className="mb-8">
      <div className="flex gap-4 overflow-x-auto pb-4">
        {metrics.map((metric, idx) => (
          <div
            key={idx}
            className="flex-shrink-0 w-48 p-4 bg-[#151A21] border border-[#222A35] rounded-xl"
          >
            <div className="text-xs text-gray-400 mb-1">{metric.label}</div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold text-white">{metric.value}</span>
              {metric.badge && (
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    metric.badgeColor === "green"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-orange-500/20 text-orange-400"
                  }`}
                >
                  {metric.badge}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">{metric.subtext}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Summer Behavior Panel Component
const SummerBehaviorPanel = ({ diagnostics }) => {
  return (
    <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Today's AC Behavior */}
      <div className="bg-[#151A21] border border-[#222A35] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Today's AC Behavior</h3>
        <div className="h-32 bg-[#0C0F14] rounded-lg mb-4 flex items-center justify-center">
          <div className="text-center">
            <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Runtime chart would go here</p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Average cycle:</span>
            <span className="text-white">
              {diagnostics.avgCycleOn} min on / {diagnostics.avgCycleOff} min off
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Short cycling risk:</span>
            <span
              className={
                diagnostics.avgCycleOn < 10 ? "text-orange-400 font-medium" : "text-green-400"
              }
            >
              {diagnostics.avgCycleOn < 10 ? "High" : "Low"}
            </span>
          </div>
        </div>
      </div>

      {/* Humidity vs Temperature */}
      <div className="bg-[#151A21] border border-[#222A35] rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Humidity vs Temperature</h3>
        <div className="h-32 bg-[#0C0F14] rounded-lg mb-4 flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Humidity chart would go here</p>
          </div>
        </div>
        <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <p className="text-xs text-orange-300">
            <strong>Evening: 7–10 PM</strong> — Temp OK (74°F), humidity high (65%) → feels sticky
          </p>
        </div>
      </div>
    </div>
  );
};

// Root Cause List Component
const RootCauseList = ({ causes }) => {
  const [expanded, setExpanded] = useState({});

  const severityColors = {
    primary: "border-orange-500 bg-orange-500/10",
    secondary: "border-yellow-500 bg-yellow-500/10",
    context: "border-blue-500 bg-blue-500/10",
    optional: "border-gray-500 bg-gray-500/10",
  };

  const severityIcons = {
    primary: <AlertTriangle className="w-4 h-4 text-orange-400" />,
    secondary: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
    context: <AlertTriangle className="w-4 h-4 text-blue-400" />,
    optional: <AlertTriangle className="w-4 h-4 text-gray-400" />,
  };

  return (
    <div className="mb-8 bg-[#151A21] border border-[#222A35] rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Likely causes (based on your data)</h3>
      <div className="space-y-3">
        {causes.map((cause, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg border ${severityColors[cause.severity] || severityColors.optional}`}
          >
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }))}
              className="w-full flex items-start gap-3 text-left"
            >
              <div className="mt-0.5">{severityIcons[cause.severity]}</div>
              <div className="flex-1">
                <p className="text-sm text-white font-medium">{cause.text}</p>
                {expanded[idx] && cause.explanation && (
                  <p className="text-xs text-gray-400 mt-2">{cause.explanation}</p>
                )}
              </div>
              {cause.explanation && (
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expanded[idx] ? "rotate-180" : ""
                  }`}
                />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Fix Suggestion Panel Component
const FixSuggestionPanel = ({ fixes, appliedFixes, onApplyFix, onApplyAll }) => {
  const [showMath, setShowMath] = useState(false);

  return (
    <div className="mb-8 bg-[#151A21] border border-[#222A35] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Joule's recommended tweaks</h3>
        <button
          onClick={() => setShowMath(!showMath)}
          className="text-xs text-[#1E4CFF] hover:underline"
        >
          {showMath ? "Hide math" : "Show math"}
        </button>
      </div>
      <div className="space-y-4 mb-6">
        {fixes.map((fix) => {
          const isApplied = appliedFixes.includes(fix.id);
          return (
            <div
              key={fix.id}
              className={`p-4 rounded-lg border ${
                isApplied
                  ? "border-green-500/50 bg-green-500/10"
                  : "border-[#222A35] bg-[#0C0F14]"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-white mb-1">{fix.title}</h4>
                  <p className="text-xs text-gray-400 mb-3">{fix.explanation}</p>
                  <div className="flex items-center gap-4 text-xs">
                    {fix.current.coolMinOn !== undefined && (
                      <div>
                        <span className="text-gray-500">Cool Min On:</span>{" "}
                        <span className="text-gray-300">{fix.current.coolMinOn} min</span> →{" "}
                        <span className="text-green-400">{fix.proposed.coolMinOn} min</span>
                      </div>
                    )}
                    {fix.current.compMinOff !== undefined && (
                      <div>
                        <span className="text-gray-500">Comp Min Off:</span>{" "}
                        <span className="text-gray-300">{fix.current.compMinOff} min</span> →{" "}
                        <span className="text-green-400">{fix.proposed.compMinOff} min</span>
                      </div>
                    )}
                    {fix.current.overcool !== undefined && (
                      <div>
                        <span className="text-gray-500">AC Overcool Max:</span>{" "}
                        <span className="text-gray-300">+{fix.current.overcool}°F</span> →{" "}
                        <span className="text-green-400">+{fix.proposed.overcool}°F</span>
                      </div>
                    )}
                    {fix.current.fanMode !== undefined && (
                      <div>
                        <span className="text-gray-500">Fan:</span>{" "}
                        <span className="text-gray-300">{fix.current.fanMode.toUpperCase()}</span> →{" "}
                        <span className="text-green-400">{fix.proposed.fanMode.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onApplyFix(fix.id)}
                  disabled={isApplied}
                  className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isApplied
                      ? "bg-green-500/20 text-green-400 cursor-not-allowed"
                      : "bg-[#1E4CFF] hover:bg-[#1a3fcc] text-white"
                  }`}
                >
                  {isApplied ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 inline mr-1" />
                      Applied
                    </>
                  ) : (
                    "Apply fix"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button
        onClick={onApplyAll}
        className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
      >
        Apply all 3 changes
      </button>
      {showMath && (
        <div className="mt-4 p-4 bg-[#0C0F14] rounded-lg border border-[#222A35]">
          <p className="text-xs text-gray-400">
            <strong>How these settings affect runtime / kWh / humidity:</strong>
          </p>
          <ul className="mt-2 space-y-1 text-xs text-gray-500 list-disc list-inside">
            <li>Longer cycles = more time for coil to condense moisture = lower humidity</li>
            <li>More overcool = longer runtime = better dehumidification</li>
            <li>Fan AUTO = prevents blowing moisture back into air = better humidity control</li>
            <li>Trade-off: Slightly higher energy use, but much better comfort</li>
          </ul>
        </div>
      )}
    </div>
  );
};

// Comfort Outcome Summary Component
const ComfortOutcomeSummary = () => {
  return (
    <div className="mb-8 bg-gradient-to-r from-orange-500/10 to-blue-500/10 border border-orange-500/30 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-3">What you'll feel</h3>
      <p className="text-gray-300 leading-relaxed">
        Once these changes kick in, your house should feel less sticky in the evening, the AC will
        run in longer, smoother cycles, and indoor humidity should drift toward 50–55% on typical
        summer days.
      </p>
      <p className="text-xs text-gray-500 mt-3">
        If your AC still short-cycles after this, it might be oversized for the house. I can help you
        check that next.
      </p>
    </div>
  );
};

// Season Footer Actions Component
const SeasonFooterActions = ({ navigate }) => {
  return (
    <div className="flex items-center justify-between pt-6 border-t border-[#222A35]">
      <button
        onClick={() => navigate("/settings/thermostat")}
        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <Settings className="w-4 h-4" />
        View detailed thermostat thresholds
      </button>
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
    </div>
  );
};

export default SummerACIssues;

