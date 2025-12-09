/**
 * SeasonProvider - Context for managing seasonal mode (heating/cooling/both)
 * Automatically detects season based on thermostat mode, weather, and date
 */
import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

export type SeasonMode = "heating" | "cooling" | "both" | "auto";

export interface SeasonContextValue {
  seasonMode: SeasonMode;
  setSeasonMode: (mode: SeasonMode) => void;
  isHeatingView: boolean;
  isCoolingView: boolean;
  isBothView: boolean;
  // Derived from current mode
  activeModes: ("heating" | "cooling")[];
  // Auto-detection helpers
  autoDetectedMode: "heating" | "cooling" | "both";
}

const SeasonContext = createContext<SeasonContextValue | null>(null);

interface SeasonProviderProps {
  children: React.ReactNode;
  // Optional props for auto-detection
  thermostatMode?: "heat" | "cool" | "auto" | "off";
  outdoorTemp?: number; // Current outdoor temperature
  dateRange?: { start: Date; end: Date };
  defaultMode?: SeasonMode;
}

export const SeasonProvider: React.FC<SeasonProviderProps> = ({
  children,
  thermostatMode = "auto",
  outdoorTemp,
  dateRange,
  defaultMode = "auto",
}) => {
  const [seasonMode, setSeasonModeState] = useState<SeasonMode>(defaultMode);

  // Auto-detect season based on thermostat mode, temperature, and date
  const autoDetectedMode = useMemo<"heating" | "cooling" | "both">(() => {
    // If thermostat is explicitly in heat/cool mode, use that
    if (thermostatMode === "heat") return "heating";
    if (thermostatMode === "cool") return "cooling";

    // If we have outdoor temp, use temperature-based detection
    if (outdoorTemp !== undefined) {
      if (outdoorTemp < 55) return "heating";
      if (outdoorTemp > 65) return "cooling";
      return "both"; // Swing season
    }

    // Fallback to month-based detection
    const currentMonth = new Date().getMonth() + 1;
    if (currentMonth >= 11 || currentMonth <= 3) return "heating"; // Nov-Mar
    if (currentMonth >= 6 && currentMonth <= 9) return "cooling"; // Jun-Sep
    return "both"; // Apr, May, Oct
  }, [thermostatMode, outdoorTemp]);

  // Resolve actual active mode
  const resolvedMode = seasonMode === "auto" ? autoDetectedMode : seasonMode;

  // Determine which views are active
  const activeModes = useMemo<("heating" | "cooling")[]>(() => {
    if (resolvedMode === "heating") return ["heating"];
    if (resolvedMode === "cooling") return ["cooling"];
    if (resolvedMode === "both") return ["heating", "cooling"];
    return [];
  }, [resolvedMode]);

  const isHeatingView = activeModes.includes("heating");
  const isCoolingView = activeModes.includes("cooling");
  const isBothView = activeModes.length === 2;

  const setSeasonMode = (mode: SeasonMode) => {
    setSeasonModeState(mode);
    // Store user preference (optional - persist to localStorage)
    if (typeof window !== "undefined") {
      localStorage.setItem("seasonModePreference", mode);
    }
  };

  // Load saved preference on mount
  useEffect(() => {
    if (typeof window !== "undefined" && defaultMode === "auto") {
      const saved = localStorage.getItem("seasonModePreference");
      if (saved && ["heating", "cooling", "both", "auto"].includes(saved)) {
        setSeasonModeState(saved as SeasonMode);
      }
    }
  }, [defaultMode]);

  const value: SeasonContextValue = {
    seasonMode,
    setSeasonMode,
    isHeatingView,
    isCoolingView,
    isBothView,
    activeModes,
    autoDetectedMode,
  };

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
};

export const useSeason = (): SeasonContextValue => {
  const context = useContext(SeasonContext);
  if (!context) {
    throw new Error("useSeason must be used within a SeasonProvider");
  }
  return context;
};

