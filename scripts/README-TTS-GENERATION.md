# Pre-Generated TTS Audio Files

This directory contains scripts and tools for generating pre-recorded TTS responses using ElevenLabs.

## Overview

The "ProStat" strategy uses pre-generated audio files for common responses to provide:

- **Offline playback** - No API calls needed
- **Instant response** - No network latency
- **Zero API costs** - Pre-generated once, used forever
- **Premium quality** - ElevenLabs voice actor performance

## Usage

### Generate Audio Files

```bash
# Set your ElevenLabs API key (optional, uses default if not set)
export ELEVENLABS_API_KEY="your-api-key-here"
export ELEVENLABS_VOICE_ID="your-voice-id-here"  # Optional, defaults to Absintha

# Run the generation script
node scripts/generate-tts-responses.js
```

### Output

The script will:

1. Generate MP3 files for all common responses
2. Save them to `public/audio/pre-generated/`
3. Create a `mapping.json` file that maps text to audio filenames
4. Skip files that already exist (safe to re-run)

### Fallback Chain

The TTS system uses this priority order:

1. **Pre-generated audio** (if text matches exactly)

   - Instant, offline, no API costs
   - Used for common responses like "Welcome home", "System optimized", etc.

2. **Browser TTS** (if text contains dynamic content)

   - Used for responses with numbers: "The temperature is 72 degrees"
   - No API costs, handles variables well

3. **ElevenLabs API** (for non-dynamic content without pre-generated audio)

   - High quality, but uses API credits
   - Used for uncommon responses

4. **Browser TTS** (fallback if ElevenLabs fails)
   - Always available as last resort

## Adding New Responses

Edit `scripts/generate-tts-responses.js` and add new responses to the `COMMON_RESPONSES` array:

```javascript
const COMMON_RESPONSES = [
  // ... existing responses
  "Your new response here.",
];
```

Then re-run the generation script.

## File Structure

```
public/
  audio/
    pre-generated/
      mapping.json              # Maps text to audio filenames
      welcome-home.mp3          # Pre-generated audio files
      system-optimized.mp3
      ...
```

## Benefits

- **90% of interactions** use pre-generated files (no API costs)
- **Dynamic content** (numbers, temps) uses Browser TTS (no API costs)
- **Only uncommon responses** use ElevenLabs API
- **Result**: Premium voice experience with minimal API usage
