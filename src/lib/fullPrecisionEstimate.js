import {
  computeHourlyPerformance,
  computeHourlyCoolingPerformance,
  calculateHeatLoss,
  KW_PER_TON_OUTPUT,
  BTU_PER_KWH,
} from "./heatUtils";
import { computeHourlyCost } from "./costUtils";

// Days in month for a non-leap year
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function make24HourProfile(low, high) {
  const hours = [];
  const amplitude = (high - low) / 2;
  const mid = (high + low) / 2;
  for (let h = 0; h < 24; h++) {
    const phase = ((h - 16) / 24) * Math.PI * 2;
    const t = mid + amplitude * Math.sin(phase);
    hours.push({
      hour: h,
      temp: Math.round(t * 10) / 10,
      humidity: 50,
      time: new Date(2025, 0, 1, h),
    });
  }
  return hours;
}

function runDayScenario(profileHours, indoorStrategyFn, settings) {
  let totalEnergy = 0;
  let totalCost = 0;
  let totalAux = 0;
  for (const hour of profileHours) {
    const indoorTemp =
      typeof indoorStrategyFn === "function"
        ? indoorStrategyFn(hour.hour)
        : indoorStrategyFn;
    if (indoorTemp > hour.temp) {
      const perf = computeHourlyPerformance(
        {
          tons: settings.tons,
          indoorTemp,
          designHeatLossBtuHrAt70F: calculateHeatLoss(settings),
          compressorPower: settings.compressorPower,
        },
        hour.temp,
        hour.humidity
      );
      // perf.hpKwh is already energy (kWh) for the timestep, scaled by dtHours
      const kwh = perf.hpKwh || 0;
      totalEnergy += kwh;
      const aux = settings.useElectricAuxHeat ? perf.auxKwh || 0 : 0;
      totalAux += aux;
      totalCost += computeHourlyCost(kwh, hour.time, [], settings.utilityCost);
      if (settings.useElectricAuxHeat)
        totalCost += computeHourlyCost(
          aux,
          hour.time,
          [],
          settings.utilityCost
        );
    } else {
      const perfCool = computeHourlyCoolingPerformance(
        {
          tons: settings.tons,
          indoorTemp,
          designHeatLossBtuHrAt70F: calculateHeatLoss(settings),
          seer2: settings.seer2,
          solarExposure: settings.solarExposure || 1.0,
        },
        hour.temp,
        hour.humidity
      );
      // perfCool.electricalKw is power (kW), multiply by runtime to get energy (kWh)
      // For cooling, electricalKw represents average power over the hour when running
      // Note: cooling performance returns electricalKw as power, runtime as percentage
      const kwh = perfCool.electricalKw !== undefined && perfCool.runtime !== undefined
        ? perfCool.electricalKw * (perfCool.runtime / 100)
        : 0;
      totalEnergy += kwh;
      totalCost += computeHourlyCost(kwh, hour.time, [], settings.utilityCost);
    }
  }
  return { totalEnergy, totalCost, totalAux };
}

/**
 * Compute a full-precision annual estimate using per-month representative days.
 * The function is intentionally configurable via climateProfile to be testable.
 *
 * @param {Object} settings - user settings (tons, compressorPower, utilityCost, seer2, hspf2, etc.)
 * @param {Object} options - { monthlyProfile: [{ low, high }, ...], winterThermostat, summerThermostat }
 * @returns {Promise<Object>} estimate { totalCost, heatingCost, coolingCost, totalEnergy, totalAux }
 */
export async function computeAnnualPrecisionEstimate(
  settings = {},
  options = {}
) {
  const monthlyProfile =
    options.monthlyProfile ||
    [8, 10, 20, 30, 40, 55, 60, 58, 52, 42, 25, 10].map((high) => {
      // crude heuristic: high and low with ~14 deg swing
      const low = high - 14;
      return { low, high };
    });

  const winterThermostat =
    typeof options.winterThermostat === "number"
      ? options.winterThermostat
      : settings.winterThermostat || 70;
  const summerThermostat =
    typeof options.summerThermostat === "number"
      ? options.summerThermostat
      : settings.summerThermostat || 74;

  let annualEnergy = 0;
  let annualCost = 0;
  let annualAux = 0;
  let heatingCost = 0;
  let coolingCost = 0;

  // Indoor strategy: assume constant indoor target during heating season is winterThermostat, during cooling season summerThermostat
  const indoorFn = (monthIndex) => () => {
    // Determine if month is mainly cooling or heating by comparing high to 70F
    const m = monthlyProfile[monthIndex];
    const isCooling = m.high >= 72;
    return isCooling ? summerThermostat : winterThermostat;
  };

  for (let month = 0; month < 12; month++) {
    const days = DAYS_IN_MONTH[month];
    const m = monthlyProfile[month] || { low: 30, high: 50 };
    const representativeDay = make24HourProfile(m.low, m.high);
    const indoorStrategy = indoorFn(month);
    // Compute a single day and multiply by days in month (representative day approach)
    const dayRes = runDayScenario(representativeDay, indoorStrategy, settings);
    // Multiply by days for monthly sum
    annualEnergy += dayRes.totalEnergy * days;
    annualCost += dayRes.totalCost * days;
    annualAux += dayRes.totalAux * days;
    // Partition heating vs cooling: approximate by checking if indoor > outdoor for the rep day hours
    const dayHeatingCost = representativeDay.reduce((acc, h) => {
      const indoor = indoorStrategy(h.hour);
      return indoor > h.temp
        ? acc +
            computeHourlyCost(
              computeHourlyPerformance(
                {
                  tons: settings.tons,
                  indoorTemp: indoor,
                  designHeatLossBtuHrAt70F: calculateHeatLoss(settings),
                  compressorPower: settings.compressorPower,
                },
                h.temp,
                h.humidity
              ).electricalKw *
                (() => {
                  const perf = computeHourlyPerformance(
                    {
                      tons: settings.tons,
                      indoorTemp: indoor,
                      designHeatLossBtuHrAt70F: calculateHeatLoss(settings),
                      compressorPower: settings.compressorPower,
                    },
                    h.temp,
                    h.humidity
                  );
                  return (perf.capacityUtilization || perf.runtime || 0) / 100; // Using capacityUtilization, not time-based runtime
                })(),
              h.time,
              [],
              settings.utilityCost
            )
        : acc;
    }, 0);
    // Cooling cost similarly
    const dayCoolingCost = representativeDay.reduce((acc, h) => {
      const indoor = indoorStrategy(h.hour);
      return indoor <= h.temp
        ? acc +
            computeHourlyCost(
              computeHourlyCoolingPerformance(
                {
                  tons: settings.tons,
                  indoorTemp: indoor,
                  designHeatLossBtuHrAt70F: calculateHeatLoss(settings),
                  seer2: settings.seer2,
                  solarExposure: settings.solarExposure || 1.0,
                },
                h.temp,
                h.humidity
              ).electricalKw *
                (() => {
                  const perf = computeHourlyCoolingPerformance(
                    {
                      tons: settings.tons,
                      indoorTemp: indoor,
                      designHeatLossBtuHrAt70F: calculateHeatLoss(settings),
                      seer2: settings.seer2,
                      solarExposure: settings.solarExposure || 1.0,
                    },
                    h.temp,
                    h.humidity
                  );
                  return (perf.capacityUtilization || perf.runtime || 0) / 100; // Using capacityUtilization, not time-based runtime
                })(),
              h.time,
              [],
              settings.utilityCost
            )
        : acc;
    }, 0);

    heatingCost += dayHeatingCost * days;
    coolingCost += dayCoolingCost * days;
  }

  return {
    totalEnergy: annualEnergy,
    totalCost: annualCost,
    totalAux: annualAux,
    heatingCost,
    coolingCost,
  };
}

export default computeAnnualPrecisionEstimate;
