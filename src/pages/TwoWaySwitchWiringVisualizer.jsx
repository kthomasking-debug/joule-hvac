import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Zap, Lightbulb, ArrowLeftRight } from "lucide-react";
import AIExplanation from "../components/AIExplanation";

/**
 * TwoWaySwitchWiringVisualizer
 * - Animated "3-way" switch contacts (SPDT) for Switch 1 & Switch 2
 * - Highlights which traveler is hot (energized from LINE)
 * - Shows lamp ON when circuit completes (LINE -> S1 -> traveler -> S2 -> LOAD)
 * - Includes ASCII diagrams + induction formulas + NEC notes
 *
 * Notes:
 * - Models the most common "power at one end" 3-way topology:
 *   LINE -> S1 (COM), two travelers between switches, S2 COM -> lamp hot, neutral unswitched to lamp.
 */
export default function TwoWaySwitchWiringVisualizer() {
  // 0 = COM connected to traveler A (RED), 1 = COM connected to traveler B (BLACK)
  const [sw1, setSw1] = useState(0);
  const [sw2, setSw2] = useState(0);

  // In a standard 3-way, light is ON when both switches select the same traveler path
  // for the typical "line at S1, load at S2" configuration:
  // If S1 sends hot on RED and S2 selects RED -> ON; if mismatch -> OFF.
  const lightOn = sw1 === sw2;

  const travelerHot = sw1 === 0 ? "RED" : "BLACK"; // whichever S1 selects is energized
  const travelerOther = travelerHot === "RED" ? "BLACK" : "RED";

  const asciiMain = useMemo(() => {
    const hotMarkRed = travelerHot === "RED" ? "🔥 HOT" : "   off (~40V phantom)";
    const hotMarkBlk = travelerHot === "BLACK" ? "🔥 HOT" : "   off (~40V phantom)";
    return String.raw`
TWO-LOCATION LIGHT CONTROL (3-WAY SWITCHES)

PANEL / FEED              BOX A (SW1)            3-WIRE TRAVELERS         BOX B (SW2)             LIGHT
-----------               -------------          -----------------       -------------            -----
  HOT (BLK)  ───────────>  COM (SW1)  o----.     RED  -------------------> o  (SW2)  COM  ────>  Lamp Hot
                                            \    BLACK-------------------> o  (SW2)  (selects)
                                             \
                                              '---- (SW1 selects traveler)

  NEUT (WHT) ───────────────────────────────────────────────────────────────────────────────────> Lamp Neutral
  GND (BARE) ───────────────────────────────────────────────────────────────────────────────────> Grounds bonded

Traveler state right now:
  RED   : ${hotMarkRed}
  BLACK : ${hotMarkBlk}

Light: ${lightOn ? "ON ✅ (path complete)" : "OFF ⛔ (open path)"}
`.trim();
  }, [travelerHot, lightOn]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.titleRow}>
          <div>
            <h1 style={styles.h1}>Two-Way (3-Way) Switch Wiring — Visual + ASCII + NEC + Induction</h1>
            <p style={styles.sub}>
              Why you see ~40V on the "off" traveler, why neutrals are tied together, and how either switch controls the light.
            </p>
          </div>

          <div style={styles.badges}>
            <div style={styles.badge}>
              <Zap size={16} />
              <span>Traveler Hot: <b>{travelerHot}</b></span>
            </div>
            <div style={styles.badge}>
              <Lightbulb size={16} />
              <span>Light: <b style={{ color: lightOn ? "#7CFF7C" : "#FF7C7C" }}>{lightOn ? "ON" : "OFF"}</b></span>
            </div>
          </div>
        </div>

        <div style={styles.controls}>
          <SwitchToggle
            label="Switch 1 (LINE side)"
            position={sw1}
            setPosition={setSw1}
            hintLeft="Connect COM → RED"
            hintRight="Connect COM → BLACK"
          />
          <SwitchToggle
            label="Switch 2 (LOAD side)"
            position={sw2}
            setPosition={setSw2}
            hintLeft="Connect COM → RED"
            hintRight="Connect COM → BLACK"
          />
        </div>

        <div style={styles.note}>
          <b>Interpretation:</b> Switch 1 chooses which traveler is energized ("hot"). Switch 2 chooses which traveler connects to the lamp hot.
          If both choose the same traveler, the circuit completes and the lamp turns on.
        </div>
      </header>

      <main style={styles.main}>
        {/* Visual Circuit Row */}
        <div style={styles.grid}>
          <Card title="Animated switch contacts (like the contactor demo)">
            <div style={styles.visualRow}>
              <DeviceBox
                title="SW1 (SPDT)"
                subtitle="LINE → travelers"
                isEnergized={true}
              >
                <SpdtSwitchVisual
                  id="sw1"
                  position={sw1}
                  hotSide="LINE"
                  showHotDot
                  hotDotOnTraveler={travelerHot}
                  lightOn={lightOn}
                />
              </DeviceBox>

              <TravelerBundle
                hotTraveler={travelerHot}
                otherTraveler={travelerOther}
                lightOn={lightOn}
              />

              <DeviceBox
                title="SW2 (SPDT)"
                subtitle="travelers → LOAD"
                isEnergized={travelerHot !== null}
              >
                <SpdtSwitchVisual
                  id="sw2"
                  position={sw2}
                  hotSide="TRAVELERS"
                  showHotDot={false}
                  hotDotOnTraveler={travelerHot}
                  lightOn={lightOn}
                />
              </DeviceBox>

              <LampVisual on={lightOn} />
            </div>
          </Card>

          <Card title="ASCII wiring (what you'd post on Reddit)">
            <pre style={styles.pre}>{asciiMain}</pre>
          </Card>
        </div>

        <div style={styles.grid}>
          <Card title="Why ~40V on the off traveler? (phantom / induced voltage)">
            <p style={styles.p}>
              When one traveler is energized at 120VAC and the other runs alongside it in the same cable,
              capacitive + inductive coupling can induce a "ghost" voltage on the de-energized conductor.
              A DMM (high impedance) reads it; a real load collapses it.
            </p>

            <pre style={styles.pre}>
{String.raw`
HOT traveler (120VAC)  ~~~~~ AC field coupling ~~~~~  "OFF" traveler

Digital meter sees: 20–80V sometimes (often ~40V)
Low impedance load sees: ~0V (it collapses immediately)
`.trim()}
            </pre>

            <div style={styles.split}>
              <div>
                <div style={styles.kicker}>Inductive coupling (conceptual)</div>
                <pre style={styles.pre}>
{String.raw`
V_induced = ω · M · I

ω = 2πf
M = mutual inductance between conductors (geometry-dependent)
I = current on energized conductor
`.trim()}
                </pre>
              </div>
              <div>
                <div style={styles.kicker}>Capacitive coupling (conceptual)</div>
                <pre style={styles.pre}>
{String.raw`
I_c = ω · C · V
V_ghost ≈ I_c · R_meter

C = capacitance between conductors (close parallel wires => higher C)
R_meter ~ 10 MΩ (typical DMM)
`.trim()}
                </pre>
              </div>
            </div>

            <p style={styles.p}>
              <b>Reality check:</b> That ~40V is not "usable power." It's an artifact of measurement + coupling.
              If you test with a low-impedance tester or add a small load, it disappears.
            </p>
          </Card>

          <Card title="Why are neutrals tied together?">
            <p style={styles.p}>
              In typical lighting circuits, the switch only breaks the <b>hot</b>. Neutral remains continuous from panel to the fixture.
              So neutrals in the switch box are commonly spliced through (especially under modern code).
            </p>
            <pre style={styles.pre}>
{String.raw`
NEUTRAL (WHT) is NOT switched:

Panel neutral  ──────────┬───────────┬────────── Lamp neutral
                          |           |
                       splice      splice/through
`.trim()}
            </pre>
          </Card>
        </div>

        <div style={styles.grid}>
          <Card title="NEC wiring methods (high-level, practical)">
            <ul style={styles.ul}>
              <li>
                <b>300.3(B)</b>: All conductors of the same circuit should be run together (reduces inductive heating, stray fields).
              </li>
              <li>
                <b>404.2(C)</b>: Neutral in most switch boxes (exceptions exist, but modern practice is "bring neutral to the switch").
              </li>
              <li>
                <b>200.7 / 200.2</b>: White/gray reserved for grounded conductor (neutral) identification rules.
              </li>
              <li>
                <b>250.148</b>: Equipment grounds must be spliced/bonded in boxes.
              </li>
            </ul>

            <p style={styles.p}>
              The "keep conductors together" rule is the same intuition your brain had:
              it reduces weird coupling effects and avoids magnetic/eddy current problems.
            </p>
          </Card>

          <Card title="Quick troubleshooting checklist (for the Reddit scenario)">
            <ul style={styles.ul}>
              <li>
                ✅ Confirm you actually have a <b>3-way</b> (two switches controlling one light).
              </li>
              <li>
                ✅ Identify <b>COM</b> screws (usually black screw) vs traveler screws (brass).
              </li>
              <li>
                ✅ Expect one traveler to read "ghost" voltage with a DMM.
              </li>
              <li>
                ✅ Neutral splice is normal (neutral is not switched).
              </li>
              <li>
                ⚠️ If you see real load behavior issues (flicker, buzzing, warmth), stop and verify wiring / box fill / device rating.
              </li>
            </ul>
          </Card>
        </div>
      </main>

      {/* AI Explanation */}
      <div style={{ maxWidth: 1150, margin: "14px auto" }}>
        <AIExplanation
          title="Explanation (Plain English)"
          prompt={`You are viewing an animated educational visualizer for 3-way switch wiring. Explain what this visualization demonstrates in plain, conversational English:

What the animation currently shows:
- Switch 1 (LINE side): ${sw1 === 0 ? "COM → RED traveler" : "COM → BLACK traveler"}
- Switch 2 (LOAD side): ${sw2 === 0 ? "COM → RED traveler" : "COM → BLACK traveler"}
- Energized traveler: ${travelerHot} (carrying 120V from LINE)
- De-energized traveler: ${travelerOther} (showing ~40V phantom voltage on a multimeter)
- Circuit status: ${lightOn ? "COMPLETE - lamp is ON because both switches select the same traveler" : "OPEN - lamp is OFF because switches select different travelers"}

Educational concepts demonstrated by this visualization:
1. How the "power at one end" topology works: LINE connects to Switch 1 COM, two travelers run between switches, Switch 2 COM connects to lamp hot
2. Why the lamp only turns ON when both switches route power through the SAME traveler (creating a complete path)
3. Phantom voltage physics: The de-energized traveler shows ~40V on a meter due to electromagnetic coupling with the hot traveler in the same cable (mutual inductance)
4. Why the neutral wire is continuous and unswitched from panel to lamp
5. Real-world meter behavior: High-impedance multimeters detect induced voltage, but it disappears under load

This is an educational demonstration of electrical theory - explain what someone learns by interacting with this animation. Help them understand why their home's 3-way switches behave this way and why phantom voltage readings are normal and safe.`}
        />
      </div>

      <footer style={styles.footer}>
        Want this to match the "two romex wires" photo scenario exactly? Add one more diagram: "3-way switch loop / dead-end 3-way / feed at light vs feed at switch."
      </footer>
    </div>
  );
}

/* -------------------- UI PARTS -------------------- */

function Card({ title, children }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function SwitchToggle({ label, position, setPosition, hintLeft, hintRight }) {
  return (
    <div style={styles.toggleCard}>
      <div style={styles.toggleLabel}>{label}</div>
      <div style={styles.toggleRow}>
        <button
          onClick={() => setPosition(0)}
          style={{
            ...styles.toggleBtn,
            ...(position === 0 ? styles.toggleBtnOn : {}),
          }}
        >
          UP
          <div style={styles.toggleHint}>{hintLeft}</div>
        </button>
        <button
          onClick={() => setPosition(1)}
          style={{
            ...styles.toggleBtn,
            ...(position === 1 ? styles.toggleBtnOn : {}),
          }}
        >
          DOWN
          <div style={styles.toggleHint}>{hintRight}</div>
        </button>
      </div>
    </div>
  );
}

function DeviceBox({ title, subtitle, children }) {
  return (
    <div style={styles.device}>
      <div style={styles.deviceHdr}>
        <div style={styles.deviceTitle}>{title}</div>
        <div style={styles.deviceSub}>{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

/**
 * SPDT "contactor-like" visual:
 * - COM on left
 * - Two throws (RED, BLACK) on right
 * - Moving blade connects COM to one throw depending on position
 */
function SpdtSwitchVisual({ position, showHotDot, hotDotOnTraveler, lightOn }) {
  const throwA = "RED";
  const throwB = "BLACK";
  const selected = position === 0 ? throwA : throwB;

  return (
    <div style={styles.spdtWrap}>
      <div style={styles.spdtLegend}>
        <span style={styles.mono}>
          Selected: <b>{selected}</b>
        </span>
        <span style={{ ...styles.mono, opacity: 0.8 }}>
          (other is floating)
        </span>
      </div>

      <svg width="280" height="160" viewBox="0 0 280 160">
        {/* COM */}
        <circle cx="55" cy="80" r="10" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" />
        <text x="55" y="110" fontSize="11" textAnchor="middle" fill="currentColor">COM</text>

        {/* Throws */}
        <circle cx="225" cy="55" r="10" fill="#fb7185" stroke="#334155" strokeWidth="2" />
        <text x="225" y="35" fontSize="11" textAnchor="middle" fill="currentColor">RED</text>

        <circle cx="225" cy="105" r="10" fill="#94a3b8" stroke="#334155" strokeWidth="2" />
        <text x="225" y="135" fontSize="11" textAnchor="middle" fill="currentColor">BLACK</text>

        {/* Fixed stubs */}
        <line x1="65" y1="80" x2="110" y2="80" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
        <line x1="215" y1="55" x2="170" y2="55" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
        <line x1="215" y1="105" x2="170" y2="105" stroke="#334155" strokeWidth="6" strokeLinecap="round" />

        {/* Moving blade */}
        <AnimatePresence mode="wait">
          {position === 0 ? (
            <motion.line
              key="toRed"
              x1="110"
              y1="80"
              x2="170"
              y2="55"
              stroke={hotDotOnTraveler === "RED" ? "#7CFF7C" : "#64748b"}
              strokeWidth="8"
              strokeLinecap="round"
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: 1, pathLength: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            />
          ) : (
            <motion.line
              key="toBlack"
              x1="110"
              y1="80"
              x2="170"
              y2="105"
              stroke={hotDotOnTraveler === "BLACK" ? "#7CFF7C" : "#64748b"}
              strokeWidth="8"
              strokeLinecap="round"
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: 1, pathLength: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
            />
          )}
        </AnimatePresence>

        {/* Hot dot on selected traveler leaving switch */}
        {showHotDot && (
          <AnimatePresence>
            <motion.circle
              key={selected}
              cx="195"
              cy={selected === "RED" ? 55 : 105}
              r="6"
              fill="#7CFF7C"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: [1, 1.25, 1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
          </AnimatePresence>
        )}

        {/* Tiny "current" pulses when light is on */}
        <AnimatePresence>
          {lightOn && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
            >
              <circle cx="95" cy="80" r="4" fill="#7CFF7C" />
              <circle cx="140" cy={selected === "RED" ? 67 : 93} r="4" fill="#7CFF7C" />
              <circle cx="190" cy={selected === "RED" ? 55 : 105} r="4" fill="#7CFF7C" />
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
    </div>
  );
}

function TravelerBundle({ hotTraveler, otherTraveler, lightOn }) {
  const hotIsRed = hotTraveler === "RED";
  return (
    <div style={styles.bundle}>
      <div style={styles.bundleHdr}>
        <ArrowLeftRight size={16} />
        <span>Travelers (3-wire between boxes)</span>
      </div>

      <div style={styles.travelerRow}>
        <TravelerWire
          name="RED"
          energized={hotIsRed}
          lightOn={lightOn}
          note={hotIsRed ? "hot (120V)" : "floating (~40V phantom possible)"}
        />
        <TravelerWire
          name="BLACK"
          energized={!hotIsRed}
          lightOn={lightOn}
          note={!hotIsRed ? "hot (120V)" : "floating (~40V phantom possible)"}
        />
      </div>

      <div style={styles.bundleNote}>
        The "floating" traveler can read ghost voltage on a high-impedance meter due to coupling.
      </div>
    </div>
  );
}

function TravelerWire({ name, energized, lightOn, note }) {
  return (
    <div style={styles.traveler}>
      <div style={styles.travelerTop}>
        <span style={styles.mono}><b>{name}</b></span>
        <span style={{ ...styles.mini, opacity: 0.85 }}>{note}</span>
      </div>
      <div style={styles.wireTrack}>
        <motion.div
          style={{
            ...styles.wire,
            ...(energized ? styles.wireHot : styles.wireOff),
          }}
          animate={energized ? { opacity: [0.6, 1, 0.6] } : { opacity: 0.45 }}
          transition={energized ? { repeat: Infinity, duration: 1.2 } : { duration: 0.2 }}
        />
        <AnimatePresence>
          {energized && lightOn && (
            <motion.div
              initial={{ x: 0, opacity: 0 }}
              animate={{ x: 140, opacity: [0, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.0, ease: "easeInOut" }}
              style={styles.pulseDot}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LampVisual({ on }) {
  return (
    <div style={styles.lamp}>
      <div style={styles.lampHdr}>Lamp</div>
      <div style={styles.lampBody}>
        <motion.div
          animate={{
            filter: on ? "drop-shadow(0px 0px 18px rgba(124,255,124,0.8))" : "none",
            opacity: on ? 1 : 0.55,
            scale: on ? 1.02 : 1,
          }}
          transition={{ type: "spring", stiffness: 250, damping: 20 }}
          style={styles.bulbWrap}
        >
          <Lightbulb size={56} />
          <div style={{ ...styles.lampText, color: on ? "#7CFF7C" : "#FF7C7C" }}>
            {on ? "ON" : "OFF"}
          </div>
        </motion.div>
      </div>
      <div style={styles.lampNote}>
        Neutral is continuous; only hot is switched.
      </div>
    </div>
  );
}

/* -------------------- STYLES -------------------- */

const styles = {
  page: {
    minHeight: "100vh",
    padding: 18,
    background: "#0b1020",
    color: "#e8ecff",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  },
  header: {
    maxWidth: 1150,
    margin: "0 auto 14px",
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  titleRow: { display: "flex", gap: 14, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" },
  h1: { margin: 0, fontSize: 20, fontWeight: 850, letterSpacing: 0.2 },
  sub: { marginTop: 6, marginBottom: 0, opacity: 0.85, lineHeight: 1.35 },
  badges: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  badge: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 13,
  },
  controls: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 },
  note: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: "rgba(80,160,255,0.10)",
    border: "1px solid rgba(80,160,255,0.25)",
    lineHeight: 1.35,
    fontSize: 13.5,
  },
  main: { maxWidth: 1150, margin: "0 auto" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 },
  card: {
    borderRadius: 16,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
    padding: 14,
  },
  cardTitle: { fontWeight: 800, marginBottom: 10 },
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
  p: { marginTop: 0, opacity: 0.92, lineHeight: 1.5, fontSize: 13.5 },
  ul: { margin: 0, paddingLeft: 18, lineHeight: 1.55, fontSize: 13.5, opacity: 0.92 },
  split: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 },
  kicker: { fontSize: 12, opacity: 0.85, marginBottom: 6, fontWeight: 700 },

  toggleCard: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(0,0,0,0.22)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  toggleLabel: { fontWeight: 800, marginBottom: 8, fontSize: 13.5 },
  toggleRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  toggleBtn: {
    borderRadius: 12,
    padding: "10px 10px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#e8ecff",
    cursor: "pointer",
    textAlign: "left",
    fontWeight: 800,
  },
  toggleBtnOn: {
    background: "rgba(124,255,124,0.12)",
    border: "1px solid rgba(124,255,124,0.30)",
  },
  toggleHint: { fontSize: 11, opacity: 0.8, marginTop: 4, fontWeight: 600 },

  visualRow: { display: "flex", gap: 12, alignItems: "stretch", flexWrap: "wrap" },
  device: {
    flex: "0 0 auto",
    width: 320,
    borderRadius: 16,
    padding: 12,
    background: "rgba(0,0,0,0.22)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  deviceHdr: { marginBottom: 8 },
  deviceTitle: { fontWeight: 900 },
  deviceSub: { fontSize: 12, opacity: 0.8 },

  spdtWrap: { marginTop: 6 },
  spdtLegend: { display: "flex", gap: 10, alignItems: "baseline", marginBottom: 6 },

  bundle: {
    flex: "0 0 auto",
    width: 420,
    borderRadius: 16,
    padding: 12,
    background: "rgba(0,0,0,0.22)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  bundleHdr: { display: "flex", gap: 8, alignItems: "center", fontWeight: 900, marginBottom: 8 },
  travelerRow: { display: "grid", gridTemplateColumns: "1fr", gap: 10 },
  bundleNote: { marginTop: 10, fontSize: 12, opacity: 0.8, lineHeight: 1.35 },

  traveler: {
    borderRadius: 14,
    padding: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  travelerTop: { display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 },
  wireTrack: { position: "relative", height: 16, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" },
  wire: { height: "100%", width: "100%", borderRadius: 999 },
  wireHot: { background: "rgba(124,255,124,0.40)" },
  wireOff: { background: "rgba(148,163,184,0.22)" },
  pulseDot: { position: "absolute", top: 2, left: 0, width: 12, height: 12, borderRadius: 999, background: "rgba(124,255,124,0.85)" },

  lamp: {
    flex: "0 0 auto",
    width: 200,
    borderRadius: 16,
    padding: 12,
    background: "rgba(0,0,0,0.22)",
    border: "1px solid rgba(255,255,255,0.10)",
    display: "flex",
    flexDirection: "column",
  },
  lampHdr: { fontWeight: 900, marginBottom: 6 },
  lampBody: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  bulbWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  lampText: { fontWeight: 1000, letterSpacing: 1, fontSize: 14 },
  lampNote: { fontSize: 11.5, opacity: 0.8, marginTop: 10, lineHeight: 1.35 },

  mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace" },
  mini: { fontSize: 11.5 },

  footer: { maxWidth: 1150, margin: "14px auto 0", opacity: 0.7, fontSize: 12.5 },
};