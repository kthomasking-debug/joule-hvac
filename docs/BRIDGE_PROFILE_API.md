# Bridge Profile API

Endpoints provided by the Pi bridge (mocked by `pi-hmi/mock_server.py`) to store home data and compute weekly costs.

## Base URL
- Configure in React via `VITE_BRIDGE_BASE` or set with `setBridgeBase(url)` from `src/lib/bridgeApi.js`.
- Default (localhost dev): `http://127.0.0.1:8090`.

## Endpoints

### GET /profile
- Returns the currently stored home profile.
- Response:
```json
{
  "ok": true,
  "profile": {
    "electric_rate_cents_kwh": 15.0,
    "gas_rate_per_therm": 1.5,
    "weekly_kwh": 0,
    "weekly_therms": 0,
    "notes": "User-supplied profile"
  }
}
```

### POST /profile
- Stores home data used for cost calculations.
- Body fields (all optional; persisted if provided):
  - `electric_rate_cents_kwh`: number (e.g., 15.8)
  - `gas_rate_per_therm`: number (e.g., 1.15)
  - `weekly_kwh`: number (estimated weekly electricity use for HVAC)
  - `weekly_therms`: number (estimated weekly gas use for heating)
  - `notes`: string
- Example:
```json
{
  "electric_rate_cents_kwh": 15.8,
  "gas_rate_per_therm": 1.12,
  "weekly_kwh": 85,
  "weekly_therms": 6.5,
  "notes": "3-ton HP, 92% AFUE furnace"
}
```

### POST /cost-weekly
- Computes weekly cost from either the stored profile or values supplied in the request.
- Request body (optional overrides): `weekly_kwh`, `weekly_therms`, `electric_rate_cents_kwh`, `gas_rate_per_therm`.
- Response:
```json
{
  "ok": true,
  "electric_cost_usd": 12.5,
  "gas_cost_usd": 7.28,
  "total_usd": 19.78,
  "inputs": {
    "weekly_kwh": 85,
    "weekly_therms": 6.5,
    "electric_rate_cents_kwh": 14.7,
    "gas_rate_per_therm": 1.12
  }
}
```

## React Usage
- Use helpers from [src/lib/bridgeApi.js](../src/lib/bridgeApi.js):
```js
import { saveHomeProfile, getWeeklyCost, setBridgeBase } from '../lib/bridgeApi';

setBridgeBase('http://bridge.local:8090');
await saveHomeProfile({ electric_rate_cents_kwh: 15.2, gas_rate_per_therm: 1.05 });
const result = await getWeeklyCost({ weekly_kwh: 90, weekly_therms: 5.8 });
console.log(result.total_usd);
```

## Notes
- This mock logic is intentionally simple. In production, the bridge can compute usage using forecast (HDD/CDD), equipment efficiencies (COP/AFUE), and duty cycle, then return detailed breakdowns.
