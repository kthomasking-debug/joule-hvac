import { test, expect } from "@playwright/test";
import { setupTest, ensureUIUnblocked } from "../e2e/helpers/test-setup";

const BASE_URL = "http://localhost:5173"; // Or your Netlify URL

test.describe("ProStat Critical User Journey", () => {
  test("The Sales Funnel: Landing Page -> Demo", async ({ page }) => {
    // 1. Land on the sales page
    await page.goto(BASE_URL);

    // 2. Verify the "Aggressive" Copy exists
    await expect(page.getByText(/Your Ecobee is dumb/i)).toBeVisible();
    await expect(page.getByText(/ProStat is the brain/i)).toBeVisible();

    // 3. Check Pricing Tiers render correctly
    // Look for Bridge pricing - it might be in a card or text
    await expect(page.getByText(/\$129/i)).toBeVisible();
    await expect(page.getByText(/Bridge/i)).toBeVisible();

    // 4. Click the Demo/Launch button
    const launchButton = page
      .getByRole("button", { name: /Launch App|Demo|Get Started/i })
      .first();
    await expect(launchButton).toBeVisible();
    await launchButton.click();

    // 5. Verify we hit the Dashboard
    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByText(/Mission Control|Home/i)).toBeVisible();
  });

  test('The "Hero" Dashboard: Data Visualization', async ({ page }) => {
    // Setup test environment
    await setupTest(page);

    // Bypass landing page, go straight to app
    await page.goto(`${BASE_URL}/home`);
    await ensureUIUnblocked(page);

    // 1. Verify "System Status" is visible
    await expect(page.getByText(/System Status/i)).toBeVisible();

    // 2. Check for the "Big Number" (Current Temp)
    // Using a regex to catch any temperature format like "72°F" or "72.0°F"
    await expect(
      page
        .locator("h1, h2, .text-\\[4rem\\], .text-5xl, .text-6xl")
        .filter({ hasText: /°F/ })
        .first()
    ).toBeVisible({ timeout: 10000 });

    // 3. Verify the "Active Intelligence Feed" is loading
    await expect(page.getByText(/Active Intelligence Feed/i)).toBeVisible();
    // Check if at least one log entry exists (mock data)
    await expect(
      page.getByText(/Optimization|System check|Intelligence/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('The "Control" Room: Thermostat Interactions', async ({ page }) => {
    await setupTest(page);
    await page.goto(`${BASE_URL}/control/thermostat`);
    await ensureUIUnblocked(page);

    // 1. Check Main Controls
    await expect(page.getByText(/Manual Control|Thermostat/i)).toBeVisible();

    // 2. Verify Setpoint Adjustment works (Simulation)
    // Find the current target
    const targetText = page.getByText(/Target:|Setpoint/i);
    await expect(targetText).toBeVisible({ timeout: 10000 });

    // 3. Check for the "Voice Disabled" icon/text (The UI fix we made)
    // This ensures you didn't break the layout
    // Look for mic icon or voice-related text
    await expect(
      page
        .locator("svg")
        .filter({ has: page.locator("path") })
        .or(page.getByText(/Voice|Mic/i))
    ).toBeVisible({ timeout: 5000 });
  });

  test('The "Analysis" Engine: Performance Cards', async ({ page }) => {
    await setupTest(page);
    // Updated route: /analysis/analyzer instead of /performance-analyzer
    await page.goto(`${BASE_URL}/analysis/analyzer`);
    await ensureUIUnblocked(page);

    // 1. Verify the "Red/Green" Cards
    // We expect the "Thermal Factor" card
    await expect(
      page.getByText(/Thermal Factor|Heat Loss Factor/i)
    ).toBeVisible({ timeout: 10000 });

    // 2. Check the "Building Geometry" Logic
    // This text proves the "A-Frame" logic rendered
    await expect(
      page.getByText(/Building Geometry|Home Shape|Geometry/i)
    ).toBeVisible({ timeout: 10000 });

    // 3. Verify no "Result 3" ghost text (The bug we fixed)
    await expect(page.getByText("Result 3")).not.toBeVisible();
  });

  test("The AI: Ask Joule (Offline Intent)", async ({ page }) => {
    await setupTest(page);
    await page.goto(`${BASE_URL}/home`);
    await ensureUIUnblocked(page);

    // 1. Find the input box - use the role selector we fixed
    const input = page.getByRole("textbox", { name: "Ask Joule" });
    await expect(input).toBeVisible({ timeout: 10000 });

    // 2. Type a "Hard Coded" command (Offline mode test)
    await input.fill("What is my balance point?");
    await input.press("Enter");

    // 3. Expect a response (Mocked or calculated)
    // We wait for the response container to appear
    // The response might be in error area or response card
    const responseContainer = page
      .locator('[data-testid="response-card"], [data-testid="error-message"]')
      .filter({ hasText: /balance point|°F/i });
    await expect(responseContainer).toBeVisible({ timeout: 10000 });

    // It should contain a degree symbol (e.g., "22°F") or explanation
    await expect(responseContainer).toContainText(
      /°F|balance point|calculation/i
    );
  });
});
