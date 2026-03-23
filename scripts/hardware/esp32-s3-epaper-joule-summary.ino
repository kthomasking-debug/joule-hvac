/*
 * ESP32-S3 Waveshare 1.54" E-Paper Joule Summary Display
 *
 * Pulls compact forecast data from Joule Bridge:
 *   GET /api/hmi/summary
 *
 * Libraries:
 * - ArduinoJson
 * - GxEPD2
 * - Adafruit GFX Library
 *
 * Board:
 * - ESP32S3 Dev Module (or Waveshare ESP32-S3 board profile)
 *
 * NOTE ON PINS:
 * Waveshare ESP32-S3 e-paper variants can differ. Update the pin constants below
 * to match your exact board's silkscreen/wiki pinout if needed.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include <GxEPD2_BW.h>
#include <Fonts/FreeMonoBold9pt7b.h>
#include <Fonts/FreeMonoBold12pt7b.h>
#include <Fonts/FreeSansBold18pt7b.h>

// -------------------- User Config --------------------
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// Example: http://192.168.0.103:8080/api/hmi/summary
const char* SUMMARY_URL = "http://192.168.0.103:8080/api/hmi/summary";

// Update cadence: e-paper should refresh infrequently.
const unsigned long POLL_INTERVAL_MS = 5UL * 60UL * 1000UL;
const uint32_t HTTP_TIMEOUT_MS = 12000;

// Optional timezone for updatedAt display if you later expand formatting.
const long TZ_OFFSET_SECONDS = -5L * 3600L;

// -------------------- Display Pins --------------------
// Default values below are common for ESP32 + Waveshare wiring examples.
// If your board differs, change these 5 pins.
static const int EPD_CS   = 10;
static const int EPD_DC   = 9;
static const int EPD_RST  = 8;
static const int EPD_BUSY = 7;

// Not all boards need explicit SCK/MOSI remap. Most use hardware SPI defaults.
// If needed:
// SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, EPD_CS);

// 1.54" 200x200 b/w panel family
GxEPD2_BW<GxEPD2_154_D67, GxEPD2_154_D67::HEIGHT> display(
  GxEPD2_154_D67(EPD_CS, EPD_DC, EPD_RST, EPD_BUSY)
);

struct SummaryData {
  bool success = false;
  String location = "-";
  String monthName = "-";
  String mode = "-";
  float targetTemp = NAN;
  float nightTemp = NAN;
  float totalMonthlyCost = NAN;
  float variableCost = NAN;
  float fixedCost = NAN;
  float totalEnergyKwh = NAN;
  uint64_t updatedAt = 0;
};

unsigned long lastPollAt = 0;
bool hasEverRendered = false;
SummaryData lastData;

static String safeModeLabel(const String& raw) {
  String m = raw;
  m.toLowerCase();
  if (m == "heating" || m == "heat") return "Heat";
  if (m == "cooling" || m == "cool") return "Cool";
  if (m == "auto") return "Auto";
  if (m == "off") return "Off";
  if (m.length() == 0) return "-";
  return m;
}

static String tempPair(const SummaryData& d) {
  if (isnan(d.targetTemp) && isnan(d.nightTemp)) return "--/--F";
  char buf[24];
  const int dayT = isnan(d.targetTemp) ? -1 : (int)lround(d.targetTemp);
  const int nightT = isnan(d.nightTemp) ? -1 : (int)lround(d.nightTemp);
  snprintf(buf, sizeof(buf), "%s/%sF",
    dayT < 0 ? "--" : String(dayT).c_str(),
    nightT < 0 ? "--" : String(nightT).c_str());
  return String(buf);
}

static String dollars(float amount) {
  if (isnan(amount)) return "$--.--";
  char buf[24];
  snprintf(buf, sizeof(buf), "$%.2f", amount);
  return String(buf);
}

static String kwhLabel(float kwh) {
  if (isnan(kwh)) return "Energy -- kWh";
  char buf[32];
  snprintf(buf, sizeof(buf), "Energy %.0f kWh", kwh);
  return String(buf);
}

bool fetchSummary(SummaryData& out) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.begin(SUMMARY_URL);

  const int code = http.GET();
  if (code != HTTP_CODE_OK) {
    http.end();
    return false;
  }

  const String body = http.getString();
  http.end();

  StaticJsonDocument<2048> doc;
  const DeserializationError err = deserializeJson(doc, body);
  if (err) {
    return false;
  }

  out.success = doc["success"] | false;
  if (!out.success) return false;

  out.location = String((const char*)(doc["location"] | "-"));
  out.monthName = String((const char*)(doc["monthName"] | "-"));
  out.mode = String((const char*)(doc["mode"] | "-"));

  out.targetTemp = doc["targetTemp"].isNull() ? NAN : (float)doc["targetTemp"].as<float>();
  out.nightTemp = doc["nightTemp"].isNull() ? NAN : (float)doc["nightTemp"].as<float>();
  out.totalMonthlyCost = doc["totalMonthlyCost"].isNull() ? NAN : (float)doc["totalMonthlyCost"].as<float>();
  out.variableCost = doc["variableCost"].isNull() ? NAN : (float)doc["variableCost"].as<float>();
  out.fixedCost = doc["fixedCost"].isNull() ? NAN : (float)doc["fixedCost"].as<float>();
  out.totalEnergyKwh = doc["totalEnergyKwh"].isNull() ? NAN : (float)doc["totalEnergyKwh"].as<float>();
  out.updatedAt = doc["updatedAt"].isNull() ? 0ULL : doc["updatedAt"].as<uint64_t>();

  return true;
}

void drawCenteredText(const String& text, int16_t y, const GFXfont* font) {
  display.setFont(font);
  int16_t x1, y1;
  uint16_t w, h;
  display.getTextBounds(text, 0, y, &x1, &y1, &w, &h);
  int16_t x = (display.width() - (int16_t)w) / 2;
  if (x < 0) x = 0;
  display.setCursor(x, y);
  display.print(text);
}

void renderSummary(const SummaryData& d, const String& statusLine = "") {
  display.setFullWindow();
  display.firstPage();
  do {
    display.fillScreen(GxEPD_WHITE);
    display.setTextColor(GxEPD_BLACK);

    drawCenteredText("Joule", 22, &FreeMonoBold12pt7b);

    String topLine = d.monthName;
    if (topLine.length() == 0 || topLine == "-") topLine = "Summary";
    drawCenteredText(topLine, 40, &FreeMonoBold9pt7b);

    String loc = d.location;
    if (loc.length() > 24) {
      loc = loc.substring(0, 24);
    }
    drawCenteredText(loc, 58, &FreeMonoBold9pt7b);

    drawCenteredText(dollars(d.totalMonthlyCost), 105, &FreeSansBold18pt7b);

    String modeTemp = safeModeLabel(d.mode) + "  " + tempPair(d);
    drawCenteredText(modeTemp, 132, &FreeMonoBold9pt7b);

    String costs = "Var " + dollars(d.variableCost) + "  Fix " + dollars(d.fixedCost);
    drawCenteredText(costs, 154, &FreeMonoBold9pt7b);

    drawCenteredText(kwhLabel(d.totalEnergyKwh), 176, &FreeMonoBold9pt7b);

    String footer = statusLine.length() ? statusLine : "OK";
    if (footer.length() > 28) footer = footer.substring(0, 28);
    drawCenteredText(footer, 196, &FreeMonoBold9pt7b);
  } while (display.nextPage());
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Connecting WiFi");
  const unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - start) < 30000) {
    Serial.print('.');
    delay(400);
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("WiFi connected: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi not connected (will retry in loop)");
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);

  connectWifi();

  display.init(115200, true, 2, false);
  display.setRotation(0);

  SummaryData boot;
  boot.monthName = "Booting";
  boot.location = "Waveshare ESP32-S3";
  boot.totalMonthlyCost = NAN;
  renderSummary(boot, "Starting up...");
}

void loop() {
  const unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }

  if ((now - lastPollAt >= POLL_INTERVAL_MS) || !hasEverRendered) {
    lastPollAt = now;

    SummaryData current;
    if (fetchSummary(current)) {
      lastData = current;
      renderSummary(lastData, "Bridge sync OK");
      hasEverRendered = true;
      Serial.println("Rendered /api/hmi/summary successfully.");
    } else {
      if (hasEverRendered) {
        renderSummary(lastData, "Bridge unavailable");
      } else {
        SummaryData err;
        err.monthName = "No Data";
        err.location = "Check bridge URL";
        renderSummary(err, "Fetch failed");
      }
      Serial.println("Failed to fetch /api/hmi/summary.");
    }
  }

  delay(200);
}
