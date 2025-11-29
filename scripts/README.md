# Scripts

## Google Nest Takeout Converter

Convert Google Nest Takeout JSON into the canonical CSV shape expected by the System Performance Analyzer.

Canonical CSV headers:

- `Date`
- `Time`
- `Outdoor Temp (F)`
- `Thermostat Temperature (F)`
- `Heat Stage 1 (sec)`
- `Aux Heat 1 (sec)`

### Quick Start (Windows PowerShell)

```powershell
# From the repo root
npm run nest:convert -- -i "C:\path\to\nest_takeout.json" -o "C:\path\to\nest.csv"
```

Then upload `nest.csv` in the Analyzer.

### Options

- `-i, --input <file>`: Path to Nest JSON (required)
- `-o, --output <file>`: Output CSV path (defaults to `<input>-converted.csv`)
- `--sampleSeconds <n>`: Seconds to credit when a boolean heat/aux flag is true (default 300)
- `--fallbackOutdoorF <n>`: Constant outdoor °F to use if none is present in export
- Mapping overrides (optional if auto-detect fails):
  - `--mapTimestamp <path>`
  - `--mapIndoorC <path>` | `--mapIndoorF <path>`
  - `--mapOutdoorC <path>` | `--mapOutdoorF <path>`
  - `--mapHeatSec <path>` | `--mapHeatFlag <path>`
  - `--mapAuxSec <path>` | `--mapAuxFlag <path>`

Paths are dot-notation into the flattened JSON object (e.g., `traits.ambientTemperatureCelsius`).

### Examples

Basic conversion:

```powershell
npm run nest:convert -- -i "nest.json" -o "nest.csv"
```

If outdoor temperature is missing:

```powershell
npm run nest:convert -- -i "nest.json" -o "nest.csv" --fallbackOutdoorF 35
```

If your sampling cadence is 1 minute (not 5):

```powershell
npm run nest:convert -- -i "nest.json" -o "nest.csv" --sampleSeconds 60
```

Override field mappings (when auto-detection misses):

```powershell
npm run nest:convert -- -i "nest.json" -o "nest.csv" `
  --mapTimestamp "events.0.timestamp" `
  --mapIndoorC "traits.ambientTemperatureCelsius" `
  --mapOutdoorC "weather.outdoorTemperatureCelsius" `
  --mapHeatSec "metrics.heatingSeconds" `
  --mapAuxSec "metrics.auxHeatSeconds"
```

### Notes

- Temperatures reported in °C are converted automatically to °F.
- When only boolean on/off flags are present for heating/aux, `--sampleSeconds` controls the credited seconds for a true flag.
- Output rows are sorted by `Date` and `Time`.
