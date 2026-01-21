// Minimal Groq fallback test harness (avoid committing secrets)
// Usage:
//   node scripts/testGroqFallback.mjs --key YOUR_GROQ_KEY \
//        --prompt "Give a one sentence heat pump efficiency tip"
// Or set env var VITE_GROQ_API_KEY and omit --key.

import { askJouleFallback } from "../src/lib/groqAgent.js";

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const key = getArg("--key") || process.env.VITE_GROQ_API_KEY || "";
const prompt =
  getArg("--prompt") ||
  "Provide a concise energy savings tip for a residential heat pump.";

if (!key) {
  console.error(
    "No API key supplied. Pass --key <key> or set VITE_GROQ_API_KEY."
  );
  process.exit(1);
}

console.log("Testing Groq fallback with prompt:\n", prompt, "\n");

(async () => {
  try {
    const result = await askJouleFallback(prompt, key);
    if (result?.error) {
      console.error("\nGroq error:", result.message);
      if (result.needsSetup) console.error("Action: Set up API key");
      process.exitCode = 2;
    } else if (result?.success) {
      console.log("\nGroq response:\n", result.message);
    } else {
      console.log("\nGroq response:\n", result);
    }
  } catch (err) {
    console.error("Groq test failed:", err?.message || err);
    process.exitCode = 2;
  }
})();
