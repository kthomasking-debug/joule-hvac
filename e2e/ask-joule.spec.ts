// e2e/ask-joule.spec.ts
// Comprehensive Playwright tests for AskJoule component

import { test, expect } from "@playwright/test";
import { setupTest, ensureUIUnblocked } from "./helpers/test-setup";

// Helper to get the form submit button (not the FAB)
const getAskButton = (page) =>
  page.getByRole("button", { name: "Ask", exact: true });

test.describe("AskJoule Component", () => {
  test.beforeEach(async ({ page }) => {
    // Setup test environment with bypassed onboarding
    await setupTest(page);

    // Add a mock Groq API key for testing
    await page.addInitScript(() => {
      localStorage.setItem("groqApiKey", "test-api-key-for-testing");
      localStorage.setItem("groqModel", "llama-3.1-8b-instant");
    });

    // Navigate to analysis/forecast page where AskJoule is rendered
    await page.goto("/analysis/forecast");
    await ensureUIUnblocked(page);
  });

  test("should render AskJoule input field", async ({ page }) => {
    // Look for the input field - use role to distinguish from FAB button
    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test("should render Ask button", async ({ page }) => {
    const askButton = getAskButton(page);
    await expect(askButton).toBeVisible({ timeout: 10000 });
  });

  test("should render voice control buttons", async ({ page }) => {
    // Mic and speaker buttons should be visible
    const buttons = page.locator("button").filter({ hasText: "" }); // Icon-only buttons
    await expect(buttons.first()).toBeVisible({ timeout: 10000 });
  });

  test("should accept text input", async ({ page }) => {
    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("What is my score?");
    await expect(input).toHaveValue("What is my score?");
  });

  test("should handle local command - show score", async ({ page }) => {
    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("my score");

    await getAskButton(page).click();

    // Should show a response (either score or message to complete settings)
    await expect(
      page.getByText(/Joule Score|Complete your system settings/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("should clear input after submission", async ({ page }) => {
    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("help");

    await getAskButton(page).click();

    // Input should be cleared after submission
    await expect(input).toHaveValue("", { timeout: 5000 });
  });

  test("should show loading state during API call", async ({ page }) => {
    // Mock a slow API response
    await page.route("**/api.groq.com/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          choices: [{ message: { content: "Test response from AI" } }],
          usage: { total_tokens: 100 },
        }),
      });
    });

    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("What is the weather like today?");

    await getAskButton(page).click();

    // Should show "Thinking..." loading state
    await expect(page.getByTestId("loading-indicator")).toBeVisible({
      timeout: 3000,
    });
  });

  test("should display AI response after successful API call", async ({
    page,
  }) => {
    // Mock successful API response
    await page.route("**/api.groq.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: "Here's a helpful answer about your HVAC system.",
              },
            },
          ],
          usage: { total_tokens: 50 },
        }),
      });
    });

    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("Tell me about heat pumps");

    await getAskButton(page).click();

    // Wait for loading to finish
    await expect(page.getByTestId("loading-indicator")).toBeHidden({
      timeout: 10000,
    });

    // Should show the response card with text
    await expect(page.getByTestId("response-card")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("response-text")).toContainText(
      "helpful answer"
    );
  });

  test("should handle API error gracefully", async ({ page }) => {
    // Mock API error
    await page.route("**/api.groq.com/**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Internal server error" } }),
      });
    });

    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("This will cause an error");

    await getAskButton(page).click();

    // Should show error message
    await expect(page.getByTestId("error-message")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should handle missing API key", async ({ page }) => {
    // Remove the API key
    await page.evaluate(() => {
      localStorage.removeItem("groqApiKey");
    });

    // Reload the page to pick up the change
    await page.reload();
    await ensureUIUnblocked(page);

    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("Test question without API key");

    await getAskButton(page).click();

    // Should show API key required message in error area
    await expect(page.getByTestId("error-message")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("error-message")).toContainText(/API key/i);
  });

  test("should toggle Commands panel", async ({ page }) => {
    const commandsButton = page.getByRole("button", { name: "Commands" });
    await commandsButton.click();

    // Commands panel should show - check for collapsible section content
    await expect(
      page.getByText(/Temperature|System|What can I save/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("should toggle History panel", async ({ page }) => {
    const historyButton = page.getByRole("button", { name: "History" });
    await historyButton.click();

    // History panel should appear with heading
    await expect(
      page.getByRole("heading", { name: "Recent Activity" })
    ).toBeVisible({ timeout: 5000 });
  });

  test("should handle rate limit error", async ({ page }) => {
    // Mock rate limit error
    await page.route("**/api.groq.com/**", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Rate limit exceeded" } }),
      });
    });

    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("Rate limited question");

    await getAskButton(page).click();

    // Should show rate limit message
    await expect(page.getByText(/rate limit|wait/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("should submit on Enter key", async ({ page }) => {
    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("my score");
    await input.press("Enter");

    // Should process the command
    await expect(
      page.getByText(/Joule Score|Complete your system settings/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("should not submit empty input", async ({ page }) => {
    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("");

    await getAskButton(page).click();

    // No loading state should appear
    await expect(page.getByTestId("loading-indicator")).not.toBeVisible();
  });

  test("should handle navigation commands", async ({ page }) => {
    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("go to settings");

    await getAskButton(page).click();

    // Should navigate to settings
    await expect(page).toHaveURL(/settings/i, { timeout: 10000 });
  });
});

test.describe("AskJoule Voice Mode", () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
    await page.addInitScript(() => {
      localStorage.setItem("groqApiKey", "test-api-key-for-testing");
    });
    await page.goto("/analysis/forecast");
    await ensureUIUnblocked(page);
  });

  test("should have mic button visible", async ({ page }) => {
    // Look for mic button (either by aria-label or icon)
    const micButton = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .nth(1);
    await expect(micButton).toBeVisible({ timeout: 10000 });
  });

  test("should have speaker button visible", async ({ page }) => {
    // Look for speaker button
    const speakerButton = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .nth(2);
    await expect(speakerButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe("AskJoule Response Display", () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
    await page.addInitScript(() => {
      localStorage.setItem("groqApiKey", "test-api-key-for-testing");
    });
    await page.goto("/analysis/forecast");
    await ensureUIUnblocked(page);
  });

  test("should display success response with styling", async ({ page }) => {
    // Mock successful response
    await page.route("**/api.groq.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          choices: [
            {
              message: {
                content: "Cold climate heat pumps work great in cold weather!",
              },
            },
          ],
          usage: { total_tokens: 30 },
        }),
      });
    });

    const input = page.getByRole("textbox", { name: "Ask Joule" });
    // Use a query that goes to AI (not a local command)
    await input.fill("Tell me about cold climate heat pumps");
    await getAskButton(page).click();

    // Wait for response
    await expect(page.getByTestId("loading-indicator")).toBeHidden({
      timeout: 15000,
    });

    // Check for response card with content
    await expect(page.getByTestId("response-card")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("response-text")).toContainText("cold");
  });

  test("should display info responses with correct styling", async ({
    page,
  }) => {
    // Mock API response for educational query
    await page.route("**/api.groq.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "HSPF (Heating Seasonal Performance Factor) measures heat pump efficiency.",
              },
            },
          ],
          usage: { total_tokens: 25 },
        }),
      });
    });

    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("explain HSPF");
    await getAskButton(page).click();

    // Wait for loading to complete, then check response card for content
    await expect(page.getByTestId("loading-indicator")).toBeHidden({
      timeout: 15000,
    });
    await expect(page.getByTestId("response-card")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByTestId("response-text")).toContainText(/HSPF/i);
  });

  test("should not show duplicate Joule Assistant headers", async ({
    page,
  }) => {
    // Mock response
    await page.route("**/api.groq.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          choices: [{ message: { content: "Test response" } }],
          usage: { total_tokens: 10 },
        }),
      });
    });

    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("test question");
    await getAskButton(page).click();

    // Wait for response
    await expect(page.getByTestId("loading-indicator")).toBeHidden({
      timeout: 15000,
    });

    // Should only have one Joule Assistant header in response card
    const responseCard = page.getByTestId("response-card");
    await expect(responseCard).toBeVisible({ timeout: 5000 });
    const headers = responseCard.getByText("Joule Assistant");
    await expect(headers).toHaveCount(1, { timeout: 5000 });
  });
});

test.describe("AskJoule Easter Eggs", () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
    await page.goto("/analysis/forecast");
    await ensureUIUnblocked(page);
  });

  test("should activate Byzantine mode with command", async ({ page }) => {
    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("enable byzantine mode");
    await getAskButton(page).click();

    // Should show Byzantine activation message
    await expect(page.getByText(/BYZANTINE MODE ACTIVATED/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/Rejoice, Oh Coil Unfrosted/i)).toBeVisible();
  });

  test("should activate Byzantine mode with secret phrase", async ({
    page,
  }) => {
    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("Rejoice, O Coil Unfrosted!");
    await getAskButton(page).click();

    // Should activate Byzantine mode
    await expect(page.getByText(/BYZANTINE MODE ACTIVATED/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("should disable Byzantine mode", async ({ page }) => {
    // First enable it
    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("enable byzantine mode");
    await getAskButton(page).click();
    await expect(page.getByText(/BYZANTINE MODE ACTIVATED/i)).toBeVisible({
      timeout: 5000,
    });

    // Then disable it
    await input.fill("disable byzantine mode");
    await getAskButton(page).click();
    await expect(page.getByText(/Byzantine mode disabled/i)).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("AskJoule Offline Intelligence", () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
    // Don't set API key - these queries should work without it
    await page.goto("/analysis/forecast");
    await ensureUIUnblocked(page);
  });

  test("should answer 'when was your last data update' without API key", async ({
    page,
  }) => {
    // Remove API key to ensure offline intelligence works
    await page.evaluate(() => {
      localStorage.removeItem("groqApiKey");
    });
    await page.reload();
    await ensureUIUnblocked(page);

    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("when was your last data update");
    await getAskButton(page).click();

    // Should show offline answer without requiring API key
    await expect(
      page.getByText(
        /Last data update|No data updates yet|timestamp not tracked/i
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test("should answer 'what is the temperature' without API key", async ({
    page,
  }) => {
    await page.evaluate(() => {
      localStorage.removeItem("groqApiKey");
    });
    await page.reload();
    await ensureUIUnblocked(page);

    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("what is the temperature");
    await getAskButton(page).click();

    // Should show temperature response - check for any response text
    // The response might be in error area or response card
    await expect(
      page.getByText(/temperature|Temperature|not available|Connect/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("should answer 'what is short cycling' without API key", async ({
    page,
  }) => {
    await page.evaluate(() => {
      localStorage.removeItem("groqApiKey");
    });
    await page.reload();
    await ensureUIUnblocked(page);

    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("what is short cycling");
    await getAskButton(page).click();

    // Should show knowledge base answer
    await expect(
      page.getByText(/Short cycling|turns on and off|frequently/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("should calculate conversions without API key", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem("groqApiKey");
    });
    await page.reload();
    await ensureUIUnblocked(page);

    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("convert 20 celsius to fahrenheit");
    await getAskButton(page).click();

    // Should show calculation result
    await expect(page.getByText(/20°C = 68.0°F/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("should answer 'is the bridge connected' without API key", async ({
    page,
  }) => {
    await page.evaluate(() => {
      localStorage.removeItem("groqApiKey");
    });
    await page.reload();
    await ensureUIUnblocked(page);

    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("is the bridge connected");
    await getAskButton(page).click();

    // Should show bridge status
    await expect(
      page.getByText(
        /Bridge is (connected|not connected)|status not available/i
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test("should handle 'open the pod bay doors' easter egg", async ({
    page,
  }) => {
    await page.evaluate(() => {
      localStorage.removeItem("groqApiKey");
    });
    await page.reload();
    await ensureUIUnblocked(page);

    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await input.fill("open the pod bay doors");
    await getAskButton(page).click();

    // Should show HAL 9000 reference
    await expect(
      page.getByText(/I'm sorry, Dave|can't do that|turn on the fan/i)
    ).toBeVisible({ timeout: 10000 });
  });
});
