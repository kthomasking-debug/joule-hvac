# Bridge Cost Estimation - Quick Reference

## API Endpoint

```
POST /api/cost-estimate
```

---

## Request Format

```json
{
  "outdoor_temp": 45,
  "target_temp": 70,
  "duration_hours": 168
}
```

**OR with hourly forecast:**

```json
{
  "outdoor_temps_array": [45, 44, 43, ...],
  "target_temp": 70,
  "duration_hours": 168
}
```

---

## Response Format

```json
{
  "success": true,
  "weeklyCost": 45.23,
  "monthlyCost": 195.85,
  "parameters": {...},
  "breakdown": [...]
}
```

---

## Common Requests

### Test 1: Current Conditions
```bash
curl -X POST http://192.168.1.50:3002/api/cost-estimate \
  -H "Content-Type: application/json" \
  -d '{"outdoor_temp":45,"target_temp":70,"duration_hours":168}'
```

### Test 2: What-If Lower Target
```bash
curl -X POST http://192.168.1.50:3002/api/cost-estimate \
  -H "Content-Type: application/json" \
  -d '{"outdoor_temp":45,"target_temp":68,"duration_hours":168}'
```

### Test 3: Cold Weather Scenario
```bash
curl -X POST http://192.168.1.50:3002/api/cost-estimate \
  -H "Content-Type: application/json" \
  -d '{"outdoor_temp":20,"target_temp":70,"duration_hours":168}'
```

### Test 4: Single Day
```bash
curl -X POST http://192.168.1.50:3002/api/cost-estimate \
  -H "Content-Type: application/json" \
  -d '{"outdoor_temp":45,"target_temp":70,"duration_hours":24}'
```

---

## Usage in Code

### JavaScript/React
```javascript
const res = await fetch('http://192.168.1.50:3002/api/cost-estimate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    outdoor_temp: 45,
    target_temp: 70,
    duration_hours: 168
  })
});

const data = await res.json();
console.log(`Weekly: $${data.weeklyCost.toFixed(2)}`);
```

### Python
```python
import requests

response = requests.post(
  'http://192.168.1.50:3002/api/cost-estimate',
  json={
    'outdoor_temp': 45,
    'target_temp': 70,
    'duration_hours': 168
  }
)

data = response.json()
print(f"Weekly: ${data['weeklyCost']:.2f}")
```

### Node.js
```javascript
const http = require('http');

const postData = JSON.stringify({
  outdoor_temp: 45,
  target_temp: 70,
  duration_hours: 168
});

const options = {
  hostname: '192.168.1.50',
  port: 3002,
  path: '/api/cost-estimate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    console.log(`Weekly: $${result.weeklyCost}`);
  });
});

req.write(postData);
req.end();
```

---

## What It Calculates

```
For each hour:
  Load = heatLoss × (target_temp - outdoor_temp)  [BTU/hr]
  Energy = Load ÷ 3412                            [kWh]
  Cost = Energy × utility_rate                    [$/hr]

Weekly = Sum(Cost for duration_hours)
Monthly = Weekly × 4.33
```

---

## Data It Uses

- **Heat Loss:** From `joule-settings.json` (3-tier priority)
  1. `userSettings.calculatedHeatLoss` (building analysis)
  2. `userSettings.analyzerHeatLoss` (coast-down test)
  3. `userSettings.manualHeatLoss` (user-entered)
  4. Default: 850 BTU/hr/°F

- **Utility Rate:** From `userSettings.utilityCost` (default: $0.15/kWh)
- **System Efficiency:** From `userSettings.hspf2` (reference only)

---

## What It Returns

| Field | Example | Use |
|-------|---------|-----|
| `success` | `true` | Check if calculation succeeded |
| `weeklyCost` | `45.23` | Cost for specified duration |
| `monthlyCost` | `195.85` | Projected monthly cost |
| `parameters` | `{...}` | Details about calculation |
| `breakdown` | `[...]` | Hourly details (first 24 hrs) |

---

## Use Cases

| Need | Request |
|------|---------|
| Current cost | `{outdoor_temp: 45, target_temp: 70}` |
| What-if lower temp | `{outdoor_temp: 45, target_temp: 68}` |
| What-if cold snap | `{outdoor_temp: 20, target_temp: 70}` |
| Weekly forecast | `{outdoor_temps_array: [...], target_temp: 70}` |
| Daily cost | `{outdoor_temp: 45, duration_hours: 24}` |
| Just tomorrow | `{outdoor_temp: 35, duration_hours: 24}` |

---

## Performance

| Metric | Value |
|--------|-------|
| Response Time | < 100ms |
| Request Size | ~100 bytes |
| Response Size | ~300 bytes |
| Safe Call Frequency | Every 100ms |

---

## Testing

```bash
# Run all tests
node test-cost-estimate.js 192.168.1.50

# Test specific IP
node test-cost-estimate.js 192.168.1.50 3002

# Test locally
node test-cost-estimate.js localhost
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `ECONNREFUSED` | Bridge not running | Start: `cd pi-zero-bridge && node server.js` |
| `timeout` | Bridge too slow | Check bridge load, network connectivity |
| `success: false` | Invalid parameters | Ensure outdoor_temp or outdoor_temps_array provided |
| `Missing settings` | No joule-settings.json | Uses defaults (850 BTU/hr, $0.15/kWh) |

---

## Full Docs

- **API Spec:** `BRIDGE_DYNAMIC_COST_ESTIMATION.md`
- **Integration:** `BRIDGE_COST_ESTIMATION_INTEGRATION.md`
- **Summary:** `BRIDGE_COST_CALCULATION_SUMMARY.md`

---

**Ready to use!** Test it now: `curl -X POST http://192.168.1.50:3002/api/cost-estimate -H "Content-Type: application/json" -d '{"outdoor_temp":45,"target_temp":70,"duration_hours":168}' | jq`
