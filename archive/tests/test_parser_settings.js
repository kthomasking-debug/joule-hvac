// Test script for Ask Joule Parser - Thermostat Settings
// Tests commands and questions for all thermostat settings

import { parseAskJoule, parseCommand } from './src/utils/askJouleParser.js';

// Test cases organized by setting
const testCases = {
  "Auto Heat/Cool": {
    commands: [
      "set auto heat cool to true",
      "enable auto heat cool",
      "turn on auto heat cool",
      "set auto heat cool on",
    ],
    queries: [
      "what is my auto heat cool",
      "show me auto heat cool",
      "what's my auto heat cool setting",
    ],
  },
  "Heat/Cool Min Delta": {
    commands: [
      "set heat cool min delta to 5",
      "set heat/cool min delta to 5",
      "set heat-cool min delta to 5",
      "set auto min delta to 5",
    ],
    queries: [
      "what is my heat cool min delta",
      "what's my heat/cool min delta",
      "show me heat-cool min delta",
      "what is my auto min delta",
    ],
  },
  "Heat Dissipation Time": {
    commands: [
      "set heat dissipation to 60",
      "set heat dissipation time to 60",
      "set heat dissipation to 60 seconds",
    ],
    queries: [
      "what is my heat dissipation time",
      "what's my heat dissipation",
      "show me heat dissipation time",
    ],
  },
  "Cool Dissipation Time": {
    commands: [
      "set cool dissipation to 60",
      "set cool dissipation time to 60",
      "set cool dissipation to 60 seconds",
    ],
    queries: [
      "what is my cool dissipation time",
      "what's my cool dissipation",
      "show me cool dissipation time",
    ],
  },
  "Heat Differential Temperature": {
    commands: [
      "set heat differential to 1.5",
      "set heat differential to 1.5 degrees",
      "set heat differential 1.5",
    ],
    queries: [
      "what is my heat differential",
      "what's my heat differential",
      "show me heat differential",
    ],
  },
  "Cool Differential Temperature": {
    commands: [
      "set cool differential to 1.0",
      "set cool differential to 1.0 degrees",
      "set cool differential 1.0",
    ],
    queries: [
      "what is my cool differential",
      "what's my cool differential",
      "show me cool differential",
    ],
  },
  "Heat Min on Time": {
    commands: [
      "set heat min on time to 600",
      "set heat min on time to 10 minutes",
      "set heat min on time to 600 seconds",
    ],
    queries: [
      "what is my heat min on time",
      "what's my heat min on time",
      "show me heat min on time",
    ],
  },
  "AC Overcool Max": {
    commands: [
      "set ac overcool to 3",
      "set ac overcool max to 3",
      "set ac overcool to 3 degrees",
    ],
    queries: [
      "what is my ac overcool",
      "what's my ac overcool max",
      "show me ac overcool",
    ],
  },
  "Temperature Correction": {
    commands: [
      "set temperature correction to 2",
      "calibrate temperature by 2",
      "set temp correction to 2",
    ],
    queries: [
      "what is my temperature correction",
      "what's my temp correction",
      "show me temperature correction",
    ],
  },
  "Humidity Correction": {
    commands: [
      "set humidity correction to 0",
      "set humidity correction to 5 percent",
      "set humidity correction 0",
    ],
    queries: [
      "what is my humidity correction",
      "what's my humidity correction",
      "show me humidity correction",
    ],
  },
  "Thermal Protect": {
    commands: [
      "set thermal protect to 10",
      "set thermal protect to 10 degrees",
      "enable thermal protect",
    ],
    queries: [
      "what is my thermal protect",
      "what's my thermal protect",
      "show me thermal protect",
    ],
  },
  "Compressor Min Cycle Off Time": {
    commands: [
      "set compressor min cycle off to 300",
      "set compressor min cycle off time to 5 minutes",
      "set compressor min cycle off to 300 seconds",
    ],
    queries: [
      "what is my compressor min cycle off",
      "what's my compressor min cycle off time",
      "show me compressor min cycle off",
    ],
  },
  "Compressor Min On Time": {
    commands: [
      "set compressor min on time to 300",
      "set compressor min on time to 5 minutes",
      "set compressor min on time to 300 seconds",
    ],
    queries: [
      "what is my compressor min on time",
      "what's my compressor min on time",
      "show me compressor min on time",
    ],
  },
  "Compressor Min Outdoor Temperature": {
    commands: [
      "set compressor min outdoor temp to 22",
      "set compressor lockout to 22",
      "lock out compressor below 22",
    ],
    queries: [
      "what is my compressor min outdoor temp",
      "what's my compressor lockout",
      "show me compressor lockout",
    ],
  },
  "Compressor Stage 2 Temperature Delta": {
    commands: [
      "set compressor stage 2 delta to 2",
      "set compressor stage 2 delta to 2 degrees",
    ],
    queries: [
      "what is my compressor stage 2 delta",
      "what's my compressor stage 2 delta",
      "show me compressor stage 2 delta",
    ],
  },
  "Compressor Reverse Staging": {
    commands: [
      "enable compressor reverse staging",
      "turn on compressor reverse staging",
      "set compressor reverse staging to true",
    ],
    queries: [
      "what is my compressor reverse staging",
      "is compressor reverse staging enabled",
    ],
  },
  "Compressor Stage 1 Max Runtime": {
    commands: [
      "set compressor stage 1 max runtime to 30 minutes",
      "set compressor stage 1 max runtime to 1800 seconds",
    ],
    queries: [
      "what is my compressor stage 1 max runtime",
      "what's my compressor stage 1 max runtime",
      "show me compressor stage 1 max runtime",
    ],
  },
  "Heat Reverse Staging": {
    commands: [
      "enable heat reverse staging",
      "turn on heat reverse staging",
      "set heat reverse staging to true",
    ],
    queries: [
      "what is my heat reverse staging",
      "is heat reverse staging enabled",
    ],
  },
  "Heat Stage 2 Temperature Delta": {
    commands: [
      "set heat stage 2 delta to 2",
      "set heat stage 2 delta to 2 degrees",
    ],
    queries: [
      "what is my heat stage 2 delta",
      "what's my heat stage 2 delta",
      "show me heat stage 2 delta",
    ],
  },
  "Heat Stage 1 Max Runtime": {
    commands: [
      "set heat stage 1 max runtime to 30 minutes",
      "set heat stage 1 max runtime to 1800 seconds",
    ],
    queries: [
      "what is my heat stage 1 max runtime",
      "what's my heat stage 1 max runtime",
      "show me heat stage 1 max runtime",
    ],
  },
  "Aux Heat Max Outdoor Temperature": {
    commands: [
      "set aux heat max outdoor temp to 50",
      "lock out aux heat above 50",
      "set aux heat lockout to 50",
    ],
    queries: [
      "what is my aux heat max outdoor temp",
      "what's my aux heat lockout",
      "show me aux heat lockout",
    ],
  },
  "Aux Heat Min on Time": {
    commands: [
      "set aux heat min on time to 300",
      "set aux heat min on time to 5 minutes",
      "set aux heat min on time to 300 seconds",
    ],
    queries: [
      "what is my aux heat min on time",
      "what's my aux heat min on time",
      "show me aux heat min on time",
    ],
  },
  "Compressor to Aux Temperature Delta": {
    commands: [
      "set compressor to aux delta to 2",
      "set compressor to aux delta to 2 degrees",
    ],
    queries: [
      "what is my compressor to aux delta",
      "what's my compressor to aux delta",
      "show me compressor to aux delta",
    ],
  },
  "Compressor to Aux Runtime": {
    commands: [
      "set compressor to aux runtime to 30 minutes",
      "set compressor to aux runtime to 1800 seconds",
    ],
    queries: [
      "what is my compressor to aux runtime",
      "what's my compressor to aux runtime",
      "show me compressor to aux runtime",
    ],
  },
  "Aux Stage 2 Temperature Delta": {
    commands: [
      "set aux stage 2 delta to 2",
      "set aux stage 2 delta to 2 degrees",
    ],
    queries: [
      "what is my aux stage 2 delta",
      "what's my aux stage 2 delta",
      "show me aux stage 2 delta",
    ],
  },
  "Aux Reverse Staging": {
    commands: [
      "enable aux reverse staging",
      "turn on aux reverse staging",
      "set aux reverse staging to true",
    ],
    queries: [
      "what is my aux reverse staging",
      "is aux reverse staging enabled",
    ],
  },
  "Aux Stage 1 Max Runtime": {
    commands: [
      "set aux stage 1 max runtime to 30 minutes",
      "set aux stage 1 max runtime to 1800 seconds",
    ],
    queries: [
      "what is my aux stage 1 max runtime",
      "what's my aux stage 1 max runtime",
      "show me aux stage 1 max runtime",
    ],
  },
};

// Run tests
console.log("=".repeat(80));
console.log("ASK JOULE PARSER - THERMOSTAT SETTINGS TEST");
console.log("=".repeat(80));
console.log();

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

for (const [settingName, tests] of Object.entries(testCases)) {
  console.log(`\n${settingName}`);
  console.log("-".repeat(80));
  
  // Test commands
  console.log("  Commands:");
  for (const command of tests.commands) {
    totalTests++;
    const result = parseCommand(command);
    const hasAction = result && result.action;
    const isCommand = result && result.isCommand;
    
    if (hasAction || isCommand) {
      passedTests++;
      console.log(`    ✓ "${command}"`);
      if (result.action) {
        console.log(`      → action: ${result.action}${result.value !== undefined ? `, value: ${result.value}` : ''}`);
      }
    } else {
      failedTests++;
      failures.push({ setting: settingName, type: "command", query: command, result });
      console.log(`    ✗ "${command}"`);
      console.log(`      → No action found. Result: ${JSON.stringify(result)}`);
    }
  }
  
  // Test queries
  console.log("  Queries:");
  for (const query of tests.queries) {
    totalTests++;
    const result = parseAskJoule(query);
    const hasQueryAction = result && (result.action === "queryThreshold" || result.action === "queryTemp" || result.isCommand);
    
    if (hasQueryAction) {
      passedTests++;
      console.log(`    ✓ "${query}"`);
      if (result.action) {
        console.log(`      → action: ${result.action}${result.setting ? `, setting: ${result.setting}` : ''}`);
      }
    } else {
      failedTests++;
      failures.push({ setting: settingName, type: "query", query, result });
      console.log(`    ✗ "${query}"`);
      console.log(`      → No query action found. Result: ${JSON.stringify(result)}`);
    }
  }
}

// Summary
console.log("\n" + "=".repeat(80));
console.log("SUMMARY");
console.log("=".repeat(80));
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
console.log(`Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);

if (failures.length > 0) {
  console.log("\nFAILURES:");
  console.log("-".repeat(80));
  for (const failure of failures) {
    console.log(`\n${failure.setting} - ${failure.type.toUpperCase()}:`);
    console.log(`  Query: "${failure.query}"`);
    console.log(`  Result: ${JSON.stringify(failure.result, null, 2)}`);
  }
}


