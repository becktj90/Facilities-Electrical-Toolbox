# New Glenn Runner — Game Design Specification

## Vision

**New Glenn Runner** is a physics-based browser arcade game set at Launch Complex 36, Cape Canaveral. The player pilots the Blue Origin New Glenn rocket through 15 discrete mission scenarios — from clearing the lightning protection towers on first flight, through stage separation, booster recovery, and trans-lunar injection. The game uses formula-based physics (real thrust, drag, gravity gradient, mass depletion) compressed in time for playability. Visual style is retro terminal green-amber-red on near-black, using VT323 and Share Tech Mono fonts.

---

## Hard Constraints

- Single HTML/CSS/JS static app — no build step, no bundler, no external runtime
- `js/arcade.js` is one IIFE `(function() { 'use strict'; ... }())`
- No external dependencies; vanilla Canvas 2D only
- `requestAnimationFrame` for game loop; fixed 1/60 s physics timestep with accumulator
- No `eval`, no `Function()`, no inline event handlers
- All randomness via seeded PRNG (mulberry32) for reproducibility
- `document.addEventListener('DOMContentLoaded', init)` at bottom of file
- Exports: `window.arcadeReset`, `window.arcadeFullscreen`, `window.arcadeToggleMute`, `window.arcadeTogglePause`, `window.arcadeToggleSettings`

---

## Key Constants

```js
const CW = 420;           // canvas logical width
const CH = 640;           // canvas logical height
const BASE_FPS = 60;
const STORAGE_KEY = 'newGlennRunnerStateV3';
const LEGACY_KEY  = 'newGlennRunnerSettingsV2';
```

---

## Vehicle Specification — New Glenn (7 m × 2-stage)

### Stage 1 — 7 × BE-4 (methane/LOX)
| Parameter | Value |
|---|---|
| Sea-level thrust | 19,928,000 N |
| Isp (sea level) | 310 s |
| Isp (vacuum) | 340 s |
| Propellant mass | 1,230,000 kg |
| Dry mass | 220,000 kg |
| Diameter | 7 m |
| Frontal area | π × 3.5² ≈ 38.5 m² |

### Stage 2 — 2 × BE-3U (hydrogen/LOX)
| Parameter | Value |
|---|---|
| Vacuum thrust | 1,779,000 N |
| Isp (vacuum) | 445 s |
| Propellant mass | 30,000 kg (simplified) |
| Dry mass | 12,000 kg |

---

## Physics Model

All formulas operate in SI units. Simulation advances at `dt × timeScale` per frame where `timeScale` is a per-level time compression factor (1–8×).

```js
// Gravity gradient
function gravity(y)     { return G0 * (R_EARTH / (R_EARTH + y)) ** 2; }

// Exponential atmosphere
function airDensity(y)  { return RHO0 * Math.exp(-y / H_SCALE); }

// Mach number (ISA standard atmosphere)
function mach(v, y) {
  const T = Math.max(216.65, 288.15 - 0.0065 * Math.min(y, 11000));
  return v / Math.sqrt(1.4 * 287.05 * T);
}

// Drag coefficient (subsonic / transonic / supersonic)
function dragCoeff(m) {
  if (m < 0.8)  return CD_SUB;   // 0.5
  if (m < 1.2)  return CD_TRANS; // 0.8
  return CD_SUPER;                // 0.4
}

// Dynamic pressure  q = ½ρv²
function dynamicPressure(rho, v) { return 0.5 * rho * v * v; }

// Isp interpolated from sea-level to vacuum
function isp(stage, altitude) {
  if (stage === 1)
    return S1_ISP_SL + (S1_ISP_VAC - S1_ISP_SL) * Math.min(1, altitude / 80000);
  return S2_ISP_VAC;
}

// Mass flow rate
function mdot(thrust, isp) { return thrust / (G0 * isp); }
```

### State Variables (per physics frame)

| Variable | Units | Description |
|---|---|---|
| `altitude` | m | Height above sea level |
| `simX` | m | Horizontal position from pad center |
| `vx` | m/s | Horizontal velocity (positive = downrange) |
| `vy` | m/s | Vertical velocity (positive = up) |
| `mass` | kg | Current total vehicle mass |
| `fuel1` | kg | Stage 1 propellant remaining |
| `fuel2` | kg | Stage 2 propellant remaining |
| `theta` | rad | Attitude angle from vertical |
| `throttle` | [0,1] | Throttle setting |
| `gimbal` | rad | Gimbal deflection [−0.087, +0.087] |
| `stage` | 1 or 2 | Active stage |
| `t` | s | Mission elapsed time since T-0 |
| `q` | kPa | Dynamic pressure |
| `machNum` | — | Mach number |
| `twr` | — | Thrust-to-weight ratio |
| `deltaVUsed` | m/s | Cumulative ΔV consumed |
| `damage` | [0,1] | Structural integrity loss |

### Structural Limits
- **q > 32 kPa**: damage accumulation begins. Fail at `damage ≥ 1`.
- **q > 35 kPa** warning threshold.
- **Crewed missions**: sustained g-load > 4g triggers abort.
- **Hard landing**: `|vy| > 3 m/s` at touchdown = RUD.

---

## Controls

### Keyboard (desktop)
| Key | Action |
|---|---|
| ↑ / ↓ | Throttle +10% / −10% per tap; hold = continuous |
| ← / → | Gimbal left / right |
| Space | Stage / Confirm (hold 0.5 s) |
| 1–5 | Throttle presets: 20%, 50%, 65%, 80%, 100% |
| P | Toggle pause |
| M | Toggle mute |
| R | Restart level |
| ~ | Toggle engineer mode overlay |
| Konami ↑↑↓↓←→←→BA | Pad Rat cheat: infinite fuel, no structural limits |

### Touch (mobile)
| Zone | Action |
|---|---|
| Left edge (vertical slider) | Throttle drag up/down. Snap points: 0%, 50%, 65%, 100% |
| Bottom center (horizontal slider) | Gimbal drag left/right, auto-centers on release |
| Bottom right red button | STAGE — hold 0.5 s to fire, only active when conditions met |
| Top right | Pause |

---

## Level Structure

### Tier 1 — Ascent Fundamentals

**L1: Tower Clear** (timeScale × 1)  
T-0 to T+10 s. Avoid the two lightning protection towers. Win: altitude > 100 m, vehicle intact.

**L2: Pitch Program** (timeScale × 3)  
Execute gravity turn pitch program to 30 km. Stay within ±5° of nominal pitch envelope.

**L3: Max-Q** (timeScale × 3)  
Throttle bucket through ~12 km. Keep dynamic pressure q < 35 kPa to avoid structural damage.

### Tier 2 — Stage Operations

**L4: MECO & Sep** (timeScale × 4)  
Time main engine cutoff within ±2 s of T+190 s; trigger clean stage separation.

**L5: Boostback** (timeScale × 4)  
After separation, flip booster and execute boostback burn. Acquire entry corridor.

**L6: Land on Jacklyn** (timeScale × 3)  
Full booster recovery. Bullseye < 5 m; Pad < 25 m; splash = mission failure.

### Tier 3 — Orbit & Payload

**L7: Upper Stage Ignition** (timeScale × 4)  
GS2 ignites at T+200 s. Time ignition within ±0.5 s.

**L8: Fairing Sep & Orbit Insertion** (timeScale × 5)  
Separate fairing when q < 0.05 kPa. Burn to 400 km LEO (vy = 0, vx > 7,500 m/s, alt > 380 km).

**L9: Payload Deploy** (timeScale × 5)  
Orient stack to pitch ±1°; hold STAGE to deploy payload in the deploy window.

### Tier 4 — Real Missions

**L10: NG-1** (timeScale × 5)  
January 2025 night launch. No booster recovery attempted. Payload to LEO.

**L11: NG-2** (timeScale × 5)  
Higher energy. First booster landing on Jacklyn. Twin payload deploy.

**L12: NG-3** (timeScale × 5)  
At T+9 min, GS2 underperforms. Salvage trajectory to lower orbit (> 200 km). Win = "off-nominal but recoverable."

**L13: Blue Moon** (timeScale × 6)  
Heavy lunar lander. Trans-lunar injection. Tight ΔV budget; must achieve > 3,100 m/s ΔV and deploy lander.

**L14: Crewed** (timeScale × 4)  
TWR ≤ 4g sustained. Abort gates active. Crew safety first.

**L15: Vandenberg Polar** (timeScale × 5)  
Pacific coast, southerly trajectory, sun-sync orbit ~98°, altitude 500–600 km.

---

## Level Unlock System

Levels unlock sequentially: completing L*n* unlocks L*(n+1)*. L1 is always unlocked. Best score per level is recorded. Badges awarded based on score thresholds:

| Badge | Threshold |
|---|---|
| PAD RAT | Score > 0 (any completion) |
| BOOSTER OPS | Score > 1,500 |
| MISSION DIRECTOR | Score > 2,500 |
| FLIGHT | Score > 3,500 |

---

## HUD Layout

```
┌─────────────────────────────────────────┐  ← 24 px top bar
│ T+00:00:00   PHASE: ASCENT   MISSION:NG2│
├──────┬───────────────────────────┬───────┤
│ ALT  │                           │ THRTL │
│ VY   │   center viewport         │ FUEL  │
│ VX   │   300 × 572 px            │ STAGE │
│ q kPa│   (scrolling scene)       │ PITCH │
│ MACH │                           │ ENG   │
│ TWR  │                           │       │
├──────┴───────────────────────────┴───────┤  ← 44 px bottom rail
│ Mission event log — last 5 lines         │
└─────────────────────────────────────────┘
```

- **Left rail** (60 px): ALT, VY, VX, q kPa (amber > 25, red > 32), Mach, TWR
- **Right rail** (60 px): throttle bar, fuel bar S1/S2, stage indicator, pitch horizon, engine dots (7 for S1, 2 for S2)
- **Bottom rail** (44 px): scrolling event log, comm chatter callouts
- **Top bar** (24 px): T+ elapsed time, flight phase, mission name

---

## Visual Style

- Font: `VT323` (headings/HUD), `Share Tech Mono` (smaller text)
- Colors: `#33ff33` green, `#ffb300` amber, `#ff3300` red, `#080e08` background
- Colorblind mode: amber → `#00e5ff` cyan, red → `#ff00ff` magenta
- No CRT scanlines / flicker in reduced-motion mode

### Scene Elements
- Two lightning protection towers flanking LC-36 pad (green glow, occasional strike flash)
- Gantry silhouette offset to one side
- Cape Canaveral lighthouse silhouette (visible only in pad / early ascent)
- Water deluge plume at ignition (white-green particle burst, ~5 s duration)
- Sky gradient: terminal green at pad → deep black in space
- Clouds 2–15 km altitude; stars visible above 20 km; Earth limb curve visible above 60 km
- Atlantic horizon visible at apogee

---

## Audio (Web Audio API)

All audio is synthesized — no audio files.

- **Engine rumble**: looped filtered noise + 30 Hz sine oscillator. Amplitude scales with throttle.
- **Event chimes**: two-tone beeps for MECO, sep, landing, mission complete, RUD.
- **Comm chatter callouts** (text + blip): "Tower clear", "Throttle bucket commanded", "Mark, MECO", "Stage sep confirmed", "Welcome to space", "Fairing sep", "Reentry burn", "Touchdown — Jacklyn"
- Web Speech API synthesis used if available, otherwise text-only + blip.

---

## Save State Schema

Storage key: `newGlennRunnerStateV3`

```json
{
  "version": 3,
  "missions": {
    "L1":  { "unlocked": true,  "best": null },
    "L2":  { "unlocked": false, "best": null }
  },
  "totals": {
    "missionsFlown": 0,
    "boostersLanded": 0,
    "payloadsDeployed": 0,
    "totalDeltaV": 0
  },
  "settings": {
    "audio": true,
    "music": false,
    "reducedMotion": false,
    "colorblind": false,
    "engineerMode": false
  },
  "leaderboard": []
}
```

### Migration from `newGlennRunnerSettingsV2`
If legacy key exists, import: `hiScore` → L1 best score, `leaderboard`, `settings.muted` → `!settings.audio`. Then delete legacy key.

---

## Engineer Mode

Toggle: `~` key or 5-tap on title. Overlay panel shows:

| Field | Description |
|---|---|
| altitude | m above sea level |
| vy / vx | m/s components |
| q | kPa dynamic pressure |
| mass | kg total vehicle mass |
| mdot | kg/s mass flow rate |
| TWR | thrust-to-weight |
| theta | ° attitude from vertical |
| gimbal | ° gimbal deflection |
| ΔV remaining | m/s estimated |

---

## Seeded PRNG

```js
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// Usage: const rng = mulberry32(levelNumber * 0x12345 + seedOffset);
```

---

## Rendering Loop

Fixed-timestep accumulator with interpolation:

```js
const FIXED_DT = 1 / 60;
let accumulator = 0;

function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (ts - lastTs) / 1000);
  lastTs = ts;
  accumulator += dt;
  while (accumulator >= FIXED_DT) {
    updatePhysics(FIXED_DT);
    accumulator -= FIXED_DT;
  }
  draw(accumulator / FIXED_DT); // alpha for interpolation
}
```

Canvas scaled to fit viewport with `image-rendering: pixelated`.

---

## Game State Machine

```
TITLE → LEVEL_SELECT → LEVEL_INTRO → RUNNING → PAUSED → RUNNING
                                              ↓
                                      LEVEL_COMPLETE → LEVEL_SELECT
                                      GAME_OVER      → LEVEL_SELECT
```

### Title Screen
- Game title "NEW GLENN RUNNER"
- Rotating LC-36 historical tips
- PLAY and SETTINGS buttons
- Patch wall: last 8 completed mission patches

### Level Select Screen
- 5 × 3 grid of level cards (L1–L15)
- Locked levels dimmed with lock icon
- Each unlocked card: level name, best score, badge

---

## Easter Eggs

- **Konami code** (↑↑↓↓←→←→BA): "Pad Rat Mode" — infinite fuel, no structural limits, disabled in scored runs.
- **5-tap on title**: toggle engineer mode overlay.
- **LC-36 tip rotation**: 13 historical facts rotate on title screen.
