# Voice Features - Speech-to-Text & Text-to-Speech

## Overview

Ask Joule now supports full voice interaction: speak your questions and hear the responses.

## Speech-to-Text (STT) - NEW!

### How It Works

1. Click the **microphone button** (🎤) next to the Ask button
2. The button turns red and pulses while listening
3. **Speak your question** - your words appear in the input box in real-time
4. Click the microphone again to stop, or it stops automatically when you finish speaking
5. Click **Ask** to get your answer

### Browser Support

- ✅ Chrome/Edge: Full support
- ✅ Safari: Full support (macOS/iOS)
- ❌ Firefox: Limited support

### Tips

- Speak clearly and at normal pace
- Works best in quiet environments
- You'll see interim results as you speak
- Final transcript appears when you stop

## Text-to-Speech (TTS)

### How It Works

1. Click the **speaker button** (🔊) to enable voice responses
2. Ask your question (typed or spoken)
3. Joule reads the answer aloud automatically
4. Click speaker button again to disable

### Controls

- **Volume button with pulse**: Currently speaking - click to stop
- **Active speaker icon**: Voice enabled
- **Muted speaker icon**: Voice disabled

## AI Mode vs Traditional Mode

### AI Mode (Voice-First Interface)

- Access via **Sparkles button** (✨) in top-right corner
- Full-screen, minimalist design
- Time-of-day animated backgrounds (dawn, day, dusk, night)
- Weather animations (rain, snow) - decorative for now
- Ask Joule front and center
- Quick stats at a glance
- Direct navigation to detailed tools

### Traditional Mode (Dashboard & Tools)

- Access via **Grid button** (⊞) in top-right corner
- Full dashboard with all calculators
- Detailed analysis tools
- Charts and graphs
- Data export features
- Ask Joule available as floating button (bottom-right)

### Switching Modes

- Click the mode toggle in top-right corner
- Your preference saves between sessions
- Navigating from AI Mode to a tool automatically switches to Traditional Mode

## Complete Voice Workflow

1. **Switch to AI Mode**: Click Sparkles (✨) button
2. **Enable voice output**: Click speaker button (🔊)
3. **Start listening**: Click microphone button (🎤)
4. **Speak**: "What can I save with better insulation?"
5. **Your words appear** in the input box as you speak
6. **Click Ask**: Or press Enter
7. **Joule responds** with voice and text
8. **Navigate**: Click suggested tools to dive deeper

## Privacy & Offline

- **STT**: Uses browser's built-in speech recognition (no data sent to servers)
- **TTS**: Uses browser's built-in speech synthesis (completely offline)
- **No external services**: Works without internet for voice features
- **Groq LLM**: Optional, only if you provide your own API key for advanced queries

## Troubleshooting

### Microphone Not Working

- Check browser permissions for microphone access
- Ensure microphone is connected and working
- Try Chrome or Edge for best compatibility
- Reload the page if recognition stops working

### Voice Output Not Working

- Check system volume is not muted
- Verify browser has permission to play audio
- Try selecting a different voice in Settings (coming soon)
- Some browsers require user interaction before playing audio

### Words Not Showing in Input

- Ensure microphone button is active (red/pulsing)
- Check browser console for errors
- Try speaking more clearly or closer to microphone
- Grant microphone permissions if prompted

## Future Enhancements

- [ ] Voice selection in Settings
- [ ] Speech rate/pitch controls
- [ ] Real-time weather API integration for AI Mode backgrounds
- [ ] Voice commands to navigate between modes
- [ ] Continuous listening mode
- [ ] Wake word detection ("Hey Joule")
- [ ] Multi-turn conversation memory
