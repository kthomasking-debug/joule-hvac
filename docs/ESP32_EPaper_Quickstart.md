# ESP32-S3 Waveshare E-Paper Quickstart (Joule Data)

Use this with Waveshare ESP32-S3 1.54" e-paper (200x200) to show live Joule forecast data.

## 1) Data source from Joule bridge

New endpoint (lightweight for microcontrollers):

- `GET /api/hmi/summary`
- Example URL: `http://<bridge-ip>:8080/api/hmi/summary`

Returns compact JSON:

```json
{
  "success": true,
  "updatedAt": 1763078400000,
  "location": "Blairsville, Georgia",
  "month": 3,
  "monthName": "March",
  "mode": "heating",
  "targetTemp": 70,
  "nightTemp": 66,
  "totalMonthlyCost": 57.8,
  "variableCost": 42.8,
  "fixedCost": 15,
  "totalEnergyKwh": 307.9,
  "hpEnergyKwh": 307.9,
  "auxEnergyKwh": 0,
  "electricityRate": 0.139,
  "source": "monthly_forecast"
}
```

## 2) Arduino libraries

Install in Arduino IDE:

- `ArduinoJson`
- `GxEPD2`
- `Adafruit GFX Library`

(Or use Waveshare's native driver if you prefer.)

## 3) Ready-to-flash sketch (recommended)

Use the included sketch:

- `scripts/hardware/esp32-s3-epaper-joule-summary.ino`

What it does:

- Connects to Wi-Fi
- Polls `GET /api/hmi/summary` every 5 minutes
- Renders month, location, total cost, mode/setpoints, variable/fixed split, and kWh
- Shows a status footer when bridge is temporarily unavailable

Before uploading:

1. Set `WIFI_SSID`, `WIFI_PASS`, and `SUMMARY_URL`
2. Verify `EPD_CS`, `EPD_DC`, `EPD_RST`, `EPD_BUSY` pin constants match your Waveshare variant
3. Select board `ESP32S3 Dev Module` (or your exact Waveshare ESP32-S3 profile)

## 4) Minimal ESP32 polling example

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASS = "YOUR_PASS";
const char* SUMMARY_URL = "http://192.168.0.103:8080/api/hmi/summary";

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(SUMMARY_URL);
    int code = http.GET();

    if (code == 200) {
      String body = http.getString();
      StaticJsonDocument<2048> doc;
      auto err = deserializeJson(doc, body);

      if (!err && doc["success"] == true) {
        const char* monthName = doc["monthName"] | "-";
        float totalCost = doc["totalMonthlyCost"] | 0.0f;
        float variableCost = doc["variableCost"] | 0.0f;
        float fixedCost = doc["fixedCost"] | 0.0f;
        const char* location = doc["location"] | "-";
        const char* mode = doc["mode"] | "-";

        Serial.printf("%s | %s\n", location, monthName);
        Serial.printf("Mode: %s\n", mode);
        Serial.printf("Total: $%.2f\n", totalCost);
        Serial.printf("Variable: $%.2f  Fixed: $%.2f\n", variableCost, fixedCost);

        // TODO: draw the same values to e-paper here
        // GxEPD2 draw calls go here
      }
    }
    http.end();
  }

  // E-paper refresh cadence: 5-15 min is typical
  delay(5 * 60 * 1000);
}
```

## 5) Good defaults for e-paper

- Poll every 5–15 minutes (not every few seconds)
- Full refresh every ~30-60 min to reduce ghosting
- Partial refresh for small value changes if driver supports it

## 6) Suggested first screen layout (200x200)

- Line 1: `Joule • March`
- Line 2: `Blairsville, Georgia`
- Big center: `$57.80`
- Footer: `Heat 70°/66°  |  Updated 5m ago`

If your board uses different panel wiring or a different 1.54" driver, only the display constructor and pin constants should need changes.