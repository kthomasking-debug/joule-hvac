# Engineering Tools

This workspace contains a React + Vite app and supporting scripts for HVAC/energy tools, including optional hardware integration for development.

- User Manual: see `docs/THERMOSTAT_USER_MANUAL.md` for setup, hardware options (BlinkStick, USB‑Serial LED, Arduino), and the Short‑Cycle Test.
- Relay Setup & Safety: see `docs/relay-setup.md`.

## Development

- Start app: `npm run dev`
- Run tests: `npm test`
- Build: `npm run build`

## Building for Android on Windows

If you're on Windows and want to build the Android debug APK locally, see `BUILD_ANDROID_WINDOWS.md` for recommended setup steps and trouble-shooting. It includes instructions for installing a JDK, setting the `JAVA_HOME` environment variable, cleaning stale Gradle build artifacts, and assembling a debug APK.

Automation: There's also a convenience PowerShell script at `scripts/build-android.ps1`. It automates the steps in `BUILD_ANDROID_WINDOWS.md` and optionally installs the debug APK to a connected device with `adb`.

## Ask Joule (natural‑language concierge)

Ask Joule lets you describe your home and preferences in plain English. It parses your prompt locally and updates the forecaster with the same deterministic engine used by manual inputs. You’ll also see a quick Answer card summarizing expected weekly cost and estimated annual savings with a CTA to open the full dashboard.

### Where to find it

On the Seven‑Day Cost Forecaster screen, Ask Joule appears above the main content as a single input field with examples.

### What it understands

Ask Joule extracts these fields when present:

- City and state (e.g., "Austin, TX", "in Denver, CO")
- Home size in square feet, including k‑suffix (e.g., "1,800 sq ft", "1.8k sqft")
- Insulation level keywords: poor, average, good, well‑insulated
- Indoor temperature setpoint in °F (e.g., "keep it at 70")
- Primary system: gas furnace or heat pump
- Energy mode: gas or electric

All parsing is done on‑device; no additional network calls are made beyond the normal forecast APIs.

### Example prompts

- "Austin, 1.8k sq ft, average insulation, keep it at 70, heat pump on electricity"
- "In Denver, CO, 2000 sqft, good insulation, 68F, gas furnace"
- "Brooklyn 1200 sq ft poor insulation 72 degrees electric"

If a field can’t be parsed, Ask Joule leaves your current setting unchanged so you can refine the prompt or adjust manually.

### Notes

- The Answer card is a quick summary; choose "Open Dashboard" to explore full charts and controls.
- You can reset or fine‑tune values at any time via the regular controls.
- Feature is covered by unit tests for common phrasing patterns and edge cases to ensure long‑term stability.

## Security and API keys

- Environment variables: Create a `.env` (use `.env.example` as a template). `.env` is ignored by git.
- Vite exposes variables prefixed with `VITE_` to the client at build time. Treat any `VITE_*` values as public.
  - Use `VITE_EIA_API_KEY` and `VITE_NREL_API_KEY` for public/rate-limited APIs only.
  - Do NOT put private keys (e.g., DeepSeek/OpenAI) in the client; route those calls through a server or serverless function that reads secrets from server-side env.
  - Optional: To enable the Ask Joule LLM fallback via Groq, you can set `VITE_GROQ_API_KEY` in your local `.env` or use the Settings page in the app to store a key in `localStorage` (under `groqApiKey`). If you store a key in Settings, it will override `VITE_GROQ_API_KEY` for the current device.
- If a key is accidentally shared, revoke/rotate it immediately in the provider dashboard.
