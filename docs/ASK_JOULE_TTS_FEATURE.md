# Ask Joule Text-to-Speech Feature

## Overview

Ask Joule now includes text-to-speech (TTS) capabilities using the browser's built-in Web Speech API. This allows Ask Joule to speak its responses aloud, making the assistant more accessible and hands-free.

## Features

### Voice Toggle

- **Speaker Icon**: A speaker button appears next to the Commands and History buttons in Ask Joule
- **Visual Feedback**:
  - Volume icon (🔊) when enabled
  - Muted icon (🔇) when disabled
  - Animated green dot when actively speaking
- **Persistent State**: Your voice preference is saved in localStorage

### Automatic Speech

- When enabled, Ask Joule automatically reads all responses aloud
- Responses include:
  - Success messages (e.g., "Winter thermostat set to 68 degrees Fahrenheit")
  - Error messages
  - Information and what-if scenarios
  - Educational content
  - LLM fallback responses

### Text Cleaning

The TTS system intelligently cleans text for better speech output:

- Removes emojis (✓, 💡, etc.)
- Converts `$100` to "100 dollars"
- Converts `°F` to "degrees Fahrenheit"
- Spells out acronyms: HSPF → "H S P F", SEER → "S E E R"
- Converts technical units for clarity

### Browser Compatibility

- Uses the Web Speech API (supported in Chrome, Edge, Safari, and most modern browsers)
- Gracefully degrades if TTS is not supported (button won't appear)
- No external API keys or services required
- Works offline

## Implementation Details

### Custom Hook: `useSpeechSynthesis`

Located at `src/hooks/useSpeechSynthesis.js`, this hook provides:

- `speak(text, options)` - Speak text with optional rate/pitch/volume
- `stop()` - Cancel ongoing speech
- `pause()` / `resume()` - Pause and resume speech
- `toggleEnabled()` - Toggle TTS on/off
- `isEnabled`, `isSpeaking`, `isSupported` - State flags
- `availableVoices` - List of browser voices
- `changeVoice(name)` - Select a different voice

### Integration in AskJoule

The component automatically:

- Stops speech when a new command starts
- Speaks responses when TTS is enabled
- Provides visual feedback (animated dot) when speaking
- Saves user preference in localStorage

### Settings Page

A dedicated section in Settings explains:

- How to enable/disable voice
- That it uses the browser's built-in TTS (no external APIs)
- Privacy: all processing is local

## User Experience

### Enabling Voice

1. Open Ask Joule (FAB or on Home/Forecast pages)
2. Click the speaker icon (bottom left, next to Commands/History)
3. Icon changes to indicate enabled state
4. Ask a question - response will be spoken automatically

### Privacy & Performance

- **100% Local**: All TTS processing happens in the browser
- **No Network Calls**: No data sent to external services
- **Lightweight**: Uses native browser APIs, no additional dependencies
- **Accessible**: Improves accessibility for visually impaired users

## Testing

### Unit Tests

- `src/hooks/__tests__/useSpeechSynthesis.test.js` - Tests hook functionality
- Mocks Web Speech API for consistent test results
- Validates text cleaning, state management, and voice controls

### E2E Tests

- `e2e/ask-joule-fab.spec.ts` - Tests TTS toggle in Ask Joule modal
- Validates localStorage persistence
- Tests toggle on/off functionality

## Future Enhancements

Potential improvements for future versions:

- Voice selection UI in Settings
- Speech rate/pitch/volume controls
- Speak on command (button press) vs automatic
- Highlight text as it's being spoken
- Keyboard shortcuts for TTS controls
- Support for reading longer content (chunking)

## Technical Notes

### Text Cleaning Regex

The hook uses carefully crafted regex patterns to clean text:

- Unicode flag (`/u`) for proper emoji handling
- Separate handling for variation selectors (e.g., ℹ️)
- Case-insensitive replacements for acronyms
- Dollar/currency formatting

### Event Handling

The hook properly manages speech synthesis events:

- `onstart` - Updates `isSpeaking` state
- `onend` - Cleans up state and references
- `onerror` - Logs errors gracefully
- Cleanup on component unmount to prevent memory leaks

### Browser Quirks

- Voice loading may be asynchronous (handled via `onvoiceschanged`)
- Some browsers require user interaction before TTS works
- Default voice selection prefers English, female voices for clarity
