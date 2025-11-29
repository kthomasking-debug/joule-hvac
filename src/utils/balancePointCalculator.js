// Balance point calculation utility for Ask Joule
// Calculates the outdoor temperature where heat pump output equals building heat loss

const CONSTANTS = {
  BTU_PER_KWH: 3412,
  KW_PER_TON_OUTPUT: 3.5,
  MIN_CAPACITY_FACTOR: 0.65,
};

export function calculateBalancePoint(userSettings) {
  const {
    squareFeet = 2000,
    ceilingHeight = 8,
    insulationLevel = 1.0, // multiplier: 0.65 = good, 1.0 = average, 1.4 = poor
    hspf2 = 9,
    tons = 3,
    targetIndoorTemp = 68,
    designOutdoorTemp = 20,
  } = userSettings;

  // Calculate building heat loss rate (BTU/hr per °F difference)
  const volume = squareFeet * ceilingHeight;
  const baseHeatLossPerDegF = volume * 0.018; // Base factor for heat loss
  const btuLossPerDegF = baseHeatLossPerDegF * insulationLevel;

  // Heat pump capacity derating with temperature
  // At 47°F, HP operates at rated capacity. Below that, capacity decreases
  const ratedCapacityBtu = tons * 12000; // Tons to BTU/hr at rated conditions

  // Generate temperature range data from 60°F down to design temp
  const data = [];
  for (let temp = 60; temp >= designOutdoorTemp; temp -= 1) {
    // Capacity derating: linear approximation
    // At 47°F = 100%, at 17°F ≈ 65%, at 5°F ≈ 50%
    const capacityFactor = Math.max(
      CONSTANTS.MIN_CAPACITY_FACTOR,
      1.0 - (47 - temp) * 0.012 // ~1.2% loss per degree below 47°F
    );
    const thermalOutputBtu = ratedCapacityBtu * capacityFactor;

    // Building heat loss at this outdoor temp
    const deltaT = targetIndoorTemp - temp;
    const buildingHeatLossBtu = btuLossPerDegF * deltaT;

    // COP calculation based on HSPF2
    const avgCOP = hspf2 / 3.4;
    const tempAdjustedCOP = avgCOP * (1 + (temp - 47) * 0.01);
    const cop = Math.max(1.5, tempAdjustedCOP);

    data.push({
      outdoorTemp: temp,
      thermalOutputBtu,
      buildingHeatLossBtu,
      cop,
      surplus: thermalOutputBtu - buildingHeatLossBtu,
    });
  }

  // Find balance point: where surplus goes from positive to negative
  let balancePoint = null;
  for (let i = 0; i < data.length - 1; i++) {
    const curr = data[i];
    const next = data[i + 1];
    if (curr.surplus >= 0 && next.surplus < 0) {
      // Linear interpolation
      const t = curr.surplus / (curr.surplus - next.surplus);
      balancePoint =
        curr.outdoorTemp + t * (next.outdoorTemp - curr.outdoorTemp);
      break;
    }
  }

  // Calculate aux heat need at design temp
  const designData = data.find((d) => d.outdoorTemp === designOutdoorTemp);
  const auxHeatNeeded = designData ? Math.max(0, -designData.surplus) : 0;

  return {
    balancePoint: balancePoint ? Math.round(balancePoint * 10) / 10 : null,
    auxHeatAtDesign: Math.round(auxHeatNeeded),
    copAtDesign: designData ? Math.round(designData.cop * 100) / 100 : null,
    heatLossFactor: Math.round(btuLossPerDegF),
    interpretation: getBalancePointInterpretation(balancePoint),
  };
}

function getBalancePointInterpretation(balancePoint) {
  if (!balancePoint) return "Unable to calculate - check your system settings";

  if (balancePoint <= 25) {
    return "Lower balance point — heat pump is well-sized for your home. Minimal aux heat needed.";
  } else if (balancePoint <= 35) {
    return "Moderate balance point — aux heat will help on colder days. System is reasonably sized.";
  } else {
    return "Higher balance point — aux heat will engage more often in winter. Consider upgrading to larger/more efficient unit.";
  }
}

export function formatBalancePointResponse(result, userSettings) {
  if (!result.balancePoint) {
    return "I need your system details to calculate the balance point. Please set your square footage, HSPF rating, and system capacity in Settings first.";
  }

  const { balancePoint, auxHeatAtDesign, copAtDesign, heatLossFactor } = result;
  const { designOutdoorTemp = 20 } = userSettings;

  return `Your system's balance point is **${balancePoint}°F** — the outdoor temperature where your heat pump's output equals your home's heat loss.

**Key metrics:**
• Balance point: ${balancePoint}°F
• Heat loss rate: ${heatLossFactor.toLocaleString()} BTU/hr per °F
• COP at ${designOutdoorTemp}°F design: ${copAtDesign}
• Aux heat needed at ${designOutdoorTemp}°F: ${auxHeatAtDesign.toLocaleString()} BTU/hr

**What this means:**
${result.interpretation}

Below ${balancePoint}°F, your heat pump alone can't keep up, and auxiliary heat (electric strips or gas furnace backup) will engage to maintain comfort.`;
}
