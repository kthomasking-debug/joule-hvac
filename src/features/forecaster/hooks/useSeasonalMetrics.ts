/**
 * useSeasonalMetrics - Hook for calculating season-aware metrics
 * Returns different metrics based on whether we're in heating or cooling mode
 */
import { useMemo } from "react";
import { useSeason } from "../components/SeasonProvider";

export interface WeeklyMetrics {
  totalCost: number;
  totalEnergy: number; // kWh or therms
  totalCostWithAux?: number; // For heating with aux heat
  summary: DailyMetrics[];
}

export interface DailyMetrics {
  date: string;
  tempRange: string;
  humidityRange?: string; // For cooling
  indoorTarget: number;
  runtime: number; // hours
  energy: number; // kWh
  cost: number;
  auxEnergy?: number; // For heating
  auxCost?: number; // For heating
  // Cooling-specific
  coolingLoad?: number; // BTU
  latentLoad?: number; // BTU (humidity removal)
  sensibleLoad?: number; // BTU (temperature reduction)
  cop?: number; // Cooling COP/EER
  // Heating-specific
  heatingLoad?: number; // BTU
  cop?: number; // Heating COP/HSPF
  auxRuntime?: number; // hours
}

export interface SeasonalMetrics {
  weeklyMetrics: WeeklyMetrics | null;
  peakLoadDay: DailyMetrics | null;
  comfortRiskDays: DailyMetrics[];
  recommendations: string[];
}

export const useSeasonalMetrics = (
  rawWeeklyMetrics: any, // Replace with proper type
  forecastData: any // Replace with proper type
): SeasonalMetrics => {
  const { isHeatingView, isCoolingView, activeModes } = useSeason();

  const weeklyMetrics = useMemo<WeeklyMetrics | null>(() => {
    if (!rawWeeklyMetrics) return null;

    // Transform raw metrics based on active season mode
    if (isHeatingView && !isCoolingView) {
      // Heating-only metrics
      return {
        totalCost: rawWeeklyMetrics.totalCost || 0,
        totalEnergy: rawWeeklyMetrics.totalEnergy || 0,
        totalCostWithAux: rawWeeklyMetrics.totalCostWithAux,
        summary: rawWeeklyMetrics.summary?.map((day: any) => ({
          date: day.date,
          tempRange: day.tempRange,
          indoorTarget: day.indoorTemp || 70,
          runtime: day.runtime || 0,
          energy: day.energy || 0,
          cost: day.cost || 0,
          auxEnergy: day.auxEnergy,
          auxCost: day.auxCost,
          heatingLoad: day.heatingLoad,
          cop: day.cop,
          auxRuntime: day.auxRuntime,
        })) || [],
      };
    }

    if (isCoolingView && !isHeatingView) {
      // Cooling-only metrics
      return {
        totalCost: rawWeeklyMetrics.coolingCost || 0,
        totalEnergy: rawWeeklyMetrics.coolingEnergy || 0,
        summary: rawWeeklyMetrics.coolingSummary?.map((day: any) => ({
          date: day.date,
          tempRange: day.tempRange,
          humidityRange: day.humidityRange,
          indoorTarget: day.indoorTemp || 75,
          runtime: day.runtime || 0,
          energy: day.energy || 0,
          cost: day.cost || 0,
          coolingLoad: day.coolingLoad,
          latentLoad: day.latentLoad,
          sensibleLoad: day.sensibleLoad,
          cop: day.cop,
        })) || [],
      };
    }

    // Both modes - combine metrics
    return {
      totalCost: (rawWeeklyMetrics.totalCost || 0) + (rawWeeklyMetrics.coolingCost || 0),
      totalEnergy: (rawWeeklyMetrics.totalEnergy || 0) + (rawWeeklyMetrics.coolingEnergy || 0),
      summary: [], // Combine both summaries
    };
  }, [rawWeeklyMetrics, isHeatingView, isCoolingView]);

  const peakLoadDay = useMemo<DailyMetrics | null>(() => {
    if (!weeklyMetrics?.summary.length) return null;

    if (isCoolingView && !isHeatingView) {
      // Find day with highest cooling load
      return weeklyMetrics.summary.reduce((max, day) =>
        (day.coolingLoad || 0) > (max.coolingLoad || 0) ? day : max
      );
    }

    if (isHeatingView && !isCoolingView) {
      // Find day with highest heating load
      return weeklyMetrics.summary.reduce((max, day) =>
        (day.heatingLoad || 0) > (max.heatingLoad || 0) ? day : max
      );
    }

    return null;
  }, [weeklyMetrics, isHeatingView, isCoolingView]);

  const comfortRiskDays = useMemo<DailyMetrics[]>(() => {
    if (!weeklyMetrics?.summary.length) return [];

    return weeklyMetrics.summary.filter((day) => {
      if (isCoolingView) {
        // High humidity or excessive runtime
        return (day.humidityRange && parseFloat(day.humidityRange.split("-")[1]) > 60) || day.runtime > 12;
      }
      if (isHeatingView) {
        // Excessive aux heat usage or runtime
        return (day.auxRuntime && day.auxRuntime > 4) || day.runtime > 14;
      }
      return false;
    });
  }, [weeklyMetrics, isHeatingView, isCoolingView]);

  const recommendations = useMemo<string[]>(() => {
    const recs: string[] = [];

    if (isCoolingView) {
      if (comfortRiskDays.length > 0) {
        recs.push("High humidity days detected - consider lowering setpoint by 1-2°F");
      }
      if (peakLoadDay && (peakLoadDay.coolingLoad || 0) > 30000) {
        recs.push("Peak cooling load exceeds design capacity - pre-cooling recommended");
      }
    }

    if (isHeatingView) {
      if (comfortRiskDays.some((d) => d.auxRuntime && d.auxRuntime > 2)) {
        recs.push("Auxiliary heat usage detected - raise setpoint to reduce aux runtime");
      }
    }

    return recs;
  }, [isHeatingView, isCoolingView, comfortRiskDays, peakLoadDay]);

  return {
    weeklyMetrics,
    peakLoadDay,
    comfortRiskDays,
    recommendations,
  };
};

