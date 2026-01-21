/*
 * Simple Arduino sketch to control relays via serial commands:
 * Example commands (newline-terminated):
 *   RELAY 0 ON\n
 *   RELAY 0 OFF\n
 * The module toggles digital pins (adjust pin assignments per hardware).
 */

const int RELAY_PINS[] = {2, 3, 4, 5}; // modify to match wiring
const int RELAY_COUNT = sizeof(RELAY_PINS) / sizeof(int);

String buffer = "";

void setup() {
  Serial.begin(9600);
  for (int i = 0; i < RELAY_COUNT; i++) {
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], LOW);
  }
}

void processCommand(String cmd) {
  cmd.trim();
  // parse: RELAY <index> ON|OFF
  if (cmd.startsWith("RELAY")) {
    // simple split
    int firstSpace = cmd.indexOf(' ');
    if (firstSpace < 0) return;
    String rest = cmd.substring(firstSpace + 1);
    int secondSpace = rest.indexOf(' ');
    if (secondSpace < 0) return;
    String idxStr = rest.substring(0, secondSpace);
    String stateStr = rest.substring(secondSpace + 1);
    int idx = idxStr.toInt();
    stateStr.toUpperCase();
    if (idx < 0 || idx >= RELAY_COUNT) return;
    bool on = stateStr == "ON";
    digitalWrite(RELAY_PINS[idx], on ? HIGH : LOW);
    Serial.print("OK "); Serial.println(cmd);
  }
}

void loop() {
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\n') {
      processCommand(buffer);
      buffer = "";
    } else {
      buffer += c;
    }
  }
}
