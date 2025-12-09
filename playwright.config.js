import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for end-to-end testing
 * Tests the entire application across multiple browsers
 */
export default defineConfig({
  testDir: "./tests/e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Optimize workers: Use CPU count - 1 for better performance, but limit to 4 max */
  workers: process.env.CI
    ? 1
    : Math.min(4, (require("os").cpus().length || 4) - 1),
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html"],
    ["json", { outputFile: "test-results/results.json" }],
    ["list"],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:5173",
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    /* Screenshot on failure */
    screenshot: "only-on-failure",
    /* Video on failure */
    video: "retain-on-failure",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      // Firefox-specific: Add retries for connection issues
      retries: 2,
      // Add longer timeout for Firefox to account for server startup
      timeout: 45000,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: "pipe",
    stderr: "pipe",
    // Wait for the server to be ready by checking for a specific response
    // This ensures the server is fully started before tests run
  },
});
