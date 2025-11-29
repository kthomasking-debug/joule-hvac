// src/lib/heatUtils.js

// --- Constants ---
export const KW_PER_TON_OUTPUT = 3.517;
export const BTU_PER_KWH = 3412.14;
const DRY_LAPSE_RATE_F_PER_1000FT = 5.4;
const SATURATED_LAPSE_RATE_F_PER_1000FT = 2.7;

// --- Core Calculation Functions ---

/**
 * Calculates the building's estimated heat loss in BTU/hr at a 70°F delta-T.
 */
export function calculateHeatLoss({
  squareFeet,
  insulationLevel,
  homeShape,
  ceilingHeight,
}) {
  const baseBtuPerSqFt = 22.67;
  const sf = Number(squareFeet);
  const ins = Number(insulationLevel);
  const shape = Number(homeShape);
  const ceil = Number(ceilingHeight);
  if (
    !Number.isFinite(sf) ||
    !Number.isFinite(ins) ||
    !Number.isFinite(shape) ||
    !Number.isFinite(ceil)
  ) {
    console.warn("calculateHeatLoss received invalid inputs", {
      squareFeet,
      insulationLevel,
      homeShape,
      ceilingHeight,
    });
    return 0;
  }
  const ceilingMultiplier = 1 + (ceil - 8) * 0.1;
  const rawHeatLoss = sf * baseBtuPerSqFt * ins * shape * ceilingMultiplier;
  return Math.round(rawHeatLoss / 1000) * 1000;
}

export function getCapacityFactor(tempOut) {
  if (tempOut >= 47) return 1.0;
  if (tempOut < 17) return Math.max(0.3, 0.7 - (17 - tempOut) * 0.0074);
  return Math.max(0.3, 1.0 - (47 - tempOut) * 0.01);
}

let _invalidPerfLogged = false;
export function computeHourlyPerformance(
  { tons, indoorTemp, heatLossBtu, compressorPower },
  outdoorTemp,
  humidity
) {
  // Defensive numeric parsing to avoid NaNs
  let _tons = Number(tons);
  let _indoorTemp = Number(indoorTemp);
  let _heatLossBtu = Number(heatLossBtu);
  let _compressorPower = Number(compressorPower);
  let _outdoorTemp = Number(outdoorTemp);
  let _humidity = Number(humidity);

  if (
    !Number.isFinite(_tons) ||
    !Number.isFinite(_indoorTemp) ||
    !Number.isFinite(_heatLossBtu) ||
    !Number.isFinite(_compressorPower) ||
    !Number.isFinite(_outdoorTemp)
  ) {
    if (!_invalidPerfLogged) {
      console.warn(
        "computeHourlyPerformance received invalid inputs (logging once)",
        {
          tons: _tons,
          indoorTemp: _indoorTemp,
          heatLossBtu: _heatLossBtu,
          compressorPower: _compressorPower,
          outdoorTemp: _outdoorTemp,
          humidity: _humidity,
        }
      );
      _invalidPerfLogged = true;
    }
  }

  const btuLossPerDegreeF = _heatLossBtu > 0 ? _heatLossBtu / 70 : 0;
  const tempDiff = Math.max(1, _indoorTemp - _outdoorTemp);
  const buildingHeatLossBtu = btuLossPerDegreeF * tempDiff;

  const capacityFactor = getCapacityFactor(_outdoorTemp);
  const heatpumpOutputBtu =
    _tons * KW_PER_TON_OUTPUT * capacityFactor * BTU_PER_KWH;

  const powerFactor = 1 / Math.max(0.7, capacityFactor || 0.7);
  const baseElectricalKw = _compressorPower * powerFactor;
  let defrostPenalty = 1.0;
  if (outdoorTemp > 20 && outdoorTemp < 45) {
    defrostPenalty = 1 + 0.15 * (humidity / 100);
  }
  const electricalKw = baseElectricalKw * defrostPenalty;

  let runtimePercentage =
    heatpumpOutputBtu > 0
      ? (buildingHeatLossBtu / heatpumpOutputBtu) * 100
      : 100;
  const deficitBtu = Math.max(0, buildingHeatLossBtu - heatpumpOutputBtu);
  const auxKw = deficitBtu / BTU_PER_KWH;

  let actualIndoorTemp = indoorTemp;
  if (runtimePercentage >= 100) {
    runtimePercentage = 100;
    if (btuLossPerDegreeF > 0) {
      actualIndoorTemp = heatpumpOutputBtu / btuLossPerDegreeF + outdoorTemp;
    }
  }
  runtimePercentage = Math.max(0, runtimePercentage);

  // Ensure final values are finite numbers
  const _electricalKw = Number.isFinite(electricalKw) ? electricalKw : 0;
  const _runtime = Number.isFinite(runtimePercentage) ? runtimePercentage : 0;
  const _actualIndoorTemp = Number.isFinite(actualIndoorTemp)
    ? actualIndoorTemp
    : _indoorTemp;
  const _auxKw = Number.isFinite(auxKw) ? auxKw : 0;
  const _defrostPenalty = Number.isFinite(defrostPenalty)
    ? defrostPenalty
    : 1.0;
  return {
    electricalKw: _electricalKw,
    runtime: _runtime,
    actualIndoorTemp: _actualIndoorTemp,
    auxKw: _auxKw,
    defrostPenalty: _defrostPenalty,
  };
}

/**
 * Cooling-mode performance (simplified seasonal approximation).
 * Treats buildingLoadPerDegF = heatLossBtu/70 as a universal load factor.
 * Heat gain uses (outdoorTemp - indoorTemp) when outdoor hotter; applies a solar exposure multiplier.
 * electricalKw derived from removed BTU / (SEER2 * 1000). Runtime capped at 100%.
 */
export function computeHourlyCoolingPerformance(
  { tons, indoorTemp, heatLossBtu, seer2, solarExposure = 1.0 },
  outdoorTemp,
  humidity
) {
  // Defensive numeric parsing
  let _tons = Number(tons);
  let _indoorTemp = Number(indoorTemp);
  let _heatLossBtu = Number(heatLossBtu);
  let _seer2 = Number(seer2);
  let _solarExposure = Number(solarExposure);
  let _outdoorTemp = Number(outdoorTemp);
  let _humidity = Number(humidity);

  if (
    !Number.isFinite(_outdoorTemp) ||
    !Number.isFinite(_indoorTemp) ||
    !Number.isFinite(_heatLossBtu)
  ) {
    console.warn("computeHourlyCoolingPerformance received invalid inputs", {
      tons: _tons,
      indoorTemp: _indoorTemp,
      heatLossBtu: _heatLossBtu,
      seer2: _seer2,
      solarExposure: _solarExposure,
      outdoorTemp: _outdoorTemp,
      humidity: _humidity,
    });
  }

  const buildingLoadPerDegF = _heatLossBtu > 0 ? _heatLossBtu / 70 : 0;
  const tempDiff = Math.max(0, _outdoorTemp - _indoorTemp); // only positive when cooling needed
  // Base sensible heat gain (BTU/hr)
  let buildingHeatGainBtu = buildingLoadPerDegF * tempDiff * solarExposure;
  // Light latent adjustment with humidity (simple add-on)
  const latentFactor = 1 + (humidity / 100) * 0.05; // up to +5%
  buildingHeatGainBtu *= latentFactor;

  // Nominal cooling capacity (approx same tons * KW_PER_TON_OUTPUT)
  const nominalCapacityBtu = tons * KW_PER_TON_OUTPUT * BTU_PER_KWH; // (tons * kW/ton * BTU/kWh)

  // Assume mild derate above 95°F ( -1% per °F over 95 )
  let capacityDerate = 1.0;
  if (outdoorTemp > 95)
    capacityDerate = Math.max(0.75, 1 - (outdoorTemp - 95) * 0.01);
  const availableCapacityBtu = nominalCapacityBtu * capacityDerate;

  const deficitBtu = Math.max(0, buildingHeatGainBtu - availableCapacityBtu);
  let runtimePercentage =
    availableCapacityBtu > 0
      ? (buildingHeatGainBtu / availableCapacityBtu) * 100
      : 100;
  runtimePercentage = Math.min(100, Math.max(0, runtimePercentage));

  // Electrical use (BTU removed / EER). SEER2 approximates seasonal EER: kWh = BTU / (SEER2 * 1000)
  const electricalKw = buildingHeatGainBtu / Math.max(1, (_seer2 || 1) * 1000);

  // Actual indoor temp drift if undersized
  let actualIndoorTemp = indoorTemp;
  if (deficitBtu > 0 && buildingLoadPerDegF > 0) {
    // Temp rises until heat gain equals available capacity
    const equilibriumGain = availableCapacityBtu; // BTU/hr system can remove
    const requiredDiff = equilibriumGain / buildingLoadPerDegF;
    actualIndoorTemp = outdoorTemp - requiredDiff; // indoor temp higher than setpoint
  }

  return {
    electricalKw: Number.isFinite(electricalKw) ? electricalKw : 0,
    runtime: Number.isFinite(runtimePercentage) ? runtimePercentage : 0,
    actualIndoorTemp: Number.isFinite(actualIndoorTemp)
      ? actualIndoorTemp
      : _indoorTemp,
    auxKw: 0, // no auxiliary for cooling (deficit indicates unmet load)
    deficitBtu: Number.isFinite(deficitBtu) ? deficitBtu : 0,
    capacityDerate,
  };
}

export function adjustForecastForElevation(
  forecast,
  homeElevation,
  locationElevation
) {
  const elevationDifference = homeElevation - locationElevation;
  if (Math.abs(elevationDifference) < 10) return forecast;

  return forecast.map((hour) => {
    const humidityRatio = hour.humidity / 100;
    const lapseRate =
      SATURATED_LAPSE_RATE_F_PER_1000FT +
      (DRY_LAPSE_RATE_F_PER_1000FT - SATURATED_LAPSE_RATE_F_PER_1000FT) *
        (1 - humidityRatio);
    const tempAdjustment = (elevationDifference / 1000) * lapseRate;
    return { ...hour, temp: hour.temp - tempAdjustment };
  });
}

/**
 * Compute weekly/day summaries from an adjusted forecast array.
 * forecast: array of { time: Date, temp: number, humidity: number }
 * getPerformanceAtTemp: function(outdoorTemp, humidity) => { electricalKw, runtime, actualIndoorTemp, auxKw }
 * utilityCost: number ($/kWh)
 * indoorTemp: setpoint
 */
import { computeHourlyCost } from "./costUtils";

export function computeWeeklyMetrics(
  adjustedForecast,
  getPerformanceAtTemp,
  utilityCost,
  indoorTemp,
  useElectricAuxHeat = true,
  rateSchedule = []
) {
  if (!adjustedForecast) return null;
  const dailyData = {};
  adjustedForecast.forEach((hour) => {
    const day = hour.time.toLocaleDateString();
    if (!dailyData[day]) {
      dailyData[day] = {
        temps: [],
        humidities: [],
        totalEnergy: 0,
        totalCost: 0,
        actualIndoorTemps: [],
        achievedIndoorTemps: [],
        auxEnergy: 0,
      };
    }
    const perf = getPerformanceAtTemp(hour.temp, hour.humidity);
    const energyForHour = perf.electricalKw * (perf.runtime / 100);
    const auxEnergyForHour = perf.auxKw;

    dailyData[day].temps.push(hour.temp);
    dailyData[day].humidities.push(hour.humidity);
    dailyData[day].totalEnergy += energyForHour;
    // compute hourly cost using TOU schedule when provided
    const hourCost = computeHourlyCost(
      energyForHour,
      hour.time,
      rateSchedule,
      utilityCost
    );
    dailyData[day].totalCost += hourCost;
    dailyData[day].actualIndoorTemps.push(perf.actualIndoorTemp);
    dailyData[day].achievedIndoorTemps.push(
      perf.auxKw && perf.auxKw > 0 ? indoorTemp : perf.actualIndoorTemp
    );
    dailyData[day].auxEnergy += auxEnergyForHour;
    // aux energy cost (also charged at TOU rate) if we count aux towards electricity
    if (useElectricAuxHeat) {
      dailyData[day].totalCost += computeHourlyCost(
        auxEnergyForHour,
        hour.time,
        rateSchedule,
        utilityCost
      );
    }
  });

  const summary = Object.keys(dailyData).map((day) => {
    const dayData = dailyData[day];
    const totalEnergyWithAux =
      dayData.totalEnergy + (useElectricAuxHeat ? dayData.auxEnergy : 0);
    return {
      day: new Date(day).toLocaleDateString([], {
        weekday: "short",
        month: "numeric",
        day: "numeric",
      }),
      lowTemp: Math.min(...dayData.temps),
      highTemp: Math.max(...dayData.temps),
      avgHumidity:
        dayData.humidities.reduce((a, b) => a + b, 0) /
        dayData.humidities.length,
      energy: dayData.totalEnergy,
      cost: dayData.totalCost,
      minIndoorTemp: Math.min(...dayData.achievedIndoorTemps),
      minNoAuxIndoorTemp: Math.min(...dayData.actualIndoorTemps),
      auxEnergy: dayData.auxEnergy,
      costWithAux: dayData.totalCost,
      energyWithAux: totalEnergyWithAux,
    };
  });

  const totalEnergy = summary.reduce((acc, day) => acc + day.energy, 0);
  const totalCost = summary.reduce((acc, day) => acc + day.cost, 0);
  const totalCostWithAux = summary.reduce(
    (acc, day) => acc + day.costWithAux,
    0
  );

  return { summary, totalEnergy, totalCost, totalCostWithAux };
}
