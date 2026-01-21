/*
 * Arduino Thermostat Controller
 * Controls W (heat), Y (cool), G (fan) relays
 * Reads temperature from DS18B20 (optional)
 * Communicates via USB Serial
 * 
 * Commands:
 *   RELAY W|Y|G ON|OFF  - Control relay
 *   TEMP                - Read temperature
 *   STATUS              - Report all relay states
 * 
 * Auto-reports temperature every 5 seconds if sensor is present
 */

#include <OneWire.h>
#include <DallasTemperature.h>

// Relay pins (W, Y, G)
const int RELAY_W = 2;  // Heat
const int RELAY_Y = 3;  // Cool/Compressor
const int RELAY_G = 4;  // Fan

// Temperature sensor (DS18B20 on pin 5, optional)
// If you don't have a DS18B20, comment out these lines and set hasTempSensor = false
#define ONE_WIRE_BUS 5
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
bool hasTempSensor = false;

String buffer = "";

void setup() {
  Serial.begin(9600);
  
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
  
  Serial.println("Arduino Thermostat Controller Ready");
  Serial.println("Commands: RELAY W|Y|G ON|OFF, TEMP, STATUS");
}

void processCommand(String cmd) {
  cmd.trim();
  
  // RELAY W|Y|G ON|OFF
  if (cmd.startsWith("RELAY")) {
    int firstSpace = cmd.indexOf(' ');
    if (firstSpace < 0) return;
    String rest = cmd.substring(firstSpace + 1);
    int secondSpace = rest.indexOf(' ');
    if (secondSpace < 0) return;
    
    String terminal = rest.substring(0, secondSpace);
    String stateStr = rest.substring(secondSpace + 1);
    stateStr.toUpperCase();
    
    int pin = -1;
    if (terminal == "W") pin = RELAY_W;
    else if (terminal == "Y") pin = RELAY_Y;
    else if (terminal == "G") pin = RELAY_G;
    
    if (pin >= 0) {
      bool on = stateStr == "ON";
      digitalWrite(pin, on ? HIGH : LOW);
      Serial.print("OK RELAY ");
      Serial.print(terminal);
      Serial.print(" ");
      Serial.println(on ? "ON" : "OFF");
    } else {
      Serial.println("ERROR: Invalid terminal (use W, Y, or G)");
    }
  }
  // TEMP - read temperature
  else if (cmd == "TEMP") {
    if (hasTempSensor) {
      sensors.requestTemperatures();
      float tempC = sensors.getTempCByIndex(0);
      if (tempC != DEVICE_DISCONNECTED_C) {
        float tempF = (tempC * 9.0 / 5.0) + 32.0;
        Serial.print("TEMP ");
        Serial.print(tempC, 1);
        Serial.print(" ");
        Serial.println(tempF, 1);
      } else {
        Serial.println("TEMP ERROR: Sensor disconnected");
      }
    } else {
      Serial.println("TEMP ERROR: No sensor");
    }
  }
  // STATUS - report all relay states
  else if (cmd == "STATUS") {
    Serial.print("STATUS W:");
    Serial.print(digitalRead(RELAY_W) ? "ON" : "OFF");
    Serial.print(" Y:");
    Serial.print(digitalRead(RELAY_Y) ? "ON" : "OFF");
    Serial.print(" G:");
    Serial.println(digitalRead(RELAY_G) ? "ON" : "OFF");
  }
  else if (cmd.length() > 0) {
    Serial.print("ERROR: Unknown command: ");
    Serial.println(cmd);
  }
}

void loop() {
  // Read serial commands
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n') {
      processCommand(buffer);
      buffer = "";
    } else {
      buffer += c;
    }
  }
  
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



