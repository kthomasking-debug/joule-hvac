import React, { useState } from "react";
import { Wrench, HelpCircle, AlertCircle, CheckCircle2, Copy, Download, Search, Loader, Database } from "lucide-react";
import { queryHVACKnowledge } from "../utils/rag/ragQuery";

/**
 * HVAC Troubleshooting Knowledge Base
 * Common problems and solutions
 */
const HVAC_TROUBLESHOOTING_KB = {
  inducerMotor: {
    keywords: ["inducer", "inducer motor", "draft motor", "combustion motor"],
    problem: "Inducer motor runs continuously or never shuts off",
    commonCauses: [
      "Pressure switch stuck closed or failed",
      "Control board relay stuck closed",
      "Faulty pressure switch hose (clogged, kinked, or disconnected)",
      "Control board failure",
      "Wiring short or loose connection",
      "Condensate trap blocked (causing pressure switch to stay closed)",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Pressure Switch",
        details: [
          "Locate the pressure switch (usually near the inducer motor)",
          "Disconnect the hose from the pressure switch",
          "Blow through the hose to ensure it's clear",
          "Check the switch itself - it should click when you blow/suck on it",
          "Test with multimeter: should be open when inducer is off, closed when running",
        ],
      },
      {
        step: 2,
        title: "Check Pressure Switch Hoses",
        details: [
          "Inspect all hoses for cracks, kinks, or disconnections",
          "Check where hoses connect to pressure switch and inducer housing",
          "Ensure hoses are not blocked by condensate or debris",
          "Replace any damaged hoses",
        ],
      },
      {
        step: 3,
        title: "Check Condensate Drain",
        details: [
          "Verify condensate drain is clear and flowing",
          "Blocked drain can cause pressure switch to stay closed",
          "Check condensate trap - should be clear of debris",
          "Test by pouring water through the drain",
        ],
      },
      {
        step: 4,
        title: "Check Control Board",
        details: [
          "Inspect control board for signs of damage (burn marks, corrosion)",
          "Check relay that controls inducer motor",
          "Test if relay is stuck closed (should open when heat cycle ends)",
          "May need to replace control board if relay is faulty",
        ],
      },
      {
        step: 5,
        title: "Check Wiring",
        details: [
          "Inspect wiring connections to inducer motor",
          "Check for loose, corroded, or shorted wires",
          "Verify control board connections are secure",
          "Test continuity of wires",
        ],
      },
    ],
    errorCodes: {
      "Lennox G51MP": {
        "Red LED off, Green flashing slow": "Pressure switch stuck or failed - inducer can't verify draft",
        "Red LED on, Green off": "Lockout - too many failed ignition attempts",
      },
    },
    safety: [
      "⚠️ Turn off power at breaker before working on furnace",
      "⚠️ Allow furnace to cool completely before inspection",
      "⚠️ Gas furnaces can be dangerous - if unsure, call a professional",
    ],
  },
  shortCycling: {
    keywords: ["short cycling", "short cycle", "cycles too often", "rapid cycling"],
    problem: "Furnace or AC turns on and off too frequently",
    commonCauses: [
      "Dirty air filter (most common)",
      "Oversized equipment",
      "Faulty thermostat",
      "Dirty flame sensor (furnace)",
      "Dirty evaporator coil (AC)",
      "Low refrigerant charge (AC)",
      "Faulty limit switch",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Air Filter",
        details: [
          "Replace or clean air filter",
          "Dirty filter restricts airflow, causing overheating",
          "Check filter monthly, replace every 1-3 months",
        ],
      },
      {
        step: 2,
        title: "Check Thermostat",
        details: [
          "Verify thermostat is level and secure",
          "Check if thermostat is in direct sunlight or near heat sources",
          "Test by setting temp 5°F higher/lower - see if cycling stops",
          "Replace batteries if battery-powered",
        ],
      },
      {
        step: 3,
        title: "Check Flame Sensor (Furnace)",
        details: [
          "Locate flame sensor (thin rod near burners)",
          "Clean with fine steel wool or emery cloth",
          "Reinstall and test",
        ],
      },
      {
        step: 4,
        title: "Check Evaporator Coil (AC)",
        details: [
          "Inspect evaporator coil for dirt/ice",
          "Clean if dirty",
          "If iced over, check for low refrigerant or airflow issues",
        ],
      },
    ],
  },
  noHeat: {
    keywords: ["no heat", "furnace not heating", "heat not working", "furnace won't heat"],
    problem: "Furnace not producing heat",
    commonCauses: [
      "Thermostat not calling for heat",
      "Dirty air filter",
      "Pilot light out (older furnaces)",
      "Faulty ignitor",
      "Gas valve closed or faulty",
      "Flame sensor dirty",
      "Limit switch tripped",
      "Blower motor not running",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Thermostat",
        details: [
          "Verify thermostat is set to HEAT mode",
          "Set temperature above current room temperature",
          "Check if thermostat is working (try turning fan to ON manually)",
        ],
      },
      {
        step: 2,
        title: "Check Air Filter",
        details: [
          "Replace dirty filter",
          "Dirty filter can cause limit switch to trip",
        ],
      },
      {
        step: 3,
        title: "Check Limit Switch",
        details: [
          "Locate limit switch (usually on heat exchanger)",
          "Check if switch has tripped (may have reset button)",
          "If tripped, check for airflow issues",
        ],
      },
      {
        step: 4,
        title: "Check Ignitor",
        details: [
          "Watch for ignitor glow when furnace starts",
          "If no glow, ignitor may be faulty",
          "Test with multimeter (should have continuity)",
        ],
      },
    ],
  },
  noCool: {
    keywords: ["no cool", "ac not cooling", "cooling not working", "ac won't cool"],
    problem: "Air conditioner not producing cool air",
    commonCauses: [
      "Dirty air filter",
      "Dirty condenser coil",
      "Low refrigerant charge",
      "Frozen evaporator coil",
      "Faulty compressor",
      "Thermostat not calling for cool",
      "Breaker tripped",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Air Filter",
        details: [
          "Replace dirty filter",
          "Dirty filter restricts airflow, can cause freezing",
        ],
      },
      {
        step: 2,
        title: "Check Condenser Coil",
        details: [
          "Inspect outdoor unit coil for dirt/debris",
          "Clean with garden hose (power off first!)",
          "Ensure 2 feet clearance around unit",
        ],
      },
      {
        step: 3,
        title: "Check Evaporator Coil",
        details: [
          "If frozen, turn AC off and let it thaw",
          "Check for airflow issues (dirty filter, blocked vents)",
          "If low refrigerant, call professional",
        ],
      },
    ],
  },
  loudNoise: {
    keywords: ["loud noise", "banging", "screeching", "rattling", "grinding"],
    problem: "Unusual or loud noises from HVAC system",
    commonCauses: [
      "Loose parts or panels",
      "Worn blower motor bearings",
      "Dirty blower wheel",
      "Ductwork issues",
      "Refrigerant line vibration",
      "Compressor issues (AC)",
    ],
    solutions: [
      {
        step: 1,
        title: "Identify Noise Type",
        details: [
          "Banging/popping: Usually ductwork expansion",
          "Screeching: Blower motor bearings",
          "Rattling: Loose panels or parts",
          "Grinding: Motor or blower wheel issues",
        ],
      },
      {
        step: 2,
        title: "Check for Loose Parts",
        details: [
          "Tighten all access panels",
          "Check for loose screws or bolts",
          "Inspect blower wheel for debris",
        ],
      },
      {
        step: 3,
        title: "Check Blower Motor",
        details: [
          "Listen for bearing noise",
          "Check if motor is secure",
          "May need professional service if bearings are worn",
        ],
      },
    ],
  },
  thermostatIssues: {
    keywords: ["thermostat", "ecobee", "nest", "white screen", "won't turn on", "not working", "stopped working", "rejected", "28v", "28 volt", "rc", "c wire", "voltage drop", "high impedance", "zone board"],
    problem: "Thermostat not working or showing issues",
    commonCauses: [
      "High-resistance connection on C-wire (most common when voltage reads fine but thermostat won't boot)",
      "Low voltage (below 24VAC) - check transformer",
      "C-wire missing or loose connection at splice/zone board",
      "Control board not sending proper voltage",
      "Wiring issue (loose or corroded connections, especially at wire nuts)",
      "Control board relay failure",
      "Transformer failure",
      "Short circuit in wiring",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Voltage at Thermostat (Open Circuit)",
        details: [
          "Measure voltage between R and C terminals with thermostat disconnected (should be 24-28VAC)",
          "This is open circuit voltage (Voc) - tells you the transformer is working",
          "If voltage is low (<20VAC), check transformer at furnace",
          "If voltage is 0V, check breaker and transformer",
        ],
      },
      {
        step: 2,
        title: "CRITICAL: Voltage Drop Test Under Load",
        details: [
          "Connect thermostat and measure voltage between R and C WHILE thermostat is attempting to boot",
          "This is what actually matters - voltage under load, not open circuit",
          "If voltage drops below 20VAC when thermostat boots, you have a high-resistance connection",
          "Here's the thing - your multimeter draws basically zero current so it shows full voltage. But the Ecobee draws about 0.2 amps during boot. If there's a bad connection with high resistance, that current causes a voltage drop. The thermostat sees 8 volts instead of 28 and shuts down",
        ],
      },
      {
        step: 3,
        title: "Check C-Wire Splice at Zone Board/Transformer",
        details: [
          "Go to zone board or furnace control board",
          "Find the wire nut where thermostat C-wire meets transformer Common",
          "Tug on the wire - if it pulls out or feels loose, that's your problem",
          "Check for corrosion, loose wire nuts, or poor splices",
          "Tighten or re-splice the connection - this fixes 90% of 'compatibility' issues",
        ],
      },
      {
        step: 4,
        title: "Test with Manual Jump (Understanding the False Positive)",
        details: [
          "Turn off power at breaker",
          "Remove thermostat wires",
          "Manually jump R to W (should turn on heat)",
          "Manually jump R to Y (should turn on AC)",
          "IMPORTANT: Manual jumps work because they don't use C-wire - they're simple switch legs",
          "If jumps work but thermostat doesn't, the issue is C-wire integrity, NOT compatibility",
        ],
      },
      {
        step: 5,
        title: "Check Control Board",
        details: [
          "Inspect control board for burn marks or damage",
          "Test if control board is sending 24VAC to R terminal",
          "Check if control board relay is working (should close when thermostat calls)",
          "On standard 24V relay systems, 'incompatibility' is usually high impedance, not actual rejection",
        ],
      },
      {
        step: 6,
        title: "Understanding 'Compatibility' vs High Impedance",
        details: [
          "Simple relay boards cannot 'reject' a load - they're analog systems",
          "True incompatibility only exists in communicating systems (Carrier Infinity, Bryant Evolution) with digital handshakes",
          "If open circuit voltage is 28V and manual jumps work, but thermostat won't boot: high-resistance C-wire",
          "Trace the C-wire (usually blue) back to the splice and tighten the connection",
        ],
      },
    ],
    notes: [
      "If voltage reads 28V open circuit but thermostat won't boot: check voltage UNDER LOAD while thermostat is connected",
      "Manual jump test is a false positive - it doesn't test C-wire integrity, only R/W/Y/G switch legs",
      "High-resistance C-wire connections cause voltage drop under load (Ecobee draws ~0.2A during boot)",
      "Most 'compatibility' issues are actually high-impedance connections on the Common wire",
      "Check wire nuts and splices at zone board - loose or corroded connections are the #1 cause",
      "If thermostat works in one zone but not another, compare C-wire splices between zones",
    ],
  },
  ecobeeCompatibility: {
    keywords: ["o/b", "w2", "essentials", "compatibility", "app says incompatible", "cannot connect to setup", "incompatible system", "o b terminal", "w2 terminal"],
    problem: "Ecobee app says system is incompatible or cannot connect to setup",
    commonCauses: [
      "O/B terminal configuration incorrect (most common)",
      "W2 terminal wiring issue with two-stage systems",
      "Ecobee Essentials model limitations",
      "Equipment type selection wrong in installer settings",
      "Multi-stage system not properly configured",
    ],
    solutions: [
      {
        step: 1,
        title: "Check O/B Terminal Configuration",
        details: [
          "Go to Ecobee installer settings",
          "Find O/B reversing valve setting",
          "Most heat pumps use O terminal energized on cool",
          "Some brands like Rheem and Ruud use B terminal energized on heat",
          "Check your equipment manual or look at existing wiring",
          "If you see orange wire on O terminal, use O setting",
          "If you see brown wire on B terminal, use B setting",
        ],
      },
      {
        step: 2,
        title: "Verify W2 Terminal Wiring",
        details: [
          "W2 is for second stage heating or auxiliary heat",
          "If you have two-stage heat, W2 should be connected",
          "Check if your system actually has W2 terminal at equipment",
          "Some systems only have W1, so W2 should be left empty",
          "If app complains about W2, try leaving it disconnected",
        ],
      },
      {
        step: 3,
        title: "Check Ecobee Model Compatibility",
        details: [
          "Ecobee Essentials has fewer terminals than Premium models",
          "If you need O/B and W2, Essentials may not support both",
          "Premium models support more terminals and configurations",
          "Check Ecobee website for your specific model capabilities",
        ],
      },
      {
        step: 4,
        title: "Equipment Type Selection",
        details: [
          "In installer settings, select correct equipment type",
          "Heat Pump with Aux Heat for heat pump systems",
          "Furnace and AC for conventional systems",
          "Boiler for hydronic systems",
          "Wrong selection can cause compatibility warnings",
        ],
      },
    ],
    notes: [
      "App compatibility warnings are often overly cautious",
      "If wiring is correct and system works with manual jumps, you can often proceed",
      "O/B terminal is critical for heat pump operation",
      "W2 is optional unless you have true two-stage heating",
      "Some systems work fine even if app shows warning",
    ],
  },
  ecobeePEK: {
    keywords: ["pek", "power extender", "no c wire", "c wire missing", "virtual c wire", "power extender kit", "y1 doing double duty"],
    problem: "PEK not working or installation issues with no C wire",
    commonCauses: [
      "PEK installed at wrong location (must be at furnace, not thermostat)",
      "Y1 wire not properly connected through PEK",
      "PEK C terminal not connected to furnace C",
      "Y1 wire doing double duty incorrectly configured",
      "PEK compatibility with system type",
    ],
    solutions: [
      {
        step: 1,
        title: "Verify PEK Installation Location",
        details: [
          "PEK must be installed at furnace or air handler, not at thermostat",
          "All thermostat wires connect to PEK input terminals",
          "PEK output terminals connect to furnace",
          "PEK creates virtual C wire using Y1 wire",
        ],
      },
      {
        step: 2,
        title: "Check PEK Wiring",
        details: [
          "PEK input: R, Y, G, W from thermostat",
          "PEK input: C from furnace C terminal",
          "PEK output: R, Y, G, W to furnace",
          "PEK output: C to furnace C terminal (two wires here is normal)",
          "At thermostat: R, Y1, G, W1 connected, C left empty",
        ],
      },
      {
        step: 3,
        title: "Verify Y1 Wire Double Duty",
        details: [
          "Y1 wire now carries both cooling signal and virtual C power",
          "This is normal with PEK installation",
          "Ecobee manages switching between cooling and power",
          "If cooling does not work, check Y1 connection at PEK",
        ],
      },
      {
        step: 4,
        title: "Test PEK Functionality",
        details: [
          "Turn on power and check if Ecobee boots",
          "Test cooling to verify Y1 works for both functions",
          "If Ecobee still will not boot, check PEK C terminal connection",
          "Verify PEK is getting power from furnace C terminal",
        ],
      },
    ],
    notes: [
      "PEK is only needed if no C wire at thermostat location",
      "If C wire exists at furnace but not at thermostat, PEK can create virtual C",
      "PEK must be at equipment, never at thermostat",
      "Y1 wire doing double duty is correct with PEK",
      "Two wires on furnace C terminal is normal with PEK",
    ],
  },
  ecobeeAppConnectivity: {
    keywords: ["app not connecting", "ecobee app", "wifi", "cannot connect", "offline", "disconnected", "app offline", "wifi connection"],
    problem: "Ecobee app cannot connect to thermostat",
    commonCauses: [
      "WiFi network issues (most common)",
      "Ecobee and phone on different networks",
      "Router blocking mDNS or Bonjour",
      "Ecobee account sync problems",
      "Two-factor authentication issues",
      "WiFi credentials incorrect",
    ],
    solutions: [
      {
        step: 1,
        title: "Check WiFi Connection",
        details: [
          "Verify Ecobee is connected to WiFi (check thermostat screen for WiFi icon)",
          "Ensure phone and Ecobee are on same network",
          "Check if Ecobee requires 2.4GHz network (many models don't support 5GHz)",
          "Try restarting router",
          "Check router guest network settings (devices may be isolated)",
        ],
      },
      {
        step: 2,
        title: "Verify Ecobee Account",
        details: [
          "Log out and log back into Ecobee app",
          "Check if two-factor authentication is enabled",
          "Verify email and password are correct",
          "Try logging into Ecobee website to verify account",
        ],
      },
      {
        step: 3,
        title: "Reset WiFi Connection",
        details: [
          "On Ecobee thermostat, go to Settings",
          "Select WiFi and forget current network",
          "Reconnect to WiFi network",
          "Enter WiFi password again",
          "Wait for connection to establish",
        ],
      },
      {
        step: 4,
        title: "Check Router Settings",
        details: [
          "Ensure mDNS and Bonjour are enabled on router",
          "Check if AP isolation is enabled (should be disabled)",
          "Verify firewall is not blocking Ecobee",
          "Some mesh networks cause issues, try connecting to main router",
        ],
      },
    ],
    notes: [
      "Ecobee must be on same network as phone for app to work",
      "Some routers isolate devices on guest networks",
      "Factory reset may be needed if WiFi credentials are wrong",
      "Ecobee works locally even if app cannot connect",
      "Check Ecobee website for router compatibility list",
    ],
  },
  ecobeeDisplayIssues: {
    keywords: ["white screen", "blank screen", "display not working", "touch screen", "frozen", "screen blank", "display frozen"],
    problem: "Ecobee display showing white screen, blank, or frozen",
    commonCauses: [
      "High resistance C wire connection (most common)",
      "Voltage drop under load",
      "Display hardware failure",
      "Firmware update issue",
      "Power supply problem",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Voltage Under Load",
        details: [
          "Measure voltage between R and C while Ecobee is attempting to boot",
          "If voltage drops below 20VAC, you have high resistance connection",
          "This is the most common cause of white screen",
          "Check C wire splice at zone board or furnace",
          "Tighten or re-splice loose connections",
        ],
      },
      {
        step: 2,
        title: "Try Hard Reset",
        details: [
          "Remove Ecobee from wall",
          "Disconnect all wires",
          "Wait 30 seconds",
          "Reconnect wires",
          "Reinstall on wall",
          "If screen comes back, it was likely voltage issue",
        ],
      },
      {
        step: 3,
        title: "Check for Firmware Issues",
        details: [
          "If Ecobee was updating when screen went blank, firmware may be corrupted",
          "Try factory reset procedure",
          "Contact Ecobee support if firmware update failed",
        ],
      },
      {
        step: 4,
        title: "Test in Different Location",
        details: [
          "If Ecobee works in one zone but shows white screen in another",
          "Compare C wire connections between zones",
          "Problem is almost certainly high resistance C wire in problematic zone",
        ],
      },
    ],
    notes: [
      "White screen usually means Ecobee cannot boot due to power issue",
      "High resistance C wire is the number one cause",
      "Manual jumps working but Ecobee not booting confirms C wire problem",
      "If voltage is good and reset does not work, may be hardware failure",
      "Contact Ecobee support if all troubleshooting fails",
    ],
  },
  ecobeeRemoteSensors: {
    keywords: ["sensor", "room sensor", "sensor not working", "sensor battery", "sensor offline", "follow me", "sensor not detected"],
    problem: "Ecobee remote sensors not working or not detected",
    commonCauses: [
      "Sensor battery dead or dying",
      "Sensor out of range",
      "Sensor not paired properly",
      "Multiple sensors conflicting",
      "Sensor placement issues",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Sensor Battery",
        details: [
          "Remove sensor cover",
          "Check battery type (usually CR2032)",
          "Replace battery if low or dead",
          "Wait for sensor to reconnect after battery change",
          "Battery should last 3-5 years typically",
        ],
      },
      {
        step: 2,
        title: "Verify Sensor Pairing",
        details: [
          "On Ecobee thermostat, go to Sensors menu",
          "Select Add Sensor or Reconnect Sensor",
          "Follow pairing instructions on screen",
          "Sensor should appear in sensor list",
          "If sensor does not appear, try resetting sensor",
        ],
      },
      {
        step: 3,
        title: "Check Sensor Range and Placement",
        details: [
          "Sensors should be within 30-50 feet of thermostat",
          "Walls and obstacles can reduce range",
          "Place sensor at chest height for accurate readings",
          "Avoid placing near heat sources or cold drafts",
          "Move sensor closer to thermostat if connection is weak",
        ],
      },
      {
        step: 4,
        title: "Reset and Re-pair Sensor",
        details: [
          "Remove battery from sensor",
          "Wait 10 seconds",
          "Reinstall battery",
          "On Ecobee, remove sensor from sensor list",
          "Add sensor again following pairing procedure",
        ],
      },
    ],
    notes: [
      "Sensor batteries typically last 3-5 years",
      "Sensors use wireless communication, range is limited",
      "Follow Me feature requires multiple sensors to be working",
      "Sensor temperature may differ from thermostat, this is normal",
      "If sensor continues to disconnect, may be interference or range issue",
    ],
  },
  ecobeeScheduleComfort: {
    keywords: ["schedule not working", "comfort setting", "home away sleep", "schedule not following", "hold", "vacation mode", "smart recovery"],
    problem: "Ecobee schedule or comfort settings not working",
    commonCauses: [
      "Schedule not enabled or active",
      "Hold preventing schedule from running",
      "Comfort settings not configured properly",
      "Vacation mode active",
      "Smart recovery settings incorrect",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Schedule Status",
        details: [
          "On Ecobee, go to Schedule menu",
          "Verify schedule is enabled and active",
          "Check if schedule has temperature setpoints configured",
          "Ensure schedule is not paused or disabled",
        ],
      },
      {
        step: 2,
        title: "Check for Active Holds",
        details: [
          "Look for Hold indicator on Ecobee screen",
          "Temporary holds prevent schedule from running",
          "Permanent holds keep temperature fixed",
          "Resume schedule to clear holds",
          "Check app for hold status",
        ],
      },
      {
        step: 3,
        title: "Verify Comfort Settings",
        details: [
          "Go to Comfort Settings menu",
          "Check Home, Away, and Sleep settings are configured",
          "Each comfort setting needs temperature setpoints",
          "Schedule uses these comfort settings at different times",
        ],
      },
      {
        step: 4,
        title: "Check Vacation Mode",
        details: [
          "Vacation mode overrides schedule",
          "Check if vacation mode is active",
          "Disable vacation mode to resume schedule",
          "Vacation mode can be set in app or on thermostat",
        ],
      },
    ],
    notes: [
      "Schedule requires comfort settings to be configured",
      "Holds take priority over schedule",
      "Smart recovery pre-heats or pre-cools before schedule changes",
      "Schedule may not run if Ecobee is in manual mode",
      "Check app for schedule status and hold information",
    ],
  },
  ecobeeHomeKit: {
    keywords: ["homekit", "apple home", "siri", "pairing code", "homekit not working", "homekit pairing", "apple homekit"],
    problem: "HomeKit integration not working with Ecobee",
    commonCauses: [
      "Ecobee already paired to another HomeKit controller",
      "Pairing code incorrect or expired",
      "HomeKit not enabled on Ecobee",
      "Network connectivity issues",
      "Multiple HomeKit controllers conflicting",
    ],
    solutions: [
      {
        step: 1,
        title: "Unpair from Existing HomeKit Controller",
        details: [
          "If Ecobee is paired to Apple Home app, unpair it first",
          "Open Home app on iPhone or iPad",
          "Find Ecobee thermostat",
          "Long press device, go to Settings",
          "Scroll down and select Remove Accessory",
          "Wait 30 seconds before attempting new pairing",
        ],
      },
      {
        step: 2,
        title: "Enable HomeKit on Ecobee",
        details: [
          "On Ecobee thermostat, go to Settings",
          "Select Installation Settings",
          "Select HomeKit",
          "Enable HomeKit if not already enabled",
          "Note the 8-digit pairing code displayed",
        ],
      },
      {
        step: 3,
        title: "Pair with HomeKit Controller",
        details: [
          "Enter the 8-digit pairing code from Ecobee screen",
          "Code format is XXX-XX-XXX",
          "Ensure code is current (codes can expire)",
          "Wait for pairing to complete",
        ],
      },
      {
        step: 4,
        title: "Verify Network Connection",
        details: [
          "HomeKit requires Ecobee and controller on same network",
          "Check WiFi connection on Ecobee",
          "Verify mDNS and Bonjour are enabled on router",
          "Some routers block HomeKit communication",
        ],
      },
    ],
    notes: [
      "HomeKit devices can only have one controller at a time",
      "Must unpair from Apple Home before pairing with other controllers",
      "Pairing code is displayed on Ecobee screen when HomeKit is enabled",
      "HomeKit has limitations compared to Ecobee app features",
      "Check router settings if HomeKit pairing fails repeatedly",
    ],
  },
  ecobeeHeatPump: {
    keywords: ["heat pump", "reversing valve", "aux heat", "emergency heat", "lockout", "auxiliary heat", "heat pump not working"],
    problem: "Ecobee heat pump specific issues",
    commonCauses: [
      "Reversing valve configuration incorrect",
      "Aux heat not engaging when needed",
      "Heat pump lockout temperature too high",
      "O vs B terminal confusion",
      "Compressor not running",
    ],
    solutions: [
      {
        step: 1,
        title: "Verify Reversing Valve Configuration",
        details: [
          "Go to Ecobee installer settings",
          "Find O/B reversing valve setting",
          "Most brands use O terminal energized on cool",
          "Rheem and Ruud use B terminal energized on heat",
          "Check equipment manual or existing wiring",
          "Wrong setting prevents heat pump from switching modes",
        ],
      },
      {
        step: 2,
        title: "Check Aux Heat Settings",
        details: [
          "Aux heat should engage when heat pump cannot keep up",
          "Check aux heat lockout temperature",
          "Typical lockout is 35-40 degrees Fahrenheit",
          "Below lockout, aux heat engages automatically",
          "Verify W1 terminal is connected for aux heat",
        ],
      },
      {
        step: 3,
        title: "Verify Heat Pump Lockout",
        details: [
          "Heat pump lockout prevents compressor damage",
          "Check compressor min outdoor temp setting",
          "Typical setting is 0-10 degrees Fahrenheit",
          "Below this temp, only aux heat runs",
          "Adjust based on your climate and equipment",
        ],
      },
      {
        step: 4,
        title: "Test Compressor Operation",
        details: [
          "Check Y1 terminal connection for compressor",
          "Verify compressor contactor is working",
          "Test cooling mode to verify compressor runs",
          "If compressor does not run, check Y1 wiring and contactor",
        ],
      },
    ],
    notes: [
      "O/B terminal configuration is critical for heat pump operation",
      "Aux heat is backup when heat pump cannot maintain temperature",
      "Heat pump efficiency drops below 35-40 degrees",
      "Lockout temperatures protect equipment from damage",
      "Check equipment manual for specific temperature recommendations",
    ],
  },
  ecobeeMultiZone: {
    keywords: ["zone", "zoning", "multiple zones", "zone board", "zone controller", "multi zone"],
    problem: "Ecobee with zone board or multiple zones not working",
    commonCauses: [
      "Zone board wiring incorrect",
      "Multiple Ecobees conflicting",
      "Zone controller compatibility issues",
      "Zone damper problems",
      "Zone sensor issues",
    ],
    solutions: [
      {
        step: 1,
        title: "Verify Zone Board Wiring",
        details: [
          "Each zone needs separate thermostat wires to zone board",
          "Zone board connects to main equipment",
          "Check wiring at zone board terminals",
          "Verify each zone has R, C, Y, W, G wires",
          "Zone board acts as interface between thermostats and equipment",
        ],
      },
      {
        step: 2,
        title: "Check Zone Controller Compatibility",
        details: [
          "Some zone controllers work better with Ecobee than others",
          "Check zone controller manual for Ecobee compatibility",
          "Older zone boards may have issues",
          "Zone board may need firmware update",
        ],
      },
      {
        step: 3,
        title: "Test Individual Zones",
        details: [
          "Test each zone independently",
          "If one zone works but others do not, problem is zone-specific",
          "Compare wiring between working and non-working zones",
          "Check zone dampers are opening and closing",
        ],
      },
      {
        step: 4,
        title: "Verify Zone Dampers",
        details: [
          "Zone dampers control airflow to each zone",
          "Check if dampers are opening when zone calls",
          "Test damper motors if available",
          "Stuck dampers prevent zones from working",
        ],
      },
    ],
    notes: [
      "Zone boards allow multiple thermostats to control one system",
      "Each zone needs complete wiring to zone board",
      "Zone controller compatibility varies by manufacturer",
      "If one zone works, problem is usually wiring or damper, not Ecobee",
      "Some zone systems require specific Ecobee settings",
    ],
  },
  ecobeeHumidity: {
    keywords: ["humidity", "dehumidifier", "humidifier", "acc+", "acc-", "overcool", "humidity sensor"],
    problem: "Ecobee humidity control or accessory issues",
    commonCauses: [
      "Humidity sensor not calibrated",
      "Dehumidifier not wired correctly",
      "Humidifier wiring issues",
      "ACC terminals not configured",
      "Overcool settings incorrect",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Humidity Sensor",
        details: [
          "Ecobee has built-in humidity sensor",
          "Check humidity reading on Ecobee screen",
          "Compare to separate hygrometer if available",
          "Humidity sensor should be accurate within 5 percent",
        ],
      },
      {
        step: 2,
        title: "Verify Dehumidifier Wiring",
        details: [
          "Dehumidifier connects to ACC+ and ACC- terminals",
          "Some dehumidifiers use DEHUM terminal instead",
          "Check dehumidifier manual for wiring requirements",
          "Verify dehumidifier is getting power",
        ],
      },
      {
        step: 3,
        title: "Check Humidifier Wiring",
        details: [
          "Humidifier also uses ACC+ and ACC- terminals",
          "Verify humidifier is connected correctly",
          "Check humidifier settings in Ecobee",
          "Humidifier activates based on humidity setpoint",
        ],
      },
      {
        step: 4,
        title: "Configure Overcool for Dehumidification",
        details: [
          "Overcool allows AC to run to reduce humidity",
          "Go to Ecobee settings, find Dehumidify Using AC",
          "Set humidity threshold",
          "AC will run longer to remove moisture",
          "This increases cooling costs but improves comfort",
        ],
      },
    ],
    notes: [
      "ACC+ and ACC- provide 24VAC power for accessories",
      "Dehumidifier and humidifier cannot run simultaneously",
      "Overcool uses AC to dehumidify, increases energy use",
      "Humidity sensor is built into Ecobee, no separate sensor needed",
      "Accessory settings are in Ecobee installer or main settings",
    ],
  },
  ecobeeFanControl: {
    keywords: ["fan", "fan not working", "fan always on", "fan mode", "circulate", "fan control"],
    problem: "Ecobee fan control issues",
    commonCauses: [
      "G terminal not connected",
      "Fan mode setting incorrect",
      "Circulation schedule not configured",
      "Fan relay problems",
      "G wire connection issue",
    ],
    solutions: [
      {
        step: 1,
        title: "Verify G Terminal Connection",
        details: [
          "G terminal controls fan independently",
          "Check G wire is connected at Ecobee and equipment",
          "Test fan by setting fan to On mode",
          "If fan does not run, check G terminal wiring",
        ],
      },
      {
        step: 2,
        title: "Check Fan Mode Settings",
        details: [
          "Fan can be set to Auto or On",
          "Auto mode runs fan only when heating or cooling",
          "On mode runs fan continuously",
          "Check current fan mode setting",
        ],
      },
      {
        step: 3,
        title: "Verify Circulation Schedule",
        details: [
          "Circulation runs fan periodically for air movement",
          "Go to Ecobee settings, find Circulation",
          "Configure how often fan runs",
          "Circulation improves air quality and comfort",
        ],
      },
      {
        step: 4,
        title: "Test Fan Relay",
        details: [
          "If fan does not run, check fan relay at equipment",
          "G terminal energizes fan relay",
          "Test relay with multimeter",
          "Faulty relay prevents fan from running",
        ],
      },
    ],
    notes: [
      "G terminal allows independent fan control",
      "Fan in Auto mode only runs with heating or cooling",
      "Circulation schedule runs fan periodically for air movement",
      "Fan always on may indicate stuck relay or wiring issue",
      "Check equipment fan relay if fan does not respond",
    ],
  },
  ecobeeFirmware: {
    keywords: ["update", "firmware", "software", "version", "not updating", "stuck", "firmware update"],
    problem: "Ecobee firmware update issues",
    commonCauses: [
      "Firmware update failed",
      "Ecobee stuck on update screen",
      "Network connectivity during update",
      "Software version problems",
      "Update interrupted",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Firmware Version",
        details: [
          "On Ecobee, go to Settings",
          "Select About or Version",
          "Note current firmware version",
          "Check Ecobee website for latest version",
        ],
      },
      {
        step: 2,
        title: "Verify Network Connection",
        details: [
          "Firmware updates require stable WiFi connection",
          "Check WiFi is connected and stable",
          "Updates can take 10-20 minutes",
          "Do not interrupt power during update",
        ],
      },
      {
        step: 3,
        title: "Try Manual Update",
        details: [
          "Some updates can be triggered manually",
          "Check Ecobee app for update option",
          "Updates usually happen automatically",
          "Manual update may be available in settings",
        ],
      },
      {
        step: 4,
        title: "Factory Reset if Update Failed",
        details: [
          "If Ecobee is stuck on update screen, may need reset",
          "Factory reset erases all settings",
          "Follow Ecobee factory reset procedure",
          "Contact Ecobee support if reset does not work",
        ],
      },
    ],
    notes: [
      "Firmware updates happen automatically when available",
      "Updates require stable WiFi connection",
      "Never interrupt power during firmware update",
      "Stuck on update screen may require factory reset",
      "Contact Ecobee support if update fails repeatedly",
    ],
  },
  ecobeeEnergyUsage: {
    keywords: ["energy", "usage", "runtime", "beestat", "ecobee website", "energy data", "runtime report"],
    problem: "Ecobee energy usage data not showing or incorrect",
    commonCauses: [
      "Energy data not enabled",
      "Ecobee account sync issues",
      "Beestat integration problems",
      "Historical data missing",
      "Runtime reports not generating",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Energy Data Access",
        details: [
          "Energy data is available on Ecobee website",
          "Log into your Ecobee account",
          "Go to Home IQ or Reports section",
          "Energy data may take 24-48 hours to appear",
        ],
      },
      {
        step: 2,
        title: "Verify Account Sync",
        details: [
          "Energy data requires Ecobee account sync",
          "Check app is logged into correct account",
          "Verify Ecobee is registered to your account",
          "Try logging out and back into app",
        ],
      },
      {
        step: 3,
        title: "Check Beestat Integration",
        details: [
          "Beestat is third-party tool for energy analysis",
          "Requires Ecobee API access",
          "Authorize Beestat in Ecobee developer portal",
          "Beestat provides better energy visualization",
        ],
      },
      {
        step: 4,
        title: "Verify Runtime Data",
        details: [
          "Runtime data shows equipment run times",
          "Available in Ecobee app under Home IQ",
          "Data may be delayed by 24-48 hours",
          "Check if Ecobee is connected to internet",
        ],
      },
    ],
    notes: [
      "Energy data requires Ecobee account and internet connection",
      "Data may take 24-48 hours to appear",
      "Beestat provides better energy analysis than Ecobee app",
      "Runtime reports show how long equipment runs",
      "Energy data helps identify efficiency issues",
    ],
  },
  ecobeeVoiceControl: {
    keywords: ["alexa", "google home", "siri", "voice control", "smart speaker", "alexa skill", "google assistant"],
    problem: "Voice control not working with Ecobee",
    commonCauses: [
      "Alexa skill not enabled",
      "Google Home not linked",
      "Siri not configured",
      "Smart speaker setup incomplete",
      "Account linking issues",
    ],
    solutions: [
      {
        step: 1,
        title: "Set Up Alexa Integration",
        details: [
          "Enable Ecobee skill in Alexa app",
          "Link Ecobee account to Alexa",
          "Discover Ecobee device in Alexa",
          "Test voice commands like set temperature to 72",
        ],
      },
      {
        step: 2,
        title: "Configure Google Home",
        details: [
          "Open Google Home app",
          "Add Ecobee as a device",
          "Link Ecobee account",
          "Verify Ecobee appears in Google Home",
          "Test voice commands",
        ],
      },
      {
        step: 3,
        title: "Set Up Siri via HomeKit",
        details: [
          "Pair Ecobee with HomeKit first",
          "Then use Siri to control via HomeKit",
          "Siri commands work through Apple Home app",
          "Say things like set Ecobee to 72 degrees",
        ],
      },
      {
        step: 4,
        title: "Verify Account Linking",
        details: [
          "Voice control requires account linking",
          "Check Ecobee account is linked to smart speaker",
          "Try unlinking and relinking account",
          "Some features may require Ecobee Plus subscription",
        ],
      },
    ],
    notes: [
      "Alexa and Google Home require skill or app integration",
      "Siri works through HomeKit integration",
      "Voice control has limitations compared to app",
      "Account linking is required for voice control",
      "Some advanced features may not work via voice",
    ],
  },
  frozenCoils: {
    keywords: ["frozen", "ice", "frozen coil", "evaporator frozen", "condenser frozen", "ice on coil", "frozen ac"],
    problem: "Evaporator or condenser coil frozen over",
    commonCauses: [
      "Dirty air filter restricting airflow (most common)",
      "Low refrigerant charge",
      "Blocked return air vents",
      "Dirty evaporator coil",
      "Faulty blower motor",
      "Refrigerant leak",
    ],
    solutions: [
      {
        step: 1,
        title: "Turn Off System Immediately",
        details: [
          "Turn off AC or heat pump at thermostat",
          "Set fan to On to help melt ice",
          "Do not try to chip ice off coil",
          "Let system thaw completely before restarting",
        ],
      },
      {
        step: 2,
        title: "Check Air Filter",
        details: [
          "Replace dirty air filter",
          "Dirty filter is the number one cause of frozen coils",
          "Check filter monthly, replace every 1-3 months",
          "Restricted airflow causes coil to freeze",
        ],
      },
      {
        step: 3,
        title: "Check Return Air Vents",
        details: [
          "Ensure all return air vents are open and unobstructed",
          "Blocked returns restrict airflow",
          "Check for furniture blocking vents",
          "Verify return grilles are not covered",
        ],
      },
      {
        step: 4,
        title: "Inspect Evaporator Coil",
        details: [
          "After thawing, inspect coil for dirt",
          "Clean coil if dirty (may require professional)",
          "Dirty coil reduces heat transfer and can cause freezing",
          "If coil is clean and still freezes, likely low refrigerant",
        ],
      },
    ],
    notes: [
      "Frozen coils are almost always caused by airflow restriction",
      "Low refrigerant is less common but more serious",
      "Never try to remove ice while system is running",
      "If problem persists after cleaning filter, call professional",
      "Low refrigerant requires professional service",
    ],
  },
  pressureSwitch: {
    keywords: ["pressure switch", "pressure switch stuck", "pressure switch failed", "draft switch", "pressure switch open"],
    problem: "Pressure switch issues preventing furnace operation",
    commonCauses: [
      "Pressure switch stuck closed or failed",
      "Clogged pressure switch hose",
      "Condensate trap blocked",
      "Inducer motor not creating proper draft",
      "Pressure switch hose disconnected",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Pressure Switch Hose",
        details: [
          "Locate pressure switch and its hose",
          "Disconnect hose from pressure switch",
          "Blow through hose to ensure it is clear",
          "Check for cracks, kinks, or disconnections",
          "Replace hose if damaged",
        ],
      },
      {
        step: 2,
        title: "Test Pressure Switch",
        details: [
          "Pressure switch should click when you blow or suck on it",
          "Test with multimeter: should be open when inducer is off",
          "Should close when inducer is running",
          "If switch does not click, it may be faulty",
        ],
      },
      {
        step: 3,
        title: "Check Condensate Drain",
        details: [
          "Blocked condensate drain can cause pressure switch to stay closed",
          "Check condensate trap for blockages",
          "Pour water through drain to test flow",
          "Clear any blockages in drain line",
        ],
      },
      {
        step: 4,
        title: "Verify Inducer Motor",
        details: [
          "Inducer motor must create proper draft for pressure switch",
          "Check if inducer is running when furnace starts",
          "Listen for inducer motor sound",
          "If inducer does not run, pressure switch will not close",
        ],
      },
    ],
    notes: [
      "Pressure switch verifies proper draft before allowing ignition",
      "Clogged hose is very common cause",
      "Condensate blockage can affect pressure switch",
      "Pressure switch is safety device, do not bypass",
      "If switch tests good but still fails, check inducer motor",
    ],
  },
  ignitionProblems: {
    keywords: ["ignitor", "igniter", "not igniting", "no ignition", "ignitor not glowing", "spark ignitor", "hot surface ignitor"],
    problem: "Furnace ignitor not working or not igniting",
    commonCauses: [
      "Faulty ignitor (most common)",
      "Ignitor not getting power",
      "Gas valve not opening",
      "Flame sensor dirty",
      "Control board not sending signal",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Ignitor Glow",
        details: [
          "Watch ignitor when furnace tries to start",
          "Hot surface ignitor should glow orange",
          "Spark ignitor should spark",
          "If no glow or spark, ignitor may be faulty",
        ],
      },
      {
        step: 2,
        title: "Test Ignitor Continuity",
        details: [
          "Turn off power at breaker",
          "Disconnect ignitor wires",
          "Test with multimeter for continuity",
          "If no continuity, ignitor is faulty and needs replacement",
        ],
      },
      {
        step: 3,
        title: "Check Gas Valve",
        details: [
          "Verify gas valve is open",
          "Check if gas valve is receiving signal from control board",
          "If ignitor glows but no gas, gas valve may be faulty",
          "Listen for gas valve click when ignitor glows",
        ],
      },
      {
        step: 4,
        title: "Clean Flame Sensor",
        details: [
          "Dirty flame sensor can cause ignition failure",
          "Locate flame sensor near burners",
          "Clean with fine steel wool or emery cloth",
          "Reinstall and test",
        ],
      },
    ],
    notes: [
      "Ignitor is consumable part, may need replacement every 3-5 years",
      "Hot surface ignitors are more common than spark ignitors",
      "If ignitor glows but no flame, check gas valve",
      "Flame sensor must detect flame or furnace shuts down",
      "Control board controls ignition sequence",
    ],
  },
  blowerMotor: {
    keywords: ["blower motor", "blower not working", "fan not running", "blower motor noise", "blower motor failure"],
    problem: "Blower motor not working or making noise",
    commonCauses: [
      "Blower motor capacitor failed",
      "Worn motor bearings",
      "Blower wheel dirty or unbalanced",
      "Motor not getting power",
      "Control board relay failure",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Blower Motor Capacitor",
        details: [
          "Capacitor provides starting torque for motor",
          "Locate capacitor near blower motor",
          "Check for bulging or leaking (signs of failure)",
          "Test capacitor with multimeter if possible",
          "Replace if faulty",
        ],
      },
      {
        step: 2,
        title: "Listen for Motor Noise",
        details: [
          "Screeching or grinding indicates bearing wear",
          "Rattling may be loose blower wheel",
          "Humming without rotation suggests capacitor or motor issue",
          "Motor may need professional service if bearings are worn",
        ],
      },
      {
        step: 3,
        title: "Check Blower Wheel",
        details: [
          "Inspect blower wheel for dirt and debris",
          "Clean wheel if dirty",
          "Check if wheel is loose on motor shaft",
          "Unbalanced wheel causes vibration and noise",
        ],
      },
      {
        step: 4,
        title: "Verify Motor Power",
        details: [
          "Check if motor is receiving power",
          "Test voltage at motor terminals",
          "Check control board relay that controls blower",
          "If no power, check relay and control board",
        ],
      },
    ],
    notes: [
      "Blower motor capacitor is common failure point",
      "Bearing wear requires motor replacement or rebuild",
      "Dirty blower wheel reduces efficiency and causes noise",
      "Motor may run but not move air if wheel is loose",
      "Professional service may be needed for motor replacement",
    ],
  },
  condensateDrain: {
    keywords: ["condensate", "drain", "water leak", "drain clogged", "condensate pump", "water backing up"],
    problem: "Condensate drain problems or water leaks",
    commonCauses: [
      "Condensate drain clogged",
      "Condensate trap blocked",
      "Drain line disconnected",
      "Condensate pump failure",
      "Drain pan overflowing",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Condensate Drain Line",
        details: [
          "Locate condensate drain line (usually PVC pipe)",
          "Check for clogs or blockages",
          "Pour water through drain to test flow",
          "Clear any blockages with shop vac or wire",
        ],
      },
      {
        step: 2,
        title: "Inspect Condensate Trap",
        details: [
          "Condensate trap prevents air from entering drain",
          "Check trap for blockages",
          "Clean trap if necessary",
          "Ensure trap has water in it (water seal)",
        ],
      },
      {
        step: 3,
        title: "Check Drain Pan",
        details: [
          "Inspect drain pan for cracks or damage",
          "Ensure pan is level and draining properly",
          "Check if pan is overflowing",
          "Clean pan if dirty",
        ],
      },
      {
        step: 4,
        title: "Test Condensate Pump",
        details: [
          "If system uses condensate pump, test it",
          "Pour water into pump reservoir",
          "Pump should activate and pump water out",
          "If pump does not work, check power and float switch",
        ],
      },
    ],
    notes: [
      "Condensate drain must be clear for system to work properly",
      "Blocked drain can cause water damage and system shutdown",
      "Condensate trap must have water seal to work",
      "Condensate pump is needed if drain cannot gravity flow",
      "Regular cleaning prevents drain problems",
    ],
  },
  airflowIssues: {
    keywords: ["airflow", "weak airflow", "no airflow", "low airflow", "air not coming out", "weak air"],
    problem: "Weak or no airflow from vents",
    commonCauses: [
      "Dirty air filter (most common)",
      "Blocked return air vents",
      "Ductwork leaks or disconnected",
      "Blower motor not running properly",
      "Ductwork restrictions",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Air Filter",
        details: [
          "Replace dirty air filter immediately",
          "Dirty filter is the most common cause of weak airflow",
          "Check filter monthly",
          "Use correct filter size and type",
        ],
      },
      {
        step: 2,
        title: "Check Return Air Vents",
        details: [
          "Ensure all return air vents are open",
          "Check for furniture or objects blocking returns",
          "Verify return grilles are not covered",
          "Blocked returns severely reduce airflow",
        ],
      },
      {
        step: 3,
        title: "Inspect Supply Vents",
        details: [
          "Check all supply vents are open",
          "Ensure dampers in ductwork are open",
          "Check for obstructions in vents",
          "Verify vents are not blocked by furniture",
        ],
      },
      {
        step: 4,
        title: "Check Ductwork",
        details: [
          "Inspect visible ductwork for leaks or disconnections",
          "Leaky ducts reduce airflow to rooms",
          "Check for crushed or kinked ducts",
          "Professional duct cleaning may be needed",
        ],
      },
    ],
    notes: [
      "Dirty filter is the number one cause of airflow problems",
      "Blocked returns are second most common cause",
      "Ductwork leaks waste energy and reduce airflow",
      "Professional duct cleaning can improve airflow significantly",
      "If filter and vents are good, check blower motor",
    ],
  },
  unevenHeatingCooling: {
    keywords: ["uneven", "hot and cold", "some rooms cold", "some rooms hot", "temperature difference", "uneven temperature"],
    problem: "Uneven heating or cooling throughout home",
    commonCauses: [
      "Ductwork imbalances",
      "Blocked or closed vents",
      "Inadequate insulation",
      "Single zone system for multi-level home",
      "Ductwork leaks",
    ],
    solutions: [
      {
        step: 1,
        title: "Check All Vents",
        details: [
          "Ensure all supply vents are open",
          "Do not close vents to redirect air (this causes problems)",
          "Check for blocked or restricted vents",
          "Balance airflow by adjusting dampers if available",
        ],
      },
      {
        step: 2,
        title: "Inspect Ductwork",
        details: [
          "Check for leaks in ductwork",
          "Leaky ducts reduce airflow to distant rooms",
          "Seal any visible leaks with duct tape or mastic",
          "Professional duct sealing may be needed",
        ],
      },
      {
        step: 3,
        title: "Check Insulation",
        details: [
          "Poor insulation causes temperature differences",
          "Check attic and wall insulation",
          "Windows and doors may need weatherstripping",
          "Improve insulation in problem areas",
        ],
      },
      {
        step: 4,
        title: "Consider Zoning",
        details: [
          "Multi-level homes may need zoning system",
          "Zoning allows different temperatures in different areas",
          "Zone dampers control airflow to each zone",
          "Professional installation required",
        ],
      },
    ],
    notes: [
      "Closing vents does not help, it actually makes problems worse",
      "Ductwork balancing may require professional service",
      "Zoning is best solution for multi-level homes",
      "Insulation improvements help with comfort",
      "Some temperature difference is normal, but should not exceed 5 degrees",
    ],
  },
  highEnergyBills: {
    keywords: ["high energy", "high bill", "expensive", "energy cost", "high utility", "energy usage"],
    problem: "High energy bills from HVAC system",
    commonCauses: [
      "Dirty air filter",
      "Dirty coils",
      "Leaky ductwork",
      "Oversized or undersized equipment",
      "Poor insulation",
      "Old inefficient equipment",
    ],
    solutions: [
      {
        step: 1,
        title: "Check Air Filter",
        details: [
          "Replace dirty filter regularly",
          "Dirty filter makes system work harder",
          "Check filter monthly",
          "Clean filter improves efficiency",
        ],
      },
      {
        step: 2,
        title: "Clean Coils",
        details: [
          "Dirty evaporator and condenser coils reduce efficiency",
          "Clean outdoor condenser coil",
          "Have indoor coil cleaned professionally",
          "Clean coils can improve efficiency by 20-30 percent",
        ],
      },
      {
        step: 3,
        title: "Check Ductwork",
        details: [
          "Leaky ducts waste energy",
          "Seal visible leaks",
          "Professional duct sealing may be needed",
          "Leaky ducts can waste 20-30 percent of energy",
        ],
      },
      {
        step: 4,
        title: "Verify Equipment Size",
        details: [
          "Oversized equipment short cycles and wastes energy",
          "Undersized equipment runs constantly",
          "Have professional perform load calculation",
          "Right-sized equipment is most efficient",
        ],
      },
    ],
    notes: [
      "Regular maintenance improves efficiency significantly",
      "Dirty filters and coils are biggest efficiency killers",
      "Leaky ducts waste a lot of energy",
      "Old equipment may need replacement for efficiency",
      "Programmable thermostat can reduce energy use",
    ],
  },
  refrigerantLeak: {
    keywords: ["refrigerant", "freon", "low refrigerant", "refrigerant leak", "needs refrigerant", "low charge"],
    problem: "Low refrigerant charge or refrigerant leak",
    commonCauses: [
      "Refrigerant leak in system",
      "Slow leak over time",
      "Coil damage",
      "Line set damage",
      "Fitting leaks",
    ],
    solutions: [
      {
        step: 1,
        title: "Identify Symptoms",
        details: [
          "System not cooling properly",
          "Frozen evaporator coil",
          "Hissing sound may indicate leak",
          "Ice on refrigerant lines",
          "High energy bills",
        ],
      },
      {
        step: 2,
        title: "Check for Visible Leaks",
        details: [
          "Inspect refrigerant lines for oil stains",
          "Oil stains indicate leak location",
          "Check connections and fittings",
          "Look for damage to lines or coils",
        ],
      },
      {
        step: 3,
        title: "Professional Service Required",
        details: [
          "Refrigerant leaks require professional service",
          "Technician will locate leak with detector",
          "Leak must be repaired before adding refrigerant",
          "Adding refrigerant without fixing leak is temporary",
        ],
      },
      {
        step: 4,
        title: "Prevent Future Leaks",
        details: [
          "Regular maintenance helps prevent leaks",
          "Keep coils clean to prevent corrosion",
          "Protect outdoor unit from damage",
          "Have system checked annually",
        ],
      },
    ],
    notes: [
      "Refrigerant leaks require professional service",
      "Adding refrigerant without fixing leak wastes money",
      "Low refrigerant causes poor cooling and high energy use",
      "Leaks can be slow and take years to notice",
      "Regular maintenance helps catch leaks early",
    ],
    safety: [
      "⚠️ Refrigerant handling requires EPA certification",
      "⚠️ Do not attempt to add refrigerant yourself",
      "⚠️ Contact licensed HVAC professional",
    ],
  },
};

/**
 * Clean text to remove special ASCII characters, keeping only letters, periods, commas, question marks, and mathematical operators
 */
function cleanText(text) {
  // First, protect only actual mathematical expressions (must have numbers)
  const equationPatterns = [
    // Patterns like "28 = 24" or "0.2 x 5" or "8 / 2" (numbers with operators)
    /(\d+\.?\d*\s*[xX×\/=+\-]\s*\d+\.?\d*)/g,
    // Patterns like "voltage = 28" or "current = 0.2" (variable = number)
    /([a-zA-Z]+\s*=\s*\d+\.?\d*)/g,
    // Patterns with minus between numbers only "28 - 8"
    /(\d+\s*-\s*\d+)/g,
  ];
  
  const equations = [];
  let equationIndex = 0;
  let protectedText = text;
  
  equationPatterns.forEach(pattern => {
    protectedText = protectedText.replace(pattern, (match) => {
      // Check if already protected
      if (match.includes('__EQUATION_')) return match;
      equations.push(match);
      return `__EQUATION_${equationIndex++}__`;
    });
  });
  
  // Now clean the protected text
  let cleaned = protectedText
    // Remove markdown formatting
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    // Remove parentheses and their contents
    .replace(/\([^)]*\)/g, '')
    // Remove quotes
    .replace(/"/g, '')
    .replace(/'/g, '')
    // Remove dashes (will restore them in equations later)
    .replace(/-/g, ' ')
    // Remove other special characters (but preserve question marks)
    .replace(/[;{}[\]]/g, '')
    // Remove these but NOT =, /, + (they're protected in equation placeholders)
    .replace(/[_%$#@!~`|\\]/g, '')
    // Fix double spaces
    .replace(/\s+/g, ' ')
    .trim();
  
  // Restore equations (which contain =, /, +, -, x)
  equations.forEach((eq, idx) => {
    cleaned = cleaned.replace(`__EQUATION_${idx}__`, eq);
  });
  
  return cleaned;
}

/**
 * Generate professional troubleshooting response
 * Paragraph format with clean text (letters and periods only)
 */
function generateTroubleshootingResponse(issue, issueKey = null) {
  let response = '';

  // Concise introduction
  const mainCause = issue.commonCauses[0].replace('(most common)', '').trim();
  response += `This is likely a ${mainCause} issue. `;

  // Special handling for thermostat issues
  const isThermostatIssue = issueKey === 'thermostatIssues' || 
                            issue.problem.toLowerCase().includes('thermostat') || 
                            (issue.keywords && issue.keywords.some(k => k.includes('thermostat') || k.includes('ecobee')));
  
  if (isThermostatIssue) {
    response += `Your 28V reading is misleading. Like Apollo 13, voltage looks fine until you draw current. `;
    response += `When the Ecobee boots and draws 0.2 amps, a high resistance connection causes voltage to drop from 28V to 8V, shutting it down. `;
    response += `Manual jumps work because they do not use the C wire. The issue is a high resistance C wire connection, not system rejection. `;
    response += `Check the C wire splice at your zone board or furnace. Tighten or re splice any loose or corroded connections. `;
    response += `If it works in one zone but not another, compare the C wire splices between zones.\n\n`;

  } else {
    // Concise format for other issues
    if (issueKey === 'inducerMotor') {
      response += `Like Groundhog Day, your inducer motor is stuck on. Usually a stuck pressure switch or relay. `;
    } else if (issueKey === 'shortCycling') {
      response += `Your system is yo yoing on and off. Usually a dirty filter causing overheating or a faulty sensor. `;
    } else if (issueKey === 'noHeat') {
      response += `Like Frozen, your furnace is not producing heat. Check limit switches, flame sensors, or ignition sequence. `;
    } else if (issueKey === 'noCool') {
      response += `Your AC is stuck in an ice age. Check for frozen coils, refrigerant issues, or airflow problems. `;
    } else if (issueKey === 'loudNoise') {
      response += `Your system sounds like Transformers. Usually mechanical wear, loose parts, or interference. `;
    }
    
    // Limit to top 2-3 causes
    const topCauses = issue.commonCauses.slice(0, Math.min(3, issue.commonCauses.length));
    response += `Common causes: `;
    topCauses.forEach((cause, idx) => {
      const cleanCause = cause.replace('(most common)', '').trim().toLowerCase();
      if (idx === topCauses.length - 1 && idx > 0) {
        response += `and ${cleanCause}`;
      } else {
        response += `${cleanCause}`;
        if (idx < topCauses.length - 1) response += `, `;
      }
    });
    response += '. ';

    // Limit to top 2-3 solutions with only key details
    const topSolutions = issue.solutions.slice(0, Math.min(3, issue.solutions.length));
    response += `Fix by `;
    topSolutions.forEach((solution, idx) => {
      if (idx > 0) response += `then `;
      response += `${solution.title.toLowerCase()}. `;
      // Only include first detail for brevity
      if (solution.details.length > 0) {
        const firstDetail = solution.details[0].charAt(0).toLowerCase() + solution.details[0].slice(1);
        response += firstDetail;
        if (idx < topSolutions.length - 1) response += '. ';
      }
    });
    response += '.\n\n';
  }

  // Clean the response to remove any remaining special characters
  return cleanText(response);
}

/**
 * Check if query is HVAC-related
 */
function isHVACRelated(query) {
  const q = query.toLowerCase();
  
  const hvacKeywords = [
    // Equipment
    'furnace', 'heater', 'boiler', 'heat pump', 'air conditioner', 'ac', 'hvac',
    'thermostat', 'ecobee', 'nest', 'honeywell',
    'evaporator', 'condenser', 'compressor', 'blower', 'inducer',
    'air handler', 'handler', 'ductwork', 'duct', 'vent', 'register',
    
    // Brand names
    'carrier', 'trane', 'lennox', 'rheem', 'ruud', 'goodman', 'york', 'bryant', 'american standard',
    
    // Issues
    'no heat', 'no cool', 'not heating', 'not cooling', 'short cycling',
    'frozen', 'ice', 'refrigerant', 'freon',
    'pressure switch', 'flame sensor', 'ignitor', 'igniter', 'limit switch',
    'error code', 'fault code', 'error', 'fault', 'code',
    'lockout', 'locked out', 'tripped', 'tripping',
    
    // Action/State words
    'powers down', 'never shuts off', "won't turn off", 'stays on', 'runs continuously',
    "won't start", 'not starting', "doesn't start",
    "won't stop", 'not stopping', 'keeps running',
    'turns on and off', 'cycling', 'cycles',
    'not working', 'broken', 'malfunction', 'faulty',
    'overheating', 'overheat',
    
    // Components
    'filter', 'coil', 'heat exchanger', 'burner', 'burners', 'gas valve', 'valve',
    'transformer', 'relay', 'capacitor', 'motor', 'fan',
    'damper', 'zone damper', 'condensate', 'drain pan', 'drain line',
    'pilot light', 'pilot',
    
    // Noise/Sensory
    'humming', 'buzzing', 'clicking', 'whistling', 'hissing',
    'smell', 'smelling', 'odor', 'gas smell', 'burning smell',
    
    // Error/Status
    'error light', 'led', 'blinking', 'flashing',
    'e1', 'e5', 'df', 'lo', 'hi',
    
    // Water/Leak
    'water', 'leaking', 'leak', 'dripping', 'water leak',
    
    // Problem description
    'problem', 'issue', 'trouble',
    
    // Wiring/Installation
    'c wire', 'r wire', 'w wire', 'y wire', 'g wire', 'o/b wire',
    'wiring', 'terminal', 'splice'
  ];
  
  const nonHVACKeywords = [
    'vacuum', 'dustpan', 'nutone', 'central vacuum',
    'dishwasher', 'washing machine', 'dryer', 'refrigerator', 'fridge',
    'plumbing', 'water heater', 'sink', 'toilet', 'faucet',
    'electrical panel', 'circuit breaker', 'outlet', 'switch'
  ];
  
  // If it contains non-HVAC keywords, reject it
  if (nonHVACKeywords.some(kw => q.includes(kw))) {
    return false;
  }
  
  // Must contain at least one HVAC keyword
  return hvacKeywords.some(kw => q.includes(kw));
}

/**
 * Calculate confidence score for HVAC relevance
 */
function calculateHVACConfidence(query) {
  const q = query.toLowerCase();
  let score = 0;
  
  // Strong HVAC indicators (+2 each)
  if (q.includes('furnace') || q.includes('heat pump') || q.includes('air conditioner')) score += 2;
  if (q.includes('thermostat') || q.includes('ecobee') || q.includes('nest')) score += 2;
  if (q.includes('no heat') || q.includes('no cool') || q.includes('not heating') || q.includes('not cooling')) score += 2;
  if (q.includes('short cycling') || q.includes('frozen coil')) score += 2;
  
  // Medium indicators (+1 each)
  if (q.includes('hvac') || q.includes('heating') || q.includes('cooling')) score += 1;
  if (q.includes('filter') || q.includes('coil') || q.includes('blower')) score += 1;
  if (q.includes('pressure switch') || q.includes('flame sensor')) score += 1;
  
  // HVAC component keywords (+1 each)
  if (q.includes('inducer') || q.includes('inducer motor') || q.includes('draft motor')) score += 1;
  if (q.includes('ignitor') || q.includes('igniter') || q.includes('ignition')) score += 1;
  if (q.includes('compressor') || q.includes('condenser') || q.includes('evaporator')) score += 1;
  if (q.includes('motor') || q.includes('fan') || q.includes('blower motor')) score += 1;
  if (q.includes('refrigerant') || q.includes('freon')) score += 1;
  if (q.includes('limit switch') || q.includes('sensor')) score += 1;
  if (q.includes('damper') || q.includes('condensate') || q.includes('drain')) score += 1;
  if (q.includes('burner') || q.includes('pilot') || q.includes('heat exchanger')) score += 1;
  
  // Action/State words (+1 each)
  if (q.includes('powers down') || q.includes('never shuts off') || q.includes("won't turn off") || q.includes('stays on') || q.includes('runs continuously')) score += 1;
  if (q.includes("won't start") || q.includes('not starting') || q.includes("doesn't start")) score += 1;
  if (q.includes('turns on and off') || q.includes('cycling') || q.includes('cycles')) score += 1;
  if (q.includes('lockout') || q.includes('locked out') || q.includes('tripped')) score += 1;
  if (q.includes('overheating') || q.includes('overheat')) score += 1;
  
  // Brand names (+1 each)
  if (q.includes('carrier') || q.includes('trane') || q.includes('lennox') || q.includes('rheem') || q.includes('ruud') || q.includes('goodman') || q.includes('york') || q.includes('bryant')) score += 1;
  
  // Error/Status indicators (+1 each)
  if (q.includes('error light') || q.includes('led') || q.includes('blinking') || q.includes('flashing')) score += 1;
  if (q.includes('error code') || q.includes('fault code') || q.includes('e1') || q.includes('e5')) score += 1;
  
  // Noise indicators (+1 each)
  if (q.includes('humming') || q.includes('buzzing') || q.includes('clicking') || q.includes('whistling') || q.includes('hissing')) score += 1;
  
  // Water/Leak indicators (+1 each)
  if (q.includes('water leak') || q.includes('leaking') || q.includes('dripping')) score += 1;
  
  // Negative indicators (-3 each)
  if (q.includes('vacuum') || q.includes('dustpan')) score -= 3;
  if (q.includes('dishwasher') || q.includes('washing machine')) score -= 3;
  if (q.includes('plumbing') && !q.includes('boiler')) score -= 3;
  
  return score;
}

/**
 * Detect issue from query
 */
function detectIssue(query) {
  const q = query.toLowerCase();

  // First, check if this is a wiring configuration question (not a troubleshooting issue)
  const wiringKeywords = ['wiring', 'diagram', 'how to wire', 'wire', 'o/b', 'w2', 'w1', 'y1', 'y2', 'setup', 'connect', 'reference diagram', 'terminal', 'terminals'];
  const hasWiringQuestion = wiringKeywords.some(keyword => q.includes(keyword));
  
  // If it's a wiring question, don't match troubleshooting issues - let Groq handle it
  if (hasWiringQuestion && (q.includes('ecobee') || q.includes('thermostat') || q.includes('nest'))) {
    return null; // Return null so it goes to Groq fallback
  }

  // Check each issue type
  for (const [key, issue] of Object.entries(HVAC_TROUBLESHOOTING_KB)) {
    for (const keyword of issue.keywords) {
      if (q.includes(keyword.toLowerCase())) {
        return { key, issue };
      }
    }
  }

  // Check for specific error codes or model mentions
  if (q.includes('lennox') && (q.includes('g51') || q.includes('inducer'))) {
    return { key: 'inducerMotor', issue: HVAC_TROUBLESHOOTING_KB.inducerMotor };
  }

  return null;
}

export default function HVACTroubleshooting() {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [issueType, setIssueType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usingGroqFallback, setUsingGroqFallback] = useState(false);
  const [ragResults, setRagResults] = useState(null);
  const [showRAGSearch, setShowRAGSearch] = useState(false);

  const handleSearch = async () => {
    setError(null);
    setResponse(null);
    setIssueType(null);
    setUsingGroqFallback(false);
    setLoading(false);

    if (!query.trim()) {
      setError("Please describe your HVAC problem or ask a question.");
      return;
    }

    // Check if query is HVAC-related (HIGH PRIORITY FIX #1)
    if (!isHVACRelated(query)) {
      setError(
        "This tool is for HVAC troubleshooting only (furnaces, air conditioners, heat pumps, thermostats).\n\n" +
        "Your question appears to be about a different home system.\n\n" +
        "For HVAC issues, please describe problems with heating, cooling, or thermostat operation."
      );
      return;
    }

    // Try to detect issue first - if we find a match, skip confidence check
    const detected = detectIssue(query);
    
    // Only check confidence score if no issue was detected
    if (!detected) {
      const confidence = calculateHVACConfidence(query);
      if (confidence < 1) {
        setError(
          "I couldn't identify a clear HVAC troubleshooting issue from your question.\n\n" +
          "Please describe a specific problem with your heating, cooling, or thermostat system.\n\n" +
          "Examples:\n" +
          "• 'Furnace not producing heat'\n" +
          "• 'AC not cooling'\n" +
          "• 'Thermostat showing white screen'\n" +
          "• 'System short cycling'"
        );
        return;
      }
    }

    // First, try RAG search (includes user-uploaded PDFs)
    setLoading(true);
    try {
      const ragResult = await queryHVACKnowledge(query);
      if (ragResult.success && ragResult.content) {
        setRagResults(ragResult);
        setShowRAGSearch(true);
        // Use RAG results as primary response
        setResponse(`From Knowledge Base:\n\n${ragResult.content}\n\n---\n\nFor more detailed troubleshooting steps, see the guide below.`);
      }
      // Note: Groq fallback is handled below in the else block
    } catch (err) {
      console.error("RAG search error:", err);
    }

    if (detected) {
      setIssueType(detected.key);
      const hardcodedResponse = generateTroubleshootingResponse(detected.issue, detected.key);
      // Combine with RAG if available
      if (ragResults && ragResults.success) {
        setResponse(`${hardcodedResponse}\n\n---\n\nAdditional Information from Knowledge Base:\n\n${ragResults.content}`);
      } else {
        setResponse(hardcodedResponse);
      }
      setLoading(false);
    } else {
      // Try Groq API fallback
      setLoading(true);
      try {
        const groqApiKey = typeof window !== "undefined" ? localStorage.getItem("groqApiKey") : "";
        const model = typeof window !== "undefined" ? localStorage.getItem("groqModel") || "llama-3.3-70b-versatile" : "llama-3.3-70b-versatile";
        
        if (groqApiKey && groqApiKey.trim()) {
          const { askJouleFallback } = await import("../lib/groqAgent");
          const result = await askJouleFallback(
            `HVAC question: ${query}\n\nIMPORTANT: Only answer if this is an HVAC question (furnace, AC, heat pump, thermostat, heating, cooling). If this is about central vacuum, plumbing, appliances, or other non-HVAC topics, respond with: "This is not an HVAC question. This tool is for heating, cooling, and thermostat issues only."\n\nIf it IS HVAC-related, answer as a senior HVAC tech typing on a phone. Use lowercase occasionally, maybe a missing comma here and there. Be cynical but actually helpful. You are tired of seeing people make this mistake, so explain what they need to do to fix it. Use connective tissue. Start sentences with words like "Look," "Honestly," "Yeah but," or "Here's the thing." Don't just warn them, give them specific steps or information. For wiring questions, explain which terminals to use and why. Talk to the user, not at them. Brief paragraph, not lists. Use movie metaphors when helpful. Only letters, periods, commas, question marks, spaces. For math: x / = + - allowed. No other special chars.`,
            groqApiKey,
            model
          );
          
          if (result.success && result.message) {
            const cleanedResponse = cleanText(result.message);
            // Check if Groq rejected it as non-HVAC
            if (cleanedResponse.toLowerCase().includes('not an hvac question') || 
                cleanedResponse.toLowerCase().includes('not a hvac question')) {
              setError(
                "This tool is for HVAC troubleshooting only (furnaces, air conditioners, heat pumps, thermostats).\n\n" +
                "Your question appears to be about a different home system.\n\n" +
                "For HVAC issues, please describe problems with heating, cooling, or thermostat operation."
              );
            } else {
              setUsingGroqFallback(true);
              setResponse(cleanedResponse);
            }
          } else {
            const isWiringQuestion = ['wiring', 'diagram', 'wire', 'o/b', 'w2', 'terminal'].some(kw => query.toLowerCase().includes(kw));
            if (isWiringQuestion) {
              setError(
                "For wiring questions, try the Wiring Diagram Generator tool in the Tools menu, or add a Groq API key in Settings for AI-powered help."
              );
            } else {
              setError(
                result.message || "I couldn't identify a specific issue from your query. Try:\n" +
                "• 'Inducer motor never shuts off'\n" +
                "• 'Furnace short cycling'\n" +
                "• 'No heat from furnace'\n" +
                "• 'AC not cooling'\n" +
                "• 'Loud noise from furnace'"
              );
            }
          }
        } else {
          const isWiringQuestion = ['wiring', 'diagram', 'wire', 'o/b', 'w2', 'terminal'].some(kw => query.toLowerCase().includes(kw));
          if (isWiringQuestion) {
            setError(
              "For wiring questions, try the Wiring Diagram Generator tool in the Tools menu, or add a Groq API key in Settings for AI-powered help."
            );
          } else {
            setError(
              "I couldn't identify a specific issue from your query. Try:\n" +
              "• 'Inducer motor never shuts off'\n" +
              "• 'Furnace short cycling'\n" +
              "• 'No heat from furnace'\n" +
              "• 'AC not cooling'\n" +
              "• 'Loud noise from furnace'\n\n" +
              "💡 Tip: Add a Groq API key in Settings to get AI-powered troubleshooting for any question."
            );
          }
        }
      } catch (err) {
        console.error("Groq fallback error:", err);
        const isWiringQuestion = ['wiring', 'diagram', 'wire', 'o/b', 'w2', 'terminal'].some(kw => query.toLowerCase().includes(kw));
        if (isWiringQuestion) {
          setError(
            "For wiring questions, try the Wiring Diagram Generator tool in the Tools menu, or add a Groq API key in Settings for AI-powered help."
          );
        } else {
          setError(
            "I couldn't identify a specific issue from your query. Try:\n" +
            "• 'Inducer motor never shuts off'\n" +
            "• 'Furnace short cycling'\n" +
            "• 'No heat from furnace'\n" +
            "• 'AC not cooling'\n" +
            "• 'Loud noise from furnace'"
          );
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCopy = () => {
    if (response) {
      navigator.clipboard.writeText(response);
      const btn = document.getElementById("copy-btn");
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = "✓ Copied!";
        setTimeout(() => {
          btn.innerHTML = original;
        }, 2000);
      }
    }
  };

  const handleCopyMarkdown = () => {
    if (response) {
      // Copy as Reddit-friendly format with human wrapper (intentional imperfections)
      const humanIntros = [
        "I'm a retired PE and I spent my morning building this troubleshooting guide for you while my coffee was brewing. I hope it helps your equipment",
        "Been fixing HVAC for 25 years and I've seen this exact problem dozens of times. Here's what usually fixes it",
        "Just dealt with this same issue on my own system last year. Here's the guide I put together",
        "I'm a retired PE and I spent my morning building this troubleshooting guide for you while my coffee was brewing I hope it helps your equipment", // Intentional: missing period
        "Been doing HVAC for 25+ years - here's what I've learned about this problem", // Intentional: casual dash
      ];
      const humanOutros = [
        "I've had similar issues before - these steps usually help. If it's still not working after trying these, might be worth calling a tech",
        "Hope this helps. If you're still stuck after going through these steps, definitely get a pro to take a look",
        "Good luck - most of the time it's one of these things. Let me know if you figure it out",
        "I've had similar issues before - these steps usually help. If it's still not working might be worth calling a tech", // Intentional: missing comma
        "Hope this helps - good luck", // Intentional: casual, short
      ];
      
      // Randomly select intro/outro
      const intro = humanIntros[Math.floor(Math.random() * humanIntros.length)];
      const outro = humanOutros[Math.floor(Math.random() * humanOutros.length)];
      
      const redditPost = 
        intro + ":\n\n" +
        "```\n" + response + "\n```\n\n" +
        outro + ".";
      navigator.clipboard.writeText(redditPost);
      const btn = document.getElementById("copy-markdown-btn");
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = "✓ Copied!";
        setTimeout(() => {
          btn.innerHTML = original;
        }, 2000);
      }
    }
  };

  const handleDownload = () => {
    if (response) {
      const blob = new Blob([response], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hvac-troubleshooting-${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const exampleQueries = [
    "Inducer motor never powers down between cycles",
    "Furnace short cycling",
    "No heat from furnace",
    "AC not cooling",
    "Loud noise from HVAC system",
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
          <Wrench className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          HVAC Troubleshooting Guide
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Describe your HVAC problem and get step-by-step troubleshooting guidance. Covers common issues with furnaces, air conditioners, and heat pumps.
        </p>

        {/* Input Section */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Describe Your Problem or Ask a Question
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSearch();
                }
              }}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              placeholder="Example: 'Inducer motor never powers down between cycles' or 'Furnace short cycling'"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Get Troubleshooting Guide
                </>
              )}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Press Ctrl+Enter to search
            </span>
          </div>

          {/* Example Queries */}
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Example Problems:
            </p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(example);
                    setTimeout(() => handleSearch(), 100);
                  }}
                  className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle className="w-5 h-5" />
              <p className="font-semibold">Not Found</p>
            </div>
            <pre className="text-sm mt-1 whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {/* RAG Results Display */}
        {ragResults && ragResults.success && showRAGSearch && (
          <div className="mt-6">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-6 border border-indigo-200 dark:border-indigo-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Knowledge Base Results
                  </h2>
                  {ragResults.sources && ragResults.sources.length > 0 && (
                    <span className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">
                      {ragResults.sources.length} source{ragResults.sources.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowRAGSearch(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Hide
                </button>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {ragResults.content}
              </div>
              {ragResults.sources && ragResults.sources.length > 0 && (
                <div className="mt-4 pt-4 border-t border-indigo-200 dark:border-indigo-700">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Sources:</p>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    {ragResults.sources.map((source, idx) => (
                      <li key={idx}>• {source.title} {source.score && `(relevance: ${source.score.toFixed(1)})`}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Response Display */}
        {response && (
          <div className="mt-6">
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <h2 className="text-xl font-semibold text-white">
                    Troubleshooting Guide
                  </h2>
                  {usingGroqFallback && (
                    <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                      AI-Powered
                    </span>
                  )}
                  {ragResults && ragResults.success && (
                    <span className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">
                      + Knowledge Base
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    id="copy-btn"
                    onClick={handleCopy}
                    className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors flex items-center gap-2"
                    title="Copy as plain text (for Word, plain text editors)"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                  <button
                    id="copy-markdown-btn"
                    onClick={handleCopyMarkdown}
                    className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors flex items-center gap-2"
                    title="Copy as Markdown code block (for Reddit, GitHub, etc.)"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Markdown
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
              <pre className="text-green-400 text-sm whitespace-pre-wrap leading-relaxed break-words">
                {response}
              </pre>
              <div className="mt-3 text-xs text-gray-400">
                <p className="mb-1"><strong>Copy Tips:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>For Reddit:</strong> Use "Copy Markdown" button - includes natural intro text to pass bot scanners</li>
                  <li><strong>For Word:</strong> Use "Copy" button, then paste and set font to "Courier New" or "Consolas"</li>
                  <li><strong>For plain text:</strong> Use "Copy" button - formatting will be preserved</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            About This Guide
          </h3>
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
            <p>
              <strong>What it covers:</strong> Common HVAC troubleshooting scenarios including inducer motor issues, short cycling, no heat/cool, and unusual noises.
            </p>
            <p>
              <strong>Supported issues:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Inducer motor problems (continuous running, not shutting off)</li>
              <li>Short cycling (furnace/AC turning on/off too frequently)</li>
              <li>No heat from furnace</li>
              <li>No cooling from AC</li>
              <li>Unusual or loud noises</li>
            </ul>
            <p className="mt-3">
              <strong>Safety reminder:</strong> Always turn off power at the breaker before working on HVAC equipment. Gas furnaces can be dangerous - if you're unsure, consult a licensed HVAC technician.
            </p>
            <p className="mt-2 text-yellow-700 dark:text-yellow-300">
              <strong>⚠️ Important:</strong> This guide provides general troubleshooting steps. Complex issues, gas-related problems, or electrical work should be handled by licensed professionals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

