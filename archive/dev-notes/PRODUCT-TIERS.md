# Joule Product Tiers

## Overview

Joule offers three product tiers to meet different needs and budgets, from basic analysis to complete home automation control.

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

### Features

- ✅ Heat loss calculation from coast-down data
- ✅ System balance point analysis
- ✅ Efficiency percentile ranking
- ✅ Building geometry analysis
- ✅ Recommendations based on results
- ✅ Export results to CSV
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

- Requires basic technical setup (plug in, connect to WiFi)
- Physical hardware installation
- Local network access required for control

### Best For

- Homeowners who want complete control
- Privacy-conscious users (no cloud dependency)
- Those wanting offline operation
- DIY smart home enthusiasts
- Multiple device coordination (thermostat + dehumidifier + air purifier)

---

## Comparison Table

| Feature | Free (CSV Analyzer) | Monitor ($20) | Bridge ($129) |
|---------|---------------------|---------------|---------------|
| **Price** | Free | $20 | $129 |
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

---

*Last updated: 2025*

