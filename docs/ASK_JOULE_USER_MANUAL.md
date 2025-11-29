# Ask Joule — User Manual

Ask Joule is your natural-language home energy assistant in the app — it accepts commands, explains estimates, and can modify settings.

Supported commands (examples):

- Thermostats

  - "Set winter to 68" — set your winter thermostat
  - "Set summer to 74" — set your summer thermostat

- Efficiency & equipment

  - "Set HSPF to 10" — set heat pump efficiency
  - "Set SEER to 18" — set AC efficiency
  - "Set AFUE to 0.95" — set furnace AFUE
  - "Set capacity to 36" — set system capacity in kBTU

- Home details

  - "Set square feet to 2000" — set home size
  - "Set insulation to good" — set insulation roughness
  - "Set ceiling height to 9 ft" — set ceiling height
  - "Set home elevation to 1500 ft" — set elevation

- Utility & system

  - "Set utility cost to $0.12" — set electricity price
  - "Turn off aux heat" — disable electric auxiliary heat
  - "Set cooling capacity to 36" — set cooling system capacity

- Location & navigation

  - "Set location to Denver, CO" — change location
  - "Show me Denver forecast" — navigate to the forecast (if applicable)

- Undo
  - "Undo" or "Undo last change" — Revert the last setting change Ask Joule made

Other features:

- Command help: The UI includes a small list of supported commands and quick examples.
- Command history: The app records Ask Joule changes for traceability and to provide undo functionality.
- Voice responses (Text-to-Speech): Ask Joule can speak its responses using your browser's built-in voice synthesis. Click the speaker icon to enable/disable voice. When enabled, Ask Joule will read all responses aloud automatically.

- Status icons: Ask Joule now surfaces quick visual feedback for commands:
  - ✅ Green check: Command accepted and applied — the change was recorded and persisted.
  - ❌ Red error: Command not accepted — Ask Joule couldn't apply the change (e.g., settings updates not available); no changes were made.
  - ℹ️ Blue info: Informational responses — no change was applied; this includes what-if scenarios or LLM answers.

Security & privacy notes

- Ask Joule uses your local settings to provide more accurate answers.
- Commands that change settings are applied locally and synchronized via localStorage.
- If you use the Groq LLM key for fallback, the host key is sent to the Groq endpoint; check Settings for your API key.

For more help or feedback, open Settings → Ask Joule and use the "Help" link or contact support.

## Technical Details: How Ask Joule Works

Ask Joule is a local, client-side assistant designed to be privacy-conscious while offering helpful suggestions and the ability to update your app settings with natural language.

- Parsing & Commands: The UI component `AskJoule` in `src/components/AskJoule.jsx` contains a collection of parsing helpers (`parseAskJoule`, `parseCommand`, plus smaller helpers such as `parseSquareFeet`, `parseTemperature`, and `parseCity`). Commands (like `set HSPF to 10`) are matched by `parseCommand` and mapped to actions the app understands (e.g., `setHSPF`, `setUtilityCost`, `setLocation`).

- App Context & Settings: When Ask Joule updates a setting, it calls a callback (`onSettingChange`) implemented by `App.jsx` or by page components via React `Outlet` context. `App.jsx` stores app-wide settings under `userSettings` (persisted to `localStorage`) and wraps that into a `mergedUserSettings` object for routes and components. The app-level `setUserSetting` function records any changes and pushes them to an audit log.

- Audit Log & Undo: Changes made by Ask Joule are recorded in an audit log (`askJouleAuditLog`) stored in `localStorage` by the App shell. The app provides `undoChange` and `clearAuditLog` functions to revert or manage recorded changes. The audit log keeps the action key, previous value, new value, timestamp, and comments.

- LLM Fallback: If Ask Joule can't parse a user question, it can optionally use a Groq LLM (via `askJouleFallback`) to generate richer answers. The LLM is used only client-side and requires the user to provide their own Groq API key in Settings (the key is saved in `localStorage` under `groqApiKey`). The app never sends the key to our servers; calls go directly from the user’s browser to Groq's API endpoints.

- Data Sources & Privacy: Ask Joule uses local app state (`userSettings`, `userLocation`, `annualEstimate`, and `recommendations`) to craft contextual responses and local suggestions. This means predictions and what-if scenarios are based on settings and estimates available in your device. If you enable Groq, Ask Joule only sends a minimal context for better answers; the key and calls remain in the browser. No personal usage data is sent to our servers unless you explicitly export or share it.

## Ask Joule Command Center

For power users and administrators, a dedicated "Ask Joule Command Center" page provides a deeper command audit view and administration utilities:

- View command history with timestamps and details.
- Export the audit history as JSON or CSV for backup or review.
- Revert individual changes or clear the entire audit history.
- Quick access to the full command list and examples.

You can open the command center from Settings → Ask Joule (link) or by navigating to `/ask-joule-command-center`.
