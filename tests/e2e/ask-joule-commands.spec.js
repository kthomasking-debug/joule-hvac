import { test, expect } from "@playwright/test";

/**
 * Test 100 commands through Ask Joule to verify they're recognized as commands
 * and don't require LLM fallback
 */

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

// Helper function to accept terms and conditions if modal is present
async function acceptTermsIfPresent(page) {
  try {
    // Check if terms modal is visible
    const termsModal = page.locator("text=/Welcome to Joule/i");
    const acceptButton = page.locator(
      'button:has-text("Accept & Continue"), button:has-text("Accept")'
    );
    const checkbox = page.locator('input[type="checkbox"]').first();

    // Wait a bit for modal to appear
    await page.waitForTimeout(1000);

    // Check if modal exists
    if ((await termsModal.count()) > 0 || (await acceptButton.count()) > 0) {
      // Check the checkbox first
      if ((await checkbox.count()) > 0) {
        await checkbox.check({ timeout: 2000 });
      }

      // Click accept button
      if ((await acceptButton.count()) > 0) {
        await acceptButton.click({ timeout: 2000 });
        // Wait for modal to disappear
        await page.waitForTimeout(500);
      }
    }
  } catch (error) {
    // Terms modal might not be present, which is fine
    // Just continue with the test
  }
}

test.describe("Ask Joule Command Parser - 100 Commands Test", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });
    await acceptTermsIfPresent(page);
    await page.waitForLoadState("networkidle");
    // Wait a bit more for React to render
    await page.waitForTimeout(2000);
  });

  test("should recognize commands without LLM fallback", async ({ page }) => {
    // Test the parser directly via browser console instead of UI interaction
    // This is more reliable and tests the actual parser logic

    const results = await page.evaluate(async (testCommands) => {
      // Import the parser module
      const module = await import("/src/utils/askJouleParser.js");
      const parseAskJoule = module.parseAskJoule || module.default;

      const results = {
        commands: 0,
        questions: 0,
        errors: 0,
        unrecognized: 0,
        requiresLLM: 0,
        details: [],
      };

      for (let i = 0; i < testCommands.length; i++) {
        const cmd = testCommands[i];
        try {
          const parsed = await parseAskJoule(cmd, {});
          const isCommand = parsed?.isCommand === true || parsed?.action;
          const isQuestion = parsed?.isCommand === false;
          const isSalesQuery = parsed?.isSalesQuery === true;
          const isFunResponse = parsed?.action === "funResponse";
          const requiresLLM = !isCommand && !isSalesQuery && !isFunResponse;

          if (isCommand) {
            results.commands++;
          } else if (isQuestion) {
            results.questions++;
            results.requiresLLM++;
          } else if (isSalesQuery) {
            results.questions++;
          } else if (isFunResponse) {
            results.questions++;
          } else {
            results.unrecognized++;
            results.requiresLLM++;
          }

          results.details.push({
            input: cmd,
            isCommand: isCommand,
            isQuestion: isQuestion,
            requiresLLM: requiresLLM,
            action: parsed?.action,
          });
        } catch (error) {
          results.errors++;
          results.requiresLLM++;
          results.details.push({
            input: cmd,
            error: error.message,
            requiresLLM: true,
          });
        }
      }

      return results;
    }, testCommands);

    // Log results
    console.log("\n📊 SUMMARY:");
    console.log(
      `   ✅ Commands recognized: ${results.commands} (${(
        (results.commands / testCommands.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `   ❓ Questions detected: ${results.questions} (${(
        (results.questions / testCommands.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `   ❌ Unrecognized: ${results.unrecognized} (${(
        (results.unrecognized / testCommands.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `   💥 Errors: ${results.errors} (${(
        (results.errors / testCommands.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `   🤖 Requires LLM: ${results.requiresLLM} (${(
        (results.requiresLLM / testCommands.length) *
        100
      ).toFixed(1)}%)`
    );

    // Commands that should NOT require LLM
    const commandsThatShouldNotNeedLLM = results.details.filter((d) => {
      const looksLikeCommand =
        /^(set|change|make|turn|switch|activate|enable|disable|open|show|go|navigate|run|calculate|check|analyze|optimize|start|stop|toggle|help|sleep|away|home|heat|cool|auto)/i.test(
          d.input
        );
      return looksLikeCommand && d.requiresLLM;
    });

    if (commandsThatShouldNotNeedLLM.length > 0) {
      console.log("\n⚠️  COMMANDS THAT SHOULD NOT REQUIRE LLM (but do):");
      commandsThatShouldNotNeedLLM.forEach((d) => {
        console.log(`   - "${d.input}" → ${d.action || "no action"}`);
      });
    }

    // Assert that most command-like inputs are recognized as commands
    const commandLikeInputs = testCommands.filter((cmd) =>
      /^(set|change|make|turn|switch|activate|enable|disable|open|show|go|navigate|run|calculate|check|analyze|optimize|start|stop|toggle|help|sleep|away|home|heat|cool|auto)/i.test(
        cmd
      )
    );

    const commandRecognitionRate = results.commands / commandLikeInputs.length;

    // Log breakdown by action type
    const commandDetails = results.details.filter((d) => d.isCommand);
    const actionCounts = {};
    commandDetails.forEach((d) => {
      const action = d.action || "unknown";
      actionCounts[action] = (actionCounts[action] || 0) + 1;
    });

    console.log("\n📈 BREAKDOWN BY ACTION TYPE:");
    Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([action, count]) => {
        console.log(`   ${action}: ${count}`);
      });

    // Expect at least 80% of command-like inputs to be recognized as commands
    expect(commandRecognitionRate).toBeGreaterThan(0.8);

    // Expect that commands that look like commands don't require LLM
    expect(commandsThatShouldNotNeedLLM.length).toBeLessThan(
      commandLikeInputs.length * 0.2
    );
  });
});
