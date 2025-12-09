/**
 * Pre-generation script for ElevenLabs TTS responses
 * Generates MP3 files for common responses to use offline
 *
 * Usage: node scripts/generate-tts-responses.js
 *
 * Requirements:
 * - ELEVENLABS_API_KEY environment variable
 * - ELEVENLABS_VOICE_ID environment variable (or uses Absintha by default)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ELEVENLABS_API_KEY =
  process.env.ELEVENLABS_API_KEY ||
  "sk_6f2db1886a416f1985025b6ef997d9ddf27c1985b228e580";
const ELEVENLABS_VOICE_ID =
  process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB"; // Absintha

// Common responses that should be pre-generated
const COMMON_RESPONSES = [
  // System status
  "I have optimized your system.",
  "Short cycle detected.",
  "Welcome home.",
  "System is running efficiently.",
  "All systems operational.",
  "System status normal.",

  // Temperature responses
  "Temperature set successfully.",
  "Adjusting temperature now.",
  "Temperature updated.",

  // Mode changes
  "Switching to heat mode.",
  "Switching to cool mode.",
  "Switching to auto mode.",
  "System turned off.",
  "System activated.",

  // Preset modes
  "Sleep mode activated.",
  "Away mode activated.",
  "Home mode activated.",

  // Optimizations
  "Optimizing for comfort.",
  "Optimizing for savings.",
  "Settings optimized.",
  "Efficiency improved.",

  // Warnings and alerts
  "Short cycling detected. Adjusting settings.",
  "High energy usage detected.",
  "System efficiency below optimal.",
  "Maintenance recommended.",

  // Confirmations
  "Done.",
  "Complete.",
  "Settings saved.",
  "Changes applied.",
  "Command executed.",

  // Greetings and acknowledgments
  "Hello, how can I help you?",
  "I'm here to help.",
  "What would you like to know?",
  "Sure thing.",
  "Of course.",
  "Absolutely.",

  // Status queries
  "The system is currently running.",
  "The system is currently off.",
  "Everything looks good.",
  "All systems are functioning normally.",

  // Analysis responses
  "Analysis complete.",
  "Calculating your savings potential.",
  "Reviewing your system performance.",
  "Checking your settings.",

  // Error messages
  "I couldn't execute that command.",
  "Please try rephrasing that.",
  "I didn't understand that.",
  "Could you clarify?",

  // Help responses
  "I can help you control your thermostat, check system status, or optimize your settings.",
  "You can ask me about temperature, system mode, efficiency, or savings.",
  "Try asking about your system status or requesting optimizations.",

  // Energy and savings
  "You're saving energy.",
  "Energy usage is optimal.",
  "Potential savings detected.",
  "Your system is efficient.",

  // Comfort
  "Comfort settings applied.",
  "Your home should feel more comfortable now.",
  "Comfort mode activated.",

  // Time-based
  "Good morning.",
  "Good afternoon.",
  "Good evening.",
  "Have a great day.",

  // HVAC specific
  "Heat pump is running.",
  "Auxiliary heat engaged.",
  "Defrost cycle active.",
  "Fan is running.",

  // Settings
  "Your preferences have been saved.",
  "Settings updated successfully.",
  "Configuration saved.",

  // Diagnostic
  "Running diagnostics.",
  "System check complete.",
  "No issues detected.",
  "All parameters within normal range.",

  // Weather related
  "Checking weather forecast.",
  "Weather conditions analyzed.",
  "Forecast updated.",

  // Balance point
  "Balance point calculated.",
  "Your balance point has been determined.",

  // Efficiency
  "Efficiency analysis complete.",
  "Your system efficiency is good.",
  "Efficiency could be improved.",

  // Cost
  "Cost analysis complete.",
  "Your energy costs are optimized.",
  "Potential cost savings identified.",
];

// Output directory for generated audio files
const OUTPUT_DIR = path.join(__dirname, "../public/audio/pre-generated");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate a filename-safe version of the text
 */
function sanitizeFilename(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .substring(0, 100); // Limit length
}

/**
 * Generate audio file for a given text
 */
async function generateAudio(text, voiceId = ELEVENLABS_VOICE_ID) {
  const filename = `${sanitizeFilename(text)}.mp3`;
  const filepath = path.join(OUTPUT_DIR, filename);

  // Skip if file already exists
  if (fs.existsSync(filepath)) {
    console.log(`✓ Already exists: ${filename}`);
    return { text, filename, filepath, cached: true };
  }

  try {
    console.log(`Generating: ${text}...`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_flash_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
          output_format: "mp3_44100_128",
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    fs.writeFileSync(filepath, Buffer.from(audioBuffer));

    console.log(`✓ Generated: ${filename}`);
    return { text, filename, filepath, cached: false };
  } catch (error) {
    console.error(`✗ Failed: ${text}`, error.message);
    return { text, filename: null, filepath: null, error: error.message };
  }
}

/**
 * Generate mapping file that maps text patterns to audio files
 */
function generateMapping(responses) {
  const mapping = {};

  responses.forEach(({ text, filename }) => {
    if (filename) {
      // Create multiple mapping patterns for flexibility
      const normalized = text.toLowerCase().trim();
      mapping[normalized] = filename;

      // Also map without punctuation
      const noPunct = normalized.replace(/[.,!?]/g, "");
      if (noPunct !== normalized) {
        mapping[noPunct] = filename;
      }
    }
  });

  const mappingPath = path.join(OUTPUT_DIR, "mapping.json");
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  console.log(`\n✓ Mapping file generated: ${mappingPath}`);

  return mapping;
}

/**
 * Main execution
 */
async function main() {
  console.log("🎙️  Generating pre-recorded TTS responses...\n");
  console.log(`Voice ID: ${ELEVENLABS_VOICE_ID}`);
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  const results = [];

  // Generate all responses (with rate limiting to avoid API throttling)
  for (let i = 0; i < COMMON_RESPONSES.length; i++) {
    const text = COMMON_RESPONSES[i];
    const result = await generateAudio(text);
    results.push(result);

    // Rate limiting: wait 100ms between requests
    if (i < COMMON_RESPONSES.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Generate summary
  const successful = results.filter((r) => r.filename).length;
  const cached = results.filter((r) => r.cached).length;
  const failed = results.filter((r) => r.error).length;

  console.log(`\n📊 Summary:`);
  console.log(`  Total: ${COMMON_RESPONSES.length}`);
  console.log(`  Generated: ${successful - cached}`);
  console.log(`  Cached: ${cached}`);
  console.log(`  Failed: ${failed}`);

  // Generate mapping file
  if (successful > 0) {
    generateMapping(results.filter((r) => r.filename));
  }

  console.log(`\n✅ Complete! Audio files saved to: ${OUTPUT_DIR}`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { COMMON_RESPONSES, generateAudio, generateMapping };
