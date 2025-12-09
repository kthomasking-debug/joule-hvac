/**
 * Browser Console Test for Ask Joule Parser
 *
 * Copy and paste this entire script into your browser console when on the app
 * to test 100 commands through the parser.
 */

(async function testAskJouleParser100() {
  console.log("🧪 Testing Ask Joule Parser with 100 commands...\n");
  console.log("=".repeat(80));

  // Import the parser
  let parseAskJoule;
  try {
    const module = await import("/src/utils/askJouleParser.js");
    parseAskJoule = module.parseAskJoule || module.default;
    console.log("✅ Parser loaded successfully\n");
  } catch (error) {
    console.error("❌ Failed to load parser:", error);
    console.log("\nTrying alternative import path...");
    try {
      // Try relative path
      const module = await import("./src/utils/askJouleParser.js");
      parseAskJoule = module.parseAskJoule || module.default;
      console.log("✅ Parser loaded from alternative path\n");
    } catch (error2) {
      console.error("❌ Failed to load parser from alternative path:", error2);
      return;
    }
  }

  const testCommands = [
    // Temperature commands (15)
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

    // Mode commands (7)
    "set to heat mode",
    "switch to cool",
    "turn on auto",
    "set to off",
    "heat mode",
    "cool mode",
    "auto mode",

    // Preset commands (6)
    "sleep mode",
    "away mode",
    "home mode",
    "set to sleep",
    "activate away mode",
    "set to home",

    // Navigation commands (9)
    "show forecast",
    "go to analysis",
    "open settings",
    "navigate to budget",
    "show me the comparison",
    "open balance point",
    "go to analyzer",
    "show methodology",
    "open thermostat settings",

    // Status/Query commands (8)
    "what's the temperature",
    "current temp",
    "how hot is it",
    "system status",
    "what's my status",
    "show status",
    "is the heat on",
    "is it running",

    // Settings commands (8)
    "set square feet to 2000",
    "set sq ft to 1500",
    "set home size to 1800",
    "set insulation to good",
    "set HSPF to 10",
    "set SEER to 16",
    "set utility cost to 0.15",
    "set electric rate to 0.12",

    // Help/Info commands (8)
    "help",
    "what can you do",
    "show commands",
    "what commands",
    "explain HSPF",
    "what is SEER",
    "tell me about COP",
    "explain short cycling",

    // Savings/Calculations (8)
    "show savings",
    "calculate savings",
    "what can I save",
    "show my savings",
    "calculate heat loss",
    "what's my heat loss",
    "compare systems",
    "heat pump vs gas",

    // Score/Performance (4)
    "what's my Joule Score",
    "show my score",
    "Joule Score",
    "what's my score",

    // What-if scenarios (3)
    "what if HSPF was 12",
    "what if SEER was 18",
    "what if I had 10 HSPF",

    // Diagnostics (4)
    "show diagnostics",
    "check aux heat",
    "check short cycling",
    "temperature stability",

    // Educational (4)
    "what is a setback",
    "explain differential",
    "what is balance point",
    "explain defrost cycle",

    // Edge cases (12)
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
    "set temp 68",

    // Complex commands (3)
    "set temp to 72 and switch to heat",
    "make it 70 degrees and turn on auto",
    "set to 68 and activate sleep mode",

    // Questions - should NOT be commands (4)
    "why is my bill high",
    "how do I save money",
    "what should I set my thermostat to",
    "when should I use heat mode",
  ];

  const results = {
    commands: 0,
    questions: 0,
    errors: 0,
    unrecognized: 0,
    details: [],
  };

  console.log(`Testing ${testCommands.length} commands...\n`);

  for (let i = 0; i < testCommands.length; i++) {
    const cmd = testCommands[i];
    try {
      const parsed = await parseAskJoule(cmd, {});
      const isCommand = parsed?.isCommand === true || parsed?.action;
      const isQuestion = parsed?.isCommand === false;

      if (isCommand) {
        results.commands++;
        console.log(`✅ [${i + 1}/${testCommands.length}] COMMAND: "${cmd}"`);
        console.log(
          `   → Action: ${parsed.action || "none"}, Value: ${
            parsed.value || "none"
          }`
        );
      } else if (isQuestion) {
        results.questions++;
        console.log(`❓ [${i + 1}/${testCommands.length}] QUESTION: "${cmd}"`);
      } else {
        results.unrecognized++;
        console.log(
          `❌ [${i + 1}/${testCommands.length}] UNRECOGNIZED: "${cmd}"`
        );
        console.log(`   → Parsed:`, parsed);
      }

      results.details.push({
        input: cmd,
        parsed: parsed,
        isCommand: isCommand,
        isQuestion: isQuestion,
      });
    } catch (error) {
      results.errors++;
      console.error(
        `💥 [${i + 1}/${testCommands.length}] ERROR: "${cmd}" →`,
        error.message
      );
      results.details.push({
        input: cmd,
        error: error.message,
      });
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("📊 SUMMARY:");
  console.log(
    `   Commands recognized: ${results.commands} (${(
      (results.commands / testCommands.length) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `   Questions detected: ${results.questions} (${(
      (results.questions / testCommands.length) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `   Unrecognized: ${results.unrecognized} (${(
      (results.unrecognized / testCommands.length) *
      100
    ).toFixed(1)}%)`
  );
  console.log(
    `   Errors: ${results.errors} (${(
      (results.errors / testCommands.length) *
      100
    ).toFixed(1)}%)`
  );
  console.log(`   Total tested: ${testCommands.length}`);
  console.log("\n📋 Full results object saved to: window.askJouleTestResults");
  console.log("   Access it with: window.askJouleTestResults");

  window.askJouleTestResults = results;

  // Show breakdown by category
  console.log("\n📈 BREAKDOWN BY CATEGORY:");
  const commandDetails = results.details.filter((d) => d.isCommand);
  const actionCounts = {};
  commandDetails.forEach((d) => {
    const action = d.parsed?.action || "unknown";
    actionCounts[action] = (actionCounts[action] || 0) + 1;
  });
  Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([action, count]) => {
      console.log(`   ${action}: ${count}`);
    });

  return results;
})();
