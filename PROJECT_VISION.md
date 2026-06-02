# Project Vision — Mike's Camper Power Calculator

## Purpose

A purpose-built generator management tool for boondocking (generator-only camping) with no shore power. The app answers the primary question:

> **"How long can I run my camper from my current fuel setup?"**

It is not a generic RV energy calculator. Every design decision is tailored to a specific rig, generator, and camping style.

---

## Equipment

| Component | Details |
|---|---|
| Camper | 2025 Coachmen Apex Ultra-Lite 28RBS |
| Generator | WEN DF360iX Dual-Fuel Inverter |
| A/C | GE 15,000 BTU roof unit |
| A/C Startup | Micro-Air EasyStart (reduces startup surge only — not running watts) |
| Solar | 300W roof panel |
| Batteries | 2 × SRM24 flooded lead-acid, 68Ah each |
| Battery Bank | 136Ah at 12V (wired in parallel) |
| Satellite Internet | Starlink Mini |

---

## Generator Fuel Specifications

| Fuel | Running Rating | Peak Rating |
|---|---|---|
| Gasoline | 2,900W | 3,600W |
| Propane | 2,600W | 3,500W |

Fuel burn specs (WEN / Home Depot):
- Gasoline: ~5 hrs at half-load (1,450W) on 1.5 gal tank
- Propane: ~11 hrs at half-load (1,300W) on 20 lb tank

---

## Key Design Assumptions

### Generator-First Camping Strategy
The generator runs primarily for A/C comfort. The app is designed around near-continuous generator use while boondocking, not occasional supplemental use.

### Auto Fuel Selection (WEN DF360iX)
The WEN DF360iX uses **Auto Fuel Selection**: propane (LPG) is prioritized automatically when a propane tank is connected. The generator only switches to gasoline after the LPG regulator hose is **manually disconnected**. There is no automatic fuel switchover.

- **Propane is the primary fuel** (lower running capacity, longer total runtime on a 20 lb tank)
- **Gasoline is the reserve fuel** (not consumed while propane is connected)
- Combined runtime always requires a manual hose disconnect between fuels

### Starlink Always On
Starlink Mini stays on continuously, including overnight when the generator is running. Generator power supports the 12V/120V system, so Starlink draws negligible net battery impact.

### Solar for Battery Recovery
The 300W roof solar panel is the preferred method for battery maintenance and recovery. The app defaults to **Solar Only** charging strategy. The **Generator Assist** charging option is available when solar is insufficient (extended cloudy weather, heavy battery discharge).

### Generator Assist Battery Charging
Battery state (Full / Partial / Heavy discharge) only adds generator charging load when **Generator Assist** is explicitly selected. This reflects reality: you don't always need or want the generator charging batteries.

### Elevation Derating
Generator output decreases approximately 3.5% per 1,000 ft above sea level. All Good / Near Limit / Over Limit status calculations use derated capacities at the selected elevation.

### Peak Load Logic
Estimated peak load = selected running load + **largest single** startup surge. Appliances do not all surge simultaneously.

---

## Tab Structure (Current)

| Tab | Purpose |
|---|---|
| **Live Fuel Tracker** | Primary tab — "How long do I have?" Runtime, confidence, fuel source |
| Calculator | Load calculator — appliance toggles, watt totals, status |
| Real-World Tests | Track combinations verified in the field |
| Fuel Burn Reference | Static tables — burn rates at different loads |
| Ambient & A/C | Duty cycle guidance by outdoor temperature and setpoint |
| About | Equipment specs and assumptions |

---

## Overnight Confidence Thresholds

| Runtime | Confidence |
|---|---|
| ≥ 10 hours | ✅ High |
| 6–10 hours | ⚠️ Moderate |
| < 6 hours  | ❌ Low |

Two confidence values are shown when both fuels are available:
- **Propane Only** (conservative — no fuel switch assumed)
- **Combined** (optimistic — assumes manual propane→gasoline switch)

---

## Data Persistence

All user settings persist in `localStorage`:
- Appliance states (on/off)
- Battery charge state and charging strategy
- Elevation and source (preset / GPS / custom)
- Fuel configuration (propane connected, gasoline available)
- Session tracking state (start time, load)
- Quick Presets (user-defined)
- Real-World Tests entries

---

## Design Principles

1. **Mobile-first** — designed for iPhone Safari, installable as PWA
2. **Offline-capable** — service worker caches all assets after first load
3. **No build process** — plain HTML/CSS/vanilla JS, deploys directly from GitHub Pages
4. **Single source of truth** — all watt values and generator specs live in clearly labeled constants at the top of `app.js`
5. **Real-world over theoretical** — Real-World Tests tab encourages verifying estimates against observed behavior
