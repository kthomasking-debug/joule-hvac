# Quick Start: Your Talking Thermostat

## 🎙️ Try It Now

### 1. Access AI Mode

Navigate to your app and click **"AI Mode"** from the main menu.

You'll see:

- Large time display (updates every minute)
- Time-of-day gradient background (changes throughout the day)
- Floating particles (white during day, energy-colored during heating/cooling)
- ⭐ Twinkling stars (8pm-6am only)

### 2. Voice Commands

Click the **microphone button** (🎤) and say:

#### Temperature Control

```
"Make it warmer"           → Increases by 2°F
"Make it cooler by 3"      → Decreases by 3°F
"Turn up the heat by 5"    → Increases by 5°F
"Set winter to 72"         → Sets to exact temp
```

#### Preset Modes

```
"I'm going to sleep"       → Sets to 65°F (sleep mode)
"I'm leaving"              → Sets to 60°F (away mode)
"I'm home"                 → Sets to 70°F (home mode)
```

#### Information

```
"What's the temperature"   → Shows current setting
"How cold is it"           → Same as above
"What can I save"          → Shows recommendations
"My Joule score"           → Shows efficiency score
```

### 3. Watch for Visual Feedback

**While Listening** (microphone active):

- Input field glows **blue**
- Waveform animation at bottom of input
- Microphone button pulses
- 3-bar audio indicator

**When Joule Speaks** (TTS enabled):

- Speaker icon shows
- 3-bar equalizer animates
- Success ✓ or error ✗ indicator

**HVAC Mode Indicators**:

- **Heating**: Orange particle glow + orange overlay pulse
- **Cooling**: Blue particle glow + blue overlay pulse
- **Idle**: White particles

### 4. Personality Examples

**Command**: "Make it warmer"  
**Joule**: "You got it! Setting temperature to 70°F."

**Command**: "I'm going to sleep"  
**Joule**: "Good night! Setting sleep temperature to 65°F. Sweet dreams!"

**Command**: "Set winter to 85"  
**Joule**: "Whoa, that's toasty! Your energy bill might not like this, but you'll be warm!"

**Command**: "What's the temperature" (at 3am)  
**Joule**: "Current temperature setting is 68°F."

### 5. Time-of-Day Experience

**Night (10pm-5am)**:

- Deep indigo/purple/blue gradient
- 100 twinkling stars
- Moonlit aesthetic

**Dawn (5am-7am)**:

- Orange/pink/purple sunrise gradient
- Stars fade out
- Morning energy particles

**Day (7am-5pm)**:

- Bright blue/cyan sky gradient
- Active particle movement
- Solar aesthetic

**Dusk/Evening (5pm-10pm)**:

- Orange/purple sunset gradient
- Stars begin appearing
- Warm twilight colors

---

## 🛠️ Settings

### Enable Voice Features

1. Click **microphone button** to start speech recognition (Chrome/Edge required)
2. Click **speaker button** to toggle text-to-speech
3. Voice responses happen automatically when TTS is enabled

### Groq LLM (Optional)

For complex questions Joule can't parse:

1. Go to **Settings**
2. Add your **Groq API key**
3. Select **model** (llama-3.3-70b-versatile recommended)
4. Joule will offer to send unrecognized queries to Groq

---

## 🧪 Test Commands

Try these to see all features:

```bash
# Basic thermostat control
"Set winter to 68"
"Make it warmer"
"Turn down by 3"

# Presets
"Sleep mode"
"I'm leaving"
"I'm home"

# Information
"What's the temperature"
"What can I save"
"My Joule score"
"Explain HSPF"

# Navigation
"Show me Denver forecast"
"Run analyzer"
"Compare systems"

# Advanced
"What if HSPF was 10"
"Break even on $8000"
"Why is my bill high"
```

---

## 🎨 Visual Experience Timeline

### Morning Sequence (6am-12pm)

1. **6:00am**: Orange sunrise gradient fades in
2. Stars disappear
3. Particles turn white/neutral
4. Gradient shifts to bright blue sky
5. **Check**: Say "I'm home" to test morning greeting

### Afternoon (12pm-5pm)

1. Bright sky-blue gradient
2. Active white particles floating
3. Clear visibility
4. **Check**: Temperature display shows briefly, then fades

### Evening Sequence (5pm-10pm)

1. **5:00pm**: Sunset orange/purple gradient begins
2. Particles start glowing warmer
3. **7:00pm**: First stars appear
4. Dusk deepens to purple/indigo
5. **Check**: Say "I'm going to sleep" to activate sleep mode

### Night (10pm-6am)

1. **10:00pm**: Deep night gradient (indigo/purple/blue)
2. 100 stars fully visible, twinkling
3. If heating: Warm orange particle glow
4. Peaceful, dark aesthetic
5. **Check**: Temperature shows with night-aware greeting

---

## 🚀 Pro Tips

1. **Hands-Free**: Enable both mic and speaker, then operate entirely by voice
2. **Quick Presets**: Use "sleep mode" / "away mode" / "home mode" for instant settings
3. **Natural Language**: Don't overthink it - speak naturally like you're talking to a person
4. **Visual Cues**: Watch particles change color to know if heating/cooling is active
5. **Time Awareness**: Joule greets you differently based on time of day
6. **Contextual Help**: Click "Commands" button to see all available commands
7. **History**: Click "History" to see audit log and undo changes

---

## 📱 Future: Hardware Mode

When you connect this to physical hardware (Raspberry Pi + Arduino + relays):

**Same commands will work**:

- "Make it warmer" → Arduino relay activates furnace
- "I'm leaving" → Physical thermostat drops to 60°F
- Visual feedback → Shows actual room temperature sensor reading

**Already implemented**:
✅ Voice command parsing
✅ Preset modes (sleep/away/home)
✅ Personality responses
✅ Visual HVAC indicators

**What you'll add**:

- Temperature sensor (BME280)
- Arduino with relay board
- Raspberry Pi touchscreen
- Power supply from HVAC C-wire

**No code changes needed** - just wire up the hardware!

---

## 🎬 Demo Script

Want to show someone? Try this sequence:

1. **Open AI Mode** - "See this? It's a talking thermostat."

2. **Show time-of-day** - "Watch how it changes throughout the day" (scroll time forward if needed)

3. **Voice command** - Click mic: "Make it warmer"

   - Watch blue glow, waveform, particle animation
   - Hear Joule respond: "You got it! Setting temperature to 70°F."

4. **Preset mode** - Click mic: "I'm going to sleep"

   - Watch particles shift (if heating was active)
   - Hear: "Good night! Setting sleep temperature to 65°F. Sweet dreams!"

5. **Query** - Click mic: "What's the temperature"

   - No changes made
   - Hear current setting spoken aloud

6. **Show traditional mode** - Click any calculator link
   - Show that all original features still work
   - AI Mode is an addition, not a replacement

---

Enjoy your Back to the Future-inspired talking thermostat! 🏠🔊
