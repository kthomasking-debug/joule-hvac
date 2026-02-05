# Joule HVAC

A React + Vite web app for smart thermostat control, energy forecasting, and HomeKit integration.

## Using Joule

### End Users

Just visit one of these - no setup required:

- **From anywhere (Internet)**: https://joule.netlify.app
- **On your home WiFi (if Pi installed)**: http://192.168.0.103:8080

That's it. See [User Manual](docs/USER_MANUAL.md) for setup and pairing.

### Developers

For local development, see [Local Dev Server](docs/SERVER_SETUP.md).

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Raspberry Pi Zero 2W                        │
│                      (192.168.0.103)                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  prostat-bridge (port 8080)                              │   │
│  │  - HomeKit thermostat control                            │   │
│  │  - REST API for web app                                  │   │
│  │  - Ecobee pairing via HomeKit                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  pi-hmi (e-paper HAT display)                            │   │
│  │  - Touch screen interface                                │   │
│  │  - Status display, QR code for setup                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ HTTP API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Web App (joule.netlify.app or localhost:5173)                  │
│  - Energy forecasting & budgeting                               │
│  - Ask Joule natural language interface                         │
│  - Thermostat control via bridge                                │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Links

| Document | Audience | Purpose |
|----------|----------|---------|
| [User Manual](docs/USER_MANUAL.md) | End Users | Setup, pairing, voice commands |
| [Admin Manual](docs/ADMIN_MANUAL.md) | Support Staff | Remote support, Tailscale |
| [Bridge Installation](docs/BRIDGE-INSTALLATION-GUIDE.md) | Developers | Technical setup |
| [Relay Setup](docs/relay-setup.md) | Installers | Safety & wiring |
| [Pi HMI Guide](pi-hmi/README.md) | Developers | E-paper display setup |

## Development & Running the App

### Quick Start (Standalone Server)

The app runs on a **standalone Node.js server** that works independently of any IDE:

```bash
# Build the production app
npm run build

# Start the server (keeps running even after closing terminal/IDE)
node server.js
```

Then open:
- **Local**: `http://localhost:5173`
- **Network**: `http://192.168.0.108:5173` (access from phone/tablet on same WiFi)

For more details, see [docs/SERVER_SETUP.md](docs/SERVER_SETUP.md).

### Development Workflow

```bash
npm install        # Install dependencies
npm run build      # Production build (required for server.js)
node server.js     # Run the standalone server

# For rapid development with auto-rebuild:
npm run build -- --watch  # In one terminal
node server.js            # In another terminal
```

### Testing

```bash
npm test           # Run tests with Vitest
```

## Pi Services

The Raspberry Pi runs two systemd services:

| Service | Port | Purpose | Start/Stop |
|---------|------|---------|------------|
| `prostat-bridge` | 8080 | HomeKit bridge & API | `sudo systemctl start prostat-bridge` |
| `pi-hmi` | - | E-paper touch display | `sudo systemctl start pi-hmi` |

**Check status:**
```bash
ssh pi@192.168.0.103 "systemctl status prostat-bridge pi-hmi"
```

**Health check:**
```bash
curl http://192.168.0.103:8080/health
```

## Connecting the Web App

1. Go to **Settings → Joule Bridge Settings**
2. Enter bridge URL: `http://192.168.0.103:8080`
3. Click **Save** and verify connection

Or set `VITE_JOULE_BRIDGE_URL=http://192.168.0.103:8080` in `.env`.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| E-paper not responding to touch | `sudo systemctl restart pi-hmi` |
| Bridge not connecting | `sudo systemctl restart prostat-bridge` |
| Web app can't reach bridge | Check Pi IP, ensure on same network |
| Ecobee unpaired | Re-pair via Settings → Bridge → Discover |

For detailed troubleshooting, see `prostat-bridge/README.md`.

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
