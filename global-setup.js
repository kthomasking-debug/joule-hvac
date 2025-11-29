/**
 * Playwright Global Setup
 * Starts the temperature server before running tests
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let tempServerProcess;

export default async function globalSetup() {
  console.log("🌡️  Starting temperature server...");

  // Start temperature server
  tempServerProcess = spawn(
    "node",
    [join(__dirname, "server", "temperature-server.js")],
    {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
      shell: false,
    }
  );

  // Handle server output
  tempServerProcess.stdout?.on("data", (data) => {
    console.log(`[TempServer] ${data.toString().trim()}`);
  });

  tempServerProcess.stderr?.on("data", (data) => {
    console.error(`[TempServer Error] ${data.toString().trim()}`);
  });

  // Handle server errors
  tempServerProcess.on("error", (err) => {
    console.error("Failed to start temperature server:", err);
    throw err;
  });

  // Wait for server to be ready by checking health endpoint
  const maxAttempts = 30;
  const delayMs = 500;
  let attempts = 0;
  let serverReady = false;

  while (attempts < maxAttempts && !serverReady) {
    try {
      const response = await fetch("http://localhost:3001/api/health");
      if (response.ok) {
        serverReady = true;
        console.log("✅ Temperature server started on port 3001");
        break;
      }
    } catch {
      // Server not ready yet, wait and retry
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  if (!serverReady) {
    console.error("❌ Temperature server failed to start after 15 seconds");
    tempServerProcess.kill("SIGTERM");
    throw new Error("Temperature server failed to start");
  }

  // Store process for teardown
  // eslint-disable-next-line no-undef
  global.__TEMP_SERVER__ = tempServerProcess;
}
