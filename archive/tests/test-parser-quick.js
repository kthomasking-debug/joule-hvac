/**
 * Quick Parser Test Script
 * Run: node scripts/test-parser-quick.js
 * 
 * Fast, standalone test runner for parser commands
 * No test framework needed - just runs and reports results
 */

import { parseAskJoule } from '../src/utils/askJouleParser.js';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function normalizeOutput(result) {
  if (!result) return null;
  const normalized = {
    action: result.action || null,
    value: result.value || null,
    target: result.target || null,
    isCommand: result.isCommand || false,
  };
  Object.keys(normalized).forEach(key => {
    if (normalized[key] === null) delete normalized[key];
  });
  return normalized;
}

function compareResults(actual, expected) {
  const actualNorm = normalizeOutput(actual);
  const expectedNorm = normalizeOutput(expected);
  
  // Check isCommand
  if (expected.isCommand !== undefined && actualNorm.isCommand !== expected.isCommand) {
    return { match: false, reason: `isCommand: expected ${expected.isCommand}, got ${actualNorm.isCommand}` };
  }
  
  // Check action
  if (expected.action && actualNorm.action !== expected.action) {
    return { match: false, reason: `action: expected "${expected.action}", got "${actualNorm.action}"` };
  }
  
  // Check value
  if (expected.value !== undefined && actualNorm.value !== expected.value) {
    return { match: false, reason: `value: expected ${expected.value}, got ${actualNorm.value}` };
  }
  
  // Check target
  if (expected.target && actualNorm.target !== expected.target) {
    return { match: false, reason: `target: expected "${expected.target}", got "${actualNorm.target}"` };
  }
  
  return { match: true };
}

// Test cases - same as in the full test file
const TEST_CASES = [
  // Temperature setting
  { input: 'set temperature to 72', expected: { action: 'setWinterThermostat', value: 72, isCommand: true } },
  { input: 'set temp to 72', expected: { action: 'setWinterThermostat', value: 72, isCommand: true } },
  { input: 'set to 72', expected: { action: 'setWinterThermostat', value: 72, isCommand: true } },
  { input: '72 degrees', expected: { action: 'setWinterThermostat', value: 72, isCommand: true } },
  { input: 'make it 72', expected: { action: 'setWinterThermostat', value: 72, isCommand: true } },
  { input: 'change to 72', expected: { action: 'setWinterThermostat', value: 72, isCommand: true } },
  { input: 'set heat to 72', expected: { action: 'setWinterThermostat', value: 72, isCommand: true } },
  { input: 'heat to 72 please', expected: { action: 'setWinterThermostat', value: 72, isCommand: true } },
  { input: 'set the temperature to 72', expected: { action: 'setWinterThermostat', value: 72, isCommand: true } },
  { input: 'can you set it to 72', expected: { action: 'setWinterThermostat', value: 72, isCommand: true } },
  
  // Temperature adjustment
  { input: 'make it warmer', expected: { action: 'tempUp', isCommand: true } },
  { input: 'make it cooler', expected: { action: 'tempDown', isCommand: true } },
  { input: 'turn it up', expected: { action: 'tempUp', isCommand: true } },
  { input: 'turn it down', expected: { action: 'tempDown', isCommand: true } },
  { input: 'increase by 2', expected: { action: 'tempUp', value: 2, isCommand: true } },
  { input: 'decrease by 2', expected: { action: 'tempDown', value: 2, isCommand: true } },
  
  // Mode control
  { input: 'set to heat mode', expected: { action: 'setMode', value: 'heat', isCommand: true } },
  { input: 'set to cool mode', expected: { action: 'setMode', value: 'cool', isCommand: true } },
  { input: 'switch to auto', expected: { action: 'setMode', value: 'auto', isCommand: true } },
  { input: 'heat mode', expected: { action: 'setMode', value: 'heat', isCommand: true } },
  
  // Presets
  { input: 'set to sleep mode', expected: { action: 'sleep', isCommand: true } },
  { input: 'sleep mode', expected: { action: 'sleep', isCommand: true } },
  { input: 'away mode', expected: { action: 'away', isCommand: true } },
  { input: 'home mode', expected: { action: 'home', isCommand: true } },
  
  // Navigation
  { input: 'show me the forecast', expected: { action: 'navigate', target: 'forecast', isCommand: true } },
  { input: 'open settings', expected: { action: 'navigate', target: 'settings', isCommand: true } },
  { input: 'run analyzer', expected: { action: 'navigate', target: 'analyzer', isCommand: true } },
  { input: 'open analyzer', expected: { action: 'navigate', target: 'analyzer', isCommand: true } },
  
  // Status
  { input: 'what is my score', expected: { action: 'showScore', isCommand: true } },
  { input: 'system status', expected: { action: 'systemStatus', isCommand: true } },
  
  // Calculations
  { input: 'calculate my savings', expected: { action: 'showSavings', isCommand: true } },
  { input: 'compare systems', expected: { action: 'compareSystem', isCommand: true } },
  { input: 'show diagnostics', expected: { action: 'showDiagnostics', isCommand: true } },
  
  // Optimization
  { input: 'optimize for comfort', expected: { action: 'optimizeComfort', isCommand: true } },
  { input: 'optimize for savings', expected: { action: 'optimizeSavings', isCommand: true } },
  
  // Questions (should NOT be commands)
  { input: 'why is my bill high', expected: { isCommand: false } },
  { input: 'how does a heat pump work', expected: { isCommand: false } },
];

async function runTests() {
  console.log(`${colors.blue}╔═══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║${colors.reset}  ${colors.yellow}AskJoule Parser Test Suite${colors.reset}                              ${colors.blue}║${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  const startTime = Date.now();
  
  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    const result = await parseAskJoule(testCase.input, {});
    const comparison = compareResults(result, testCase.expected);
    
    if (comparison.match) {
      passed++;
      process.stdout.write(`${colors.green}✓${colors.reset} `);
    } else {
      failed++;
      failures.push({
        input: testCase.input,
        expected: testCase.expected,
        actual: normalizeOutput(result),
        reason: comparison.reason,
      });
      process.stdout.write(`${colors.red}✗${colors.reset} `);
    }
    
    // New line every 20 tests
    if ((i + 1) % 20 === 0) {
      console.log('');
    }
  }
  
  const duration = Date.now() - startTime;
  
  console.log(`\n\n${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}  ${colors.red}Failed: ${failed}${colors.reset}  ${colors.gray}Total: ${TEST_CASES.length}${colors.reset}`);
  console.log(`${colors.gray}Duration: ${duration}ms (${(duration / TEST_CASES.length).toFixed(2)}ms per test)${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}\n`);
  
  if (failures.length > 0) {
    console.log(`${colors.red}FAILURES:${colors.reset}\n`);
    failures.forEach((failure, idx) => {
      console.log(`${colors.red}${idx + 1}. "${failure.input}"${colors.reset}`);
      console.log(`   ${colors.yellow}Expected:${colors.reset}`, JSON.stringify(failure.expected, null, 2));
      console.log(`   ${colors.yellow}Got:${colors.reset}`, JSON.stringify(failure.actual, null, 2));
      console.log(`   ${colors.red}Reason:${colors.reset} ${failure.reason}\n`);
    });
    process.exit(1);
  } else {
    console.log(`${colors.green}All tests passed! 🎉${colors.reset}\n`);
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error(`${colors.red}Test runner error:${colors.reset}`, err);
  process.exit(1);
});





