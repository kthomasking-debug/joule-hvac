# Engineering Tools — Execution Prompt for Completing Remaining Roadmap

Role: You are an experienced front‑end + product engineer working in this React 18 + Vite repo. You ship small, well‑tested increments, keep UX delightful, and write maintainable code.

Primary Objective: Complete the remaining items in the in‑repo roadmap (Todo list), starting with the AI Comfort Optimizer, while maintaining build stability and adding tests for new functionality.

Guardrails

- Keep changes focused and minimal; do not refactor unrelated code.
- Maintain existing patterns: React, hooks, Vitest + Testing Library, Playwright for E2E (lightweight).
- Persist user data in localStorage where appropriate (consistent keys), respect privacy.
- Follow existing styles (Tailwind classes, component structure).
- If a component renders JSX in tests, use `.jsx` for test files.
- If unsure about external APIs, start with stubbed or rule‑based logic + tests.

Success Criteria (global)

- Builds pass (`npm run build`).
- All new unit/integration tests pass (`npm test`).
- No regression to onboarding, elevation, or existing Home views.
- New features have at least basic unit coverage and a happy‑path E2E where feasible.

Order of Work

1. AI Comfort Optimizer (MVP) — schedule recommendation + apply flow
2. Shareable savings graphics — canvas/image export from existing savings card
3. Neighborhood leaderboard — anonymized, local mock data with percentiles
4. Community tips — simple list with submit + local moderation queue
5. Historical dashboard — month vs last year, overlay actual vs predicted
   (Continue in similar bite‑sized vertical slices for the remaining items.)

AI Comfort Optimizer — MVP Scope
Goal: Recommend a 24‑hour schedule that balances comfort vs cost using known inputs and learned behavior. Provide a preview + one‑click Apply that writes to localStorage (future: sync to devices).

Inputs

- User location (incl. elevation), thermostat prefs (winter/summer), equipment efficiency (SEER/HSPF), comfort vs savings intent (from existing dial if present), recent learning events (useThermostatLearning), forecast summaries (from useForecast).

Outputs

- A schedule array of 24 entries (or 6–8 time blocks), each with setpoint and rationale tags (e.g., "pre‑warm for wake", "coast midday").
- A small savings/comfort score deltas vs current steady setpoint.

Design

- Library: `src/lib/optimizer/comfortOptimizer.js` exports `generateSchedule(settings, forecast, learningEvents)`.
- UI: `src/components/ComfortOptimizerCard.jsx` displays preview schedule, deltas, and an Apply button.
- Storage: `localStorage.setItem("optimizerSchedule", JSON.stringify(...))`; respect opt‑in.

Algorithm (rule‑based v1)

- Morning pre‑warm if learning shows repeated winter bumps between 5–8am (suggest +2°F starting 45–60m before wake).
- Night setback by 2–4°F in winter (or up in summer) unless learning contradicts within last 14 days.
- Midday cost‑aware nudge (±1°F) using forecast temps and rough cost proxy (hotter → summer cool earlier; colder → winter pre‑heat earlier).
- Respect user comfort bounds (min/max) and never exceed safe ranges.
- Produce rationale tags per block to surface transparency.

Acceptance Tests

- Unit: Given deterministic inputs, `generateSchedule` returns blocks with expected times, setpoints in safe ranges, and rationale tags present.
- Unit: Learning pattern present → includes morning pre‑warm block; pattern absent → no pre‑warm.
- Component: OptimizerCard renders schedule, shows deltas, Apply writes to `optimizerSchedule`.
- Integration: With saved schedule, Home (or Settings) surfaces a subtle “Plan active” state.

Implementation Steps

1. Create optimizer module and pure function with small helpers (time blocks, bounds, rationale tagging).
2. Add unit tests under `src/lib/optimizer/__tests__/comfortOptimizer.test.js` covering edge cases.
3. Create `ComfortOptimizerCard.jsx` with preview table, small sparkline (optional), and Apply.
4. Add minimal component tests.
5. Wire into `Home.jsx` or a Settings/Planning page section; hide if unsupported.
6. Optional: lightweight Playwright E2E smoke: render card, click Apply, expect localStorage key.

Coding Conventions

- Keep data‑first: pure logic in `lib`, thin UI components in `components`.
- Ensure hooks memoization where necessary; avoid rerender loops.
- Guard optional data (forecast, learning) and degrade gracefully.

DX & Testing

- Prefer targeted `npm test -- <pattern>` during development.
- Use `/* @vitest-environment jsdom */` and `.jsx` when tests render JSX.
- Mock `localStorage` as needed; reset keys between tests.

Rollout Notes

- Start with MVP behind a simple toggle in Settings (Advanced), default ON for development.
- Logically separate schedule generation (pure) from side effects (Apply).
- Document keys and data shape inline at the top of the module.

Next Items (after MVP)

- Add weightings from `ComfortSavingsDial` to influence setpoints.
- Add rough cost model integration for better midday adjustments.
- Allow user to tweak blocks and save custom templates.
- Telemetry (local only) to compare adherence vs plan for learning.
