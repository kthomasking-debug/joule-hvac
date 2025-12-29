# Engineering Tools

This workspace contains a React + Vite app and supporting scripts for HVAC/energy tools, including optional hardware integration for development.

- **User Manual**: See `docs/USER_MANUAL.md` for complete end-user setup guide (includes setup, pairing, troubleshooting, and voice commands)
- **Admin Manual**: See `docs/ADMIN_MANUAL.md` for support staff and administrators (remote support, troubleshooting, Tailscale setup)
- **Technical Installation**: See `docs/BRIDGE-INSTALLATION-GUIDE.md` for developers/advanced users
- **Relay Setup & Safety**: See `docs/relay-setup.md`

## Development

- Start app: `npm run dev`
- Run tests: `npm test`
- Build: `npm run build`

## Joule Bridge (HomeKit Integration)

The Joule Bridge enables local-only thermostat control via HomeKit. The bridge server runs on **port 8080** by default.

### Quick Start

1. **Install Dependencies:**
   ```bash
   cd prostat-bridge
   pip3 install -r requirements.txt
   # Or use virtual environment:
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Start the Bridge:**
   ```bash
   cd prostat-bridge
   source venv/bin/activate  # if using venv
   python3 server.py
   ```

3. **Pair Your Ecobee:**
   - Enable HomeKit pairing on your Ecobee (Menu → Settings → Installation Settings → HomeKit)
   - Use the web app's Settings page → Joule Bridge Settings → Discover → Pair
   - Or use the API (see `prostat-bridge/README.md`)

### Documentation

- **Complete Setup Guide**: See `prostat-bridge/README.md` for detailed installation, pairing, and troubleshooting
- **API Documentation**: See `prostat-bridge/README.md` for all API endpoints
- **Bridge URL**: Must be configured explicitly (e.g., `http://192.168.0.106:8080`)
- **Health Check**: `curl http://YOUR_BRIDGE_IP:8080/health`

### Configuration

**⚠️ Important:** The web app requires an explicit bridge URL configuration. It will **never** use localhost as a fallback.

1. **Find your bridge IP address** (e.g., `192.168.0.106`)
2. **Configure in Settings**: Go to Settings → Joule Bridge Settings → Enter bridge URL (e.g., `http://192.168.0.106:8080`)
3. **Click Save** and verify connection status

Alternatively, set the `VITE_JOULE_BRIDGE_URL` environment variable during build.

### Troubleshooting

If you encounter pairing issues, connection problems, or the device becomes unpaired after restart, see the comprehensive troubleshooting section in `prostat-bridge/README.md`.

## Building for Android on Windows

If you're on Windows and want to build the Android debug APK locally, see `BUILD_ANDROID_WINDOWS.md` for recommended setup steps and trouble-shooting. It includes instructions for installing a JDK, setting the `JAVA_HOME` environment variable, cleaning stale Gradle build artifacts, and assembling a debug APK.

Automation: There's also a convenience PowerShell script at `scripts/build-android.ps1`. It automates the steps in `BUILD_ANDROID_WINDOWS.md` and optionally installs the debug APK to a connected device with `adb`.

## Energy Budget & Forecast Tools

The app includes comprehensive energy budget and forecast tools:

- **Weekly Cost Estimate**: 7-day cost forecast using typical-year hourly temperatures (TMY) derived from monthly HDD/CDD distributions. Both heat pump and auxiliary heat are computed hourly using `computeHourlyPerformance()` for accurate part-load behavior modeling.

- **Annual Cost Estimate**: Annual budget using typical-year (TMY) mode. Monthly HDD/CDD values are converted to hourly temperatures, which are then processed through `computeHourlyPerformance()` to get accurate monthly totals. This hybrid approach combines HDD/CDD (monthly aggregates) with hourly equipment modeling.

- **Key Features**:
  - **Mode: Typical Year (Budget)**: Uses typical-year hourly temperatures (TMY) derived from monthly HDD/CDD distributions, suitable for annual budget planning
  - **Accurate Equipment Modeling**: Uses `computeHourlyPerformance()` to model actual heat pump behavior (capacity factor, COP, defrost penalty) at each hour
  - **High Precision Calculations**: Monthly HDD/CDD values are kept at high precision internally, rounded only for display to prevent rounding drift
  - **Cooling Model**: Simplified CDD energy estimator (not a real equipment model) - appropriate for long-term planning but does not model actual equipment behavior

## Ask Joule (natural‑language concierge)

Ask Joule lets you describe your home and preferences in plain English. It parses your prompt locally and updates the forecaster with the same deterministic engine used by manual inputs. You'll also see a quick Answer card summarizing expected weekly cost and estimated annual savings with a CTA to open the full dashboard.

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
