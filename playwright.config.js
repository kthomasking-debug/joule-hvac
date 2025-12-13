import { defineConfig, devices } from "@playwright/test";
import os from "os";

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
  workers: process.env.CI ? 1 : Math.min(4, (os.cpus().length || 4) - 1),
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html"],
    ["json", { outputFile: "test-results/results.json" }],
    ["list"],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:4173",
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
    // Only run WebKit on macOS (or Windows) - skip on Linux due to missing runtime libs
    // WebKit on Linux requires specific library versions that aren't always available
    ...(process.platform !== "linux"
      ? [{ name: "webkit", use: { ...devices["Desktop Safari"] } }]
      : []),
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 5"] },
      // Mobile tests may need longer timeouts due to slower rendering
      timeout: 60000,
    },
  ],

  /* Run production build server before starting the tests */
  webServer: {
    // Build first, then serve the production build
    // Set PLAYWRIGHT_TEST env var to disable minification and enable source maps for debugging
    // Clear dist folder to ensure fresh build without cached artifacts
    command: "cross-env PLAYWRIGHT_TEST=true npm run build && npm run preview",
    port: 4173,
    reuseExistingServer: !process.env.CI, // Allow reusing server in local dev, but always fresh in CI
    timeout: 180 * 1000, // Longer timeout for build + serve (3 minutes)
    stdout: "pipe",
    stderr: "pipe",
    // Playwright waits for the port to be available and the server to respond
    // Vite preview server listens on port 4173 by default
    // The server is ready when it starts listening on the port
  },
});
