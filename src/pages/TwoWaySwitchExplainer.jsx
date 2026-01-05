import React, { useState } from "react";

export default function TwoWaySwitchExplainer() {
  const [sw1, setSw1] = useState(0); // 0 = up, 1 = down
  const [sw2, setSw2] = useState(0);

  const travelerHot =
    sw1 === 0 ? (sw2 === 0 ? "RED" : "BLACK") : sw2 === 0 ? "BLACK" : "RED";

  const lightOn = sw1 !== sw2;

  return (
    <div style={styles.page}>
      <h1>Two-Way (3-Way) Switch Wiring Explained</h1>

      <p style={styles.lead}>
        This page explains why one traveler reads ~40 V when "off", why neutrals
        are tied together, and how either switch can control the light.
      </p>

      {/* SWITCH CONTROLS */}
      <div style={styles.controls}>
        <button onClick={() => setSw1(sw1 ^ 1)}>
          Toggle Switch 1 ({sw1 ? "DOWN" : "UP"})
        </button>
        <button onClick={() => setSw2(sw2 ^ 1)}>
          Toggle Switch 2 ({sw2 ? "DOWN" : "UP"})
        </button>
      </div>

      <div style={styles.status}>
        <div>
          🔥 Hot traveler: <b>{travelerHot}</b>
        </div>
        <div>
          💡 Light:{" "}
          <b style={{ color: lightOn ? "#7CFF7C" : "#FF7C7C" }}>
            {lightOn ? "ON" : "OFF"}
          </b>
        </div>
      </div>

      {/* MAIN DIAGRAM */}
      <pre style={styles.diagram}>
{`
 PANEL                    SWITCH 1                 SWITCH 2                LIGHT
 -----                    --------                 --------                -----
  HOT (BLK) ─────┐          ┌───────┐   RED ──────┐ ┌───────┐
                 │          │  COM  │────────────┼▶│  COM  │───────┐
                 │          │       │             │ │       │       │
  NEUT (WHT) ────┼──────────┼─────────────────────┼─┼─────────────────────┼───┐
                 │          │       │             │ │       │       │       │   │
  GND (BARE) ────┴──────────┴───────┴─────────────┴─┴───────┴───────┴───────┴───┘

 TRAVELERS:
   RED   ────────────────┐
   BLACK ────────────────┘

 Current hot traveler: ${travelerHot}
 Light state: ${lightOn ? "ON" : "OFF"}
`}
      </pre>

      {/* WHY 40V */}
      <section>
        <h2>Why do I see ~40 V on the "off" traveler?</h2>

        <p>
          This is <b>induced (phantom) voltage</b>, caused by electromagnetic
          coupling between parallel conductors in the same cable.
        </p>

        <pre style={styles.diagram}>
{`
 HOT (120V AC)  ~~~~~~~~
                ↑ Magnetic field
                ↓ Electric field
 DEAD TRAVELER ~~~~~~~~  →  ~40V measured by high-impedance meter
`}
        </pre>

        <h3>The physics</h3>

        <pre style={styles.code}>
{`
V_induced = ω · M · I

Where:
  ω = 2πf  (AC angular frequency)
  M = mutual inductance between conductors
  I = current on energized conductor
`}
        </pre>

        <p>
          A digital multimeter has very high input impedance, so it happily
          measures this voltage. The moment you connect a load or ground it,
          the voltage collapses to zero.
        </p>
      </section>

      {/* NEUTRALS */}
      <section>
        <h2>Why are neutrals tied together?</h2>

        <ul>
          <li>The neutral is <b>not switched</b> in lighting circuits</li>
          <li>It must travel uninterrupted from panel → load</li>
          <li>Splicing in the switch box is normal and NEC-required</li>
        </ul>

        <pre style={styles.diagram}>
{`
NEUTRAL PATH (ALWAYS CONTINUOUS)

 PANEL ────────────┬───────────┬────────── LIGHT
                   │           │
               SWITCH BOX   SWITCH BOX
`}
        </pre>
      </section>

      {/* NEC */}
      <section>
        <h2>NEC Code References</h2>

        <ul>
          <li>
            <b>NEC 404.2(C)</b> — Neutral required in switch boxes (modern code)
          </li>
          <li>
            <b>NEC 300.3(B)</b> — All conductors of a circuit must be run together
          </li>
          <li>
            <b>NEC 310.10(H)</b> — Inductive effects in AC conductors
          </li>
          <li>
            <b>NEC 200.2</b> — Neutral identification
          </li>
        </ul>
      </section>

      {/* SUMMARY */}
      <section>
        <h2>Summary</h2>
        <ul>
          <li>✔️ You have a correctly wired 3-way switch</li>
          <li>✔️ ~40 V is normal phantom voltage</li>
          <li>✔️ Neutrals are tied together because they are not switched</li>
          <li>✔️ Either switch can change which traveler is hot</li>
        </ul>
      </section>
    </div>
  );
}

const styles = {
  page: {
    background: "#0e1220",
    color: "#eaeaff",
    padding: 20,
    fontFamily: "system-ui, monospace",
  },
  lead: { opacity: 0.85 },
  controls: { display: "flex", gap: 10, marginBottom: 10 },
  status: { marginBottom: 10, fontSize: 16 },
  diagram: {
    background: "#000",
    padding: 12,
    borderRadius: 8,
    overflowX: "auto",
    fontSize: 13,
  },
  code: {
    background: "#111",
    padding: 10,
    borderRadius: 6,
    fontSize: 14,
  },
};