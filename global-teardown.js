/* global global */
/**
 * Playwright Global Teardown
 * Stops the temperature server after tests complete
 */

export default async function globalTeardown() {
  console.log("🛑 Stopping temperature server...");

  if (global.__TEMP_SERVER__) {
    try {
      global.__TEMP_SERVER__.kill("SIGTERM");

      // Wait a moment for graceful shutdown
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Force kill if still running
      if (!global.__TEMP_SERVER__.killed) {
        global.__TEMP_SERVER__.kill("SIGKILL");
      }

      console.log("✅ Temperature server stopped");
    } catch (error) {
      console.error("Error stopping temperature server:", error);
    }
  }
}
