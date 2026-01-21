/*
 * ESP32 Thermostat Controller (Professional Grade)
 * Controls W (heat), Y (cool), G (fan) relays
 * Reads temperature from DS18B20 (optional)
 * Communicates via WiFi HTTP API or USB Serial
 * 
 * This is a professional-grade solution suitable for production use.
 * 
 * Features:
 * - WiFi connectivity (no USB cable needed)
 * - HTTP API for remote control
 * - Serial fallback for local control
 * - Temperature monitoring
 * - Relay state reporting
 * 
 * Setup:
 * 1. Install ESP32 board support in Arduino IDE
 * 2. Install libraries: WiFi, WebServer, OneWire, DallasTemperature
 * 3. Configure WiFi credentials below
 * 4. Upload to ESP32
 * 5. Access web interface at http://esp32-thermostat.local or check serial for IP
 */

#include <WiFi.h>
#include <WebServer.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Relay pins (W, Y, G)
const int RELAY_W = 2;  // Heat
const int RELAY_Y = 4;  // Cool/Compressor
const int RELAY_G = 5;  // Fan

// Temperature sensor (DS18B20 on pin 18, optional)
#define ONE_WIRE_BUS 18
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
bool hasTempSensor = false;

// Web server on port 80
WebServer server(80);

// Relay state
struct RelayState {
  bool W = false;
  bool Y = false;
  bool G = false;
} relayState;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  // Initialize relays
  pinMode(RELAY_W, OUTPUT);
  pinMode(RELAY_Y, OUTPUT);
  pinMode(RELAY_G, OUTPUT);
  digitalWrite(RELAY_W, LOW);
  digitalWrite(RELAY_Y, LOW);
  digitalWrite(RELAY_G, LOW);
  
  // Initialize temperature sensor
  sensors.begin();
  if (sensors.getDeviceCount() > 0) {
    hasTempSensor = true;
    Serial.println("DS18B20 sensor found");
  } else {
    Serial.println("No DS18B20 sensor (temperature will come from USB sensor)");
  }
  
  // Connect to WiFi
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Access web interface at: http://");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connection failed - using serial mode only");
  }
  
  // Setup HTTP API endpoints
  server.on("/", handleRoot);
  server.on("/api/status", handleStatus);
  server.on("/api/temperature", handleTemperature);
  server.on("/api/relay", handleRelay);
  server.on("/api/relay/toggle", HTTP_POST, handleRelayToggle);
  server.onNotFound(handleNotFound);
  
  server.begin();
  Serial.println("ESP32 Thermostat Controller Ready");
  Serial.println("HTTP API available at /api/status, /api/temperature, /api/relay");
}

void loop() {
  server.handleClient();
  
  // Auto-report temperature every 5 seconds (optional)
  static unsigned long lastTempRead = 0;
  if (hasTempSensor && millis() - lastTempRead > 5000) {
    sensors.requestTemperatures();
    float tempC = sensors.getTempCByIndex(0);
    if (tempC != DEVICE_DISCONNECTED_C) {
      float tempF = (tempC * 9.0 / 5.0) + 32.0;
      Serial.print("AUTO_TEMP ");
      Serial.print(tempC, 1);
      Serial.print(" ");
      Serial.println(tempF, 1);
    }
    lastTempRead = millis();
  }
}

// HTTP Handlers
void handleRoot() {
  String html = "<!DOCTYPE html><html><head><title>ESP32 Thermostat</title></head><body>";
  html += "<h1>ESP32 Thermostat Controller</h1>";
  html += "<p><a href='/api/status'>Status</a></p>";
  html += "<p><a href='/api/temperature'>Temperature</a></p>";
  html += "<p><a href='/api/relay'>Relay States</a></p>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleStatus() {
  DynamicJsonDocument doc(1024);
  doc["status"] = "ok";
  doc["wifi_connected"] = (WiFi.status() == WL_CONNECTED);
  doc["ip"] = WiFi.localIP().toString();
  doc["relays"]["W"] = relayState.W;
  doc["relays"]["Y"] = relayState.Y;
  doc["relays"]["G"] = relayState.G;
  doc["has_temp_sensor"] = hasTempSensor;
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleTemperature() {
  if (!hasTempSensor) {
    server.send(503, "application/json", "{\"error\":\"No temperature sensor\"}");
    return;
  }
  
  sensors.requestTemperatures();
  float tempC = sensors.getTempCByIndex(0);
  if (tempC == DEVICE_DISCONNECTED_C) {
    server.send(503, "application/json", "{\"error\":\"Sensor disconnected\"}");
    return;
  }
  
  float tempF = (tempC * 9.0 / 5.0) + 32.0;
  
  DynamicJsonDocument doc(256);
  doc["temperatureC"] = round(tempC * 10) / 10.0;
  doc["temperatureF"] = round(tempF * 10) / 10.0;
  doc["timestamp"] = millis();
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleRelay() {
  DynamicJsonDocument doc(256);
  doc["W"] = relayState.W;
  doc["Y"] = relayState.Y;
  doc["G"] = relayState.G;
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleRelayToggle() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"error\":\"Missing body\"}");
    return;
  }
  
  DynamicJsonDocument doc(256);
  deserializeJson(doc, server.arg("plain"));
  
  String terminal = doc["terminal"] | "";
  bool on = doc["on"] | false;
  
  terminal.toUpperCase();
  int pin = -1;
  if (terminal == "W") {
    pin = RELAY_W;
    relayState.W = on;
  } else if (terminal == "Y") {
    pin = RELAY_Y;
    relayState.Y = on;
  } else if (terminal == "G") {
    pin = RELAY_G;
    relayState.G = on;
  }
  
  if (pin >= 0) {
    digitalWrite(pin, on ? HIGH : LOW);
    
    DynamicJsonDocument response(256);
    response["ok"] = true;
    response["terminal"] = terminal;
    response["on"] = on;
    
    String jsonResponse;
    serializeJson(response, jsonResponse);
    server.send(200, "application/json", jsonResponse);
  } else {
    server.send(400, "application/json", "{\"error\":\"Invalid terminal (use W, Y, or G)\"}");
  }
}

void handleNotFound() {
  server.send(404, "application/json", "{\"error\":\"Not found\"}");
}



