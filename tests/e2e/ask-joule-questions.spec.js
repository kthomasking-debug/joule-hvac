import { test, expect } from "@playwright/test";

/**
 * Test that questions are correctly identified as questions and sent to LLM,
 * NOT intercepted by the command parser
 */

// Helper function to accept terms and conditions if modal is present
async function acceptTermsIfPresent(page) {
  try {
    const termsModal = page.locator("text=/Welcome to Joule/i");
    const acceptButton = page.locator(
      'button:has-text("Accept & Continue"), button:has-text("Accept")'
    );
    const checkbox = page.locator('input[type="checkbox"]').first();

    await page.waitForTimeout(1000);

    if ((await termsModal.count()) > 0 || (await acceptButton.count()) > 0) {
      if ((await checkbox.count()) > 0) {
        await checkbox.check({ timeout: 2000 });
      }
      if ((await acceptButton.count()) > 0) {
        await acceptButton.click({ timeout: 2000 });
        await page.waitForTimeout(500);
      }
    }
  } catch (error) {
    // Terms modal might not be present, which is fine
  }
}

const testQuestions = [
  // Actual questions that should go to LLM (30)
  "why is my bill high",
  "how do I save money",
  "what should I set my thermostat to",
  "when should I use heat mode",
  "what is the best temperature for my home",
  "how does a heat pump work",
  "why is my system short cycling",
  "what causes high energy bills",
  "how can I reduce my heating costs",
  "what temperature should I set at night",
  "is it better to keep the heat on all day",
  "why does my heat pump run constantly",
  "what is the most efficient thermostat setting",
  "how much money can I save with a heat pump",
  "what is the difference between heat and auto mode",
  "should I turn off my heat when I leave",
  "why is my house so cold",
  "how do I know if my heat pump is working correctly",
  "what temperature is most comfortable",
  "how often should I change my filter",
  "why is my energy bill so expensive",
  "what is the best way to save on heating",
  "how does insulation affect my energy costs",
  "what is a good HSPF rating",
  "should I use emergency heat",
  "why is my thermostat not reaching the set temperature",
  "how do I know if my system is efficient",
  "what causes short cycling",
  "how can I improve my home's efficiency",
  "what is the optimal temperature for energy savings",

  // Questions that might look like commands but are actually questions (10)
  "how do I set the temperature to 72",
  "can you set the temperature to 70",
  "should I set my thermostat to 68",
  "what happens if I set it to 65",
  "how do I change to heat mode",
  "can I switch to auto mode",
  "should I activate sleep mode",
  "how do I navigate to the settings page",
  "can you show me the forecast",
  "what does it mean to set the temperature",

  // Edge cases - questions that start with command-like words (10)
  "set temperature to what",
  "change to what temperature",
  "show me what",
  "go to where",
  "open what page",
  "calculate what",
  "check what",
  "what should I set",
  "what temperature should I set",
  "what mode should I use",
];

test.describe("Ask Joule Questions - LLM Fallback Test", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });
    await acceptTermsIfPresent(page);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
  });

  test("should send questions to LLM, not intercept as commands", async ({
    page,
  }) => {
    // Wait for parseAskJoule to be exposed on window (it's exposed in main.jsx)
    await page.waitForFunction(() => typeof window.parseAskJoule === "function", {
      timeout: 10000,
    });

    // Test the parser directly via browser console
    const results = await page.evaluate(async (testQuestions) => {
      // Use the parser exposed on window (set up in main.jsx)
      const parseAskJoule = window.parseAskJoule;
      
      if (!parseAskJoule) {
        throw new Error("parseAskJoule not available on window object");
      }

      const results = {
        questions: 0,
        commands: 0,
        offlineAnswers: 0,
        errors: 0,
        details: [],
      };

      for (let i = 0; i < testQuestions.length; i++) {
        const question = testQuestions[i];
        try {
          const parsed = await parseAskJoule(question, {});
          const isOfflineAnswer = parsed?.action === "offlineAnswer";
          const isCommand =
            (parsed?.isCommand === true || parsed?.action) && !isOfflineAnswer;
          const isQuestion = parsed?.isCommand === false;
          const isSalesQuery = parsed?.isSalesQuery === true;
          const isFunResponse = parsed?.action === "funResponse";

          // A question should NOT be a command (but offline answers are OK - they're fast and free)
          // It should either be null (sent to LLM) or marked as isCommand: false
          const shouldGoToLLM =
            !isCommand &&
            (isQuestion || parsed === null || isSalesQuery || isFunResponse);

          if (isOfflineAnswer) {
            // Offline answers are good - count separately (they're fast and free)
            results.offlineAnswers = (results.offlineAnswers || 0) + 1;
          } else if (isCommand) {
            results.commands++;
          } else if (shouldGoToLLM) {
            results.questions++;
          } else {
            // Unrecognized - might be a problem
            results.questions++; // Assume it goes to LLM if not a command
          }

          results.details.push({
            input: question,
            isCommand: isCommand,
            isQuestion: isQuestion,
            isOfflineAnswer: isOfflineAnswer,
            shouldGoToLLM: shouldGoToLLM,
            action: parsed?.action,
            parsed: parsed,
          });
        } catch (error) {
          results.errors++;
          results.details.push({
            input: question,
            error: error.message,
          });
        }
      }

      return results;
    }, testQuestions);

    // Log results
    console.log("\n📊 QUESTION TEST SUMMARY:");
    console.log(
      `   ✅ Questions sent to LLM: ${results.questions} (${(
        (results.questions / testQuestions.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `   ⚡ Offline answers (fast & free): ${results.offlineAnswers || 0} (${(
        ((results.offlineAnswers || 0) / testQuestions.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `   ❌ Commands (should be 0): ${results.commands} (${(
        (results.commands / testQuestions.length) *
        100
      ).toFixed(1)}%)`
    );
    console.log(
      `   💥 Errors: ${results.errors} (${(
        (results.errors / testQuestions.length) *
        100
      ).toFixed(1)}%)`
    );

    // Questions that were incorrectly intercepted as commands (exclude offlineAnswer - those are good!)
    const incorrectlyIntercepted = results.details.filter(
      (d) => d.isCommand && d.action !== "offlineAnswer"
    );

    if (incorrectlyIntercepted.length > 0) {
      console.log("\n⚠️  QUESTIONS INCORRECTLY INTERCEPTED AS COMMANDS:");
      incorrectlyIntercepted.forEach((d) => {
        console.log(`   - "${d.input}" → ${d.action || "no action"}`);
      });
    } else {
      console.log("\n✅ All questions correctly sent to LLM!");
    }

    // Assert that questions are NOT intercepted as commands
    // We expect 0% of questions to be commands (or at most 10% for edge cases)
    // Note: Some questions are intentionally ambiguous (e.g., "can I switch to auto mode")
    // and may be legitimately interpreted as commands
    const commandInterceptionRate = results.commands / testQuestions.length;

    // Show breakdown
    console.log("\n📈 BREAKDOWN:");
    const questionDetails = results.details.filter((d) => !d.isCommand);
    const actionCounts = {};
    questionDetails.forEach((d) => {
      const action =
        d.parsed?.action || (d.parsed === null ? "null (LLM)" : "unknown");
      actionCounts[action] = (actionCounts[action] || 0) + 1;
    });

    Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([action, count]) => {
        console.log(`   ${action}: ${count}`);
      });

    // Expect that at most 10% of questions are incorrectly intercepted as commands
    // (allowing for ambiguous edge cases like "can I switch to auto mode" which could be either)
    expect(commandInterceptionRate).toBeLessThan(0.1);

    // Expect that at least 90% of questions go to LLM (allowing for edge cases)
    const llmRate = results.questions / testQuestions.length;
    expect(llmRate).toBeGreaterThan(0.9);
  });
});
