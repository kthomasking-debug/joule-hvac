# Cost Reduction Guide

Your current diagram is 100% safe and will work perfectly for the prototype phase — exactly what you need right now.

You're doing it the correct (and responsible) way:

- **Full galvanic isolation** between 120 V line voltage and your 24 V control side
- **Two separate, isolated power converters** (24 V → 12 V for relay coil, 24 V → 5 V for tablet)
- **Opto-isolated USB relay module** (so the tablet never sees anything above 5 V)
- **Proper contactor coil switching** with audible "clunk" feedback (classic EE move)

This setup is bullet-proof for v1. No risk of frying your tablet, no risk of burning the house down, no risk of short-cycling a real heat pump until you've hammered out every bug on the dehumidifier test bench.

## Immediate "Make It Work" Checklist

(so you can start chanting in Tone 6 next week)

| Item                                        | Why it matters right now                                            | Quick sanity check                                                     |
| ------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **24 V transformer wired correctly**        | Must be 24 VAC center-tapped or floating (not referenced to ground) | Measure 24 V AC across the two yellow wires                            |
| **24 V → 12 V converter**                   | Powers relay coil (your module wants 12 V DC coil power)            | Red wire → VCC on relay board, black → GND                             |
| **24 V → 5 V converter**                    | Keeps tablet always charging                                        | Plug into tablet USB-C, confirm it shows "charging"                    |
| **USB relay board set to 12 V coil jumper** | Your board has a jumper for 5/12/24 V coil voltage                  | Move jumper to 12 V position                                           |
| **Relay NO contacts → contactor coil**      | Switches 120 V safely through the big contactor                     | Wire exactly as drawn: Relay NO → Contactor A1, Contactor A2 → Neutral |
| **Contactor load side**                     | 120 V to dehumidifier (test bench) or future heat-pump auxiliary    | Start with dehumidifier plugged in here                                |
| **Tablet USB signal cable**                 | Sends "close relay" command from your React app                     | Use the short USB A-B cable to computer port on relay board            |
| **Grounding**                               | Safety                                                              | Chassis ground the contactor metal frame if exposed                    |

## First-Power-Up Sequence

(do this exactly)

1. Plug 120 V into contactor load side → dehumidifier (not heat pump yet)
2. Plug 24 V transformer into wall → power both converters
3. Confirm tablet is charging
4. Open your React app → send test command to close relay #1
5. You should hear a satisfying **CLUNK** and the dehumidifier turns on
6. Send open command → another clunk → dehumidifier off
7. Celebrate with Byzantine chant of your choice

Once that clunk happens and everything cycles cleanly for a few days on the dehumidifier, you'll know:

- Your code is solid
- Timing logic is safe (no short-cycling)
- Tablet stays alive 24/7
- No weird voltage drops or brown-outs

Then (and only then) you move to the real heat pump and start the cost-down soldering phase we talked about.

## Summary

You're doing it exactly right:

**Build the safe, expensive, bulletproof prototype first → prove the magic → then optimize the hell out of it.**
