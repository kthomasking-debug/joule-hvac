/**
 * Ecobee Wiring Diagram Generator
 * Generates ASCII wiring diagrams for various Ecobee thermostat configurations
 */

/**
 * Generate ASCII wiring diagram for Ecobee thermostat
 * @param {Object} config - Wiring configuration
 * @param {boolean} config.hasHeat - Has heating
 * @param {boolean} config.hasCool - Has cooling
 * @param {boolean} config.hasFan - Has fan control
 * @param {boolean} config.hasAuxHeat - Has auxiliary/emergency heat
 * @param {boolean} config.hasHeatPump - Is heat pump system
 * @param {string} config.reversingValve - 'O' or 'B' for heat pump reversing valve
 * @param {boolean} config.hasHumidifier - Has humidifier
 * @param {boolean} config.hasDehumidifier - Has dehumidifier
 * @returns {string} ASCII wiring diagram
 */
export function generateEcobeeWiringDiagram(config = {}) {
  const {
    hasHeat = true,
    hasCool = true,
    hasFan = true,
    hasAuxHeat = false,
    hasHeatPump = false,
    reversingValve = 'O',
    hasHumidifier = false,
    hasDehumidifier = false,
  } = config;

  // Determine system type
  const systemType = hasHeatPump ? 'heatPump' : (hasHeat && hasCool ? 'heatCool' : hasHeat ? 'heatOnly' : 'coolOnly');

  let diagram = '';

  // Header
  diagram += '╔═══════════════════════════════════════════════════════════════╗\n';
  diagram += '║              ECOBEE THERMOSTAT WIRING DIAGRAM                  ║\n';
  diagram += '╚═══════════════════════════════════════════════════════════════╝\n\n';

  // System type
  const typeLabels = {
    heatPump: 'Heat Pump System',
    heatCool: 'Conventional Heat/Cool System',
    heatOnly: 'Heat Only System',
    coolOnly: 'Cool Only System',
  };
  diagram += `System Type: ${typeLabels[systemType]}\n`;
  if (hasAuxHeat) diagram += 'With Auxiliary/Emergency Heat\n';
  if (hasHumidifier) diagram += 'With Humidifier\n';
  if (hasDehumidifier) diagram += 'With Dehumidifier\n';
  diagram += '\n';

  // Thermostat terminal block
  diagram += '┌─────────────────────────────────────────────────────────────┐\n';
  diagram += '│                    ECOBEE TERMINAL BLOCK                     │\n';
  diagram += '├─────┬───────────────────────────────────────────────────────┤\n';

  const terminals = [];

  // Common terminals
  terminals.push({ term: 'R', desc: '24VAC Power (Red)', connected: true });
  terminals.push({ term: 'C', desc: '24VAC Common (Blue/Black)', connected: true });
  terminals.push({ term: 'G', desc: 'Fan Control (Green)', connected: hasFan });

  if (hasHeatPump) {
    // Heat pump terminals
    terminals.push({ term: 'Y1', desc: 'Compressor Stage 1 (Yellow)', connected: hasCool || hasHeat });
    terminals.push({ term: 'Y2', desc: 'Compressor Stage 2 (Yellow/White)', connected: false }); // Optional
    terminals.push({ term: reversingValve, desc: `Reversing Valve (Orange/Brown) - Energized on ${reversingValve === 'O' ? 'Cool' : 'Heat'}`, connected: true });
    if (hasAuxHeat) {
      terminals.push({ term: 'W1', desc: 'Auxiliary Heat Stage 1 (White)', connected: true });
      terminals.push({ term: 'W2', desc: 'Auxiliary Heat Stage 2 (White/Black)', connected: false }); // Optional
    }
  } else {
    // Conventional system terminals
    if (hasCool) {
      terminals.push({ term: 'Y', desc: 'Cooling (Yellow)', connected: true });
      terminals.push({ term: 'Y2', desc: 'Cooling Stage 2 (Yellow/White)', connected: false }); // Optional
    }
    if (hasHeat) {
      terminals.push({ term: 'W', desc: 'Heating (White)', connected: true });
      terminals.push({ term: 'W2', desc: 'Heating Stage 2 (White/Black)', connected: false }); // Optional
    }
  }

  // Accessory terminals
  if (hasHumidifier) {
    terminals.push({ term: 'ACC+', desc: 'Accessory Power (Orange)', connected: true });
    terminals.push({ term: 'ACC-', desc: 'Accessory Common (Brown)', connected: true });
  }
  if (hasDehumidifier) {
    terminals.push({ term: 'DEHUM', desc: 'Dehumidifier (if separate terminal)', connected: true });
  }

  // Display terminals
  terminals.forEach(({ term, desc, connected }) => {
    const status = connected ? '●' : '○';
    diagram += `│ ${status} │ ${term.padEnd(4)} │ ${desc.padEnd(55)} │\n`;
  });

  diagram += '└─────┴─────┴───────────────────────────────────────────────────┘\n\n';

  // Equipment connections
  diagram += '┌─────────────────────────────────────────────────────────────┐\n';
  diagram += '│                    EQUIPMENT CONNECTIONS                    │\n';
  diagram += '└─────────────────────────────────────────────────────────────┘\n\n';

  if (hasHeatPump) {
    diagram += 'Heat Pump Outdoor Unit:\n';
    diagram += '  R ────► 24VAC Power\n';
    diagram += '  C ────► 24VAC Common\n';
    diagram += `  ${reversingValve} ────► Reversing Valve (${reversingValve === 'O' ? 'O' : 'B'} terminal)\n`;
    diagram += '  Y1 ────► Compressor Contactor\n';
    if (hasAuxHeat) {
      diagram += '\nAuxiliary Heat (Indoor):\n';
      diagram += '  R ────► 24VAC Power\n';
      diagram += '  C ────► 24VAC Common\n';
      diagram += '  W1 ────► Aux Heat Relay/Contactor\n';
    }
  } else {
    if (hasCool) {
      diagram += 'Air Conditioner:\n';
      diagram += '  R ────► 24VAC Power\n';
      diagram += '  C ────► 24VAC Common\n';
      diagram += '  Y ────► Compressor Contactor\n';
      diagram += '  G ────► Fan Relay (if separate)\n';
    }
    if (hasHeat) {
      diagram += '\nFurnace/Heater:\n';
      diagram += '  R ────► 24VAC Power\n';
      diagram += '  C ────► 24VAC Common\n';
      diagram += '  W ────► Heat Relay/Valve\n';
      diagram += '  G ────► Fan Relay\n';
    }
  }

  if (hasFan) {
    diagram += '\nFan Control:\n';
    diagram += '  G ────► Fan Relay (enables fan independently)\n';
  }

  if (hasHumidifier) {
    diagram += '\nHumidifier:\n';
    diagram += '  ACC+ ────► Humidifier Power\n';
    diagram += '  ACC- ────► Humidifier Common\n';
  }

  if (hasDehumidifier) {
    diagram += '\nDehumidifier:\n';
    diagram += '  DEHUM ────► Dehumidifier Control\n';
  }

  diagram += '\n';

  // Wiring notes
  diagram += '┌─────────────────────────────────────────────────────────────┐\n';
  diagram += '│                         WIRING NOTES                        │\n';
  diagram += '├─────────────────────────────────────────────────────────────┤\n';
  diagram += '│ • Turn OFF power at breaker before wiring                  │\n';
  diagram += '│ • Use 18-22 AWG thermostat wire                             │\n';
  diagram += '│ • R (Red) is 24VAC power - typically from transformer       │\n';
  diagram += '│ • C (Common) completes the 24VAC circuit                    │\n';
  diagram += '│ • G (Green) controls fan independently of heating/cooling   │\n';
  if (hasHeatPump) {
    diagram += `│ • ${reversingValve} (${reversingValve === 'O' ? 'Orange' : 'Brown'}) controls reversing valve direction │\n`;
    diagram += '│ • Most heat pumps use O (energized on cool)                │\n';
    diagram += '│ • Some brands (Rheem, Ruud) use B (energized on heat)      │\n';
  }
  if (hasAuxHeat) {
    diagram += '│ • W1 activates auxiliary heat when heat pump can\'t keep up │\n';
    diagram += '│ • Aux heat typically engages below 35-40°F outdoor temp   │\n';
  }
  diagram += '│ • Verify wire colors match your equipment                   │\n';
  diagram += '│ • Take photo of old wiring before disconnecting             │\n';
  diagram += '└─────────────────────────────────────────────────────────────┘\n';

  return diagram;
}

/**
 * Get wiring diagram for common system configurations
 */
export function getCommonWiringDiagrams() {
  return {
    conventional: generateEcobeeWiringDiagram({
      hasHeat: true,
      hasCool: true,
      hasFan: true,
      hasAuxHeat: false,
      hasHeatPump: false,
    }),
    heatPump: generateEcobeeWiringDiagram({
      hasHeat: true,
      hasCool: true,
      hasFan: true,
      hasAuxHeat: true,
      hasHeatPump: true,
      reversingValve: 'O',
    }),
    heatPumpB: generateEcobeeWiringDiagram({
      hasHeat: true,
      hasCool: true,
      hasFan: true,
      hasAuxHeat: true,
      hasHeatPump: true,
      reversingValve: 'B',
    }),
    heatOnly: generateEcobeeWiringDiagram({
      hasHeat: true,
      hasCool: false,
      hasFan: true,
      hasAuxHeat: false,
      hasHeatPump: false,
    }),
    coolOnly: generateEcobeeWiringDiagram({
      hasHeat: false,
      hasCool: true,
      hasFan: true,
      hasAuxHeat: false,
      hasHeatPump: false,
    }),
    withHumidifier: generateEcobeeWiringDiagram({
      hasHeat: true,
      hasCool: true,
      hasFan: true,
      hasAuxHeat: false,
      hasHeatPump: false,
      hasHumidifier: true,
    }),
  };
}

/**
 * Detect system type from query and return appropriate diagram
 */
export function getWiringDiagramForQuery(query) {
  const q = query.toLowerCase();
  
  // Detect system type
  let config = {
    hasHeat: true,
    hasCool: true,
    hasFan: true,
    hasAuxHeat: false,
    hasHeatPump: false,
    reversingValve: 'O',
  };

  if (q.includes('heat pump') || q.includes('heatpump')) {
    config.hasHeatPump = true;
    if (q.includes('aux') || q.includes('emergency') || q.includes('backup')) {
      config.hasAuxHeat = true;
    }
    if (q.includes('b wire') || q.includes('b terminal') || q.includes('rheem') || q.includes('ruud')) {
      config.reversingValve = 'B';
    }
  } else if (q.includes('heat only') || q.includes('heating only')) {
    config.hasCool = false;
  } else if (q.includes('cool only') || q.includes('cooling only') || q.includes('ac only')) {
    config.hasHeat = false;
  }

  if (q.includes('humidifier') || q.includes('humidify')) {
    config.hasHumidifier = true;
  }
  if (q.includes('dehumidifier') || q.includes('dehumidify')) {
    config.hasDehumidifier = true;
  }

  return generateEcobeeWiringDiagram(config);
}


