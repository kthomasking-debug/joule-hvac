# Engineering Tools - Complete Folder Tree Explained

This document provides a comprehensive explanation of every directory and key file in the engineering-tools project.

---

## Root Level

```
engineering-tools/
```

**Purpose:** Root directory of the Joule HVAC analytics and smart thermostat application. A React-based web app that provides HVAC diagnostics, energy optimization, and voice-controlled thermostat management.

---

## Core Application Directories

### `src/` - Main Application Source Code

**Purpose:** Contains all React components, hooks, utilities, and business logic for the frontend application.

#### `src/agents/`
- **Purpose:** Agentic AI response UI components
- **Files:**
  - `AgenticResponseUI.jsx` - React component for displaying AI agent responses
  - `README.md` - Documentation for agent system

#### `src/components/` - React UI Components
- **Purpose:** All reusable React components for the UI
- **Key Components:**
  - `AskJoule/` - Voice assistant interface components
  - `AIMode/` - AI-powered mode switcher
  - `SystemPerformanceAnalyzer/` - HVAC performance analysis UI
  - `AskJoule.jsx` - Main voice assistant component
  - `ThermostatSettingsPanel.jsx` - Thermostat configuration UI
  - `TemperatureDisplay.jsx` - Temperature readout component
  - `VoiceOrb.jsx` - Voice interaction visual feedback
  - `__tests__/` - Component unit tests (33 test files)

#### `src/contexts/` - React Context Providers
- **Purpose:** Global state management using React Context API
- **Files:**
  - `ConversationContext.jsx` - Manages conversation history for Ask Joule
  - `ModeContext.jsx` - Application mode state (demo/production)

#### `src/data/` - Static Data Files
- **Purpose:** Hardcoded reference data used throughout the app
- **Files:**
  - `fixedChargesByState.js` - Utility fixed charges by US state
  - `stateRates.js` - Electricity rates by state
  - `welcomeThemes.js` - Welcome screen theme configurations

#### `src/features/` - Feature Modules
- **Purpose:** Self-contained feature implementations
- **Contents:**
  - `forecaster/` - 7-day cost forecasting feature (TypeScript + React)

#### `src/hooks/` - Custom React Hooks
- **Purpose:** Reusable React hooks for common functionality
- **Key Hooks:**
  - `useAskJouleController.js` - Main controller for Ask Joule voice assistant
  - `useEcobee.js` - Ecobee thermostat API integration
  - `useJouleBridge.js` - Communication with Joule Bridge hardware
  - `useSpeechRecognition.js` - Voice input handling
  - `useSpeechSynthesis.js` - Text-to-speech output
  - `useTemperature.js` - Temperature data fetching
  - `useVoiceHMI.js` - Voice human-machine interface
  - `useWakeWord.js` - Wake word detection
  - `__tests__/` - Hook unit tests

#### `src/legal/` - Legal Documents
- **Purpose:** Privacy policy and terms of use components
- **Files:**
  - `PrivacyPolicy.jsx` - Privacy policy page
  - `TermsOfUse.jsx` - Terms of service page

#### `src/lib/` - Core Business Logic Libraries
- **Purpose:** Pure JavaScript modules containing business logic, API clients, and utilities
- **Key Modules:**
  - `groqAgent.js` - **MAIN LLM PROMPTS HERE** - Groq API integration and system prompts
  - `thermostatIntentClassifier.js` - Intent classification for voice commands
  - `ecobeeApi.js` - Ecobee thermostat API client
  - `jouleBridgeApi.js` - Joule Bridge hardware API client
  - `agentExecutor.js` - Executes agent tool calls
  - `agentTools.js` - Tool definitions for agent system
  - `appliances/` - Appliance detection and analysis
  - `bills/` - Utility bill parsing
  - `community/` - Community tips engine
  - `history/` - Historical data analysis
  - `leaderboard/` - Neighborhood comparison
  - `optimizer/` - Comfort optimization algorithms
  - `savings/` - Savings calculation engine
  - `upgrades/` - ROI calculator for HVAC upgrades
  - `__tests__/` - Library unit tests

#### `src/pages/` - Page Components
- **Purpose:** Top-level page components (routes)
- **Key Pages:**
  - `Home.jsx` - Main dashboard
  - `Settings.jsx` - User settings page
  - `AskJouleCommandCenter.jsx` - Voice command interface
  - `SystemPerformanceAnalyzer.jsx` - Performance analysis page
  - `HeatPumpChargingCalc.jsx` - A/C charging calculator
  - `SevenDayCostForecaster.jsx` - Cost forecasting page
  - `heatpump/` - Heat pump specific pages
  - `__tests__/` - Page component tests

#### `src/styles/` - Global Stylesheets
- **Purpose:** CSS and styling configuration
- **Files:**
  - `design-system.css` - Design system tokens
  - `tailwind.css` - Tailwind CSS imports
  - `ui.css` - UI component styles
  - `print.css` - Print media styles

#### `src/utils/` - Utility Functions
- **Purpose:** Helper functions and utilities
- **Key Files:**
  - `askJouleParser.js` - **REGEX PARSER** - Natural language command parser (1200+ lines)
  - `geocode.js` - Geocoding and location services
  - `actionParser.js` - Action button parsing
  - `nlp/` - Natural language processing utilities
  - `rag/` - RAG (Retrieval Augmented Generation) knowledge base
  - `weather/` - Weather data utilities
  - `learning/` - Machine learning preference detection
  - `__tests__/` - Utility function tests

#### `src/App.jsx` - Main App Component
- **Purpose:** Root React component, routing, and app structure

#### `src/main.jsx` - Application Entry Point
- **Purpose:** React app initialization and mounting

#### `src/navConfig.js` - Navigation Configuration
- **Purpose:** Defines app navigation structure and routes

---

## Hardware Bridge Services

### `pi-bridge/` - Raspberry Pi 5 Bridge (Local LLM)
- **Purpose:** Local RAG bridge for Raspberry Pi 5 running Ollama + Llama 3.2 3B
- **Features:**
  - Fast local inference (13-21 tokens/second)
  - Private (no cloud API calls)
  - RAG document search
  - Drop-in replacement for Groq API
- **Files:**
  - `server.js` - Express server providing `/api/ask-joule` endpoint
  - `package.json` - Node.js dependencies
  - `README.md` - Setup and configuration guide

### `pi-zero-bridge/` - Raspberry Pi Zero 2 W Bridge (Groq-Powered)
- **Purpose:** Lightweight bridge for Pi Zero 2 W using Groq API + local embeddings
- **Features:**
  - Local embeddings (sentence-transformers)
  - Groq API for inference (cloud-based but fast)
  - RAG document search
- **Files:**
  - `server.js` - Node.js HTTP server
  - `rag_groq.py` - Python script for RAG queries using Groq
  - `package.json` - Node.js dependencies

### `pi-setup/` - Raspberry Pi 5 Setup Scripts
- **Purpose:** Installation and optimization scripts for Pi 5
- **Files:**
  - `install.sh` - Installs Ollama, Node.js, and dependencies
  - `optimize-pi.sh` - System optimization for performance
  - `README.md` - Setup instructions

### `pi-zero-setup/` - Raspberry Pi Zero 2 W Setup Scripts
- **Purpose:** Installation scripts for Pi Zero 2 W
- **Files:**
  - `install.sh` - Installs Python dependencies and Node.js
  - `README.md` - Setup instructions

### `prostat-bridge/` - Prostat Relay Bridge (Asthma Shield)
- **Purpose:** Python bridge for Prostat relay control (asthma/air quality features)
- **Features:**
  - Controls Prostat USB relay modules
  - Asthma Shield mode (air purifier automation)
  - Systemd service integration
- **Files:**
  - `server.js` - Node.js HTTP server
  - `server.py` - Python relay control server
  - `asthma_shield.py` - Asthma Shield automation logic
  - `asthma-shield.service` - Systemd service file
  - `requirements.txt` - Python dependencies
  - `package.json` - Node.js dependencies

---

## Server Services

### `server/` - Local Development Server
- **Purpose:** Express server for local development and testing
- **Files:**
  - `temperature-server.js` - Temperature data server (CPU + Ecobee)
    - Provides `/api/temperature/cpu` - CPU temperature
    - Provides `/api/temperature/ecobee` - Ecobee thermostat data
    - IFTTT webhook receiver
    - Agent memory persistence
  - `agent-memory.json` - Persistent agent memory storage

---

## Mobile App

### `android/` - Android App (Capacitor)
- **Purpose:** Native Android app built with Capacitor
- **Structure:**
  - `app/` - Android app module
    - `build/` - Build artifacts (generated)
    - `src/` - Android source code
      - `main/` - Main app code
        - `java/` - Java/Kotlin source files
        - `res/` - Android resources (icons, layouts)
        - `assets/` - Static assets
      - `androidTest/` - Android instrumentation tests
      - `test/` - Unit tests
    - `build.gradle` - Android build configuration
    - `capacitor.build.gradle` - Capacitor-specific build config
  - `capacitor-cordova-android-plugins/` - Capacitor plugin bridge
  - `gradle/` - Gradle wrapper files
  - `build.gradle` - Root build configuration
  - `settings.gradle` - Gradle project settings

---

## Configuration

### `config/` - Configuration Templates
- **Purpose:** Example configuration files (user copies and customizes)
- **Files:**
  - `ecobee_config.json.example` - Ecobee API configuration template
  - `policy.json.example` - Security policy template
  - `settings.json.example` - Application settings template

### `state/` - State File Templates
- **Purpose:** Example state files for local testing
- **Files:**
  - `current_status.json.example` - Thermostat state template

---

## Documentation

### `docs/` - Project Documentation
- **Purpose:** Comprehensive documentation for users and developers
- **Key Documents:**
  - `AI-Agent-Prompt.md` - LLM prompt engineering documentation
  - `ASK_JOULE_USER_MANUAL.md` - Ask Joule voice assistant guide
  - `SMART_THERMOSTAT_BUILD_GUIDE.md` - Hardware build instructions
  - `INSTALLATION-GUIDE.md` - Installation instructions
  - `LEGAL-FIREWALL-PITCH.md` - Legal safety guidelines
  - `QUICK_START_GUIDE.md` - Quick start for new users
  - `RAG-*.md` - RAG system documentation
  - `REGEX-PATTERNS-BREAKDOWN.md` - Regex pattern documentation
  - Many more guides for specific features

---

## Build & Distribution

### `dist/` - Build Output
- **Purpose:** Production build artifacts (generated by `npm run build`)
- **Contents:**
  - `assets/` - Bundled JavaScript and CSS
  - `docs/` - Copied documentation files
  - `images/` - Static images
  - `knowledge/` - Knowledge base files
  - `index.html` - Entry point
  - `404.html` - SPA fallback page

### `public/` - Public Static Assets
- **Purpose:** Static files served directly (not processed by Vite)
- **Contents:**
  - `audio/` - Pre-generated TTS audio files
  - `docs/` - Documentation (copied to dist)
  - `images/` - Image assets
    - `thermostat/` - Thermostat wiring diagrams
    - `dehumidifier/` - Dehumidifier diagrams
    - `welcome/` - Welcome screen images
  - `knowledge/` - RAG knowledge base markdown files
  - `app-icon-*.png` - App icons (various sizes)
  - `manifest.json` - PWA manifest

---

## Scripts & Automation

### `scripts/` - Utility Scripts
- **Purpose:** Build, deployment, and utility scripts
- **Key Scripts:**
  - `build-android.*` - Android app build scripts (JS, PowerShell, Bash)
  - `deploy-to-pi.*` - Deploy to Raspberry Pi scripts
  - `generate-tts-responses.js` - Generate pre-recorded TTS audio
  - `relay-server.js` - USB relay control server (dev/testing)
  - `sync-docs.cjs` - Sync documentation to public folder
  - `arduino-*.ino` - Arduino firmware for hardware bridges
  - `esp32-thermostat.ino` - ESP32 firmware for thermostat control
  - Various parsing/validation scripts

---

## Testing

### `tests/` - End-to-End Tests
- **Purpose:** Playwright E2E tests
- **Files:**
  - `e2e/` - End-to-end test specs
    - `app.spec.js` - Main app smoke tests
    - `ask-joule-*.spec.js` - Ask Joule voice assistant tests
    - `smoke.spec.js` - Critical path smoke tests
  - `setup.ts` - Test configuration

### `test-results/` - Test Results
- **Purpose:** Test execution results and reports
- **Files:**
  - `results.json` - Test results data

### `playwright-report/` - Playwright Test Reports
- **Purpose:** HTML test reports generated by Playwright

---

## Agent System

### `agent/` - Agent Templates
- **Purpose:** Template files for agent planning and notes
- **Files:**
  - `NOTES.md.example` - Agent notes template
  - `PLAN.md.example` - Agent planning template

---

## Root Configuration Files

### Build & Development
- `package.json` - **NPM dependencies and scripts**
  - Defines all npm scripts (dev, build, test, deploy)
  - Lists all project dependencies
- `package-lock.json` - Locked dependency versions
- `vite.config.js` - **Vite build configuration**
  - Defines build settings, plugins, aliases
- `tailwind.config.cjs` - Tailwind CSS configuration
- `postcss.config.cjs` - PostCSS configuration
- `eslint.config.js` - ESLint linting rules

### Testing
- `playwright.config.js` - Playwright test configuration

### Deployment
- `netlify.toml` - Netlify deployment configuration
- `vercel.json` - Vercel deployment configuration
- `capacitor.config.json` - **Capacitor mobile app configuration**

### Application
- `index.html` - **HTML entry point** (Vite processes this)
- `README.md` - **Main project documentation**

### Other
- `.cursor/` - Cursor IDE configuration
  - `debug.log` - Debug logging output
- `Cursor-Thermostat/` - Empty directory (legacy/placeholder)

---

## Key File Locations Summary

### LLM Prompts
- **Main System Prompt:** `src/lib/groqAgent.js:233` (`MINIMAL_SYSTEM_PROMPT`)
- **Byzantine Mode Prompt:** `src/lib/groqAgent.js:33` (`BYZANTINE_SYSTEM_PROMPT`)
- **Marketing Prompt:** `src/lib/groqAgent.js:79` (`MARKETING_SITE_SYSTEM_PROMPT`)
- **Intent Classifier Prompt:** `src/lib/thermostatIntentClassifier.js:48`

### Regex Parser
- **Main Parser:** `src/utils/askJouleParser.js` (3942 lines, 1200+ lines of regex patterns)

### Entry Points
- **React Entry:** `src/main.jsx`
- **HTML Entry:** `index.html`
- **App Component:** `src/App.jsx`

### Configuration
- **Build Config:** `vite.config.js`
- **Mobile Config:** `capacitor.config.json`
- **Tailwind Config:** `tailwind.config.cjs`

---

## Architecture Overview

### Frontend (React + Vite)
- **Location:** `src/`
- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State:** React Context + Hooks

### Backend Services
- **Local Dev Server:** `server/temperature-server.js`
- **Pi 5 Bridge:** `pi-bridge/server.js` (Ollama)
- **Pi Zero Bridge:** `pi-zero-bridge/server.js` (Groq)
- **Prostat Bridge:** `prostat-bridge/server.py` (Relay control)

### Mobile
- **Platform:** Android (via Capacitor)
- **Location:** `android/`

### Testing
- **Unit Tests:** Vitest (in `src/**/__tests__/`)
- **E2E Tests:** Playwright (in `tests/e2e/`)

---

## Development Workflow

1. **Development:** `npm run dev` - Starts Vite dev server
2. **Testing:** `npm test` - Runs Vitest unit tests
3. **E2E Testing:** `npm run test:visual` - Runs Playwright tests
4. **Build:** `npm run build` - Creates production build in `dist/`
5. **Deploy:** Various deploy scripts for Netlify, Vercel, Pi, etc.

---

_Last updated: 2025-01-27_


