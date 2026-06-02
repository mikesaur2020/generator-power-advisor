# Camper Power Calculator

A static Progressive Web App (PWA) for generator-only camping with the **WEN DF360iX** dual-fuel inverter generator and **2025 Coachmen Apex Ultra-Lite 28RBS**.

## Overview

Replaces an Excel workbook with an installable, offline-capable iPhone-friendly PWA. Calculates generator running load, startup surge, peak load, and fuel/propane status for any combination of RV appliances.

**Key features:**
- Calculator with live load summary and gasoline/propane status side-by-side
- Elevation-aware generator derating (3.5% per 1,000 ft)
- GPS elevation lookup via browser geolocation + Open Elevation API
- Elevation presets: Sea Level, Sioux Falls, Denver, 7k/8k/9k/11k ft
- Custom elevation entry
- Real-World Tests tracker (stored in localStorage)
- Fuel burn runtime estimates for both fuels
- A/C duty cycle guidance by outdoor temperature and setpoint
- Fully offline after first load (service worker caching)
- Installable from iPhone Safari via Add to Home Screen

---

## Setup

### Run locally

```bash
cd camper-power-calculator
python3 -m http.server 8000
```

Then open: [http://localhost:8000](http://localhost:8000)

### Deploy to GitHub Pages

1. Push to GitHub (main branch, root of `camper-power-calculator/` folder)
2. Go to: **GitHub repo → Settings → Pages**
3. Set source: **Deploy from branch → main → /root**
4. Public URL: **https://mikesaur2020.github.io/camper-power-calculator/**

### Install on iPhone

1. Open the public URL in **Safari**
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. The app installs as a standalone PWA with its own icon

---

## File structure

```
index.html          Main HTML shell + tab layout
style.css           All styles (mobile-first dark theme)
app.js              All logic — appliances, calculations, rendering
manifest.json       PWA manifest (name, theme color, icons)
service-worker.js   Offline caching
icon-192.png        PWA icon (192×192)
icon-512.png        PWA icon (512×512)
README.md           This file
```

---

## Updating appliance watt values

All appliance definitions live at the top of `app.js` in the `APPLIANCES` array:

```js
const APPLIANCES = [
  { id: 'ac_cool', name: 'A/C Cooling Mode', ..., running: 1700, surge: 750, ... },
  { id: 'fridge',  name: '12V Refrigerator', ..., running: 120,  surge: 120, ... },
  // ...
];
```

Edit `running` (watts while on) and `surge` (additional watts at startup) for any appliance, save, and reload. No build process required.

Generator ratings are in the `GEN` object:

```js
const GEN = {
  gas:  { running: 2900, peak: 3600 },
  prop: { running: 2600, peak: 3500 },
};
```

Battery charging loads are in `BATTERY_LOAD`:

```js
const BATTERY_LOAD = { full: 0, partial: 300, heavy: 700 };
```

Fuel burn reference data (from WEN/Home Depot specs) is in `FUEL`:

```js
const FUEL = {
  gas:  { tankGal: 1.5, halfLoadHrs: 5,  halfLoadW: 1450 },
  prop: { tankLb: 20,   halfLoadHrs: 11, halfLoadW: 1300 },
};
```

---

## Elevation & Generator Derating

Generator output decreases approximately **3.5% per 1,000 ft** above sea level.

| Elevation | Derating | Gas Running | Gas Peak | Propane Running | Propane Peak |
|---|---|---|---|---|---|
| Sea level | 0% | 2,900W | 3,600W | 2,600W | 3,500W |
| Sioux Falls (1,400 ft) | ~5% | 2,758W | 3,424W | 2,473W | 3,329W |
| Denver (5,280 ft) | ~18% | 2,364W | 2,935W | 2,120W | 2,853W |
| 7,000 ft | ~25% | 2,190W | 2,718W | 1,963W | 2,643W |
| 8,000 ft | ~28% | 2,088W | 2,592W | 1,872W | 2,520W |
| 9,000 ft | ~32% | 1,986W | 2,466W | 1,781W | 2,398W |
| 11,000 ft | ~39% | 1,784W | 2,214W | 1,599W | 2,153W |

Derated values are used for all Good/Near Limit/Over Limit status calculations.

### Elevation Sources

**Presets** — tap a preset button (Sea level, Sioux Falls, Denver, 7k–11k ft) to apply instantly.

**GPS (📍 Use My Location)** — taps the browser Geolocation API for your current position, then queries the [Open Elevation API](https://api.open-elevation.com) to convert lat/lon to feet. Requires internet. Only your elevation (in feet) is stored locally — latitude and longitude are never saved.

**🔄 Refresh Location** — appears after a GPS lookup; tap to update elevation at a new campsite.

**Custom entry** — type any value in the Custom Elevation field to override presets and GPS.

**Offline behavior** — GPS lookup requires internet. Presets and manual entry work fully offline.

---

## Source assumptions

- **Generator specs**: [WEN DF360iX product page](https://wenproducts.com/products/wen-df360ix-quiet-and-lightweight-3600-watt-dual-fuel-rv-ready-portable-inverter-generator-with-fuel-shut-off-and-co-watchdog)
- **Fuel runtime**: [Home Depot listing #330761409](https://www.homedepot.com/p/WEN-Quiet-and-Lightweight-3600-Watt-Dual-Fuel-RV-Ready-Portable-Inverter-Generator-with-Fuel-Shut-Off-and-CO-Watchdog-DF360iX/330761409) — ~5 hrs gasoline at half-load (1.5 gal), ~11 hrs propane at half-load (20 lb)
- **A/C**: GE 15,000 BTU with Micro-Air EasyStart — EasyStart reduces startup surge only, not running watts (~1,700W)
- **Solar**: 300W roof panel reduces battery charging demand; not counted as generator output
- **Batteries**: 2 × SRM24 flooded lead-acid, 68Ah each = 136Ah at 12V in parallel

---

## Watt values reference

| Appliance | Running W | Startup Surge W |
|---|---|---|
| A/C Cooling (w/ EasyStart) | 1,700 | 750 |
| A/C Fan Only | 250 | 50 |
| 12V Refrigerator | 120 | 120 |
| Starlink Mini | 40 | 0 |
| USB Charging | 50 | 0 |
| Smart TV | 100 | 0 |
| Microwave | 1,500 | 0 |
| Toaster | 1,200 | 0 |
| Coffee Maker | 1,000 | 0 |
| Hair Dryer | 1,500 | 0 |
| Clothes Iron | 1,200 | 0 |
| Water Pump | 120 | 180 |
| Furnace Blower | 350 | 350 |
| Bathroom Vent Fan | 40 | 40 |
| Range Hood Fan/Light | 50 | 25 |
| Interior LED Lighting | 75 | 0 |

---

*This app provides estimates only. Real-world generator output and fuel consumption vary with temperature, elevation, load profile, fuel quality, and generator condition.*
