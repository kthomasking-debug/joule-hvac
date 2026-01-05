import React, { useMemo, useState } from "react";

const Section = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={styles.card}>
      <button onClick={() => setOpen(!open)} style={styles.cardHeaderBtn}>
        <span style={styles.cardTitle}>{title}</span>
        <span style={styles.chev}>{open ? "▾" : "▸"}</span>
      </button>
      {open ? <div style={styles.cardBody}>{children}</div> : null}
    </div>
  );
};

const AsciiBlock = ({ label, text }) => (
  <div style={{ marginBottom: 16 }}>
    {label ? <div style={styles.blockLabel}>{label}</div> : null}
    <pre style={styles.pre}>{text}</pre>
  </div>
);

export default function WholeHouseVentilationEcobeeGuide() {
  const [filter, setFilter] = useState("all");

  const diagrams = useMemo(
    () => [
      {
        id: "baseline",
        type: "system",
        title: "1) Baseline: 2-story + Furnace + AC (no dedicated ventilation)",
        ascii: String.raw`
                (ATTIC)
          ______________________
         /                      \
        /                        \
       /__________________________\
       |   2nd FLOOR (Bedrooms)   |
       |   [Supply registers]     |
       |      ^   ^   ^           |
       |      |   |   |           |
       |    (SUPPLY DUCTS)        |
       |__________________________|
       |   1st FLOOR (Living)     |
       |  [Return grille]  --->   |
       |           |              |
       |           v              |
       |     +--------------+     |
       |     |  AIR HANDLER |     |
       |     | Furnace + AC |     |
       |     +--------------+     |
       |        ^        |        |
       |     RETURN     SUPPLY    |
       |__________________________|
            OUTDOOR UNIT (AC)
                 [CONDENSER]
`.trim(),
      },

      {
        id: "exhaust_only",
        type: "system",
        title: "2) Exhaust-Only Ventilation (bath fans / continuous exhaust)",
        ascii: String.raw`
                (ATTIC)
          ______________________
         /   Bath Fan (EXH)  --->\=====> outside
        /_________________________\
       |   2nd FLOOR              |
       |  Bathroom  [EXH FAN] --->|=====> outside
       |                          |
       |  Bedrooms (make-up air)  |
       |   <---- <---- <----      |
       |  (infiltration/vents)    |
       |__________________________|
       |   1st FLOOR              |
       |   Kitchen hood (EXH) --->|=====> outside
       |                          |
       |  [Return] -> Air Handler |
       |__________________________|

    PRO: simple, cheap
    CON: uncontrolled make-up air path; can depressurize/ backdraft in some homes
`.trim(),
      },

      {
        id: "supply_only",
        type: "system",
        title: "3) Supply-Only Ventilation (dedicated fan bringing outdoor air in)",
        ascii: String.raw`
                (ATTIC)
          ______________________
         /                      \
        /________________________\
       |   2nd FLOOR              |
       |  Bedrooms (pressurized)  |
       |     air leaks out  ----> |
       |__________________________|
       |   1st FLOOR              |
       |   OUTSIDE AIR IN         |
outside |=====> [SUPPLY FAN] =====|=====> to duct / grille
       |              |           |
       |              v           |
       |        +--------------+  |
       |        | AIR HANDLER  |  |
       |        | Furnace + AC |  |
       |        +--------------+  |
       |__________________________|

    PRO: controlled intake location (filterable)
    CON: can drive moisture/pressure issues if not balanced
`.trim(),
      },

      {
        id: "hrv",
        type: "system",
        title: "4) Balanced Ventilation: HRV (Heat Recovery Ventilator)",
        ascii: String.raw`
                (ATTIC)
          ______________________
         /                      \
        /________________________\
       |   2nd FLOOR              |
       |  Bathrooms (stale air)   |
       |     |                    |
       |     v                    |
       |   (EXHAUST DUCT)         |
       |__________________________|
       |   1st FLOOR              |
       |  Fresh air to living     |
       |     ^                    |
       |     | (SUPPLY DUCT)      |
       |     |                    |
outside |<====|====+---------+====|====> outside
  stale |====>|====|   HRV   |====|====> fresh
       |      +---------+         |
       |        |     |           |
       |   to rooms   from baths  |
       |__________________________|

    Best when: you want balanced fresh air + heat recovery, moisture-neutral-ish
`.trim(),
      },

      {
        id: "erv",
        type: "system",
        title: "5) Balanced Ventilation: ERV (Energy Recovery Ventilator)",
        ascii: String.raw`
                (ATTIC)
          ______________________
         /                      \
        /________________________\
       |   2nd FLOOR              |
       |  Bedrooms / Baths        |
       |     |        ^           |
       |     v        |           |
       |  stale air   |  fresh air|
       |__________________________|
       |   1st FLOOR              |
outside |<====+----------------+====> outside
       |     |       ERV      |
       |====>| (heat + moisture) |====>
       |     +----------------+
       |      |            |
       |   supply to     exhaust from
       |   living/bed    baths/laundry
       |__________________________|

    Best when: you care about BOTH sensible + some latent (moisture) exchange
`.trim(),
      },

      {
        id: "cfis",
        type: "system",
        title: "6) Central-Fan-Integrated Supply (Fresh-air damper + HVAC blower, aka CFIS-style)",
        ascii: String.raw`
                (ATTIC)
          ______________________
         /                      \
        /________________________\
       |   2nd FLOOR              |
       |  Supplies to bedrooms    |
       |      ^   ^   ^           |
       |      |   |   |           |
       |__________________________|
       |   1st FLOOR              |
outside |=====> [MOTOR DAMPER] ====\
       |                          |
       |                      +--------+
       |                      | RETURN |
       |   [Return grille] -->| PLENUM |----\
       |                      +--------+     \
       |                         |            \
       |                         v             \
       |                   +--------------+     \
       |                   | AIR HANDLER  |      \
       |                   | Furnace + AC |       ---> SUPPLY to house
       |                   +--------------+
       |                         ^
       |                      FILTER
       |__________________________|

    Controller logic (Ecobee or other):
    - Open damper X min/hr
    - Run blower to distribute fresh air
`.trim(),
      },

      // New #1 you asked for:
      {
        id: "dedicated_dehu_with_erv",
        type: "system",
        title: "7) ERV/HRV + Dedicated Whole-Home Dehumidifier (common in humid climates)",
        ascii: String.raw`
                (ATTIC / MECH)
          _____________________________
         /                             \
        /_______________________________\
       |   2nd FLOOR                     |
       |  Bedrooms / baths / returns     |
       |_________________________________|
       |   1st FLOOR (MECH CLOSET)       |
       |                                 |
outside |====> +--------+                 |
 fresh  |      |  ERV   |---+----> to supply trunk
 air    |<==== +--------+   |
 stale  |                   |
 air    |<---- from baths --+
       |                                 |
       |         +-------------------+    |
       |         |  DEHUMIDIFIER     |    |
       |         |  (dedicated duct) |    |
       |         +-------------------+    |
       |              |        ^          |
       |              v        |          |
       |         dry air out   return air |
       |                                 |
       |   +-------------------------+   |
       |   | AIR HANDLER (Furn+AC)   |   |
       |   +-------------------------+   |
       |_________________________________|

    Why it exists:
    - ERV brings fresh air (can add moisture in summer)
    - Dedicated dehu pulls moisture out regardless of AC runtime
`.trim(),
      },

      // New #2 you asked for:
      {
        id: "ecobee_wiring_summary",
        type: "wiring",
        title: "8) Ecobee wiring patterns: 24VAC (1-wire) vs Dry Contact (2-wire) + \"G tie-in\"",
        ascii: String.raw`
LEGEND:
  R = 24VAC hot from HVAC transformer
  C = 24VAC common
  G = fan/blower call
  ACC+ / ACC- = ecobee accessory terminals (can be 1-wire 24VAC OR 2-wire dry contact)

A) WRONG-ish for true ventilation (ventilator tied to G):
  Ecobee                 HVAC Board                     Ventilator / Damper
  -----                  ---------                      -------------------
   G  ------------------>   G  ----------------------->  "Run when fan runs"
   R  ------------------>   R
   C  ------------------>   C

  Result:
    - Ventilation only happens when blower runs
    - No independent ventilation minutes/hour
    - Often causes over-ventilation or under-ventilation

B) 1-WIRE ACC (Accessory needs 24VAC power switching)
   Example: 24VAC fresh-air damper actuator that needs 24VAC + common.
   Ecobee                 HVAC Board                     Damper Actuator
  -----                  ---------                      -------------------
  ACC+ ------------------> (switched 24V out) ---------->  Damper "OPEN" (24VAC)
   C  ----------------------------------------------->  Damper Common (C)

  Notes:
    - Only ONE conductor to the thermostat for control (ACC+)
    - The accessory shares the system C (common)

C) 2-WIRE ACC (Accessory is self-powered; ecobee provides DRY CONTACT)
   Example: HRV/ERV "interlock" terminals that want a contact closure.
   Ecobee                                     HRV/ERV Controller
  -----                                      -------------------
  ACC+ ------------------------------------->  IN1
  ACC- ------------------------------------->  IN2

  Notes:
    - ecobee closes ACC+ to ACC- like a switch (no voltage provided)
    - Your HRV/ERV provides its own control voltage internally

D) When the accessory is NOT 24VAC or needs isolation:
   Use a relay driven by ecobee (24VAC coil), and switch the accessory separately.

   Ecobee (ACC 1-wire 24VAC)   HVAC Board        Relay Coil (24VAC)      Relay Contacts
   -------------------------   ---------         ------------------      --------------
     ACC+ -------------------> (24V out) ----->  COIL+                     COM/NO -> accessory input
      C  ------------------------------------->  COIL- (C)

  Use relay contacts to close whatever the ventilator expects (dry contact, low voltage, etc).
`.trim(),
      },

      {
        id: "ecobee_damper_relay_detail",
        type: "wiring",
        title: "9) Ecobee → Relay → 24VAC fresh-air damper (clean 'universal' approach)",
        ascii: String.raw`
Goal: Drive a 24VAC damper (or anything weird) without ambiguity.

  +--------------------+          +--------------------+           +-------------------+
  |      ECOBEE        |          |     HVAC BOARD     |           |   DAMPER (24VAC)  |
  |                    |          |                    |           |                   |
  |   ACC+  o-----.    |          |   R  o-----.       |           |  OPEN o-----+     |
  |              |     |          |         |  |       |           |             |     |
  |    C   o-----+-----+----------+---o C   |  |       |           |  COM  o-----+-----+
  |                    |          |         |  |       |
  +--------------------+          |   R (24V)  |       |
                                  +-----------+       |
                                              |       |
                                          +---v-------v---+
                                          |   RELAY COIL   |
                                          |  (24VAC COIL)  |
                                          +---^-------^---+
                                              |       |
                                              |       |
                                          (from ACC+) (to C)

Relay contacts (COM/NO) switch 24VAC to damper OPEN:
  HVAC R (24V hot) ---> Relay COM
  Relay NO ----------> Damper OPEN
  Damper COM --------> HVAC C

Result:
  - ecobee controls relay timing
  - damper gets solid 24VAC power
  - works even if damper draws more current than ecobee accessory output should handle directly
`.trim(),
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    if (filter === "all") return diagrams;
    return diagrams.filter((d) => d.type === filter);
  }, [diagrams, filter]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.hTitle}>Whole-House Ventilation + Ecobee Visual Guide</div>
        <div style={styles.hSub}>
          2-story home cutaways • Exhaust/Supply/HRV/ERV • CFIS • Dedicated Dehu • Ecobee ACC wiring patterns (24VAC vs dry contact)
        </div>

        <div style={styles.toolbar}>
          <span style={styles.toolbarLabel}>Show:</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={styles.select}>
            <option value="all">All</option>
            <option value="system">Systems</option>
            <option value="wiring">Ecobee wiring</option>
          </select>
        </div>

        <div style={styles.note}>
          <b>Quick rule of thumb:</b> If your ventilator/HRV/ERV wants a <b>contact closure</b>, wire it as <b>2-wire ACC dry contact</b>. If it needs <b>24VAC power switching</b>, use <b>1-wire ACC (ACC+ to device, device to C)</b> or (best universal) <b>ACC → relay → device</b>.
        </div>
      </header>

      <main style={styles.main}>
        <Section title="Read this first: 24VAC vs Dry Contact (what your ventilator expects)" defaultOpen>
          <div style={styles.p}>
            Many "whole-house ventilation" products are controlled in one of two ways:
            <ul style={styles.ul}>
              <li>
                <b>Dry contact input:</b> the device has its own internal power and just wants you to close a switch (common on HRV/ERV control inputs).
              </li>
              <li>
                <b>24VAC powered control:</b> the device/damper actuator needs 24VAC to open/run (common on motorized fresh-air dampers).
              </li>
            </ul>
            If you're not sure: look in the ventilator manual for phrases like "<i>dry contact</i>", "<i>interlock</i>", "<i>contact closure</i>", or "<i>24VAC</i> / <i>R and C</i>".
          </div>
        </Section>

        {filtered.map((d) => (
          <Section key={d.id} title={d.title} defaultOpen={false}>
            <AsciiBlock text={d.ascii} />
          </Section>
        ))}

        <Section title="Sanity checklist before you wire anything" defaultOpen={false}>
          <ul style={styles.ul}>
            <li>
              Confirm the ventilator/damper control terminals: <b>dry contact</b> vs <b>24VAC</b>.
            </li>
            <li>
              Check current thermostat cable conductor count: if you're using a wire-saving kit, you may want to pull <b>18/7</b> to future-proof.
            </li>
            <li>
              If your accessory draws meaningful current (some dampers/relays do), prefer <b>ecobee ACC → relay</b> so the thermostat isn't directly driving loads.
            </li>
            <li>
              After wiring, configure in ecobee: Equipment → Accessories → choose <b>Ventilator</b> / <b>HRV</b> / <b>ERV</b> as appropriate.
            </li>
          </ul>
        </Section>
      </main>

      <footer style={styles.footer}>
        Built for quick "what connects to what" understanding. If you paste your pictures + model numbers, I can map your exact wiring into one of these patterns.
      </footer>
    </div>
  );
}

const styles = {
  page: {
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    background: "#0b1020",
    color: "#e8ecff",
    minHeight: "100vh",
    padding: 18,
  },
  header: {
    maxWidth: 980,
    margin: "0 auto 16px",
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  hTitle: { fontSize: 22, fontWeight: 800, letterSpacing: 0.2 },
  hSub: { marginTop: 6, opacity: 0.85, lineHeight: 1.35 },
  toolbar: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    marginTop: 12,
  },
  toolbarLabel: { opacity: 0.9 },
  select: {
    background: "rgba(255,255,255,0.08)",
    color: "#e8ecff",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 10,
    padding: "8px 10px",
    outline: "none",
  },
  note: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: "rgba(80,160,255,0.10)",
    border: "1px solid rgba(80,160,255,0.25)",
    lineHeight: 1.35,
  },
  main: { maxWidth: 980, margin: "0 auto" },
  card: {
    borderRadius: 16,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
    marginBottom: 12,
    overflow: "hidden",
  },
  cardHeaderBtn: {
    width: "100%",
    textAlign: "left",
    padding: "14px 14px",
    background: "transparent",
    color: "inherit",
    border: "none",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  cardTitle: { fontWeight: 750, lineHeight: 1.2 },
  chev: { opacity: 0.85, fontSize: 18 },
  cardBody: { padding: "0 14px 14px" },
  blockLabel: { margin: "10px 0 6px", opacity: 0.85, fontSize: 13 },
  pre: {
    margin: 0,
    padding: 12,
    borderRadius: 12,
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.10)",
    overflowX: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
    fontSize: 12.5,
    lineHeight: 1.25,
    color: "#e8ecff",
    whiteSpace: "pre",
  },
  p: { lineHeight: 1.45, opacity: 0.95 },
  ul: { marginTop: 8, lineHeight: 1.5 },
  footer: {
    maxWidth: 980,
    margin: "16px auto 0",
    opacity: 0.75,
    fontSize: 13,
    padding: "10px 2px",
  },
};