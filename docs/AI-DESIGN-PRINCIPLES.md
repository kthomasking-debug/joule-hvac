# AI Design Principles

Principles for how Joule's AI should behave and communicate. Build prompts and features around these rules.

---

## Core principle

Joule is not a heating app or a cooling app. It's **a house energy behavior model**.

Heating and cooling are two modes of the same physics engine. The AI should think in terms of:

- thermal load
- equipment efficiency
- weather

**Not** heating mode vs cooling mode.

---

## Never announce modes. Always speak in context.

If the bill is July, Joule talks about heat, sun, and cooling.
If the bill is January, Joule talks about cold, heat loss, and heating.

The user should feel:

> Joule understands what happened.

**Not:**

> Joule switched systems.

### Implementation

In your system prompt or context builder:

**Instead of:**
```
MODE: heating
```

**Use:**
```
BILL_PERIOD: Jan 3 – Feb 1
AVERAGE_TEMP: 31°F
```

Let the AI infer language from that. Pass `BILL_PERIOD`, `AVERAGE_TEMP`, `LOCATION` — not mode flags. The model will avoid saying "In cooling mode…" because it was never given that concept.

---

## Vocabulary does the switching

### Winter bill → language naturally shifts

- heat loss
- heating demand
- aux heat
- insulation
- cold spell

### Summer bill → language shifts automatically

- heat gain
- cooling demand
- compressor runtime
- solar load
- humidity

No explicit toggle needed. If the AI uses the right vocabulary, users intuitively understand what's being analyzed.

---

## Only clarify when needed

The one exception: if there's confusion about the **bill period**, not the mode.

**Example:**
> This bill covers January, so I'm comparing it to winter weather during that time.

That's not a mode declaration — it's a data clarification. That's safe.

---

## UI labels

When you add cooling thermostat setpoints, don't label them:

- ~~Cooling temperature~~

Use:

- **Summer temperature**

That keeps the seasonal feel without introducing mode language.

---

## Why this matters

When software announces "switching to cooling mode" → users think *this is a tool with toggles*.

When software simply speaks appropriately ("it was hot during this period") → users think *this understands my house*.

That's the difference between an appliance and software. Joule should feel like an appliance.

---

## Long-term benefit

Keeping modes invisible now means you can later add:

- humidity modeling
- solar gain
- window effects
- shading
- attic heat

without ever introducing a "mode switch." The AI will just talk about **what the house experienced**.

---

## Summary

- No master switch in onboarding
- No mode announcement in AI responses
- Season inferred from bill month
- Vocabulary carries context
- Labels: "Summer temperature" not "Cooling temperature"

Joule should feel like something that understands the house — rather than something the user has to configure.
