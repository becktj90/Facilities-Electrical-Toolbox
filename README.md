# Facilities Electrical Toolbox

A self-contained, browser-based electrical engineering reference and calculator application built for facilities electrical work. Based on *Ugly's Electrical References* and the **National Electrical Code (NEC)**.

Open `index.html` in any modern web browser — no build step, no server, no dependencies.

---

## Calculators & Reference Tables

| Category | What's Included |
|---|---|
| **Ohm's Law** | Solve for V, I, R from any two known values; power output |
| **DC Power** | P = VI, P = I²R, P = V²/R — choose any two to solve |
| **AC Power (1Ø & 3Ø)** | kVA, kW, kVAR, power factor, phase angle — single- and three-phase |
| **Reactance & Impedance** | XL, XC, series impedance Z, phase angle, circuit type |
| **Resonance** | Resonant frequency f₀, Q factor, bandwidth |
| **Power Factor Correction** | Capacitor bank sizing in kVAR; current reduction % |
| **Series/Parallel Circuits** | Resistance, capacitance, inductance — add as many components as needed |
| **Voltage Drop** | Single- and three-phase VD%; minimum wire size finder (NEC 310.15) |
| **Motor Calculations** | HP from FLA, FLA from HP; 1Ø & 3Ø with efficiency and PF |
| **Transformer Calculations** | kVA, primary/secondary currents, turns ratio; 1Ø & 3Ø with topology notes |
| **Conduit Fill** | THHN/THWN-2 in EMT with NEC fill limits; minimum conduit size suggestion |
| **Short Circuit** | Available fault current (transformer-only method) with asymmetrical factor |
| **UPS Sizing** | kVA, battery Ah, runtime sizing with standard tier recommendation |
| **Generator Sizing** | Motor/lighting/HVAC/other loads with NEC/NFPA 110 demand factors |
| **Hybrid Generator** | Fuel savings, CO₂ reduction, and payback period for battery-hybrid systems |
| **NEC Circuit Calculator** | Conductor sizing with temp correction, conduit fill derating, OCPD, EGC, VD |
| **Panel Schedule OCR** | Revit panel schedule image OCR, editable circuit rows, print layout (`panel-schedule.html`) |
| **LSI Breaker Visualizer** | Log-log TCC curve for Long-time / Short-time / Instantaneous trip settings |
| **BESS Peak-Shave** | LP-solver optimal load dispatch against battery + solar capacity |
| **Tap-Changer Calculator** | 23 kV / 480 V transformer tap position recommendation from measured secondary voltage |
| **Harmonics Tool** | Load-type harmonic profile lookup + %THD calculator with filter recommendations |
| **Hazardous Area Lookup** | NEC 500 Class/Division/Group/T-code for H₂, RP-1, CH₄, NH₃, LOX, N₂ |
| **IS Loop Verifier** | IEC 60079-11 entity parameter check (Voc, Isc, Ca, La vs Vmax, Imax, Ci, Li) |
| **Lighting VD Optimizer** | Minimum wire size for a lighting circuit to meet a target VD% |
| **Building Load Calc** | NEC 220 service load for lighting + receptacles with demand factors |
| **IP Rating Reference** | IEC 60529 IP code lookup table (solid particle and liquid ingress) |
| **NEMA Enclosures** | NEMA 250 enclosure type comparison chart |
| **NEC Code Tables** | NEC 310.15(B)(16) ampacity, conductor CM, THHN areas (Cu & Al) |
| **Photometrics** | Zonal cavity illuminance (fc & lux), lux ↔ fc conversion, inverse-square law |
| **Unit Conversions** | Power, apparent/reactive, voltage, current, resistance, capacitance, inductance, frequency, length, illuminance, temperature, energy |
| **Circular Mils** | Diameter (in) ↔ circular mils |
| **Conductor Reference** | NEC 310.15(B)(16) 75°C ampacity table — copper & aluminum |
| **Motor FLA Tables** | NEC Table 430.248 (1Ø) and NEC Table 430.250 (3Ø) |
| **Conduit Fill Tables** | EMT dimensions, max fill areas, THHN max conductor counts |
| **🚀 New Glenn Runner** | Side-scrolling launch arcade — dodge debris, collect propellant |
| **🧱 Bin Block Blaster** | Bubble-shooter puzzle game with pad-rat flavor |
| **🫥 Trying To Be Normal** | Comedy social-survival game about awkward everyday interactions |
| **🌌 Starforge Frontier** | Space-idle strategy game with mining, research, and sector expansion |

---

## Usage

1. Clone or download this repository.
2. Open `index.html` in any modern web browser (Chrome, Firefox, Safari, Edge).
3. Use the sidebar to navigate between sections.
4. On mobile, tap **[≡ MENU]** in the header to open the navigation.
5. Open **Panel Schedule OCR** (`panel-schedule.html`) for Revit schedule image extraction and print output.

---

## Install as PWA

The app is a fully offline-capable Progressive Web App.

**Desktop (Chrome / Edge):**
- Look for the install icon (⊕) in the address bar, or open the browser menu and choose **Install Facilities Electrical Toolbox**.

**Android (Chrome):**
- Open the page, tap the three-dot menu → **Add to Home screen**.

**iOS (Safari):**
- Tap the Share icon → **Add to Home Screen**.

Once installed, the app works fully offline — all assets are pre-cached by the service worker on first visit.

---

## Formulas Reference

All formulas are standard electrical engineering relationships as documented in:
- *Ugly's Electrical References* (Jones & Bartlett Learning)
- *National Electrical Code* (NFPA 70)
- IEEE standards (IEEE 519, IEEE 446, IEC 60079-11, IEC 60529)

---

> **Disclaimer:** Always verify calculations against the current edition of the NEC and applicable standards. Consult a licensed electrician or professional engineer for code compliance and safety-critical applications. This tool is provided for educational and reference purposes only.
