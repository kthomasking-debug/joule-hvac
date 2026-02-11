# Joule Product Tiers

## Overview

Joule offers three product tiers to meet different needs and budgets, from basic analysis to complete home automation control.

## Quick Start Workflow (Bridge Users)

1. **Plug in the Bridge** — Power up your Joule Bridge on your home network
2. **Connect** — Go to the IP address shown on the bridge screen (type it in or scan the QR code from the onboarding flow)
3. **Complete onboarding** — Enter your location, building details, and cost settings; furnace and AC sizes are auto-calculated from your home specs (you can still adjust them)
4. **Mission Control** — Go to Mission Control and select Cost Simulator
5. **Upload your bill** — Paste or upload your utility bill
6. **Ask Joule** — Ask about your bill; Joule compares your rates to your area's average and suggests gas vs. electric only when savings are meaningful

**AI** — Built-in and automatic. No setup required.

---

## 🆓 Free: CSV Analyzer

**Price:** Free  
**Target:** DIY homeowners, energy enthusiasts, one-time analysis

### What You Get

- **Manual CSV Upload Analysis**
  - Upload your thermostat CSV export files
  - Calculate heat loss factor (BTU/hr/°F)
  - Determine system balance point
  - Compare your home's efficiency to others
  - View detailed analysis results
- **Smart Onboarding** — Enter location and building details; furnace and AC sizes are auto-calculated from your home specs (you can still adjust)

### Features

- ✅ Heat loss calculation from coast-down data
- ✅ System balance point analysis
- ✅ Efficiency percentile ranking
- ✅ Building geometry analysis
- ✅ Recommendations based on results
- ✅ Export results to CSV
- ✅ **Ask Joule** — Built-in AI. Works automatically. No setup required.
- ✅ **Bill analysis** — Upload your bill; Ask Joule compares your electricity and gas rates to your area's average and suggests gas vs. heat pump only when savings are meaningful
- ✅ Manual analysis only (requires file upload each time)

### Limitations

- Manual file upload required for each analysis
- No automatic monitoring
- No hardware control
- No real-time data collection

### Best For

- Homeowners doing one-time efficiency audits
- DIY energy analysis
- Understanding your home's thermal performance
- Before/after upgrade comparisons

---

## 💰 Paid: Joule Monitor ($20/year)

**Price:** $20/year subscription  
**Target:** Homeowners who want automatic monitoring without hardware

### What You Get

Everything in **Free**, plus:

- **Automatic Daily Analysis**
  - Connects to your Ecobee thermostat automatically
  - Runs analysis every day without manual uploads
  - Tracks efficiency trends over time
  - Historical data storage and comparison
  - Email reports (optional)

### Features

- ✅ All Free tier features
- ✅ Automatic daily data collection from Ecobee
- ✅ Daily heat loss analysis
- ✅ Trend tracking and historical comparisons
- ✅ Efficiency score over time
- ✅ Alert notifications for efficiency changes
- ✅ No hardware required (cloud-based)

### Limitations

- Requires Ecobee thermostat with API access
- No hardware control (read-only)
- Cloud-dependent (requires internet)
- Annual subscription required (covers ongoing server costs for daily data polling)

### Best For

- Homeowners with Ecobee thermostats
- Those who want ongoing efficiency monitoring
- Tracking efficiency improvements over time
- No hardware installation needed

---

## 🏆 Premium: Joule Bridge ($129)

**Price:** $129 one-time purchase  
**Target:** Homeowners who want complete control and sovereignty

### What You Get

Everything in **Joule Monitor**, plus:

- **Raspberry Pi Zero Hardware**
  - Pre-configured and ready to use
  - Local HomeKit integration
  - Direct thermostat control
  - Always-on monitoring

- **Complete Home Automation**
  - Control thermostat locally (no cloud required)
  - Dehumidifier relay control
  - Air purifier integration (Blueair)
  - Interlock logic for system coordination
  - Voice control with wake word detection
  - Local LLM (no API keys needed)

### Features

- ✅ All Monitor tier features
- ✅ Raspberry Pi Zero 2W hardware included
- ✅ Local HomeKit bridge (no cloud dependency)
- ✅ Direct thermostat control via HAP protocol
- ✅ Relay control for dehumidifier
- ✅ Blueair air purifier integration
- ✅ Building Management System (BMS) logic
- ✅ Wake word detection ("Hey Joule")
- ✅ Local LLM (Ollama) - no API keys
- ✅ Works offline (no internet required)
- ✅ Complete data sovereignty

### Hardware Included

- Raspberry Pi Zero 2W
- Pre-configured SD card with software
- USB power adapter
- USB-C cable
- Quick start guide

**Note:** The Bridge is sold as hardware-only. We do not sell tablets or complete display kits. If you want a wall-mounted display, we recommend purchasing an Amazon Fire HD 8 tablet separately and using our 3D-printed mount design (available in our documentation). This keeps costs low and avoids shipping complications with batteries and glass screens.

### Limitations

- Requires basic technical setup (plug in, go to IP or scan QR, connect to WiFi)
- Physical hardware installation
- Local network access required for control

### Best For

- Homeowners who want complete control
- Privacy-conscious users (no cloud dependency)
- Those wanting offline operation
- DIY smart home enthusiasts
- Multiple device coordination (thermostat + dehumidifier + air purifier)

---

## How Ask Joule Works

Ask Joule is built in and works automatically.

By default, Joule connects to the shared Joule AI server and is ready to use immediately. No accounts or API keys are required.

If you have a gaming PC or Mac, you can optionally run AI locally for faster responses and offline use.

For maximum reliability, you can also enable a free cloud backup using a Groq API key. This takes about 30 seconds to set up and ensures AI continues working if other options are unavailable.

Most users never need to change anything.

---

## How Joule Runs: Pi + Optional Gaming Rig

Joule uses a **split architecture** that lets you choose where the AI runs:

### Raspberry Pi (24/7)
- **Runs the app:** Forecasts, cost estimates, thermostat control, HMI, bill comparison
- **Always on:** Low power, perfect for dashboards and control
- **Pi Zero 2W** (Bridge tier) or **Pi 5** (wall display) — the app lives here

### Gaming PC (When On)
- **Optional local LLM:** When your gaming rig is on, Joule uses your GPU for Ask Joule, bill auditor, and voice — no cloud, no API costs
- **Primary when local is off:** If your local AI computer is off, Joule continues using the shared Joule AI server. An optional cloud backup can be enabled in Advanced settings.

#### Local LLM System Requirements (Video-Game Style)

| | Minimum | Recommended |
|---|---------|-------------|
| **OS** | Windows 10 (build 1909+) / Linux | Windows 11 / Linux |
| **Processor** | Intel Core i5-8400 / AMD Ryzen 5 2600 | Intel Core i5-12400 / AMD Ryzen 5 5600 |
| **Memory** | 8 GB RAM | 16 GB RAM |
| **Video Card** | NVIDIA GeForce GTX 1650 (4 GB VRAM) / AMD Radeon RX 6400 (4 GB VRAM) | NVIDIA GeForce RTX 3060 (8 GB VRAM) / AMD Radeon RX 6600 XT (8 GB VRAM) |
| **Storage** | 8 GB free (for Ollama + model) | 16 GB SSD recommended |
| **Notes** | Llama 3 8B Q4 (GGUF) via Ollama | Smoother inference; 13B models possible |

**Marketing angle:** *Joule runs on your Pi. Plug in the Bridge and AI works instantly. When your gaming rig is on, Joule uses your GPU. When it's off, Joule keeps using the shared server. Most users never need to change anything.*

---

## Comparison Table

| Feature | Free (CSV Analyzer) | Monitor ($20) | Bridge ($129) |
|---------|---------------------|---------------|---------------|
| **Price** | Free | $20 | $129 |
| **Ask Joule** | ✅ | ✅ | ✅ |
| **Bill analysis & rate comparisons** | ✅ | ✅ | ✅ |
| **CSV Analysis** | ✅ | ✅ | ✅ |
| **Automatic Daily Analysis** | ❌ | ✅ | ✅ |
| **Ecobee Integration** | ❌ | ✅ | ✅ |
| **Hardware Included** | ❌ | ❌ | ✅ (Pi Zero) |
| **Local Control** | ❌ | ❌ | ✅ |
| **HomeKit Integration** | ❌ | ❌ | ✅ |
| **Dehumidifier Control** | ❌ | ❌ | ✅ |
| **Air Purifier Control** | ❌ | ❌ | ✅ |
| **Wake Word Detection** | ❌ | ❌ | ✅ |
| **Local LLM** | ❌ | ❌ | ✅ |
| **Offline Operation** | ❌ | ❌ | ✅ |
| **Data Sovereignty** | Partial | Partial | ✅ Complete |

---

## Upgrade Path

### Free → Monitor ($20)
- One-time payment
- Unlocks automatic daily analysis
- No hardware required
- Instant activation via license key

### Monitor → Bridge ($99 upgrade)
- Upgrade from Monitor to Bridge
- Receive Raspberry Pi Zero hardware
- All Bridge features unlocked
- Existing Monitor license remains valid

### Free → Bridge ($129)
- Direct purchase of Bridge tier
- Includes all features
- Hardware shipped separately

---

## Technical Requirements

### Free (CSV Analyzer)
- Web browser
- CSV export from thermostat

### Monitor ($20)
- Web browser
- Ecobee thermostat
- Ecobee API access (free account)
- Internet connection

### Bridge ($129)
- Web browser
- Raspberry Pi Zero 2W (included)
- USB power source
- WiFi network
- Optional: USB microphone for wake word
- Optional: USB relay for dehumidifier control
- Optional: Gaming PC for local LLM — Min: GTX 1650 (4 GB) / RX 6400 (4 GB); Rec: RTX 3060 (8 GB) / RX 6600 XT (8 GB)

---

## Support & Updates

- **Free:** Community support, documentation
- **Monitor:** Email support, software updates
- **Bridge:** Priority support, hardware warranty, software updates, community access

---

## Refund Policy

- **Free:** N/A (always free)
- **Monitor:** 30-day money-back guarantee
- **Bridge:** 30-day money-back guarantee (hardware must be returned)

---

## Frequently Asked Questions

### Can I try Monitor features before buying?
Yes! The Free tier lets you test the analysis features. Monitor adds automatic daily analysis.

### Do I need to buy Monitor before Bridge?
No. You can purchase Bridge directly, which includes all Monitor features.

### What if I already have a Raspberry Pi?
Contact support for a software-only Bridge license at a reduced price.

### Can I get a tablet/display with the Bridge?
We sell the Bridge hardware only ($129). For wall-mounted displays, we recommend purchasing an Amazon Fire HD 8 tablet separately (~$50-80) and using our 3D-printed mount design. This approach:
- Keeps the Bridge price low ($129 vs $249+ for a complete kit)
- Avoids shipping complications (no batteries, no glass screens)
- Lets you choose your preferred tablet
- Provides better value (Amazon sells tablets at a loss; we can't compete)

See our documentation for tablet setup guides and mount designs.

### Can I use Bridge without Ecobee?
Yes! Bridge can work with other thermostats via HomeKit or direct control protocols.

### Is there a subscription fee?
No. All tiers are one-time purchases with lifetime software updates.

### Can I run the AI on my gaming PC instead of the Pi?
Yes! The app runs on the Pi 24/7 (forecasts, control, HMI). When your gaming rig is on, run Ollama and Joule uses your GPU. A GTX 1650 (4GB) runs Llama 3 8B fine. When your PC is off, Joule keeps using the shared server.

### AI not working when I open the app from the bridge (e.g. http://192.168.0.103:8080)?
Configure AI in Settings once while on the bridge URL — select Local (Ollama) and enter your gaming PC’s Ollama URL (e.g. `http://192.168.0.108:11434/v1`). Settings sync to the bridge so they persist across sessions. For local Ollama, run Ollama with `OLLAMA_HOST=0.0.0.0` and `OLLAMA_ORIGINS=*` so it accepts requests from the Pi’s origin.

### Does Ask Joule need an API key?
No. Ask Joule works out of the box using the shared Joule AI server. No accounts or API keys required. Most users never need to change anything.

### I want to run AI locally on my gaming PC. How?
Install Ollama on your PC, start it, and download a model. Joule will use it automatically when it's on. When your PC is off, Joule keeps using the shared server.

### What if I need a backup when the Joule server is down?
In Advanced settings (Settings → Bridge & AI), you can optionally enable a free cloud backup. This uses Groq and requires a free API key (~30 seconds to create). Most users never need this.

### How does the bill analysis work?
Upload your utility bill in Cost Simulator. Ask Joule uses your location and cost settings from onboarding to compare your electricity and gas rates to your state's average. It tells you if your rates are above or below average and suggests switching to gas or a heat pump only when savings would be meaningful ($100–200+/year).

---

*Last updated: February 2026*

