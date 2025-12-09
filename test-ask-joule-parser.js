/**
 * Test script to run 100 sample commands through Ask Joule parser
 * Run with: node test-ask-joule-parser.js
 */

// Sample commands to test
const testCommands = [
  // Temperature commands
  "set temp to 68",
  "set temperature to 72",
  "set to 70",
  "set my temp to 75",
  "set the temperature to 68",
  "change temp to 65",
  "make it warmer",
  "make it cooler",
  "increase temperature by 2",
  "decrease temp by 3",
  "raise temp 5 degrees",
  "lower temperature 4 degrees",
  "set heat to 70",
  "set cool to 75",
  "set ac to 72",

  // Mode commands
  "set to heat mode",
  "switch to cool",
  "turn on auto",
  "set to off",
  "heat mode",
  "cool mode",
  "auto mode",

  // Preset commands
  "sleep mode",
  "away mode",
  "home mode",
  "set to sleep",
  "activate away mode",
  "set to home",

  // Navigation commands
  "show forecast",
  "go to analysis",
  "open settings",
  "navigate to budget",
  "show me the comparison",
  "open balance point",
  "go to analyzer",
  "show methodology",
  "open thermostat settings",

  // Status/Query commands
  "what's the temperature",
  "current temp",
  "how hot is it",
  "system status",
  "what's my status",
  "show status",
  "is the heat on",
  "is it running",

  // Settings commands
  "set square feet to 2000",
  "set sq ft to 1500",
  "set home size to 1800",
  "set insulation to good",
  "set HSPF to 10",
  "set SEER to 16",
  "set utility cost to 0.15",
  "set electric rate to 0.12",

  // Help/Info commands
  "help",
  "what can you do",
  "show commands",
  "what commands",
  "explain HSPF",
  "what is SEER",
  "tell me about COP",
  "explain short cycling",

  // Savings/Calculations
  "show savings",
  "calculate savings",
  "what can I save",
  "show my savings",
  "calculate heat loss",
  "what's my heat loss",
  "compare systems",
  "heat pump vs gas",

  // Score/Performance
  "what's my Joule Score",
  "show my score",
  "Joule Score",
  "what's my score",

  // What-if scenarios
  "what if HSPF was 12",
  "what if SEER was 18",
  "what if I had 10 HSPF",

  // Diagnostics
  "show diagnostics",
  "check aux heat",
  "check short cycling",
  "temperature stability",
  "show CSV info",

  // Educational
  "what is a setback",
  "explain differential",
  "what is balance point",
  "explain defrost cycle",

  // Edge cases
  "72 degrees",
  "70",
  "heat",
  "cool",
  "auto",
  "set 68",
  "temp 72",
  "make warmer",
  "make cooler",
  "turn up",
  "turn down",

  // Complex commands
  "set temp to 72 and switch to heat",
  "make it 70 degrees and turn on auto",
  "set to 68 and activate sleep mode",

  // Questions (should NOT be commands)
  "why is my bill high",
  "how do I save money",
  "what should I set my thermostat to",
  "when should I use heat mode",
];

// Mock the parser import (we'll need to adapt this for Node.js)
async function testParser() {
  console.log("Testing Ask Joule Parser with 100 sample commands...\n");
  console.log("=".repeat(80));

  let commandCount = 0;
  let questionCount = 0;
  let errorCount = 0;
  let unrecognizedCount = 0;

  // Since we can't directly import the parser in Node.js without bundling,
  // we'll create a test that can be run in the browser console instead
  console.log("\nNOTE: This test needs to be run in the browser console.");
  console.log("Copy and paste the following code into your browser console:\n");

  const browserTestCode = `
(async function testAskJouleParser() {
  const { parseAskJoule } = await import('/src/utils/askJouleParser.js');
  
  const testCommands = ${JSON.stringify(testCommands, null, 2)};
  
  console.log("Testing Ask Joule Parser with", testCommands.length, "commands...\\n");
  console.log("=".repeat(80));
  
  let results = {
    commands: 0,
    questions: 0,
    errors: 0,
    unrecognized: 0,
    details: []
  };
  
  for (const cmd of testCommands) {
    try {
      const parsed = await parseAskJoule(cmd, {});
      const isCommand = parsed?.isCommand === true || parsed?.action;
      const isQuestion = parsed?.isCommand === false;
      
      if (isCommand) {
        results.commands++;
        console.log("✅ COMMAND:", cmd);
        console.log("   →", JSON.stringify(parsed, null, 2));
      } else if (isQuestion) {
        results.questions++;
        console.log("❓ QUESTION:", cmd);
      } else {
        results.unrecognized++;
        console.log("❌ UNRECOGNIZED:", cmd);
        console.log("   →", JSON.stringify(parsed, null, 2));
      }
      
      results.details.push({
        input: cmd,
        parsed: parsed,
        isCommand: isCommand,
        isQuestion: isQuestion
      });
    } catch (error) {
      results.errors++;
      console.error("💥 ERROR:", cmd, "→", error.message);
      results.details.push({
        input: cmd,
        error: error.message
      });
    }
  }
  
  console.log("\\n" + "=".repeat(80));
  console.log("SUMMARY:");
  console.log("Commands recognized:", results.commands);
  console.log("Questions detected:", results.questions);
  console.log("Unrecognized:", results.unrecognized);
  console.log("Errors:", results.errors);
  console.log("Total:", testCommands.length);
  console.log("\\nFull results:", results);
  
  return results;
})();
  `.trim();

  console.log(browserTestCode);
  console.log("\n" + "=".repeat(80));
  console.log(
    "\nAlternatively, check the browser console when using Ask Joule"
  );
  console.log("to see the [AskJoule] Parsed query logs for each command.\n");
}

testParser();
