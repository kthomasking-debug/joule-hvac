# Cursor Prompt to Rebuild Joule from Scratch

Use this prompt as a starting point to rebuild the Joule HVAC app in Cursor. Paste it into a new Cursor chat and iterate. Break it into smaller prompts if needed; Cursor works best with focused tasks.

---

## Master Prompt (Phase 1: Foundation)

```
Build a React + Vite web app called Joule — a smart thermostat companion for homeowners with heat pumps. Focus on energy forecasting first.

Tech stack:
- React 18, Vite 7, React Router 7
- Tailwind CSS, Lucide icons
- TanStack Query for data fetching
- AI SDK (Vercel AI SDK) with Groq or local Ollama for LLM features

Core features (MVP):
1. **Onboarding** — Collect: location (city/state), home size (sq ft), insulation level, ceiling height, primary system (heat pump / gas / AC+gas), thermostat schedule (day/night temps, times)
2. **Energy forecast** — Monthly and annual cost estimates based on:
   - Heat loss: BTU/hr/°F from building specs (sq ft × 22.67 × insulation × shape × ceiling mult) ÷ 70
   - Heat pump capacity curve: derates below 47°F (e.g. 0.64 at 17°F, 0.56 at 9°F)
   - HSPF2 for efficiency
   - Weather: NWS/Open-Meteo API for forecast + historical degree days
3. **Bill comparison** — Let user paste utility bill text; use AI to extract daily kWh; compare to forecast and explain discrepancies
4. **Ask Joule** — Natural language Q&A about their home, bill, settings. Use RAG over HVAC docs. Support commands like "set heat to 70"

Physics model:
- Design heat loss (BTU/hr at 70°F ΔT) = sq ft × 22.67 × insulation × shape × ceiling_mult
- BTU/hr/°F = design heat loss ÷ 70
- Hourly load = BTU/hr/°F × (indoor_temp − outdoor_temp)
- Heat pump output = tons × 12,000 × capacity_factor(temp)
- Aux heat = deficit when load > HP output (electric strip backup)
- Balance point = outdoor temp where HP output = load

Create a clean routing structure: Home, Simulation (forecaster), Settings, Tools. Use localStorage for user settings. No backend required for MVP.
```

---

## Phase 2: Expand Core Features

```
Extend Joule with:

1. **Monthly Budget Planner** — Daily forecast table with:
   - Sinusoidal temp profile (low ~6 AM, high ~2 PM)
   - Per-day kWh and cost from heatUtils.computeHourlyPerformance
   - User can enter actual kWh from bill; show Δ vs forecast
   - Aux heat column when outdoor < balance point

2. **Bill extraction** — Parse pasted bill text with LLM:
   - Extract date range, daily kWh, total
   - Support PDF upload (pdfjs-dist) → extract text → parse
   - Store by month in localStorage

3. **Bill analysis** — AI explains forecast vs actual:
   - Input: model params, daily comparison (est vs actual)
   - Output: conversational audit (baseload, heat loss, thermostat)
   - Avoid mixing energy-only and total-bill numbers; use total (energy + fixed fees) consistently

4. **Heat loss sources** — Calculated (DOE), Manual, From Bill Data (auto-learned), CSV Analyzer
```

---

## Phase 3: Integrations & Polish

```
Add to Joule:

1. **Ecobee integration** — REST API for thermostat control (optional):
   - Pairing flow, API key in settings
   - Read/set temperature, mode, schedule

2. **Joule Bridge** — Raspberry Pi hardware bridge for local control:
   - REST API at bridge IP
   - HomeKit thermostat proxy
   - Display IP on e-paper or OLED

3. **Ask Joule enhancements**:
   - Structured commands: [JOULE_ACTION:heatLossSource=doe]
   - Follow-up context: bill analysis, comparison rows
   - Voice input (Web Speech API) and TTS (optional)

4. **Settings** — Location, electricity rate, fixed fees, heat loss source, thermostat schedule, aux heat toggle
```

---

## Phase 4: Supporting Features

```
Add:

1. **Weekly forecast** — 7-day cost breakdown
2. **Annual forecast** — 12-month heating/cooling by HDD/CDD
3. **Gas vs heat pump** — Comparison calculator
4. **System performance analyzer** — Ecobee CSV upload for runtime analysis
5. **Onboarding flow** — Multi-step wizard, bill paste step, "Preparing your forecast" (not "Extracting")
6. **One primary number** — Expected bill this month ($XX) prominently; secondary "So far / On track" when partial bill
```

---

## Prompt Tips for Cursor

1. **Start small** — Build the heat loss + forecast engine first, then UI.
2. **Reference files** — Use `@src/lib/heatUtils.js` or `@docs/` when asking Cursor to implement physics.
3. **Run the app** — After each major change: `npm run dev` and verify.
4. **Test oracles** — "Run `npm run test` and fix any failures" or "Run `playwright test tests/e2e/smoke.spec.js`".
5. **Scope edits** — "Only change files in `src/pages/MonthlyBudgetPlanner/`" to avoid drift.
6. **Consistency** — "Use total bill (energy + fixed fees) everywhere; no mixing energy-only and total."

---

## Key Files to Create (Reference)

| Path | Purpose |
|------|---------|
| `src/lib/heatUtils.js` | computeHourlyPerformance, getCapacityFactor, heat loss math |
| `src/lib/hddData.js` | Heating/cooling degree days, annual HDD |
| `src/pages/MonthlyBudgetPlanner/MonthlyBudgetPlanner.jsx` | Main forecaster, bill comparison |
| `src/pages/Onboarding.jsx` | Setup wizard |
| `src/components/AskJoule/` | LLM chat, RAG, command parsing |
| `src/lib/billExtractor.js` | Parse bill text → daily kWh |
| `src/utils/weather/` | Open-Meteo fetch, forecast blending |

---

## Minimal Rebuild Prompt (Single Session)

If you want a **single prompt** to hand Cursor:

```
Create a React + Vite app "Joule" — energy forecaster for heat pump homes.

1. Onboarding: location, 800 sq ft, insulation 0.65x, heat pump 3 ton HSPF2 9
2. Physics: heat loss = sqft × 22.67 × insulation × 1.2 × ceiling_mult; capacity derates below 47°F
3. Monthly forecast page: table of days with kWh and cost; use Open-Meteo for weather
4. Bill paste: user pastes text; AI extracts daily kWh; compare to forecast
5. One primary number: "Expected bill this month: $XX" (total incl fixed fees)
6. Ask Joule: chat with LLM, RAG over HVAC docs, support [JOULE_ACTION:key=value] for settings

Stack: React 18, Vite, Tailwind, Lucide, TanStack Query, AI SDK. No backend. localStorage for settings.
```

---

## Iteration Prompts

After the foundation exists, use targeted prompts:

- *"Add aux heat modeling: when outdoor temp < balance point, add electric strip kWh to the daily total"*
- *"Fix balance point: heatUtils returns deliveredHpBtuHr, not heatpumpOutputBtu"*
- *"Simplify bill summary: one primary number (Expected bill $XX), secondary for partial (So far $X for N days)"*
- *"Add prominent extracting banner when bill AI is parsing so user knows app didn't crash"*
