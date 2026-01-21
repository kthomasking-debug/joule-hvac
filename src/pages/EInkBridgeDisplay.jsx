import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Radio,
  RefreshCw,
  Sparkles,
  Wifi,
} from "lucide-react";
import { useJouleBridgeContext } from "../contexts/JouleBridgeContext";
import { getWeeklyCost } from "../lib/bridgeApi";
import useForecast from "../hooks/useForecast";
import PiZeroOnboarding from "../components/PiZeroOnboarding";

const SCREEN_W = 250;
const SCREEN_H = 122;
// True scale for 2.13" Waveshare display (48.5mm × 24.5mm)
// At 96 PPI: 48.5mm = 1.91 inches ≈ 183 pixels
// True scale: 183 / 250 = 0.732x
// Using 1.0x for slight readability while staying true to size (~2" display)
const SCALE = 1.0; // True scale: actual 2.13" display size
const NAV_HEIGHT = 24;
const HEADER_HEIGHT = 16;
const FOOTER_HEIGHT = 12;
const MODE_SEQUENCE = { off: "heat", heat: "cool", cool: "off" };

const monoFont = '"IBM Plex Mono", "Space Mono", Menlo, monospace';
const displayPaper = "#f8f6ef";
const displayInk = "#0c0c0c";

function formatTime(date) {
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function EInkBridgeDisplay() {
  const bridge = useJouleBridgeContext();
  const [page, setPage] = useState("status");
  const [showPiOnboarding, setShowPiOnboarding] = useState(() => {
    // Show onboarding if user hasn't completed it and doesn't have location data
    if (typeof window === "undefined") return false;
    const completed = localStorage.getItem("hasCompletedPiOnboarding");
    const hasLocation = localStorage.getItem("userLocation");
    return !completed && !hasLocation;
  });
  const [preview, setPreview] = useState({
    mode: "off",
    temp: 70,
    humidity: 45,
    target: 70,
  });
  const [toast, setToast] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [weeklyCost, setWeeklyCost] = useState(null);
  const [monthlyCost, setMonthlyCost] = useState(null);
  const [weeklyCostSource, setWeeklyCostSource] = useState("bridge");
  const [weeklyCostLoading, setWeeklyCostLoading] = useState(false);
  const [weeklyCostError, setWeeklyCostError] = useState(null);
  const [lastCostSync, setLastCostSync] = useState(null);
  const [partialRefreshEnabled, setPartialRefreshEnabled] = useState(true);
  const [flashOn, setFlashOn] = useState(false);
  const [wifiSignal, setWifiSignal] = useState(0);

  // Get user location for weather
  const userLocation = useMemo(() => {
    try {
      const stored = localStorage.getItem("userLocation");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);

  // Fetch weather data
  const { forecast } = useForecast(
    userLocation?.latitude,
    userLocation?.longitude,
    { enabled: !!userLocation }
  );

  const outdoorTemp = useMemo(() => {
    if (!forecast || forecast.length === 0) return null;
    return Math.round(forecast[0]?.temp ?? 0);
  }, [forecast]);

  const outdoorHumidity = useMemo(() => {
    if (!forecast || forecast.length === 0) return null;
    return Math.round(forecast[0]?.humidity ?? 0);
  }, [forecast]);

  const handleManualTargetChange = (value) => {
    const num = Number(value);
    if (Number.isFinite(num)) {
      setPreview((prev) => ({ ...prev, target: num, temp: num }));
      setLastUpdated(new Date());
    }
  };

  const connectionOk = (bridge?.bridgeAvailable && bridge?.connected) || false;
  const previewOnly = !connectionOk;
  const headerText = useMemo(() => {
    const mode = (preview.mode || "off").toUpperCase();
    const temp = Math.round(preview.temp ?? preview.target ?? 0);
    const hum = Math.round(preview.humidity ?? 0);
    return `${mode}  ${temp}°  ${hum}%`;
  }, [preview.humidity, preview.mode, preview.target, preview.temp]);

  useEffect(() => {
    if (!bridge?.thermostatData) return;

    setPreview((prev) => ({
      ...prev,
      mode: bridge.mode || prev.mode,
      temp: bridge.temperature ?? prev.temp,
      humidity: bridge.humidity ?? prev.humidity,
      target:
        bridge.targetTemperature ??
        bridge.temperature ??
        prev.target ??
        prev.temp,
    }));
    setLastUpdated(new Date());
  }, [bridge?.thermostatData, bridge?.humidity, bridge?.mode, bridge?.targetTemperature, bridge?.temperature]);

  const fetchWeeklyCost = useCallback(async () => {
    setWeeklyCostLoading(true);
    setWeeklyCostError(null);

    // Check if user has adjusted temperature from the original forecaster setting
    // If so, we must recalculate instead of using static forecaster value
    let baselineTemperature = null;
    let forecastSourceCost = null;
    
    try {
      const storedForecast = localStorage.getItem("last_forecast_summary");
      if (storedForecast) {
        const forecastData = JSON.parse(storedForecast);
        console.log("E-ink: Found localStorage forecast data:", forecastData);
        
        // Get the baseline cost from forecaster (at its original indoor temp)
        forecastSourceCost = 
          forecastData.totalHPCostWithAux ?? 
          forecastData.totalHPCost ?? 
          forecastData.totalWeeklyCost ?? 
          forecastData.weekly_cost ?? 
          forecastData.weeklyCost;
      }
    } catch (err) {
      console.warn("E-ink: Failed to read from localStorage:", err);
    }

    // Get baseline indoor temp from settings (what forecaster was calculated at)
    try {
      const userSettings = localStorage.getItem("userSettings");
      if (userSettings) {
        const settings = JSON.parse(userSettings);
        baselineTemperature = settings.indoorTemp || 70;
      }
    } catch {
      baselineTemperature = 70;
    }

    // If user has changed target temperature from baseline, recalculate cost
    const currentTarget = preview.target || baselineTemperature || 70;
    const hasTemperatureChanged = Math.abs(currentTarget - (baselineTemperature || 70)) >= 1;

    if (forecastSourceCost && forecastSourceCost > 0 && !hasTemperatureChanged) {
      // Temperature unchanged and we have forecaster data - use it as-is
      console.log("E-ink: Using static Forecaster cost (no temp adjustment):", forecastSourceCost);
      setWeeklyCost(forecastSourceCost);
      setMonthlyCost(forecastSourceCost * 4.33);
      setWeeklyCostSource("forecaster");
      setLastCostSync(new Date());
      setWeeklyCostLoading(false);
      setWifiSignal(0);
      setLastUpdated(new Date());
      return;
    } else if (hasTemperatureChanged) {
      // Temperature changed - must recalculate based on new target
      console.log(`E-ink: Temperature changed from ${baselineTemperature}° to ${currentTarget}° - recalculating...`);
    }

    // Fallback: try bridge API (only if localStorage didn't have data or temp changed)
    console.log("E-ink: Calculating cost from current conditions...");
    try {
      const payload = {
        temperature: bridge?.temperature ?? preview.temp,
        humidity: bridge?.humidity ?? preview.humidity,
        mode: bridge?.mode ?? preview.mode,
        targetTemperature: currentTarget,
      };
      const result = await getWeeklyCost(payload);
      const value = result?.weekly_cost ?? result?.weekly ?? result?.cost ?? result?.total ?? null;
      if (typeof value === "number") {
        setWeeklyCost(value);
        setMonthlyCost(value * 4.33);
        setWeeklyCostSource(connectionOk ? "bridge" : "local-calc");
        setLastCostSync(new Date());
      } else {
        setWeeklyCost(null);
        setMonthlyCost(null);
        setWeeklyCostSource(connectionOk ? "bridge" : "local-calc");
      }

      // Fetch WiFi signal if bridge is available
      if (connectionOk) {
        try {
          const bridgeUrl = localStorage.getItem('jouleBridgeUrl') || import.meta.env.VITE_JOULE_BRIDGE_URL || 'http://localhost:3002';
          const signalResp = await fetch(`${bridgeUrl}/api/wifi/signal`, { timeout: 2000 });
          if (signalResp.ok) {
            const signalData = await signalResp.json();
            setWifiSignal(signalData.bars ?? 0);
          }
        } catch {
          setWifiSignal(0);
        }
      } else {
        setWifiSignal(0);
      }
    } catch (err) {
      setWeeklyCostError(err?.message || "Cost endpoint unavailable");
      console.log("E-ink: Bridge API failed, using fallback calculation", {
        forecastSourceCost,
        baselineTemperature,
        targetTemp: preview.target,
        outdoorTemp,
      });
      
      // Improved fallback: Recalculate based on temperature change
      const targetTemp = preview.target ?? preview.temp ?? 70;
      let fallbackWeekly = 5.0; // Default minimal estimate
      
      // Get building efficiency factor from settings if available
      let efficiencyFactor = 1.0;
      try {
        const userSettings = localStorage.getItem("userSettings");
        if (userSettings) {
          const settings = JSON.parse(userSettings);
          // Larger homes cost more per degree
          const sqFt = settings.squareFeet || 1500;
          efficiencyFactor = sqFt / 1500; // Normalize to 1500 sqft
        }
      } catch {
        // Use default factor
      }
      
      // If we have forecaster source cost, scale it based on temperature delta
      if (forecastSourceCost && forecastSourceCost > 0 && baselineTemperature) {
        const tempDelta = targetTemp - baselineTemperature;
        // Each degree change scales cost by ~5-6% (roughly)
        const costMultiplier = Math.pow(1.06, tempDelta);
        fallbackWeekly = forecastSourceCost * costMultiplier;
        console.log("E-ink: Using forecaster-based calculation", {
          forecastSourceCost,
          tempDelta,
          costMultiplier,
          fallbackWeekly,
        });
      } else if (outdoorTemp !== null && !isNaN(outdoorTemp)) {
        // Use outdoor temp to estimate heating/cooling load
        const tempDiff = Math.abs(targetTemp - outdoorTemp);
        
        // Determine if heating or cooling
        if (outdoorTemp < targetTemp - 2) {
          // Heating mode: $0.50/DD base, scaled by building size
          const weeklyDD = tempDiff * 7;
          fallbackWeekly = weeklyDD * 0.50 * efficiencyFactor;
          console.log("E-ink: Using heating mode calculation", { tempDiff, weeklyDD, efficiencyFactor, fallbackWeekly });
        } else if (outdoorTemp > targetTemp + 2) {
          // Cooling mode: $0.60/DD base (less efficient), scaled by building size
          const weeklyDD = tempDiff * 7;
          fallbackWeekly = weeklyDD * 0.60 * efficiencyFactor;
          console.log("E-ink: Using cooling mode calculation", { tempDiff, weeklyDD, efficiencyFactor, fallbackWeekly });
        } else {
          // Mild weather, minimal HVAC usage
          fallbackWeekly = 2.0;
          console.log("E-ink: Mild weather, minimal usage");
        }
      } else {
        console.log("E-ink: No data for calculation, using default");
      }
      
      console.log("E-ink: Fallback result", { fallbackWeekly, monthly: fallbackWeekly * 4.33 });
      setWeeklyCost(fallbackWeekly);
      setMonthlyCost(fallbackWeekly * 4.33);
      setWeeklyCostSource("local");
      setLastCostSync(new Date());
      setWifiSignal(0);
    } finally {
      setWeeklyCostLoading(false);
      setLastUpdated((prev) => prev ?? new Date());
    }
  }, [bridge?.humidity, bridge?.mode, bridge?.temperature, connectionOk, outdoorTemp, preview.humidity, preview.mode, preview.temp, preview.target]);

  useEffect(() => {
    fetchWeeklyCost();
    
    // Auto-refresh every 15 minutes (matching e-ink update cycle)
    const interval = setInterval(() => {
      fetchWeeklyCost();
    }, 15 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchWeeklyCost]);

  const pushToast = (text, tone = "info") => {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 3200);
  };

  const triggerFlash = () => {
    if (!partialRefreshEnabled) return;
    setFlashOn(true);
    setTimeout(() => setFlashOn(false), 140);
  };

  const handleSetpointDelta = async (delta) => {
    const nextTarget = Math.round((preview.target ?? preview.temp ?? 70) + delta);
    setPreview((prev) => ({ ...prev, target: nextTarget, temp: nextTarget }));
    setLastUpdated(new Date());
    triggerFlash();
    pushToast(connectionOk ? "Sending setpoint to Bridge..." : "Preview updated locally (Bridge offline)");

    if (connectionOk && bridge?.setTemperature) {
      try {
        await bridge.setTemperature(nextTarget, nextTarget);
        pushToast("Setpoint sent to Bridge", "success");
        setLastUpdated(new Date());
      } catch (err) {
        pushToast("Bridge command failed. Preview only.", "warn");
      }
    }
  };

  const handleModeCycle = async () => {
    const nextMode = MODE_SEQUENCE[preview.mode] || "heat";
    setPreview((prev) => ({ ...prev, mode: nextMode }));
    setLastUpdated(new Date());
    triggerFlash();
    pushToast(connectionOk ? `Cycling mode to ${nextMode}` : "Preview updated locally (Bridge offline)");

    if (connectionOk && bridge?.setMode) {
      try {
        await bridge.setMode(nextMode);
        pushToast("Mode updated on Bridge", "success");
        setLastUpdated(new Date());
      } catch (err) {
        pushToast("Bridge command failed. Preview only.", "warn");
      }
    }
  };

  const handleRefresh = () => {
    bridge?.refresh?.();
    fetchWeeklyCost();
    pushToast("Requested fresh data from Bridge", "info");
  };

  const renderStatusPage = () => {
    const hasTemp = connectionOk && preview.temp != null;
    
    return (
      <div style={{ paddingTop: 6, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
        {/* Header Info */}
        <div>
          <div style={{ fontSize: 9, color: displayInk, opacity: 0.7 }}>Mode: {preview.mode} | Tgt: {(preview.target ?? 0).toFixed(0)}°</div>
        </div>

        {/* Monthly Cost - BIG DISPLAY */}
        <div style={{ 
          textAlign: 'center',
          fontSize: 32,
          fontWeight: 'bold',
          color: displayInk,
          fontFamily: monoFont,
          lineHeight: 1,
          marginBottom: 4
        }}>
          {monthlyCost !== null ? `$${monthlyCost.toFixed(0)}` : "--"}
        </div>
        
        {/* Sub-label */}
        <div style={{ 
          textAlign: 'center',
          fontSize: 10,
          color: displayInk,
          marginBottom: 6
        }}>
          per month
        </div>

        {/* Secondary info */}
        <div style={{ fontSize: 9, color: displayInk, display: 'flex', justifyContent: 'space-around', opacity: 0.85 }}>
          <span>Wk: ${weeklyCost !== null ? weeklyCost.toFixed(2) : "--"}</span>
          {hasTemp && <span>Now: {preview.temp.toFixed(1)}°</span>}
        </div>
      </div>
    );
  };

  const renderActionsPage = () => (
    <div style={{ paddingTop: 4, color: displayInk, opacity: previewOnly ? 0.75 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <div style={{ fontSize: 10 }}>Actions</div>
        <div style={{ fontSize: 9 }}>
          {weeklyCost !== null ? `$${weeklyCost.toFixed(2)}/wk` : "--"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        <button
          type="button"
          onClick={() => handleSetpointDelta(+1)}
          style={{
            border: `1px solid ${displayInk}`,
            padding: "4px 8px",
            width: 54,
            background: "transparent",
            fontFamily: monoFont,
            fontSize: 9,
            cursor: "pointer",
          }}
        >
          +1°
        </button>
        <button
          type="button"
          onClick={() => handleSetpointDelta(-1)}
          style={{
            border: `1px solid ${displayInk}`,
            padding: "4px 8px",
            width: 54,
            background: "transparent",
            fontFamily: monoFont,
            fontSize: 9,
            cursor: "pointer",
          }}
        >
          -1°
        </button>
      </div>
      <button
        type="button"
        onClick={handleModeCycle}
        style={{
          border: `1px solid ${displayInk}`,
          padding: "4px 8px",
          width: 115,
          background: "transparent",
          fontFamily: monoFont,
          fontSize: 9,
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <div>Mode: {preview.mode}</div>
        <div style={{ fontSize: 8, marginTop: 1 }}>tap to cycle</div>
      </button>

      {previewOnly && (
        <div style={{ fontSize: 8, marginTop: 4 }}>
          Bridge offline — actions are preview-only
        </div>
      )}
    </div>
  );

  const renderGuidePage = () => (
    <div style={{ paddingTop: 6, color: displayInk }}>
      <div style={{ fontSize: 11, marginBottom: 4 }}>Guide</div>
      <div style={{ fontSize: 10, marginBottom: 2 }}>Small-screen tips:</div>
      <div style={{ fontSize: 10 }}>- Use app for visuals</div>
      <div style={{ fontSize: 10 }}>- Press Actions below</div>
    </div>
  );

  const renderPage = () => {
    if (page === "status") return renderStatusPage();
    if (page === "actions") return renderActionsPage();
    return renderGuidePage();
  };

  const navItems = [
    { key: "status", label: "Status" },
    { key: "actions", label: "Actions" },
    { key: "guide", label: "Guide" },
  ];

  const nav = (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: NAV_HEIGHT,
        background: displayInk,
        color: displayPaper,
        display: "flex",
      }}
    >
      {navItems.map((item, idx) => (
        <button
          key={item.key}
          type="button"
          onClick={() => {
            setPage(item.key);
            triggerFlash();
          }}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            color: displayPaper,
            fontFamily: monoFont,
            fontSize: 10,
            textAlign: "center",
            cursor: "pointer",
            borderLeft: idx === 0 ? "none" : `1px solid ${displayPaper}`,
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
      <div className="p-4">
        <div className="relative mx-auto" style={{ width: SCREEN_W * SCALE + 30, height: SCREEN_H * SCALE + 30 }}>
          <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-slate-800 dark:via-slate-800 dark:to-slate-700 shadow-[0_30px_80px_rgba(15,23,42,0.35)]" />
          <div
            className="absolute top-3 left-3 rounded-[22px] border border-slate-900/60 bg-white overflow-hidden shadow-[0_14px_40px_rgba(0,0,0,0.18)]"
            style={{ width: SCREEN_W * SCALE + 4, height: SCREEN_H * SCALE + 4 }}
          >
            <div
              className="relative"
              style={{
                width: SCREEN_W,
                height: SCREEN_H,
                transform: `scale(${SCALE}) translate(2px, 2px)`,
                transformOrigin: "top left",
                background: displayPaper,
                color: displayInk,
                fontFamily: monoFont,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: HEADER_HEIGHT,
                  background: displayInk,
                  color: displayPaper,
                  fontSize: 10,
                  padding: "2px 4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  letterSpacing: 0.2,
                }}
              >
                <span>{headerText}</span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 9 }}>SIG {wifiSignal}/3</span>
                  <span>{connectionOk ? "OK" : "ERR"}</span>
                </span>
              </div>

              <div
                style={{
                  position: "absolute",
                  top: HEADER_HEIGHT,
                  left: 0,
                  right: 0,
                  bottom: page === "actions" ? NAV_HEIGHT : NAV_HEIGHT + FOOTER_HEIGHT,
                  padding: "6px 8px",
                  fontSize: 10,
                  lineHeight: 1.2,
                }}
              >
                {renderPage()}
              </div>

              {page !== "actions" && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: NAV_HEIGHT,
                    height: FOOTER_HEIGHT,
                    padding: "0 6px",
                    fontSize: 9,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: displayInk,
                    background: displayPaper,
                  }}
                >
                  <span>
                  Out {outdoorTemp !== null ? `${outdoorTemp}°` : "--"}
                  {outdoorHumidity !== null ? ` ${outdoorHumidity}%` : ""}
                </span>
                  <span>{weeklyCost !== null ? `$${weeklyCost.toFixed(2)}/wk` : "--"}</span>
                </div>
              )}

              {nav}

              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: displayInk,
                  opacity: flashOn ? 0.14 : 0,
                  transition: "opacity 140ms ease-out",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pi Zero Onboarding Modal */}
      {showPiOnboarding && (
        <PiZeroOnboarding
          onComplete={() => setShowPiOnboarding(false)}
          onSkip={() => setShowPiOnboarding(false)}
        />
      )}
    </div>
  );
}

