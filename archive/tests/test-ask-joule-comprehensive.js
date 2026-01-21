/**
 * Comprehensive Ask Joule Parser Test Suite
 * Tests all edge cases, typos, abbreviations, and variations
 */

// Mock environment for Node.js
global.window = undefined;
// Note: import.meta cannot be mocked in Node.js ES modules
// The code should handle undefined import.meta.env gracefully
// For testing, we rely on the code's fallback behavior when import.meta.env is undefined

import { parseAskJoule } from './src/utils/askJouleParser.js';

const testCases = [
  // Square feet variations
  { input: "my house is about 2.2k sqft", expected: { squareFeet: 2200 } },
  { input: "2200sqft", expected: { squareFeet: 2200 } },
  { input: "2,300 squarefeet", expected: { squareFeet: 2300 } },
  { input: "1800 sq. ft.", expected: { squareFeet: 1800 } },
  { input: "1.9 k sq ft", expected: { squareFeet: 1900 } },
  { input: "2500 square foot", expected: { squareFeet: 2500 } },
  { input: "3k sf house", expected: { squareFeet: 3000 } },
  { input: "around 1700-1800 sq ft", expected: { squareFeet: 1700 } }, // Should match first number
  
  // Temperature setting variations
  { input: "set to 72° please", expected: { action: "setWinterTemp", value: 72 } },
  { input: "turn it to 68 °F", expected: { action: "setWinterTemp", value: 68 } },
  { input: "make it seventy two degrees", expected: { action: "setWinterTemp", value: 72 } },
  { input: "set temperature 2 72", expected: { action: "setWinterTemp", value: 72 } }, // Typo handling
  { input: "at72", expected: { action: "setWinterTemp", value: 72 } },
  { input: "set it at72°", expected: { action: "setWinterTemp", value: 72 } },
  { input: "68F", expected: { action: "setWinterTemp", value: 68 } },
  { input: "72 degrees Farenheit", expected: { action: "setWinterTemp", value: 72 } }, // Misspelling
  { input: "72° F", expected: { action: "setWinterTemp", value: 72 } },
  { input: "72 ° F", expected: { action: "setWinterTemp", value: 72 } },
  { input: "set the temp to 70°f", expected: { action: "setWinterTemp", value: 70 } },
  { input: "set temp to seventy", expected: { action: "setWinterTemp", value: 70 } },
  { input: "turn it up to seventy five", expected: { action: "setWinterTemp", value: 75 } },
  { input: "lower to sixty eight", expected: { action: "setWinterTemp", value: 68 } },
  { input: "make it 7 2", expected: { action: "setWinterTemp", value: 72 } }, // Space instead of comma
  { input: "set to 72°fahrenheit", expected: { action: "setWinterTemp", value: 72 } },
  { input: "68 degrees celsius", expected: null }, // Should ignore or reject
  { input: "set temp 71", expected: { action: "setWinterTemp", value: 71 } },
  { input: "72 in Nashville", expected: { action: "setWinterTemp", value: 72, cityName: "Nashville" } },
  
  // City/location variations
  { input: "in dallas texas", expected: { cityName: "dallas texas" } },
  { input: "in Dallas, TX keep it cool", expected: { cityName: "Dallas, TX" } },
  { input: "Dallas TX set to 72", expected: { cityName: "Dallas TX", action: "setWinterTemp", value: 72 } },
  { input: "in Saint Louis, MO", expected: { cityName: "Saint Louis, MO" } },
  { input: "in St. Louis", expected: { cityName: "St. Louis" } },
  { input: "in Mt Pleasant, SC", expected: { cityName: "Mt Pleasant, SC" } },
  { input: "in New York City", expected: { cityName: "New York City" } },
  { input: "in OKC", expected: { cityName: "OKC" } },
  { input: "Chicago turn it down", expected: { cityName: "Chicago" } },
  { input: "Miami,FL set to 74", expected: { cityName: "Miami,FL" } },
  { input: "in Los Angeles California set to 70", expected: { cityName: "Los Angeles California" } },
  { input: "in LA", expected: { cityName: "LA" } },
  { input: "in Vegas baby", expected: { cityName: "Vegas" } },
  { input: "in boise idaho", expected: { cityName: "boise idaho" } },
  { input: "set it to 72 in austin", expected: { action: "setWinterTemp", value: 72, cityName: "austin" } },
  { input: "2200 sf in Portland, OR", expected: { squareFeet: 2200, cityName: "Portland, OR" } },
  
  // Temperature adjustments
  { input: "turn it up five", expected: { action: "increaseTemp", value: 5 } },
  { input: "bump it up 3 degrees", expected: { action: "increaseTemp", value: 3 } },
  { input: "make it warmer by 4°", expected: { action: "increaseTemp", value: 4 } },
  { input: "drop it down 2", expected: { action: "decreaseTemp", value: 2 } },
  { input: "lower by five please", expected: { action: "decreaseTemp", value: 5 } },
  { input: "cooler pls", expected: { action: "decreaseTemp", value: 2 } }, // Default 2
  { input: "make it a little hotter", expected: { action: "increaseTemp", value: 2 } }, // Default 2
  { input: "i'm freezing turn it way up", expected: { action: "emergencyHeatBoost", value: 5 } },
  { input: "can you make it less cold", expected: { action: "increaseTemp", value: 2 } },
  { input: "turn it down 10!! i'm dying", expected: { action: "decreaseTemp", value: 10 } },
  { input: "make it warmer… like 5 degrees", expected: { action: "increaseTemp", value: 5 } },
  { input: "yo turn it down", expected: { action: "decreaseTemp", value: 2 } },
  { input: "brrr too cold", expected: null }, // Might not match, could be question
  { input: "i'm sweating help", expected: { action: "emergencyCoolBoost", value: 5 } },
  
  // Mode switching
  { input: "set heat 72", expected: { action: "setWinterTemp", value: 72 } },
  { input: "heat to72", expected: { action: "setWinterTemp", value: 72 } },
  { input: "cool 2 70", expected: null }, // Voice-to-text garbage - might not parse
  { input: "switch to heat mode", expected: { action: "switchMode", mode: "heat" } },
  { input: "change to cooling", expected: { action: "switchMode", mode: "cool" } },
  { input: "turn on AC", expected: { action: "switchMode", mode: "cool" } },
  { input: "turn the system off please", expected: { action: "switchMode", mode: "off" } },
  { input: "turn off the furnace", expected: { action: "switchMode", mode: "off" } },
  { input: "shut it down", expected: { action: "switchMode", mode: "off" } },
  { input: "turn everything off", expected: { action: "switchMode", mode: "off" } },
  { input: "turn on fan", expected: { action: "fanControl" } },
  { input: "auto mode please", expected: { action: "switchMode", mode: "auto" } },
  { input: "switch back to auto", expected: { action: "switchMode", mode: "auto" } },
  { input: "set thermostat to off", expected: { action: "switchMode", mode: "off" } },
  { input: "turn off thermostat", expected: { action: "switchMode", mode: "off" } },
  
  // Schedule queries
  { input: "what's the schedule for tomorrow", expected: { action: "querySchedule" } },
  { input: "show me monday's schedule", expected: { action: "queryScheduleDay", day: 1 } },
  { input: "schedule on friday", expected: { action: "queryScheduleDay", day: 5 } },
  { input: "what is my weekly schedule", expected: { action: "querySchedule" } },
  { input: "schedule", expected: { action: "querySchedule" } },
  { input: "schedule for wed", expected: { action: "queryScheduleDay", day: 3 } },
  { input: "schedule on sat", expected: { action: "queryScheduleDay", day: 6 } },
  
  // Knowledge questions (should NOT trigger explainer for specific problems)
  { input: "why is my furnace short cycling", expected: { isCommand: false } }, // Question, not explainer
  { input: "what causes short cycling", expected: { action: "offlineAnswer", type: "knowledge" } }, // Explainer
  { input: "explain short cycling", expected: { action: "offlineAnswer", type: "knowledge" } }, // Explainer
  { input: "short cycling???", expected: { action: "offlineAnswer", type: "knowledge" } }, // Explainer
  { input: "what is short cyclng", expected: { action: "offlineAnswer", type: "knowledge" } }, // Typo, but should still match
  
  // Filter/coil questions
  { input: "is a dirty filter causing this", expected: { action: "offlineAnswer", type: "filterCoilEfficiency" } },
  { input: "could the filter be clogged", expected: { action: "offlineAnswer", type: "filterCoilEfficiency" } },
  { input: "my coils are iced up", expected: { action: "offlineAnswer", type: "filterCoilEfficiency" } },
  { input: "dirty coil explain higher bill", expected: { action: "offlineAnswer", type: "filterCoilEfficiency" } },
  { input: "why am i using so much energy filter", expected: { action: "offlineAnswer", type: "filterCoilEfficiency" } },
  { input: "filter cause more kwh", expected: { action: "offlineAnswer", type: "filterCoilEfficiency" } },
  { input: "can a filthy filter waste electricity", expected: { action: "offlineAnswer", type: "filterCoilEfficiency" } },
  { input: "dirty fliter question", expected: { action: "offlineAnswer", type: "filterCoilEfficiency" } }, // Typo
  
  // Combined commands
  { input: "house is 1.5k sq ft", expected: { squareFeet: 1500 } },
  { input: "2,100sq ft", expected: { squareFeet: 2100 } },
  { input: "1800 squarefeet", expected: { squareFeet: 1800 } },
  { input: "2.3ksqft", expected: { squareFeet: 2300 } },
  
  // Polite variations
  { input: "can you set the temp to 71 for me please", expected: { action: "setWinterTemp", value: 71 } },
  { input: "hey joule make it 70", expected: { action: "setWinterTemp", value: 70 } },
  
  // Educational questions
  { input: "can you explain how a heat pump works", expected: { isCommand: false } }, // Question for LLM
  { input: "heat pump question", expected: { isCommand: false } }, // Vague question
];

console.log("🧪 Running comprehensive Ask Joule parser tests...\n");

let passed = 0;
let failed = 0;
const failures = [];

for (const testCase of testCases) {
  try {
    const result = await parseAskJoule(testCase.input);
    
    // Check if result matches expected
    let match = true;
    if (testCase.expected === null) {
      // Expected null/undefined - check if no action or isCommand is false
      match = !result.action && !result.isCommand;
    } else if (testCase.expected.isCommand === false) {
      // Expected question (not command)
      match = result.isCommand === false;
    } else {
      // Check each expected property
      for (const [key, value] of Object.entries(testCase.expected)) {
        if (result[key] !== value) {
          match = false;
          break;
        }
      }
    }
    
    if (match) {
      passed++;
      console.log(`✅ "${testCase.input}"`);
    } else {
      failed++;
      failures.push({
        input: testCase.input,
        expected: testCase.expected,
        got: result,
      });
      console.log(`❌ "${testCase.input}"`);
      console.log(`   Expected:`, testCase.expected);
      console.log(`   Got:`, result);
    }
  } catch (error) {
    failed++;
    failures.push({
      input: testCase.input,
      error: error.message,
    });
    console.log(`💥 "${testCase.input}" - Error:`, error.message);
  }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.log(`\n❌ Failures:\n`);
  failures.forEach((f, i) => {
    console.log(`${i + 1}. "${f.input}"`);
    if (f.error) {
      console.log(`   Error: ${f.error}`);
    } else {
      console.log(`   Expected:`, JSON.stringify(f.expected, null, 2));
      console.log(`   Got:`, JSON.stringify(f.got, null, 2));
    }
    console.log();
  });
}

process.exit(failed > 0 ? 1 : 0);


