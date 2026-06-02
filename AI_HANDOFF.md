# AI Handoff — Mike's Camper Power Calculator

Read [PROJECT_VISION.md](PROJECT_VISION.md) first for equipment specs, design decisions, and assumptions.

---

## Current State (as of June 2026)

### Live at
**https://mikesaur2020.github.io/camper-power-calculator/**

### Repo
`/Users/mikesaur/Documents/ClaudeCode/ai-automation/camper-power-calculator`

### Tech stack
Static PWA — HTML + CSS + vanilla JS. No build process. Deploys from GitHub Pages main branch root. Service worker uses network-first caching.

### Pushing to GitHub
```bash
git remote set-url origin https://TOKEN@github.com/mikesaur2020/camper-power-calculator.git
git push origin main
git remote set-url origin https://github.com/mikesaur2020/camper-power-calculator.git
```
Token is short-lived — user will provide a fresh one.

---

## Key Files

| File | Purpose |
|---|---|
| `app.js` | All logic, state, calculations, HTML builders |
| `style.css` | All styles (dark theme, mobile-first) |
| `index.html` | Shell — tabs, panels, modal, service worker registration |
| `service-worker.js` | Network-first caching (cache name: `camper-power-vN`) |
| `manifest.json` | PWA manifest |

### Where to find things in `app.js`

| Section | What's there |
|---|---|
| Top constants | `APPLIANCES`, `GEN`, `BATTERY_LOAD`, `FUEL`, `DERATE_PER_1000FT` |
| `BUILT_IN_PRESETS` | 5 default quick presets |
| `state` object | All app state (appliances, battery, elevation, fuel tracker, etc.) |
| `calcLoads()` | Running load + surge + battery charging load |
| `deratedGen(elevFt)` | Returns derated gas/propane running/peak watts |
| `fuelStatus()` | Good / Near Limit / Over Limit logic |
| `renderCalculator()` | Updates all Calculator tab display elements |
| `buildCalculatorHTML()` | Generates Calculator tab HTML (called once on boot) |
| `renderFuelTrackerTab()` | Generates and injects Live Fuel Tracker tab HTML |
| `buildFuelHTML()` | Fuel Burn Reference tab |
| `showTab(id)` | Tab routing — starts/stops tick timers |
| `TABS` constant | Tab order array |

---

## Current Features

### Live Fuel Tracker (primary tab)
- Fuel configuration: Propane Connected / Gasoline Available toggles
- Active fuel source derived from WEN auto-select rules (propane priority)
- Runtime cards: propane (active), gasoline (reserve — shows reserve-after-propane timing)
- Combined Potential Runtime with correct sequential timing
- Overnight Confidence split: Propane Only + Combined (manual switch)
- Session tracking: start/stop/reset, load change detection, localStorage persist
- Fuel Combination Guidance card explains the active scenario

### Calculator
- 16 appliances with toggle switches
- A/C Cooling ↔ Fan Only mutual exclusion (turning Cooling off auto-enables Fan Only)
- Battery Charge State + Charging Strategy (Solar Only / Generator Assist)
- Elevation derating with GPS lookup, presets, custom entry, derating info panel
- Quick Presets with combo chip display
- Manage Presets modal (save current state, delete presets)
- Status banner (Near Limit / Over Limit) in Generator Load Summary
- All sections collapsible, Collapse All button in header

### Fuel Burn Reference
- Static burn rate tables at 25/50/75/100% load
- Old-style tracker (Start Gas / Start Propane / Start Both buttons)

### Real-World Tests
- Editable table stored in localStorage
- Starter rows pre-populated

### Ambient & A/C
- Duty cycle tables by outdoor temp × setpoint
- Average watt tables
- Temperature guidance

---

## Known Issues / Rough Edges

- The old Fuel Burn tab still has its own tracker (Start Gas/Propane buttons). This predates the Live Fuel Tracker tab and could be removed or simplified.
- GPS elevation lookup uses the Open Elevation API (`api.open-elevation.com`) — free, no key, but occasionally slow or down. No fallback.
- Service worker cache version must be bumped manually in `service-worker.js` when pushing updates that need to bust existing caches (though network-first strategy reduces how often this matters).
- The `?v=N` query string on `app.js` in `index.html` is a legacy cache-bust remnant — can be cleaned up since network-first SW handles freshness now.

---

## Future Enhancements (Prioritized)

### High Priority
1. **Weather-aware overnight confidence** — integrate a weather API (Open-Meteo, free) to get tonight's forecast low temperature. Use the A/C duty cycle table to estimate average load and refine runtime. Answer: "If tonight's low is 72°F and I'm running A/C cooling, will propane last until 7 AM?"
2. **Fuel tracker refinements** — allow user to input current propane level (not just full 20 lb). A partially-used tank is common.
3. **Remove or simplify the old Fuel Burn tracker** — the old Start Gas/Propane buttons in Fuel Burn Reference are now superseded by Live Fuel Tracker.

### Medium Priority
4. **Elevation-based A/C duty cycle adjustment** — at high elevation, A/C may run longer due to lower air density. Currently the duty cycle table is not elevation-aware.
5. **Watt values editable in UI** — currently requires editing `app.js`. A settings screen would let users update A/C running watts based on real measurements.
6. **Refuel event** — let user log "I refueled to X gal / Y lb" mid-session to reset tracker from that point.

### Lower Priority
7. **Multiple propane tank sizes** — 1 lb, 5 lb, 11 lb, 20 lb, 30 lb options.
8. **Dark/light theme toggle**.
9. **Export Real-World Tests to CSV**.
10. **Share/copy fuel status** — share a snapshot of current load + runtime to share with someone.

---

## Design Constraints to Preserve

- **No React, no Vue, no npm** — static HTML/CSS/vanilla JS only. Must deploy from GitHub Pages with no build step.
- **PWA offline support** — all features must work without internet after first load (except GPS elevation lookup which explicitly requires network).
- **Mobile-first** — target is iPhone Safari as an installed PWA. All touch targets ≥ 44px. Safe area insets in header.
- **localStorage only** — no backend, no accounts, no cloud sync.
- **Single file logic** — all JS in `app.js`. Don't split into modules unless the file becomes unmanageable (currently ~1,700 lines).
