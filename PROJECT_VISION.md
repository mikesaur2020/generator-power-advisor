# Project Vision — Mike's Camper Power Calculator

## Project Positioning

**An RV energy management and generator runtime planning application** built for one specific rig, one specific generator, and one specific camping style — boondocking with no shore power.

This is not a generic RV power calculator. It is a purpose-built tool that models the exact behavior of the WEN DF360iX Auto Fuel Selection system, the specific load profile of the 2025 Coachmen Apex 28RBS, and the real-world decisions a boondocker makes during a camping trip.

---

## Primary Questions the App Answers

1. **Can I safely run this appliance combination?** — Generator Load Calculator with Good / Near Limit / Over Limit status
2. **How much generator capacity remains?** — Running headroom and peak headroom for both fuels, derated for elevation
3. **Which fuel source is active?** — Live Fuel Tracker with WEN Auto Fuel Selection modeling
4. **How long will fuel last?** — Propane runtime, gasoline reserve runtime, combined potential runtime
5. **Will I likely make it through the night?** — Overnight Confidence (High / Moderate / Low) for propane-only and combined scenarios

---

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
The WEN DF360iX uses **Auto Fuel Selection**. Behavior confirmed by WEN Technical Support:

- **LPG hose connected:** Propane is the active fuel. Gasoline is not consumed.
- **LPG hose disconnected at start:** Generator starts and runs on gasoline.
- **Propane runs out (hose connected):** Generator shuts down. It does NOT auto-switch to gasoline. User must disconnect the LPG hose and restart.
- **Running on gasoline + connect propane hose:** Generator automatically switches to propane. Propane becomes the active fuel.

Key implications for this app:
- **Propane is the active fuel** when connected. Gasoline is not consumed.
- **Gasoline is reserve fuel** — available only after manual LPG hose disconnect.
- **No automatic propane→gasoline failover.** If propane runs out with the hose connected, the generator stops.
- **Automatic gasoline→propane switch.** If propane is connected while running on gasoline, the generator switches to propane automatically.
- **Combined runtime** assumes: propane depleted → generator stops → user disconnects LPG hose → generator restarts on gasoline. This is a manual 3-step process.
- The app shows gasoline as RESERVE (not as actively depleting) while propane is connected. Gasoline burn rate is not displayed in reserve mode to avoid implying it is being consumed.

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

### 30A Shore Power (Secondary Use Case)
The app is generator-first, but campers also plug into a 30A pedestal at developed campgrounds. The **30A Shore Power** tab answers a distinct question — *"Will the campground pedestal support this load?"* — using only the appliance running watts. It deliberately omits fuel, runtime, weather, and elevation logic; a pedestal does not care about any of those.

- 30A RV service = 120V × 30A = **3,600W** theoretical max.
- Breakers are rated for **80% continuous** = 24A / **2,880W** safe sustained limit.
- **Amps = Watts ÷ 120.** Estimated Amps is the primary number.
- Status: **Safe** ≤ 24A · **Near Limit** 24–30A · **Likely Trip Breaker** > 30A.
- Reuses the shared appliance selection and presets — no duplicate preset system. Recommends switching A/C to Fan Only when A/C Cooling and a high-load appliance are both selected.

---

## Tab Structure (Current)

| Tab | Purpose |
|---|---|
| **Live Fuel Tracker** | Primary tab — "How long do I have?" Runtime, confidence, fuel source |
| Calculator | Load calculator — appliance toggles, watt totals, status |
| 30A Shore Power | "Will the campground pedestal support this load?" — Estimated Amps, headroom, Safe / Near Limit / Likely Trip Breaker |
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
