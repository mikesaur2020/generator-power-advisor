'use strict';

// ── Appliance definitions ─────────────────────────────────────────────────────
// To update watt values, edit running/surge below and reload the page.
const APPLIANCES = [
  // id, name, running, surge, defaultOn, group, notes
  { id: 'ac_cool', name: 'A/C Cooling Mode', detail: 'Compressor + Fan w/ Micro-Air EasyStart', running: 1700, surge: 750, on: true,  group: 'always' },
  { id: 'fridge',  name: '12V Refrigerator', detail: '', running: 120,  surge: 120, on: true,  group: 'always' },
  { id: 'starlink',name: 'Starlink Mini',    detail: '', running: 40,   surge: 0,   on: true,  group: 'always' },
  { id: 'usb',     name: 'USB Charging',     detail: 'Phones / devices', running: 50, surge: 0, on: true, group: 'always' },
  { id: 'tv',      name: 'Smart TV',         detail: '', running: 100,  surge: 0,   on: true,  group: 'always' },
  { id: 'ac_fan',  name: 'A/C Fan Only',     detail: 'Compressor off — use before high-load appliances', running: 250, surge: 50, on: false, group: 'ac_alt' },
  { id: 'micro',   name: 'Microwave',        detail: '', running: 1500, surge: 0,   on: false, group: 'highload' },
  { id: 'toaster', name: 'Toaster',          detail: '', running: 1200, surge: 0,   on: false, group: 'highload' },
  { id: 'coffee',  name: 'Coffee Maker',     detail: '', running: 1000, surge: 0,   on: false, group: 'highload' },
  { id: 'hairdryer',name: 'Hair Dryer',      detail: '', running: 1500, surge: 0,   on: false, group: 'highload' },
  { id: 'iron',    name: 'Clothes Iron',     detail: '', running: 1200, surge: 0,   on: false, group: 'highload' },
  { id: 'pump',    name: 'Water Pump',       detail: 'Intermittent', running: 120, surge: 180, on: false, group: 'other' },
  { id: 'furnace', name: 'Furnace Blower',   detail: 'Cold-weather use', running: 350, surge: 350, on: false, group: 'other' },
  { id: 'bathfan', name: 'Bathroom Vent Fan',detail: '', running: 40,   surge: 40,  on: false, group: 'other' },
  { id: 'rangehood',name: 'Range Hood Fan/Light', detail: '', running: 50, surge: 25, on: false, group: 'other' },
  { id: 'leds',    name: 'Interior LED Lighting', detail: '', running: 75, surge: 0, on: true,  group: 'other' },
];

// ── Generator database ────────────────────────────────────────────────────────
// Each generator carries its own ratings + fuel/burn data. The whole engine reads
// from the *selected* generator (see currentGen), so swapping units re-derives every
// number. The WEN DF360iX is the default and preserves the app's original values.
//
// Watt/runtime figures are typical published specs; real output varies by unit and
// conditions. Every value is user-editable via a custom generator. Fuel-burn fields:
//   gas:  { running, peak, tankGal, halfLoadHrs, halfLoadW }
//   prop: { running, peak, tankLb,  halfLoadHrs, halfLoadW }  (null if gas-only)
const GENERATORS = [
  {
    id: 'wen-df360ix', brand: 'WEN', model: 'DF360iX', short: 'WEN DF360iX',
    kind: 'Dual-Fuel Inverter', fuels: ['gas', 'propane'], autoFuel: 'wen-priority',
    gas:  { running: 2900, peak: 3600, tankGal: 1.5, halfLoadHrs: 5,  halfLoadW: 1450 },
    prop: { running: 2600, peak: 3500, tankLb: 20,  halfLoadHrs: 11, halfLoadW: 1300 },
    source: 'WEN / Home Depot listing #330761409', builtIn: true,
  },
  {
    id: 'champion-100263', brand: 'Champion', model: '100263', short: 'Champion 3400 DF',
    kind: 'Dual-Fuel Inverter', fuels: ['gas', 'propane'], autoFuel: null,
    gas:  { running: 3100, peak: 3400, tankGal: 1.6, halfLoadHrs: 4.5, halfLoadW: 1550 },
    prop: { running: 2790, peak: 3060, tankLb: 20,  halfLoadHrs: 9,   halfLoadW: 1400 },
    source: 'Champion published specs', builtIn: true,
  },
  {
    id: 'westinghouse-igen4500df', brand: 'Westinghouse', model: 'iGen4500DF', short: 'Westinghouse iGen4500DF',
    kind: 'Dual-Fuel Inverter', fuels: ['gas', 'propane'], autoFuel: null,
    gas:  { running: 3700, peak: 4500, tankGal: 3.4, halfLoadHrs: 10, halfLoadW: 1850 },
    prop: { running: 3330, peak: 4050, tankLb: 20,  halfLoadHrs: 8,  halfLoadW: 1650 },
    source: 'Westinghouse published specs', builtIn: true,
  },
  {
    id: 'honda-eu2200i', brand: 'Honda', model: 'EU2200i', short: 'Honda EU2200i',
    kind: 'Gas Inverter', fuels: ['gas'], autoFuel: null,
    gas:  { running: 1800, peak: 2200, tankGal: 0.95, halfLoadHrs: 6, halfLoadW: 900 },
    prop: null, source: 'Honda published specs', builtIn: true,
  },
  {
    id: 'predator-3500', brand: 'Predator', model: '3500', short: 'Predator 3500',
    kind: 'Gas Inverter', fuels: ['gas'], autoFuel: null,
    gas:  { running: 3000, peak: 3500, tankGal: 2.6, halfLoadHrs: 5.5, halfLoadW: 1500 },
    prop: null, source: 'Harbor Freight published specs', builtIn: true,
  },
  {
    id: 'generac-gp2200i', brand: 'Generac', model: 'GP2200i', short: 'Generac GP2200i',
    kind: 'Gas Inverter', fuels: ['gas'], autoFuel: null,
    gas:  { running: 1700, peak: 2200, tankGal: 1.2, halfLoadHrs: 6, halfLoadW: 850 },
    prop: null, source: 'Generac published specs', builtIn: true,
  },
];

// The 6 units above are the "Popular" shortlist shown before searching.
const FEATURED_GEN_IDS = new Set(GENERATORS.map(g => g.id));

// Compact builder for the broader searchable catalog.
//   g = [running, peak, tankGal, halfLoadHrs]   (half-load watts = running/2)
//   p = [running, peak, tankLb,  halfLoadHrs] or null (gas-only)
function mkGen(brand, model, kind, g, p) {
  const id = (brand + '-' + model).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id, brand, model, short: brand + ' ' + model, kind,
    fuels: p ? ['gas', 'propane'] : ['gas'], autoFuel: p ? 'wen-priority' : null,
    gas:  { running: g[0], peak: g[1], tankGal: g[2], halfLoadHrs: g[3], halfLoadW: Math.round(g[0] / 2) },
    prop: p ? { running: p[0], peak: p[1], tankLb: p[2], halfLoadHrs: p[3], halfLoadW: Math.round(p[0] / 2) } : null,
    source: 'Typical published specs — verify against your unit', builtIn: true,
  };
}

// Broader catalog for "type your make/model" search. Watt ratings are typical
// published figures; tank/burn are reasonable estimates (runtime only). All values
// are user-confirmed and editable, so treat these as a fast starting point.
const GENERATOR_CATALOG = [
  // Honda (gas inverter)
  mkGen('Honda', 'EU1000i',      'Gas Inverter', [900, 1000, 0.55, 4],  null),
  mkGen('Honda', 'EU3000iS',     'Gas Inverter', [2800, 3000, 3.4, 12], null),
  mkGen('Honda', 'EU3000i Handi','Gas Inverter', [2600, 3000, 1.6, 6],  null),
  mkGen('Honda', 'EU7000iS',     'Gas Inverter', [5500, 7000, 5.1, 10], null),
  mkGen('Honda', 'EB2800i',      'Gas Inverter', [2500, 2800, 1.0, 5],  null),
  // Yamaha (gas inverter)
  mkGen('Yamaha', 'EF2000iSv2',  'Gas Inverter', [1600, 2000, 1.1, 6],  null),
  mkGen('Yamaha', 'EF2400iSHC',  'Gas Inverter', [2000, 2400, 1.6, 6],  null),
  mkGen('Yamaha', 'EF3000iSEB',  'Gas Inverter', [2800, 3000, 3.4, 10], null),
  // Champion
  mkGen('Champion', '100519 (2000i)', 'Gas Inverter',  [1700, 2000, 1.1, 6], null),
  mkGen('Champion', '2500 DF',        'Dual-Fuel Inverter', [1850, 2500, 1.05, 11], [1665, 2200, 20, 20]),
  mkGen('Champion', '4500 DF',        'Dual-Fuel Inverter', [3500, 4500, 2.9, 14], [3150, 4050, 20, 15]),
  mkGen('Champion', '76533 (4750 DF)','Dual-Fuel Portable', [3800, 4750, 3.4, 9], [3420, 4275, 20, 10]),
  mkGen('Champion', '100416 (9200 DF)','Dual-Fuel Portable',[7500, 9200, 6.1, 8], [6750, 8300, 20, 5]),
  // Westinghouse
  mkGen('Westinghouse', 'iGen2200',   'Gas Inverter', [1800, 2200, 1.2, 6],  null),
  mkGen('Westinghouse', 'iGen4500',   'Gas Inverter', [3700, 4500, 3.4, 10], null),
  mkGen('Westinghouse', 'WGen7500',   'Gas Portable', [7500, 9500, 6.6, 8],  null),
  mkGen('Westinghouse', 'WGen9500DF', 'Dual-Fuel Portable', [9500, 12500, 6.6, 7], [8500, 11200, 20, 4]),
  // WEN
  mkGen('WEN', '56200i',  'Gas Inverter', [1600, 2000, 1.0, 6],   null),
  mkGen('WEN', '56380i',  'Gas Inverter', [3400, 3800, 2.2, 8.5], null),
  mkGen('WEN', '56475',   'Gas Portable', [3750, 4750, 4.0, 11],  null),
  mkGen('WEN', 'DF475iX', 'Dual-Fuel Inverter', [3800, 4750, 2.9, 7], [3500, 4350, 20, 8]),
  // Predator (Harbor Freight)
  mkGen('Predator', '2000',        'Gas Inverter', [1600, 2000, 1.0, 6],  null),
  mkGen('Predator', '5000',        'Gas Inverter', [4000, 5000, 4.0, 9],  null),
  mkGen('Predator', '9500 DF',     'Dual-Fuel Inverter', [7600, 9500, 4.0, 7], [6825, 8550, 20, 4]),
  mkGen('Predator', '9000',        'Gas Portable', [7250, 9000, 6.6, 8],  null),
  // Generac
  mkGen('Generac', 'iQ3500',  'Gas Inverter', [3000, 3500, 2.6, 9],  null),
  mkGen('Generac', 'iQ2000',  'Gas Inverter', [1600, 2000, 1.06, 7], null),
  mkGen('Generac', 'GP3300',  'Gas Portable', [3300, 3750, 3.9, 10], null),
  mkGen('Generac', 'GP6500',  'Gas Portable', [6500, 8125, 7.9, 10], null),
  // DuroMax
  mkGen('DuroMax', 'XP4850EH',  'Dual-Fuel Portable', [3850, 4850, 3.96, 9], [3658, 4593, 20, 7]),
  mkGen('DuroMax', 'XP5500EH',  'Dual-Fuel Portable', [4500, 5500, 4.0, 8],  [4275, 5225, 20, 6]),
  mkGen('DuroMax', 'XP12000EH', 'Dual-Fuel Portable', [9500, 12000, 8.3, 8], [9025, 11400, 20, 5]),
  // Firman
  mkGen('Firman', 'WH03042',    'Dual-Fuel Portable', [3300, 4550, 1.8, 9], [3000, 4100, 20, 8]),
  mkGen('Firman', 'W03083',     'Gas Portable', [3300, 4100, 5.0, 12], null),
  // Briggs & Stratton
  mkGen('Briggs & Stratton', 'P2200', 'Gas Inverter', [1700, 2200, 1.0, 8],  null),
  mkGen('Briggs & Stratton', 'P3000', 'Gas Inverter', [2600, 3000, 1.5, 10], null),
  // A-iPower / Pulsar
  mkGen('A-iPower', 'SUA2000i', 'Gas Inverter', [1600, 2000, 1.1, 7], null),
  mkGen('Pulsar', 'G12KBN',     'Dual-Fuel Portable', [9500, 12000, 8.0, 7], [8550, 10800, 20, 4]),
];

function getAllGenerators() {
  return GENERATORS.concat(GENERATOR_CATALOG, state.customGenerators || []);
}
function currentGen() {
  const all = getAllGenerators();
  return all.find(g => g.id === state.generatorId) || all[0];
}
function genHasPropane() {
  const g = currentGen();
  return !!(g && g.fuels.includes('propane') && g.prop);
}

// ── Battery charging load by state (only applied when strategy = generator) ───
const BATTERY_LOAD = { full: 0, partial: 300, heavy: 700 };

// ── 30A Shore Power ───────────────────────────────────────────────────────────
// Standard campground 30A RV pedestal: single 120V leg at 30A.
//   Theoretical max         = 120V × 30A = 3,600W
//   Recommended continuous  = 80% of breaker = 24A / 2,880W
const SHORE_30A = { volts: 120, maxAmps: 30, maxW: 3600, contAmps: 24, contW: 2880 };
// High-load appliances that warrant switching A/C to Fan Only first.
const SHORE_HIGHLOAD = ['micro', 'toaster', 'coffee', 'hairdryer', 'iron'];

// (Fuel-burn reference data now lives per-generator in GENERATORS; see estFuelBurn.)

// ── A/C duty cycle table (outdoor temp rows × setpoint cols) ─────────────────
const DUTY_TEMPS    = [75, 80, 85, 90, 95, 100];
const DUTY_SETPOINTS= [68, 70, 72, 75, 78];
const DUTY_TABLE    = [
  [0.48, 0.40, 0.32, 0.20, 0.20],
  [0.68, 0.60, 0.52, 0.40, 0.28],
  [0.88, 0.80, 0.72, 0.60, 0.48],
  [1.00, 1.00, 0.92, 0.80, 0.68],
  [1.00, 1.00, 1.00, 1.00, 0.88],
  [1.00, 1.00, 1.00, 1.00, 1.00],
];
const AC_RUN_W = 1700;
const AC_FAN_W = 250;

// ── Elevation derating ────────────────────────────────────────────────────────
// ~3.5% power loss per 1,000 ft above sea level (standard rule of thumb)
const DERATE_PER_1000FT = 0.035;
function deratedGen(elevFt) {
  const g = currentGen();
  const factor = Math.max(0, 1 - (elevFt / 1000) * DERATE_PER_1000FT);
  const out = {
    factor,
    gas: { running: Math.round(g.gas.running * factor), peak: Math.round(g.gas.peak * factor) },
    prop: null,
  };
  if (g.prop) {
    out.prop = { running: Math.round(g.prop.running * factor), peak: Math.round(g.prop.peak * factor) };
  }
  return out;
}

// ── Built-in presets ──────────────────────────────────────────────────────────
function makeAppliances(onIds) {
  return Object.fromEntries(APPLIANCES.map(a => [a.id, onIds.includes(a.id)]));
}
const BUILT_IN_PRESETS = [
  {
    id: 'normal-ac', name: 'Normal A/C', builtIn: true, battery: 'full', elevation: 1400,
    appliances: makeAppliances(['ac_cool','fridge','starlink','usb','tv','leds']),
    description: 'Typical daytime camping setup. A/C cooling on, all core appliances running.',
    workflow: '☀️ Daytime Cooling',
  },
  {
    id: 'microwave', name: 'Microwave', builtIn: true, battery: 'full', elevation: 1400,
    appliances: makeAppliances(['ac_fan','fridge','starlink','usb','tv','micro','leds']),
    description: 'A/C switched to Fan Only to free up power for the microwave. Use one high-load appliance at a time.',
    workflow: '🍳 Cooking',
  },
  {
    id: 'coffee', name: 'Coffee Time', builtIn: true, battery: 'full', elevation: 1400,
    appliances: makeAppliances(['ac_fan','fridge','starlink','usb','tv','coffee','leds']),
    description: 'A/C switched to Fan Only for morning coffee. Temporary — switch back to A/C Cooling after.',
    workflow: '☕ Morning',
  },
  {
    id: 'hairdryer', name: 'Hair Dryer', builtIn: true, battery: 'full', elevation: 1400,
    appliances: makeAppliances(['ac_fan','fridge','starlink','usb','hairdryer','leds']),
    description: 'A/C switched to Fan Only to run the hair dryer. Temporary — switch back to A/C Cooling after.',
    workflow: '💨 Grooming',
  },
  {
    id: 'overnight', name: 'Overnight', builtIn: true, battery: 'full', elevation: 1400,
    appliances: makeAppliances(['ac_cool','fridge','starlink','leds']),
    description: 'Minimal overnight load. TV and USB charging off for longer runtime while sleeping.',
    workflow: '🌙 Overnight',
  },
];

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  appliances: Object.fromEntries(APPLIANCES.map(a => [a.id, a.on])),
  battery: 'full',
  chargeStrategy: 'solar', // 'solar' | 'generator'
  elevation: 1400,
  elevSource: 'preset', // 'preset' | 'gps' | 'custom'
  generatorId: 'wen-df360ix',
  customGenerators: [],
  tests: [],
  userPresets: [],
  hiddenBuiltIns: [],
  activePresetId: 'normal-ac',
  quickStartCollapsed: false,
  welcomeDismissed: false,
  // New Fuel Tracker tab
  ft: {
    propaneConnected: true,
    gasAvailable:     true,
    trackingFuel:     null,   // 'propane' | 'gas' | null
    startMs:          null,
    startLoadW:       null,
    startGal:         1.5,
    startLb:          20,
  },
  // Weather Advisory
  weather: {
    locationMode: null,   // 'gps' | 'zip' | null
    zip:          '',
    lat:          null,
    lon:          null,
    forecastLow:  null,   // °F integer
    fetchedMs:    null,
    error:        false,
    loading:      false,
  },
};

// ── Persistence ───────────────────────────────────────────────────────────────
// NOTE: the storage key stays 'camperPowerState' (the app's original name) so that
// existing users keep their saved settings, custom generators, and tests after the
// rename to Generator Power Advisor. Do not rename it without a migration.
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('camperPowerState') || '{}');
    if (saved.appliances)  Object.assign(state.appliances, saved.appliances);
    if (saved.battery)        state.battery = saved.battery;
    if (saved.chargeStrategy) state.chargeStrategy = saved.chargeStrategy;
    if (saved.elevation != null) state.elevation = saved.elevation;
    if (saved.elevSource)    state.elevSource = saved.elevSource;
    if (saved.customGenerators) state.customGenerators = saved.customGenerators;
    if (saved.generatorId)   state.generatorId = saved.generatorId;
    if (saved.tests)       state.tests = saved.tests;
    if (saved.userPresets)    state.userPresets = saved.userPresets;
    if (saved.hiddenBuiltIns) state.hiddenBuiltIns = saved.hiddenBuiltIns;
    if (saved.activePresetId !== undefined) state.activePresetId = saved.activePresetId;
    if (saved.ft) Object.assign(state.ft, saved.ft);
    if (saved.weather) { Object.assign(state.weather, saved.weather); state.weather.loading = false; }
    if (saved.quickStartCollapsed != null) state.quickStartCollapsed = saved.quickStartCollapsed;
    if (saved.welcomeDismissed != null)    state.welcomeDismissed    = saved.welcomeDismissed;
  } catch (_) {}
}

function saveState() {
  localStorage.setItem('camperPowerState', JSON.stringify({
    appliances: state.appliances,
    battery: state.battery,
    chargeStrategy: state.chargeStrategy,
    elevation: state.elevation,
    elevSource: state.elevSource,
    generatorId: state.generatorId,
    customGenerators: state.customGenerators,
    tests: state.tests,
    userPresets: state.userPresets,
    hiddenBuiltIns: state.hiddenBuiltIns,
    activePresetId: state.activePresetId,
    ft: state.ft,
    weather: { locationMode: state.weather.locationMode, zip: state.weather.zip, lat: state.weather.lat, lon: state.weather.lon, forecastLow: state.weather.forecastLow, fetchedMs: state.weather.fetchedMs, error: state.weather.error },
    quickStartCollapsed: state.quickStartCollapsed,
    welcomeDismissed:    state.welcomeDismissed,
  }));
}

// ── Calculations ──────────────────────────────────────────────────────────────
function calcLoads() {
  let running = 0;
  let maxSurge = 0;
  for (const a of APPLIANCES) {
    if (state.appliances[a.id]) {
      running += a.running;
      if (a.surge > maxSurge) maxSurge = a.surge;
    }
  }
  const battLoad = state.chargeStrategy === 'generator' ? BATTERY_LOAD[state.battery] : 0;
  running += battLoad;
  const peak = running + maxSurge;
  return { running, maxSurge, peak, battLoad };
}

function fuelStatus(running, peak, genRunning, genPeak) {
  const runPct = running / genRunning;
  let status, label;
  if (peak > genPeak) {
    status = 'over'; label = 'Over Peak Limit';
  } else if (running > genRunning) {
    status = 'over'; label = 'Over Running Limit';
  } else if (runPct > 0.85) {
    status = 'near'; label = 'Near Limit';
  } else {
    status = 'good'; label = 'Good';
  }
  const runHead = genRunning - running;
  const peakHead = genPeak - peak;
  return { status, label, runHead, peakHead, runPct };
}

function estFuelBurn(loadW) {
  // Proportional from each fuel's published half-load figure (per selected generator)
  const g = currentGen();
  const gs = g.gas;
  const gasGalHr = (loadW / gs.halfLoadW) * (gs.tankGal / gs.halfLoadHrs);
  const gasHrsPerTank = loadW > 0 ? gs.tankGal / gasGalHr : Infinity;
  const gasHrsPer5gal = loadW > 0 ? 5 / gasGalHr : Infinity;

  let propLbHr = 0, propHrsPer20lb = Infinity, propHrsPer40lb = Infinity;
  if (g.prop) {
    const ps = g.prop;
    propLbHr = (loadW / ps.halfLoadW) * (ps.tankLb / ps.halfLoadHrs);
    propHrsPer20lb = loadW > 0 ? ps.tankLb / propLbHr : Infinity;
    propHrsPer40lb = propHrsPer20lb * 2;
  }

  return {
    gasGalHr, gasHrsPerTank, gasHrsPer5gal, propLbHr, propHrsPer20lb, propHrsPer40lb,
    gasTankGal: gs.tankGal, propTankLb: g.prop ? g.prop.tankLb : null,
  };
}

// ── Formatting ────────────────────────────────────────────────────────────────
function fmt(n, decimals = 1) {
  if (!isFinite(n)) return '—';
  return n.toFixed(decimals);
}
function fmtW(w) { return w.toLocaleString() + 'W'; }
function fmtTime(ms) {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtElapsed(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function trackerBurnRates(loadW) {
  const { gasGalHr, gasHrsPerTank, propLbHr, propHrsPer20lb } = estFuelBurn(loadW);
  return { gasGalHr, gasHrsPerTank, propLbHr, propHrsPer20lb };
}
function fmtHead(w) {
  const cls = w >= 0 ? 'headroom-pos' : 'headroom-neg';
  const sign = w >= 0 ? '+' : '';
  return `<span class="${cls}">${sign}${w.toLocaleString()}W</span>`;
}

// ── Render: Calculator ────────────────────────────────────────────────────────
function renderCalculator() {
  const { running, maxSurge, peak, battLoad } = calcLoads();
  const g = currentGen();
  const hasProp = genHasPropane();
  const derated = deratedGen(state.elevation);
  const gas  = fuelStatus(running, peak, derated.gas.running,  derated.gas.peak);
  const prop = hasProp ? fuelStatus(running, peak, derated.prop.running, derated.prop.peak) : null;

  // Generator identity line (in the load summary card)
  const genLine = document.getElementById('calc-gen-line');
  if (genLine) genLine.textContent = `${g.short} · ${g.kind}`;

  // Results
  document.getElementById('res-running').textContent = fmtW(running);
  document.getElementById('res-surge').textContent   = fmtW(maxSurge);
  document.getElementById('res-peak').textContent    = fmtW(peak);
  document.getElementById('res-batt').textContent    = fmtW(battLoad);

  // Elevation indicator + collapsed summary
  const deratePct = Math.round((1 - derated.factor) * 100);
  const elevDetail = state.elevation > 0
    ? `${state.elevation.toLocaleString()} ft — ~${deratePct}% derating applied`
    : 'Sea level (no derating)';
  const elevEl = document.getElementById('res-elev');
  if (elevEl) elevEl.textContent = elevDetail;
  const elevSummary = document.getElementById('summary-elev');
  if (elevSummary) {
    const label = ELEV_LABELS[state.elevation];
    elevSummary.textContent = label
      ? (state.elevation > 0 ? `${label} — ${state.elevation.toLocaleString()} ft (−${deratePct}%)` : label)
      : `${state.elevation.toLocaleString()} ft (−${deratePct}%)`;
  }

  // Derating info panel
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('derate-elev',     state.elevation.toLocaleString() + ' ft');
  setText('derate-pct',      deratePct.toFixed(1) + '%');
  setText('derate-gas-run',  derated.gas.running.toLocaleString() + ' W');
  setText('derate-gas-peak', derated.gas.peak.toLocaleString() + ' W');
  const deratePropWrap = document.getElementById('derate-prop-wrap');
  if (deratePropWrap) deratePropWrap.style.display = hasProp ? '' : 'none';
  if (hasProp) {
    setText('derate-prop-run', derated.prop.running.toLocaleString() + ' W');
    setText('derate-prop-peak',derated.prop.peak.toLocaleString() + ' W');
  }

  // Show/hide refresh GPS button
  const refreshBtn = document.getElementById('gps-refresh-btn');
  if (refreshBtn) refreshBtn.style.display = state.elevSource === 'gps' ? 'inline-flex' : 'none';

  // Battery section collapsed summary
  const battStateLabels = { full: 'Full', partial: 'Partial', heavy: 'Heavy' };
  const stratLabel = state.chargeStrategy === 'generator' ? 'Generator Assist' : 'Solar Only';
  const addedW = state.chargeStrategy === 'generator' ? BATTERY_LOAD[state.battery] : 0;
  const battSummary = document.getElementById('summary-batt');
  if (battSummary) battSummary.textContent =
    `${battStateLabels[state.battery]} · ${stratLabel}${addedW > 0 ? ` (+${addedW}W)` : ''}`;

  // Strategy explanatory note
  const stratNote = document.getElementById('batt-strategy-note');
  if (stratNote) {
    stratNote.textContent = state.chargeStrategy === 'solar'
      ? 'Solar Only: the 300W solar panel is expected to maintain/recover the batteries. No extra generator charging load is added.'
      : 'Generator Assist: estimated converter charging load is added to the generator total. Use this when intentionally recovering batteries after clouds or heavy use.';
  }
  // Info note when partial/heavy + solar
  const solarInfo = document.getElementById('batt-solar-info');
  if (solarInfo) {
    solarInfo.style.display =
      (state.chargeStrategy === 'solar' && state.battery !== 'full') ? 'block' : 'none';
  }

  // Gas status
  const gasBadge = document.getElementById('gas-badge');
  gasBadge.textContent = gas.label;
  gasBadge.className = 'status-badge status-' + gas.status;
  document.getElementById('gas-run-head').innerHTML = fmtHead(gas.runHead);
  document.getElementById('gas-peak-head').innerHTML = fmtHead(gas.peakHead);
  document.getElementById('gas-capacity').textContent = `${derated.gas.running.toLocaleString()}W / ${derated.gas.peak.toLocaleString()}W peak`;

  // Propane status (only when the selected generator supports propane)
  const propBlock = document.getElementById('fuelblock-prop');
  if (propBlock) propBlock.style.display = hasProp ? '' : 'none';
  if (hasProp) {
    const propBadge = document.getElementById('prop-badge');
    propBadge.textContent = prop.label;
    propBadge.className = 'status-badge status-' + prop.status;
    document.getElementById('prop-run-head').innerHTML = fmtHead(prop.runHead);
    document.getElementById('prop-peak-head').innerHTML = fmtHead(prop.peakHead);
    document.getElementById('prop-capacity').textContent = `${derated.prop.running.toLocaleString()}W / ${derated.prop.peak.toLocaleString()}W peak`;
    document.getElementById('prop-run-pct').textContent = Math.round(prop.runPct * 100) + '% of running capacity';
  }

  // Running % display (gas)
  document.getElementById('gas-run-pct').textContent  = Math.round(gas.runPct * 100) + '% of running capacity';

  // Load status banner (worst of available fuels)
  const banner = document.getElementById('load-banner');
  if (banner) {
    const statuses = hasProp ? [gas.status, prop.status] : [gas.status];
    const worstStatus = statuses.includes('over') ? 'over' : statuses.includes('near') ? 'near' : 'good';
    if (worstStatus === 'over') {
      const msgs = [];
      if (gas.status  === 'over') msgs.push(`⛽ Gas: ${gas.label}`);
      if (hasProp && prop.status === 'over') msgs.push(`🔵 Propane: ${prop.label}`);
      banner.textContent = msgs.join('  ·  ');
      banner.className = 'load-banner load-banner-over';
      banner.style.display = 'block';
    } else if (worstStatus === 'near') {
      const msgs = [];
      if (gas.status  === 'near') msgs.push('⛽ Gas: Near Limit');
      if (hasProp && prop.status === 'near') msgs.push('🔵 Propane: Near Limit');
      banner.textContent = msgs.join('  ·  ');
      banner.className = 'load-banner load-banner-near';
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  // Section wattage subtotals
  const groupWatts = (ids) => ids.reduce((s, id) => s + (state.appliances[id] ? APPLIANCES.find(a => a.id === id).running : 0), 0);
  const alwaysIds   = APPLIANCES.filter(a => a.group === 'always' || a.group === 'ac_alt').map(a => a.id);
  const highloadIds = APPLIANCES.filter(a => a.group === 'highload').map(a => a.id);
  const otherIds    = APPLIANCES.filter(a => a.group === 'other').map(a => a.id);
  const setWatts = (id, w) => { const el = document.getElementById(id); if (el) el.textContent = w > 0 ? `${w.toLocaleString()}W` : ''; };
  setWatts('watts-always',   groupWatts(alwaysIds));
  setWatts('watts-highload', groupWatts(highloadIds));
  setWatts('watts-other',    groupWatts(otherIds));

  // Keep warnings in sync regardless of what triggered the recalc
  const highLoadOn = ['micro','toaster','coffee','hairdryer','iron'].some(i => state.appliances[i]);
  const hlWarn = document.getElementById('highload-warn');
  if (hlWarn) hlWarn.style.display = (highLoadOn && state.appliances['ac_cool']) ? 'block' : 'none';
  const acWarn = document.getElementById('ac-warn');
  if (acWarn) acWarn.style.display = 'none';

  // Verdict-first summary (answer, not arithmetic)
  populateVerdict(running, peak, maxSurge, derated, gas, prop);
}

// ── Verdict: plain-language "can I safely run this?" ──────────────────────────
// The headline verdict is based on the *limiting* fuel. On dual-fuel units that is
// propane (lower ratings, the documented default active fuel) and we surface
// gasoline's extra headroom as guidance. On gas-only units it is gasoline.
function populateVerdict(running, peak, maxSurge, derated, gas, prop) {
  const card = document.getElementById('verdict-card');
  if (!card) return;
  const hasProp = !!prop;
  const lim = hasProp ? prop : gas;         // limiting fuel status
  const limDer = hasProp ? derated.prop : derated.gas;
  const limName = hasProp ? 'propane' : 'gasoline';
  const cls = 'v-' + lim.status;            // v-good | v-near | v-over
  const deratePct = Math.round((1 - derated.factor) * 100);
  card.className = 'card verdict-card ' + cls;

  const pill = document.getElementById('verdict-pill');
  pill.innerHTML = lim.status === 'good' ? '<span aria-hidden="true">✅</span> Safe'
                 : lim.status === 'near' ? '<span aria-hidden="true">⚠️</span> Near Capacity'
                 : '<span aria-hidden="true">⛔</span> Unsafe';
  pill.className = 'verdict-pill ' + cls;

  // Confidence in the recommendation (honest: lower near the boundary or when
  // elevation derating — an estimate — is heavy).
  const conf = verdictConfidence(lim, derated);
  const confEl = document.getElementById('verdict-conf');
  confEl.className = 'verdict-conf ' + conf.cls;
  confEl.textContent = conf.level + ' confidence';

  document.getElementById('verdict-fuel').innerHTML =
    `on ${limName} · ${limDer.running.toLocaleString()}W est. limit`;

  document.getElementById('verdict-headline').textContent =
    lim.status === 'good' ? 'This should run safely.'
    : lim.status === 'near' ? "You're close to the limit."
    : 'This is more than your generator can handle.';

  document.getElementById('verdict-why').innerHTML =
    verdictWhy(lim, running, peak, limName, limDer);

  // Recommended action (advice, not just status) — with an optional one-tap apply.
  const action = verdictAction(lim, gas, prop, running, peak, limName);
  const actionEl = document.getElementById('verdict-action');
  const actionBtn = document.getElementById('verdict-action-btn');
  if (!action) {
    actionEl.style.display = 'none';
  } else {
    actionEl.style.display = 'flex';
    document.getElementById('verdict-action-text').innerHTML = action.text;
    if (action.apply === 'fan') {
      actionBtn.style.display = 'inline-flex';
      actionBtn.textContent = 'Switch A/C to Fan mode';
      actionBtn.onclick = applyFanRecommendation;
    } else {
      actionBtn.style.display = 'none';
      actionBtn.onclick = null;
    }
  }

  document.getElementById('vm-load').textContent = running.toLocaleString() + 'W';

  const remainEl = document.getElementById('vm-remain');
  remainEl.textContent = (lim.runHead < 0 ? '−' : '') + Math.abs(lim.runHead).toLocaleString() + 'W';
  remainEl.className = 'vm-val ' + cls;

  const marginEl = document.getElementById('vm-margin');
  marginEl.textContent = Math.round((1 - lim.runPct) * 100) + '%';
  marginEl.className = 'vm-val ' + cls;

  const surgeChip = document.getElementById('vchip-surge');
  const surgeOk = lim.peakHead >= 0;
  surgeChip.className = 'vchip ' + (surgeOk ? 'v-good' : 'v-over');
  surgeChip.innerHTML = `Startup surge <b>${surgeOk ? 'fits' : 'over'}</b> · est. peak ${peak.toLocaleString()}W`;

  const derChip = document.getElementById('vchip-derate');
  derChip.className = 'vchip';
  derChip.innerHTML = state.elevation > 0
    ? `Elevation <b>${state.elevation.toLocaleString()} ft</b> · −${deratePct}% est.`
    : `Elevation <b>sea level</b> · no derate`;

  // "What this is based on" — data provenance / transparency.
  const src = genSource();
  document.getElementById('verdict-basis-body').innerHTML = `
    <div class="basis-row"><span class="basis-dot basis-spec" aria-hidden="true"></span>
      <span><strong>Generator ratings</strong> — ${escHtml(currentGen().short)}, ${src.label}</span></div>
    <div class="basis-row"><span class="basis-dot basis-input" aria-hidden="true"></span>
      <span><strong>Appliance loads</strong> — estimated typical watts, from your on/off selection</span></div>
    <div class="basis-row"><span class="basis-dot basis-est" aria-hidden="true"></span>
      <span><strong>Elevation derating</strong> — estimated (~3.5% per 1,000 ft)${state.elevation > 0 ? `, −${deratePct}% applied` : ''}</span></div>
    <div class="basis-row"><span class="basis-dot basis-obs" aria-hidden="true"></span>
      <span><strong>Real-world results</strong> — log combinations on the Real-World Tests tab to raise confidence</span></div>`;
}

// Provenance of the selected generator's ratings.
function genSource() {
  const g = currentGen();
  return g.builtIn
    ? { kind: 'spec', label: 'manufacturer-published spec (typical — verify)', short: 'Published spec' }
    : { kind: 'input', label: 'values you entered', short: 'Your values' };
}

// Confidence in the verdict direction. Comfortably safe or clearly over → High;
// near the fuzzy boundary, or heavy (estimated) elevation derating → Moderate.
function verdictConfidence(lim, derated) {
  const nearBoundary = lim.runPct > 0.78 && lim.runPct < 1.02;
  const heavyDerate = (1 - derated.factor) > 0.10;
  if (nearBoundary || heavyDerate) return { level: 'Moderate', cls: 'conf-mod' };
  return { level: 'High', cls: 'conf-high' };
}

// Explanation of the situation (the "why"). Recommendations live in verdictAction.
function verdictWhy(lim, running, peak, limName, limDer) {
  const pct = Math.round(lim.runPct * 100);
  if (lim.status === 'good') {
    return `Comfortable margin — the estimated load is <strong>${pct}%</strong> of ${limName}'s continuous capacity, and the startup surge fits within peak.`;
  }
  if (lim.status === 'near') {
    return `The estimated load is <strong>${pct}%</strong> of ${limName}'s continuous capacity — close to the limit.`;
  }
  if (lim.peakHead < 0 && lim.runHead >= 0) {
    return `Running load fits, but the estimated <strong>startup surge</strong> (peak ${peak.toLocaleString()}W) exceeds ${limName}'s ${limDer.peak.toLocaleString()}W peak — the generator may stall when the largest load starts.`;
  }
  return `The estimated running load (<strong>${running.toLocaleString()}W</strong>) is above ${limName}'s <strong>${limDer.running.toLocaleString()}W</strong> continuous limit.`;
}

// Concrete recommendation for Near / Unsafe states. Returns {text, apply?} or null.
function verdictAction(lim, gas, prop, running, peak, limName) {
  if (lim.status === 'good') return null;
  const highOn = APPLIANCES.filter(a => a.group === 'highload' && state.appliances[a.id]);
  const acOn = state.appliances['ac_cool'];
  const hasProp = !!prop;
  const fanSave = AC_RUN_W - AC_FAN_W;   // ~1,450W freed by switching to Fan mode
  const names = arr => arr.map(a => a.name).join(' and ');

  // A/C Cooling + a high-draw appliance → switch to Fan mode (quantified, one-tap).
  if (acOn && highOn.length) {
    return {
      text: `Switch the A/C to <strong>Fan mode</strong> before running ${names(highOn)} — it frees about <strong>${fanSave.toLocaleString()}W</strong> of capacity.`,
      apply: 'fan',
    };
  }
  // Two+ high-draw appliances at once → run them one at a time.
  if (highOn.length >= 2) {
    return { text: `Run one high-draw appliance at a time — turn off <strong>${highOn[0].name}</strong> before starting <strong>${highOn[1].name}</strong>.` };
  }
  // Surge-limited (running fits, peak doesn't) → stagger motor starts.
  if (lim.peakHead < 0 && lim.runHead >= 0) {
    return { text: `Start large motors one at a time, and let the A/C compressor finish starting before adding another load.` };
  }
  // Running over on a dual-fuel unit where gasoline has room → suggest the fuel swap.
  if (lim.status === 'over' && hasProp && gas.runHead >= 0) {
    return { text: `Running on <strong>gasoline</strong> adds about <strong>${gas.runHead.toLocaleString()}W</strong> of headroom — or turn off a high-draw appliance.` };
  }
  // Single high-draw appliance over the limit → turn it off.
  if (highOn.length === 1) {
    return { text: `Turn off <strong>${highOn[0].name}</strong> to get back within the limit.` };
  }
  // Near the limit, nothing obvious to shed.
  if (lim.status === 'near') {
    return { text: `Avoid adding another large appliance while you're this close to the limit.` };
  }
  return { text: `Reduce the load to get back within ${limName}'s capacity.` };
}

function applyFanRecommendation() {
  state.appliances['ac_cool'] = false;
  state.appliances['ac_fan'] = true;
  const c = document.getElementById('toggle-ac_cool'); if (c) c.checked = false;
  const f = document.getElementById('toggle-ac_fan');  if (f) f.checked = true;
  saveState();
  renderCalculator();
}

// ── Generator selection ───────────────────────────────────────────────────────
function fuelBadgesHTML(g) {
  return g.fuels.map(f => f === 'gas'
    ? '<span class="gen-fuel-badge gen-fuel-gas">⛽ Gas</span>'
    : '<span class="gen-fuel-badge gen-fuel-prop">🔵 Propane</span>').join('');
}

function buildGeneratorCard() {
  const g = currentGen();
  const ratings = `⛽ ${g.gas.running.toLocaleString()}W · ${g.gas.peak.toLocaleString()}W peak`
    + (g.prop ? ` &nbsp;·&nbsp; 🔵 ${g.prop.running.toLocaleString()}W · ${g.prop.peak.toLocaleString()}W peak` : '');
  return `
    <div class="card gen-card">
      <div class="gen-card-top">
        <div class="gen-card-info">
          <div class="gen-card-label">Your Generator</div>
          <div class="gen-card-name">${escHtml(g.short)}${g.builtIn ? '' : ' <span class="gen-custom-tag">custom</span>'}</div>
          <div class="gen-card-kind">${escHtml(g.kind)}</div>
        </div>
        <button class="gen-change-btn" onclick="openGenPicker()">Change</button>
      </div>
      <div class="gen-card-badges">${fuelBadgesHTML(g)}</div>
      <div class="gen-card-ratings">${ratings}</div>
      <div class="gen-card-source"><span class="basis-dot ${g.builtIn ? 'basis-spec' : 'basis-input'}" aria-hidden="true"></span>${g.builtIn ? 'Manufacturer-published spec — verify against your unit' : 'Values you entered'}</div>
    </div>`;
}

function openGenPicker() {
  renderGenModal();
  document.getElementById('gen-modal').style.display = 'flex';
}
function closeGenPicker() {
  document.getElementById('gen-modal').style.display = 'none';
}

function genRowHTML(g) {
  const active = g.id === state.generatorId;
  const sub = `${escHtml(g.kind)} · ⛽ ${g.gas.running.toLocaleString()}W`
    + (g.prop ? ` · 🔵 ${g.prop.running.toLocaleString()}W` : '');
  return `
    <div class="gen-row ${active ? 'gen-row-active' : ''}" onclick="confirmGenSpecs('${g.id}')">
      <div class="gen-row-main">
        <div class="gen-row-name">${escHtml(g.short)}${active ? ' <span class="gen-row-check">✓</span>' : ''}${g.builtIn ? '' : ' <span class="gen-custom-tag">custom</span>'}</div>
        <div class="gen-row-sub">${sub}</div>
      </div>
      <span class="gen-row-arrow">›</span>
    </div>`;
}

function renderGenModal() {
  const body = document.getElementById('gen-modal-body');
  if (!body) return;
  body.innerHTML = `
    <div class="gen-search-wrap">
      <input type="text" id="gen-search" class="gen-search" autocomplete="off"
        placeholder="🔍 Search generators — brand or model…" oninput="filterGenList(this.value)">
    </div>
    <div id="gen-list"></div>
    <button class="gen-add-btn" onclick="openCustomGenForm()">＋ Add a generator manually</button>
    <div id="gen-custom-form" style="display:none"></div>
    <p class="gen-modal-note">Catalog specs are typical published figures — always confirm and verify against your unit's manual before relying on them.</p>`;
  filterGenList('');
}

function filterGenList(query) {
  const el = document.getElementById('gen-list');
  if (!el) return;
  const q = (query || '').trim().toLowerCase();
  const all = getAllGenerators();
  const builtInCount = all.filter(g => g.builtIn).length;

  if (!q) {
    const featured = all.filter(g => FEATURED_GEN_IDS.has(g.id));
    const customs  = all.filter(g => !g.builtIn);
    el.innerHTML =
      `<div class="gen-group-label">Popular</div>` + featured.map(genRowHTML).join('')
      + (customs.length ? `<div class="gen-group-label">Your custom generators</div>` + customs.map(genRowHTML).join('') : '')
      + `<p class="gen-search-hint">Type a brand or model to search all ${builtInCount} built-in units.</p>`;
    return;
  }
  const matches = all
    .filter(g => `${g.short} ${g.brand} ${g.model} ${g.kind}`.toLowerCase().includes(q))
    .slice(0, 40);
  el.innerHTML = matches.length
    ? matches.map(genRowHTML).join('')
    : `<p class="gen-search-hint">No matches for “${escHtml(query)}”. Try another term, or add it manually below.</p>`;
}

// Show a unit's full specs and require the user to confirm before using it.
function confirmGenSpecs(id) {
  const g = getAllGenerators().find(x => x.id === id);
  if (!g) return;
  const body = document.getElementById('gen-modal-body');
  const active = g.id === state.generatorId;
  body.innerHTML = `
    <button class="gen-back-btn" onclick="renderGenModal()">‹ Back to list</button>
    <div class="gen-confirm">
      <div class="gen-confirm-name">${escHtml(g.short)}${g.builtIn ? '' : ' <span class="gen-custom-tag">custom</span>'}</div>
      <div class="gen-confirm-kind">${escHtml(g.kind)}</div>
      <div class="gen-card-badges" style="margin:12px 0 14px;">${fuelBadgesHTML(g)}</div>
      <div class="gen-spec-table">
        <div class="gen-spec-row"><span>⛽ Gasoline — running</span><b>${g.gas.running.toLocaleString()} W</b></div>
        <div class="gen-spec-row"><span>⛽ Gasoline — peak / surge</span><b>${g.gas.peak.toLocaleString()} W</b></div>
        <div class="gen-spec-row"><span>⛽ Gas tank</span><b>${g.gas.tankGal} gal</b></div>
        ${g.prop ? `
        <div class="gen-spec-row"><span>🔵 Propane — running</span><b>${g.prop.running.toLocaleString()} W</b></div>
        <div class="gen-spec-row"><span>🔵 Propane — peak / surge</span><b>${g.prop.peak.toLocaleString()} W</b></div>
        <div class="gen-spec-row"><span>🔵 Propane tank</span><b>${g.prop.tankLb} lb</b></div>` : ''}
      </div>
      <p class="gen-confirm-note">${escHtml(g.source || 'Typical published specs')}. Confirm these match your unit — you can adjust them if they differ.</p>
      <div class="gen-confirm-btns">
        <button class="gen-form-save" onclick="selectGenerator('${g.id}')">${active ? '✓ Keep Using This' : 'Confirm & Use'}</button>
        <button class="gen-form-cancel" onclick="cloneGenToCustom('${g.id}')">Adjust values…</button>
      </div>
      ${!g.builtIn ? `<button class="gen-row-del gen-confirm-del" onclick="deleteCustomGen('${g.id}')">Delete this custom generator</button>` : ''}
    </div>`;
}

// Prefill the manual form from an existing unit, saving as a NEW custom generator.
function cloneGenToCustom(id) {
  const src = getAllGenerators().find(x => x.id === id);
  renderGenModal();
  openCustomGenForm(null, src);
  const form = document.getElementById('gen-custom-form');
  if (form) form.scrollIntoView({ block: 'nearest' });
}

function selectGenerator(id) {
  state.generatorId = id;
  // Gas-only unit → propane cannot be connected.
  if (!genHasPropane()) {
    state.ft.propaneConnected = false;
    if (state.ft.trackingFuel === 'propane') state.ft.trackingFuel = null;
  }
  saveState();
  closeGenPicker();
  refreshGeneratorDependentUI();
}

function openCustomGenForm(id, sourceGen) {
  const editing = id ? getAllGenerators().find(g => g.id === id) : null;
  const base = editing || sourceGen || null;   // prefill source (edit or clone)
  const form = document.getElementById('gen-custom-form');
  if (!form) return;
  const gp = base && base.prop ? base.prop : null;
  const title = editing ? 'Edit Custom Generator'
    : sourceGen ? `New — based on ${escHtml(sourceGen.short)}`
    : 'New Custom Generator';
  form.style.display = 'block';
  form.innerHTML = `
    <div class="gen-form">
      <p class="gen-form-title">${title}</p>
      <label class="gen-form-row"><span>Name</span>
        <input type="text" id="gen-f-name" maxlength="34" value="${base ? escHtml(base.short) : ''}" placeholder="e.g. My Champion 4500"></label>
      <label class="gen-form-row"><span>Gas running (W)</span>
        <input type="number" id="gen-f-grun" min="200" max="15000" step="50" value="${base ? base.gas.running : ''}" placeholder="3000"></label>
      <label class="gen-form-row"><span>Gas peak / surge (W)</span>
        <input type="number" id="gen-f-gpeak" min="200" max="18000" step="50" value="${base ? base.gas.peak : ''}" placeholder="3500"></label>
      <label class="gen-form-row"><span>Gas tank (gal)</span>
        <input type="number" id="gen-f-gtank" min="0.2" max="20" step="0.1" value="${base ? base.gas.tankGal : ''}" placeholder="2.6"></label>
      <label class="gen-form-check"><input type="checkbox" id="gen-f-haspropane" ${gp ? 'checked' : ''} onchange="document.getElementById('gen-prop-fields').style.display=this.checked?'block':'none'"> Supports propane (dual-fuel)</label>
      <div id="gen-prop-fields" style="display:${gp ? 'block' : 'none'}">
        <label class="gen-form-row"><span>Propane running (W)</span>
          <input type="number" id="gen-f-prun" min="200" max="15000" step="50" value="${gp ? gp.running : ''}" placeholder="2700"></label>
        <label class="gen-form-row"><span>Propane peak / surge (W)</span>
          <input type="number" id="gen-f-ppeak" min="200" max="18000" step="50" value="${gp ? gp.peak : ''}" placeholder="3100"></label>
        <label class="gen-form-row"><span>Propane tank (lb)</span>
          <input type="number" id="gen-f-ptank" min="1" max="100" step="1" value="${gp ? gp.tankLb : 20}" placeholder="20"></label>
      </div>
      <div class="gen-form-btns">
        <button class="gen-form-save" onclick="saveCustomGen(${editing ? `'${editing.id}'` : 'null'})">Save & Select</button>
        <button class="gen-form-cancel" onclick="document.getElementById('gen-custom-form').style.display='none'">Cancel</button>
      </div>
      <p class="gen-form-err" id="gen-form-err" style="display:none"></p>
    </div>`;
}

function saveCustomGen(editId) {
  const num = (id) => parseFloat(document.getElementById(id).value);
  const name = (document.getElementById('gen-f-name').value || '').trim();
  const grun = num('gen-f-grun'), gpeak = num('gen-f-gpeak'), gtank = num('gen-f-gtank');
  const hasProp = document.getElementById('gen-f-haspropane').checked;
  const err = document.getElementById('gen-form-err');
  const fail = (m) => { err.textContent = m; err.style.display = 'block'; };

  if (!name) return fail('Please enter a name.');
  if (!(grun > 0) || !(gpeak > 0) || !(gtank > 0)) return fail('Enter valid gas running, peak, and tank values.');
  if (gpeak < grun) return fail('Gas peak should be ≥ gas running.');

  const gen = {
    id: editId || 'custom-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.abs(hashStr(name + grun + gpeak)),
    brand: 'Custom', model: name, short: name,
    kind: hasProp ? 'Dual-Fuel (custom)' : 'Gas (custom)',
    fuels: hasProp ? ['gas', 'propane'] : ['gas'], autoFuel: hasProp ? 'wen-priority' : null,
    gas: { running: grun, peak: gpeak, tankGal: gtank, halfLoadHrs: 6, halfLoadW: Math.round(grun / 2) },
    prop: null, source: 'user-defined', builtIn: false,
  };
  if (hasProp) {
    const prun = num('gen-f-prun'), ppeak = num('gen-f-ppeak'), ptank = num('gen-f-ptank');
    if (!(prun > 0) || !(ppeak > 0) || !(ptank > 0)) return fail('Enter valid propane running, peak, and tank values.');
    if (ppeak < prun) return fail('Propane peak should be ≥ propane running.');
    gen.prop = { running: prun, peak: ppeak, tankLb: ptank, halfLoadHrs: 10, halfLoadW: Math.round(prun / 2) };
  }

  state.customGenerators = (state.customGenerators || []).filter(x => x.id !== gen.id);
  state.customGenerators.push(gen);
  state.generatorId = gen.id;
  if (!hasProp) { state.ft.propaneConnected = false; if (state.ft.trackingFuel === 'propane') state.ft.trackingFuel = null; }
  saveState();
  closeGenPicker();
  refreshGeneratorDependentUI();
}

function deleteCustomGen(id) {
  state.customGenerators = (state.customGenerators || []).filter(g => g.id !== id);
  if (state.generatorId === id) state.generatorId = 'wen-df360ix';
  saveState();
  renderGenModal();
  refreshGeneratorDependentUI();
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return h;
}

// Refresh every panel whose content depends on the selected generator.
function refreshGeneratorDependentUI() {
  rebuildCalculator();
  const about = document.getElementById('panel-about'); if (about) about.innerHTML = buildAboutHTML();
  const fuel  = document.getElementById('panel-fuel');  if (fuel)  fuel.innerHTML  = buildFuelHTML();
  renderFuelTrackerTab();
}

// Rebuild the Calculator tab HTML (used after the selected generator changes).
function rebuildCalculator() {
  const panel = document.getElementById('panel-calc');
  if (!panel) return;
  panel.innerHTML = buildCalculatorHTML();
  document.querySelectorAll('.battery-btn').forEach((btn, i) => {
    btn.classList.toggle('active', ['full', 'partial', 'heavy'][i] === state.battery);
  });
  syncPresetButtons(state.elevation);
  renderCalculator();
  renderPresetButtons();
}

// ── Render: Appliance groups ──────────────────────────────────────────────────
function buildApplianceRow(a) {
  const checked = state.appliances[a.id];
  const detail  = a.detail ? ` · ${a.detail}` : '';
  const surgeStr = a.surge > 0 ? ` +${a.surge}W surge` : '';
  return `
    <div class="appliance-row" id="row-${a.id}">
      <div class="appliance-info">
        <div class="appliance-name">${a.name}</div>
        <div class="appliance-watts">${a.running}W running${surgeStr}${detail}</div>
      </div>
      <div class="toggle-wrap">
        <label class="toggle">
          <input type="checkbox" id="toggle-${a.id}" ${checked ? 'checked' : ''}
            onchange="toggleAppliance('${a.id}')">
          <span class="slider"></span>
        </label>
      </div>
    </div>`;
}

function buildCalculatorHTML() {
  const always   = APPLIANCES.filter(a => a.group === 'always');
  const acAlt    = APPLIANCES.filter(a => a.group === 'ac_alt');
  const highload = APPLIANCES.filter(a => a.group === 'highload');
  const other    = APPLIANCES.filter(a => a.group === 'other');

  return `
    ${buildGeneratorCard()}

    <!-- Verdict-first summary -->
    <div class="card verdict-card" id="verdict-card" role="status" aria-live="polite">
      <div class="verdict-top">
        <span class="verdict-pill" id="verdict-pill">—</span>
        <div class="verdict-top-right">
          <span class="verdict-conf" id="verdict-conf"></span>
          <span class="verdict-fuel" id="verdict-fuel"></span>
        </div>
      </div>
      <div class="verdict-headline" id="verdict-headline">—</div>
      <div class="verdict-why" id="verdict-why"></div>

      <!-- Recommended action (shown for Near / Unsafe) -->
      <div class="verdict-action" id="verdict-action" style="display:none">
        <span class="verdict-action-icon" aria-hidden="true">→</span>
        <div class="verdict-action-body">
          <div class="verdict-action-text" id="verdict-action-text"></div>
          <button class="verdict-action-btn" id="verdict-action-btn" style="display:none"></button>
        </div>
      </div>

      <div class="verdict-metrics">
        <div class="vm"><div class="vm-label">Generator Load</div><div class="vm-val" id="vm-load">—</div></div>
        <div class="vm"><div class="vm-label">Capacity Remaining</div><div class="vm-val" id="vm-remain">—</div></div>
        <div class="vm"><div class="vm-label">Safety Margin</div><div class="vm-val" id="vm-margin">—</div></div>
      </div>
      <div class="verdict-chips">
        <span class="vchip" id="vchip-surge">—</span>
        <span class="vchip" id="vchip-derate">—</span>
      </div>

      <details class="verdict-basis">
        <summary>What this is based on</summary>
        <div class="verdict-basis-body" id="verdict-basis-body"></div>
      </details>
    </div>

    <div class="strategy-note">
      <div class="strategy-header">
        <h2>Recommended Operating Strategy</h2>
      </div>
      <p><strong>Normal mode:</strong> A/C Cooling + Refrigerator + Starlink + USB + TV</p>
      <p><strong>Temporary high-load mode:</strong> Switch A/C to Fan Only before running microwave, toaster, coffee maker, hair dryer, or clothes iron.</p>
    </div>

    <!-- Presets -->
    <div class="card preset-card">
      <h2>Quick Presets</h2>
      <div class="preset-btn-row" id="preset-btn-row"></div>
      <div class="preset-combo-row" id="preset-combo-row" style="display:none"></div>
    </div>

    <!-- Elevation -->
    <div class="card collapsible-card">
      <h2 class="collapsible-heading" onclick="toggleSection('elev-body', this)">
        <span>Elevation</span>
        <span class="section-watts" id="summary-elev"></span>
        <span class="collapse-icon">▸</span>
      </h2>
      <div id="elev-body" style="display:none">

        <!-- Preset buttons -->
        <p class="batt-label">Presets</p>
        <div class="elev-presets">
          <button class="preset-btn" onclick="setElevationPreset(0)">Sea level</button>
          <button class="preset-btn" onclick="setElevationPreset(1400)">Sioux Falls</button>
          <button class="preset-btn" onclick="setElevationPreset(5280)">Denver</button>
          <button class="preset-btn" onclick="setElevationPreset(7000)">7,000 ft</button>
          <button class="preset-btn" onclick="setElevationPreset(8000)">8,000 ft</button>
          <button class="preset-btn" onclick="setElevationPreset(9000)">9,000 ft</button>
          <button class="preset-btn" onclick="setElevationPreset(11000)">11,000 ft</button>
        </div>

        <!-- GPS buttons -->
        <div class="elev-gps-row">
          <button class="elev-gps-btn" onclick="getGpsElevation()">📍 Use My Location</button>
          <button class="elev-gps-btn elev-refresh-btn" id="gps-refresh-btn" onclick="getGpsElevation()" style="display:none">🔄 Refresh Location</button>
        </div>
        <div class="elev-gps-status" id="gps-status"></div>

        <!-- Custom elevation -->
        <p class="batt-label" style="margin-top:14px;">Custom Elevation</p>
        <div class="elev-custom-row">
          <input type="number" id="elev-input" min="0" max="29000" step="100"
            value="${state.elevation}"
            oninput="setCustomElevation(this.value)"
            placeholder="Enter feet…">
          <span class="elev-unit">ft</span>
        </div>

        <!-- Derating info panel -->
        <div class="derate-panel">
          <div class="derate-row"><span>Current Elevation</span><span id="derate-elev">—</span></div>
          <div class="derate-row"><span>Generator Derating</span><span id="derate-pct" class="derate-pct">—</span></div>
          <div class="derate-divider"></div>
          <div class="derate-row"><span>⛽ Gas Running Capacity</span><span id="derate-gas-run">—</span></div>
          <div class="derate-row"><span>⛽ Gas Peak Capacity</span><span id="derate-gas-peak">—</span></div>
          <div id="derate-prop-wrap">
            <div class="derate-row"><span>🔵 Propane Running Capacity</span><span id="derate-prop-run">—</span></div>
            <div class="derate-row"><span>🔵 Propane Peak Capacity</span><span id="derate-prop-peak">—</span></div>
          </div>
          <p class="derate-note">Derated values are used throughout the app for status and headroom calculations.</p>
        </div>

        <div class="elev-note" id="res-elev"></div>
      </div>
    </div>

    <!-- Results -->
    <div class="card collapsible-card">
      <h2 class="collapsible-heading" onclick="toggleSection('summary-detail', this)">
        Generator Load Summary <span class="collapse-icon">▸</span>
      </h2>
      <p class="calc-gen-line" id="calc-gen-line" style="font-size:0.72rem;color:var(--text-muted);margin:-4px 0 10px;"></p>

      <div id="load-banner" style="display:none" class="load-banner"></div>

      <div id="summary-detail" style="display:none">
        <div class="results-grid">
          <div class="result-block">
            <div class="result-label">Running Load</div>
            <div class="result-value accent" id="res-running">—</div>
          </div>
          <div class="result-block">
            <div class="result-label">Largest Surge</div>
            <div class="result-value" id="res-surge">—</div>
          </div>
          <div class="result-block full-width">
            <div class="result-label">Estimated Peak Load</div>
            <div class="result-value accent" id="res-peak">—</div>
            <div class="result-sub">Running + largest startup surge</div>
          </div>
          <div class="result-block full-width">
            <div class="result-label">Battery Charging Load Included</div>
            <div class="result-value" id="res-batt">—</div>
          </div>
        </div>
      </div>

      <div class="fuel-grid">
        <div class="fuel-block">
          <h3 class="gas">⛽ Gasoline</h3>
          <div id="gas-badge" class="status-badge">—</div>
          <div class="result-sub" id="gas-run-pct"></div>
          <div class="headroom-row"><span>Effective capacity</span><span id="gas-capacity" style="color:var(--text-muted);font-size:0.68rem">—</span></div>
          <div class="headroom-row"><span>Running headroom</span><span id="gas-run-head">—</span></div>
          <div class="headroom-row"><span>Peak headroom</span><span id="gas-peak-head">—</span></div>
        </div>
        <div class="fuel-block" id="fuelblock-prop">
          <h3 class="propane">🔵 Propane</h3>
          <div id="prop-badge" class="status-badge">—</div>
          <div class="result-sub" id="prop-run-pct"></div>
          <div class="headroom-row"><span>Effective capacity</span><span id="prop-capacity" style="color:var(--text-muted);font-size:0.68rem">—</span></div>
          <div class="headroom-row"><span>Running headroom</span><span id="prop-run-head">—</span></div>
          <div class="headroom-row"><span>Peak headroom</span><span id="prop-peak-head">—</span></div>
        </div>
      </div>
    </div>

    <!-- Battery Charge State + Charging Strategy -->
    <div class="card collapsible-card">
      <h2 class="collapsible-heading" onclick="toggleSection('batt-body', this)">
        <span>Battery Charge State</span>
        <span class="section-watts" id="summary-batt"></span>
        <span class="collapse-icon">▸</span>
      </h2>
      <div id="batt-body" style="display:none">

        <p class="batt-label">Battery State</p>
        <div class="battery-selector">
          <button class="battery-btn ${state.battery === 'full' ? 'active' : ''}" onclick="setBattery('full')">
            Full
          </button>
          <button class="battery-btn ${state.battery === 'partial' ? 'active' : ''}" onclick="setBattery('partial')">
            Partial
          </button>
          <button class="battery-btn ${state.battery === 'heavy' ? 'active' : ''}" onclick="setBattery('heavy')">
            Heavy
          </button>
        </div>

        <p class="batt-label" style="margin-top:14px;">Charging Strategy</p>
        <div class="battery-selector">
          <button class="battery-btn ${state.chargeStrategy === 'solar' ? 'active' : ''}" onclick="setChargeStrategy('solar')">
            ☀️ Solar Only
          </button>
          <button class="battery-btn ${state.chargeStrategy === 'generator' ? 'active' : ''}" onclick="setChargeStrategy('generator')">
            ⚡ Generator Assist
          </button>
        </div>

        <div id="batt-strategy-note" class="batt-strategy-note"></div>
        <div id="batt-solar-info" class="batt-solar-info" style="display:none">
          ℹ️ Battery is not full, but generator charging load is not included because Solar Only is selected.
        </div>
      </div>
    </div>

    <!-- Always-on -->
    <div class="card collapsible-card">
      <h2 class="collapsible-heading" onclick="toggleSection('always-body', this)">
        <span>Always On Loads</span>
        <span class="section-watts" id="watts-always"></span>
        <span class="collapse-icon">▸</span>
      </h2>
      <div id="always-body" style="display:none">
        ${acAlt.map(buildApplianceRow).join('')}
        <div class="ac-divider"></div>
        ${always.map(buildApplianceRow).join('')}
        <div class="warn-note" id="ac-warn" style="display:none">
          ⚠️ A/C Cooling is active. Turn it off before enabling Fan Only.
        </div>
      </div>
    </div>

    <!-- High-load -->
    <div class="card collapsible-card">
      <h2 class="collapsible-heading" onclick="toggleSection('highload-body', this)">
        <span>Temporary High Loads</span>
        <span class="section-watts" id="watts-highload"></span>
        <span class="collapse-icon">▸</span>
      </h2>
      <div id="highload-body" style="display:none">
        <p style="font-size:0.73rem;color:var(--text-muted);margin-bottom:10px;">
          Switch A/C to Fan Only before running any of these. Use one at a time.
        </p>
        ${highload.map(buildApplianceRow).join('')}
        <div class="warn-note" id="highload-warn" style="display:none">
          ⚠️ A/C Cooling is active. Switch to Fan Only before using high-load appliances.
        </div>
      </div>
    </div>

    <!-- Other -->
    <div class="card collapsible-card">
      <h2 class="collapsible-heading" onclick="toggleSection('other-body', this)">
        <span>Other / Intermittent Loads</span>
        <span class="section-watts" id="watts-other"></span>
        <span class="collapse-icon">▸</span>
      </h2>
      <div id="other-body" style="display:none">
        ${other.map(buildApplianceRow).join('')}
      </div>
    </div>
  `;
}

const ELEV_PRESETS = [0, 1400, 5280, 7000, 8000, 9000, 11000];

function syncPresetButtons(ft) {
  document.querySelectorAll('.preset-btn').forEach((btn, i) => {
    btn.classList.toggle('active', ELEV_PRESETS[i] === ft);
  });
}

function setElevation(ft) {
  state.elevation = Math.max(0, Math.min(29000, ft));
  syncPresetButtons(state.elevation);
  saveState();
  renderCalculator();
}

function setCustomElevation(val) {
  const ft = Math.max(0, Math.min(29000, parseInt(val) || 0));
  state.elevation = ft;
  state.elevSource = 'custom';
  syncPresetButtons(ft);
  clearGpsStatus();
  saveState();
  renderCalculator();
}

function setElevationPreset(ft) {
  state.elevation = ft;
  state.elevSource = 'preset';
  const input = document.getElementById('elev-input');
  if (input) input.value = ft;
  syncPresetButtons(ft);
  clearGpsStatus();
  saveState();
  renderCalculator();
}

function clearGpsStatus() {
  const el = document.getElementById('gps-status');
  if (el) el.textContent = '';
}

function setGpsStatus(msg, isError) {
  const el = document.getElementById('gps-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'elev-gps-status' + (isError ? ' gps-error' : ' gps-ok');
}

async function lookupElevation(lat, lon) {
  // Open Elevation API — free, no key required
  const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('Elevation API error');
  const data = await res.json();
  const meters = data.results[0].elevation;
  return Math.round(meters * 3.28084); // metres → feet
}

async function getGpsElevation() {
  if (!navigator.geolocation) {
    setGpsStatus('⚠️ This browser does not support GPS location.', true);
    return;
  }
  if (!navigator.onLine) {
    setGpsStatus('⚠️ GPS elevation lookup requires internet access.', true);
    return;
  }

  setGpsStatus('📍 Requesting location…', false);
  const gpsBtn = document.getElementById('gps-refresh-btn');

  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude, longitude } = pos.coords;
      setGpsStatus('🌐 Looking up elevation…', false);
      try {
        const ft = await lookupElevation(latitude, longitude);
        state.elevation = ft;
        state.elevSource = 'gps';
        const input = document.getElementById('elev-input');
        if (input) input.value = ft;
        syncPresetButtons(ft);
        saveState();
        renderCalculator();
        setGpsStatus(`📍 Elevation estimated from GPS: ${ft.toLocaleString()} ft`, false);
      } catch (_) {
        setGpsStatus('⚠️ Could not retrieve elevation. Check internet connection.', true);
      }
    },
    err => {
      const msgs = {
        1: '⚠️ Location permission denied. Enable in browser settings.',
        2: '⚠️ Location unavailable. Try again or enter manually.',
        3: '⚠️ Location request timed out. Try again.',
      };
      setGpsStatus(msgs[err.code] || '⚠️ GPS error. Try again.', true);
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}

function collapseAll() {
  ['elev-body', 'batt-body', 'summary-detail', 'always-body', 'highload-body', 'other-body'].forEach(id => {
    const body = document.getElementById(id);
    if (!body) return;
    body.style.display = 'none';
    const heading = body.previousElementSibling;
    const icon = heading && heading.querySelector('.collapse-icon');
    if (icon) icon.textContent = '▸';
  });
}

function toggleSection(bodyId, heading) {
  const body = document.getElementById(bodyId);
  const icon = heading.querySelector('.collapse-icon');
  const collapsed = body.style.display === 'none';
  body.style.display = collapsed ? '' : 'none';
  icon.textContent = collapsed ? '▾' : '▸';
}

function toggleAppliance(id) {
  const checked = document.getElementById('toggle-' + id).checked;

  // A/C mutual exclusion
  if (id === 'ac_cool' && checked) {
    // Turning Cooling ON → turn Fan Only off
    state.appliances['ac_fan'] = false;
    const el = document.getElementById('toggle-ac_fan');
    if (el) el.checked = false;
  }
  if (id === 'ac_cool' && !checked) {
    // Turning Cooling OFF → auto-enable Fan Only
    state.appliances['ac_fan'] = true;
    const el = document.getElementById('toggle-ac_fan');
    if (el) el.checked = true;
  }
  if (id === 'ac_fan' && checked) {
    // Turning Fan Only ON → turn Cooling off
    state.appliances['ac_cool'] = false;
    const el = document.getElementById('toggle-ac_cool');
    if (el) el.checked = false;
  }
  if (id === 'ac_cool' || id === 'ac_fan') {
    document.getElementById('ac-warn').style.display = 'none';
  }

  state.appliances[id] = checked;

  saveState();
  renderCalculator();
}

function setBattery(level) {
  state.battery = level;
  document.querySelectorAll('.battery-btn').forEach((btn, i) => {
    btn.classList.toggle('active', ['full','partial','heavy'][i] === level);
  });
  saveState();
  renderCalculator();
}

function setChargeStrategy(strategy) {
  state.chargeStrategy = strategy;
  // Sync the two strategy buttons (they follow the battery-selector pattern)
  const btns = document.querySelectorAll('#batt-body .battery-btn');
  // First 3 are battery state, last 2 are strategy
  if (btns.length >= 5) {
    btns[3].classList.toggle('active', strategy === 'solar');
    btns[4].classList.toggle('active', strategy === 'generator');
  }
  saveState();
  renderCalculator();
}

// ── Render: Real-World Tests ──────────────────────────────────────────────────
const STARTER_TESTS = [
  { loads: 'A/C Cooling + 12V Refrigerator + Starlink Mini', gas: true,  prop: true,  notes: 'Known good baseline.' },
  { loads: 'A/C Cooling + 12V Refrigerator + Starlink Mini + TV + USB', gas: false, prop: false, notes: 'Default always-on profile to verify.' },
  { loads: 'A/C Fan Only + Refrigerator + Starlink + USB + TV + Microwave', gas: false, prop: false, notes: 'Preferred microwave strategy.' },
  { loads: 'A/C Fan Only + Refrigerator + Starlink + USB + TV + Toaster', gas: false, prop: false, notes: 'Use one high-load appliance at a time.' },
  { loads: 'A/C Fan Only + Refrigerator + Starlink + USB + TV + Coffee Maker', gas: false, prop: false, notes: '' },
  { loads: 'A/C Fan Only + Refrigerator + Starlink + USB + TV + Clothes Iron', gas: false, prop: false, notes: '' },
  { loads: 'A/C Fan Only + Microwave + Starlink + TV', gas: false, prop: false, notes: '' },
];

function initTests() {
  if (state.tests.length === 0) {
    state.tests = STARTER_TESTS.map(t => ({ ...t }));
    saveState();
  }
}

function renderTests() {
  const tbody = document.getElementById('tests-tbody');
  if (!tbody) return;
  tbody.innerHTML = state.tests.map((t, i) => `
    <tr>
      <td><input type="text" value="${escHtml(t.loads)}" onchange="updateTest(${i},'loads',this.value)" style="min-width:200px"></td>
      <td class="check-cell"><input type="checkbox" ${t.gas ? 'checked' : ''} onchange="updateTest(${i},'gas',this.checked)"></td>
      <td class="check-cell"><input type="checkbox" ${t.prop ? 'checked' : ''} onchange="updateTest(${i},'prop',this.checked)"></td>
      <td><textarea onchange="updateTest(${i},'notes',this.value)">${escHtml(t.notes || '')}</textarea></td>
      <td><button class="del-btn" onclick="deleteTest(${i})">✕</button></td>
    </tr>`).join('');
}

function updateTest(i, field, value) {
  state.tests[i][field] = value;
  saveState();
}
function deleteTest(i) {
  state.tests.splice(i, 1);
  saveState();
  renderTests();
}
function addTest() {
  state.tests.push({ loads: '', gas: false, prop: false, notes: '' });
  saveState();
  renderTests();
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Fuel tracker helpers ──────────────────────────────────────────────────────
function buildFuelHTML() {
  const g = currentGen();
  const hasProp = !!g.prop;
  const gasTank = g.gas.tankGal;
  const propTank = hasProp ? g.prop.tankLb : null;

  const rows = [0.25, 0.50, 0.75, 1.00].map(pct => {
    const gW = Math.round(g.gas.running * pct);
    const { gasHrsPerTank, gasHrsPer5gal } = estFuelBurn(gW);
    const label = pct === 0.25 ? 'Light (25%)' : pct === 0.5 ? '½ Load (50%) — spec basis' : pct === 0.75 ? 'Heavy (75%)' : 'Full (100%)';
    const isHalf = pct === 0.5;
    let propCells = '';
    if (hasProp) {
      const pW = Math.round(g.prop.running * pct);
      const { propHrsPer20lb: pProp20, propHrsPer40lb: pProp40 } = estFuelBurn(pW);
      propCells = `<td>${pW}W</td><td>${fmt(pProp20)} hrs</td><td>${fmt(pProp40)} hrs</td>`;
    }
    return `<tr${isHalf ? ' class="highlight-row"' : ''}>
      <td>${label}</td><td>${gW}W</td><td>${fmt(gasHrsPerTank)} hrs</td><td>${fmt(gasHrsPer5gal)} hrs</td>
      ${propCells}
    </tr>`;
  });

  return `
    <!-- Reference table -->
    <div class="card">
      <h2>Runtime Reference — ${escHtml(g.short)}</h2>
      <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;">
        Planning table for estimating runtime at different load levels — useful before you know what appliance combination you'll run.
      </p>
      <div class="fuel-table-wrap">
        <table class="fuel-table">
          <thead>
            <tr>
              <th rowspan="2">Load Level</th>
              <th colspan="3" class="gas-col">⛽ Gasoline</th>
              ${hasProp ? '<th colspan="3" class="prop-col">🔵 Propane</th>' : ''}
            </tr>
            <tr>
              <th class="gas-col">Watts</th><th class="gas-col">Hrs/${fmt(gasTank, gasTank % 1 ? 1 : 0)} gal</th><th class="gas-col">Hrs/5 gal</th>
              ${hasProp ? `<th class="prop-col">Watts</th><th class="prop-col">Hrs/${propTank} lb</th><th class="prop-col">Hrs/2×${propTank} lb</th>` : ''}
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
      <p style="font-size:0.68rem;color:var(--text-muted);margin-top:8px;">
        Highlighted row = published half-load spec basis. All other rows are proportional estimates.
      </p>
    </div>

    <div class="card">
      <h2>Caveats</h2>
      <ul class="guidance-list">
        <li><span>📊</span><span>Burn rates scale proportionally from published half-load figures. Real burn varies.</span></li>
        <li><span>🌡️</span><span>Hot weather increases A/C duty cycle and average fuel use.</span></li>
        <li><span>⛰️</span><span>High elevation reduces generator output — use the Elevation section to account for derating.</span></li>
        <li><span>🔋</span><span>ECO mode can significantly extend runtime at light loads.</span></li>
        <li><span>⛽</span><span>Tank fill level, fuel age, and generator condition all affect real runtime.</span></li>
      </ul>
      <p style="font-size:0.68rem;color:var(--text-muted);margin-top:8px;">
        Figures for <strong>${escHtml(g.short)}</strong> — ${escHtml(g.source || 'typical published specs')}. Values are editable via a custom generator.
      </p>
    </div>
  `;
}

// ── Render: Ambient & A/C ─────────────────────────────────────────────────────
function dutyClass(d) {
  if (d >= 1.00) return 'duty-cell-max';
  if (d >= 0.80) return 'duty-cell-high';
  if (d >= 0.50) return 'duty-cell-mid';
  return 'duty-cell-low';
}

function buildAmbientHTML() {
  const spHdrs = DUTY_SETPOINTS.map(s => `<th>${s}°F</th>`).join('');
  const dutyRows = DUTY_TEMPS.map((t, ti) => {
    const cells = DUTY_TABLE[ti].map(d =>
      `<td class="${dutyClass(d)}">${Math.round(d * 100)}%</td>`).join('');
    return `<tr><td>${t}°F</td>${cells}</tr>`;
  }).join('');

  const avgRows = DUTY_TEMPS.map((t, ti) => {
    const cells = DUTY_TABLE[ti].map(d => {
      const w = Math.round(d * AC_RUN_W);
      return `<td class="${dutyClass(d)}">${w}W</td>`;
    }).join('');
    return `<tr><td>${t}°F</td>${cells}</tr>`;
  }).join('');

  return `
    <div class="card">
      <h2>How Setpoint Affects Fuel Use</h2>
      <p style="font-size:0.8rem;margin-bottom:10px;">
        The thermostat setpoint does <strong>not</strong> reduce A/C running watts while the compressor is
        actively on. It changes <em>duty cycle</em> — how often the compressor runs — which affects
        average fuel burn and overnight comfort.
      </p>
      <ul class="guidance-list">
        <li><span>❄️</span><span>Lower setpoint (e.g. 68°F) → compressor runs longer → more fuel</span></li>
        <li><span>🌡️</span><span>Higher setpoint (e.g. 78°F) → compressor rests more → less fuel</span></li>
        <li><span>☀️</span><span>Hotter outdoor temp → longer compressor runtime regardless of setpoint</span></li>
        <li><span>💧</span><span>High humidity may keep A/C running even at moderate temperatures</span></li>
        <li><span>⛱️</span><span>Shade / awning can reduce duty cycle more than changing setpoint a few degrees</span></li>
        <li><span>🚪</span><span>Frequent door openings add heat gain and raise duty cycle</span></li>
      </ul>
    </div>

    <div class="card">
      <h2>Compressor Duty Cycle Estimate</h2>
      <p style="font-size:0.73rem;color:var(--text-muted);margin-bottom:8px;">
        Rows = outdoor temp · Columns = A/C setpoint. Values = estimated % of time compressor runs.
      </p>
      <div class="duty-table-wrap">
        <table class="duty-table">
          <thead><tr><th>Outdoor / Set</th>${spHdrs}</tr></thead>
          <tbody>${dutyRows}</tbody>
        </table>
      </div>
      <p style="font-size:0.65rem;color:var(--text-muted);margin-top:6px;">
        Color: <span class="duty-cell-low">■ Light</span>
        <span class="duty-cell-mid"> ■ Moderate</span>
        <span class="duty-cell-high"> ■ Heavy</span>
        <span class="duty-cell-max"> ■ Near-continuous</span>
      </p>
    </div>

    <div class="card">
      <h2>Estimated Average A/C Watts</h2>
      <p style="font-size:0.73rem;color:var(--text-muted);margin-bottom:8px;">
        Running watts (${AC_RUN_W}W) × duty cycle. Use for runtime/fuel planning, not peak load.
      </p>
      <div class="duty-table-wrap">
        <table class="duty-table">
          <thead><tr><th>Outdoor / Set</th>${spHdrs}</tr></thead>
          <tbody>${avgRows}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>Outdoor Temperature Guidance</h2>
      <table class="fuel-table" style="min-width:0">
        <thead><tr><th>Outdoor Temp</th><th>A/C Duty</th><th>Fuel Impact</th></tr></thead>
        <tbody>
          <tr><td>&lt;75°F</td><td class="duty-cell-low">Light</td><td>Generator comfortable</td></tr>
          <tr><td>75–85°F</td><td class="duty-cell-mid">Moderate</td><td>Normal summer day</td></tr>
          <tr><td>85–95°F</td><td class="duty-cell-high">Heavy</td><td>Higher fuel burn</td></tr>
          <tr><td>&gt;95°F</td><td class="duty-cell-max">Near-continuous</td><td>Plan extra fuel</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

// ── Render: About ─────────────────────────────────────────────────────────────
function buildAboutHTML() {
  const g = currentGen();
  const hasProp = !!g.prop;
  return `
    <div class="card">
      <div class="about-section">
        <h3>About Generator Power Advisor</h3>
        <p style="font-size:0.8rem;color:var(--text-muted);line-height:1.6;">
          <strong>Generator Power Advisor (GPA)</strong> helps you decide what you can safely
          power with a portable generator under real-world conditions — weighing running load,
          the largest startup surge, elevation derating, and remaining fuel to give you a clear
          <strong>Safe / Near Capacity / Unsafe</strong> answer, the reason behind it, and what to change.
          It works fully offline and installs to your home screen.
        </p>
        <p style="font-size:0.75rem;color:var(--text-faint);line-height:1.6;margin-top:8px;">
          Now advising on your <strong>${escHtml(g.short)}</strong>. Change or add a generator from the
          Calculator tab. The appliance/RV profile below is the current default; saved profiles are on the roadmap.
        </p>
      </div>
    </div>

    <div class="card">
      <div class="about-section">
        <h3>Equipment</h3>
        <div class="spec-row"><span>Generator</span><span>${escHtml(g.short)} · ${escHtml(g.kind)}</span></div>
        <div class="spec-row"><span>Gas capacity</span><span>${g.gas.running.toLocaleString()}W running / ${g.gas.peak.toLocaleString()}W peak</span></div>
        ${hasProp ? `<div class="spec-row"><span>Propane capacity</span><span>${g.prop.running.toLocaleString()}W running / ${g.prop.peak.toLocaleString()}W peak</span></div>` : ''}
        <div class="spec-row"><span>Camper</span><span>2025 Coachmen Apex Ultra-Lite 28RBS</span></div>
        <div class="spec-row"><span>A/C</span><span>GE 15,000 BTU roof unit</span></div>
        <div class="spec-row"><span>A/C startup</span><span>Micro-Air EasyStart (reduces surge only)</span></div>
        <div class="spec-row"><span>Solar</span><span>300W roof panel</span></div>
        <div class="spec-row"><span>Batteries</span><span>2 × SRM24 flooded lead-acid, 68Ah each</span></div>
        <div class="spec-row"><span>Battery bank</span><span>136Ah at 12V (parallel)</span></div>
      </div>
    </div>

    <div class="card">
      <div class="about-section">
        <h3>Key Assumptions</h3>
        <ul class="guidance-list">
          <li><span>⚡</span><span>Micro-Air EasyStart reduces A/C <em>startup surge only</em> — running watts remain ~1,700W when the compressor is active.</span></li>
          <li><span>☀️</span><span>Solar Only (default): the 300W roof solar panel is expected to maintain/recover the batteries. No generator charging load is added regardless of battery state.</span></li>
          <li><span>⚡</span><span>Generator Assist: adds estimated converter charging load when intentionally using the generator to recover batteries after extended clouds or heavy discharge. Partial = +300W, Heavy = +700W.</span></li>
          <li><span>🌙</span><span>Starlink overnight is fine when the generator is running — generator/converter power the 12V system so battery drain is minimal.</span></li>
          <li><span>⚠️</span><span>Peak load = selected running load + <em>largest single</em> startup surge (appliances don't all surge simultaneously).</span></li>
          <li><span>🔋</span><span>Flooded lead-acid batteries should not be deeply discharged regularly — try to keep them above 50% (68Ah used of 136Ah).</span></li>
          <li><span>📊</span><span>Good = running ≤85% of capacity and peak ≤ peak rating. Near Limit = running 85–100%. Over Limit = either threshold exceeded.</span></li>
        </ul>
      </div>
    </div>

    ${hasProp ? `
    <div class="card">
      <div class="about-section">
        <h3>Dual-Fuel Operation${g.autoFuel === 'wen-priority' ? ' — Auto Fuel Selection' : ''}</h3>
        <p style="font-size:0.75rem;color:var(--text-muted);line-height:1.6;">
          Propane is treated as the active fuel when the LPG hose is connected. Gasoline is reserve and not consumed while propane is connected.<br><br>
          <strong>Propane runs out with hose connected:</strong> Most portable dual-fuel units shut down — they will not auto-switch to gasoline. To continue: disconnect the LPG hose, then restart the generator.<br><br>
          <strong>Running on gasoline + connect propane hose:</strong> Auto-fuel-selection units switch to propane automatically.<br><br>
          Full switchover steps are on the <strong>Live Fuel Tracker</strong> tab.${g.autoFuel === 'wen-priority' ? ' <em>WEN DF360iX behavior confirmed by WEN Technical Support.</em>' : ' <em>Verify exact behavior in your generator manual.</em>'}
        </p>
      </div>
    </div>` : ''}

    <div class="card">
      <div class="disclaimer">
        <strong>Disclaimer:</strong> This app provides estimates only. Real-world generator output, A/C efficiency,
        and fuel consumption vary with temperature, elevation, fuel quality, generator condition, and load profile.
        Always monitor your generator while running and do not leave it unattended in enclosed or unsafe spaces.
        Carbon monoxide is odorless and deadly — run the generator outdoors only.
      </div>
    </div>

    <div class="version">Generator Power Advisor (GPA) · Know what you can safely run<br>Tuned for WEN DF360iX + Coachmen Apex 28RBS · Offline-capable PWA</div>
  `;
}

// ── 30A Shore Power Tab ───────────────────────────────────────────────────────
// Strictly electrical loading on a campground 30A pedestal — no fuel, runtime,
// weather, or elevation logic. Reuses the shared appliance selection and presets.

// Appliance-only running watts (no generator/battery-assist load — shore power
// is purely about the electrical draw of the selected appliances).
function shoreApplianceWatts() {
  let w = 0;
  for (const a of APPLIANCES) {
    if (state.appliances[a.id]) w += a.running;
  }
  return w;
}

function shoreStatus(amps) {
  if (amps > SHORE_30A.maxAmps)  return { status: 'over', label: '⛔ Likely Trip Breaker' };
  if (amps > SHORE_30A.contAmps) return { status: 'near', label: '⚠️ Near Limit' };
  return { status: 'good', label: '✅ Safe' };
}

function buildShorePowerHTML() {
  return `<div id="shore-panel"></div>`;
}

function renderShorePowerTab() {
  const panel = document.getElementById('shore-panel');
  if (!panel) return;

  const totalW = shoreApplianceWatts();
  const amps   = totalW / SHORE_30A.volts;
  const st     = shoreStatus(amps);

  const headW    = SHORE_30A.contW - totalW;       // headroom to recommended continuous (24A)
  const headAmps = SHORE_30A.contAmps - amps;
  const pctOf30  = (totalW / SHORE_30A.maxW) * 100;

  const headClass = headW >= 0 ? 'ft-green' : 'ft-red';
  const headSign  = headW >= 0 ? '' : '−';

  // Capacity bar fill relative to 30A theoretical max, clamped to 100%
  const fillPct      = Math.min(100, pctOf30);
  const recMarkerPct = (SHORE_30A.contW / SHORE_30A.maxW) * 100; // 24A marker = 80%

  // A/C Cooling + high-load appliance recommendation
  const acCoolOn   = state.appliances['ac_cool'];
  const highOnList = SHORE_HIGHLOAD.filter(id => state.appliances[id]);
  const showAcRec  = acCoolOn && highOnList.length > 0;
  const highNames  = highOnList.map(id => APPLIANCES.find(a => a.id === id).name).join(', ');

  // Active appliances counted in the total
  const activeChips = APPLIANCES.filter(a => state.appliances[a.id])
    .map(a => `<span class="preset-combo-chip">${a.name} · ${a.running}W</span>`)
    .join('') || '<span class="preset-combo-chip chip-meta">No appliances selected</span>';

  panel.innerHTML = `
    <!-- Intro -->
    <div class="card">
      <h2>30A Shore Power</h2>
      <p class="shore-intro">Will the campground pedestal support this load? This tab checks the electrical draw of your selected appliances against a standard <strong>30A RV pedestal</strong> — a separate use case from generator operation. No fuel, runtime, weather, or elevation logic applies here.</p>
      <div class="shore-limit-row">
        <div class="shore-limit">
          <span class="shore-limit-label">Theoretical limit</span>
          <span class="shore-limit-val">3,600W · 30A</span>
        </div>
        <div class="shore-limit">
          <span class="shore-limit-label">Recommended continuous (80%)</span>
          <span class="shore-limit-val accent">2,880W · 24A</span>
        </div>
      </div>
    </div>

    <!-- Hero status -->
    <div class="card shore-hero shore-hero-${st.status}">
      <div class="shore-status-badge status-${st.status}">${st.label}</div>
      <div class="shore-amps-label">Estimated Amps</div>
      <div class="shore-amps shore-amps-${st.status}">${fmt(amps, 1)}A</div>
      <div class="shore-watts">${fmtW(totalW)} total running</div>

      <div class="shore-bar">
        <div class="shore-bar-fill shore-bar-${st.status}" style="width:${fillPct}%"></div>
        <div class="shore-bar-marker" style="left:${recMarkerPct}%"></div>
      </div>
      <div class="shore-bar-legend">
        <span>0A</span>
        <span class="shore-bar-rec">24A recommended</span>
        <span>30A max</span>
      </div>
    </div>

    <!-- Stats -->
    <div class="card">
      <div class="results-grid">
        <div class="result-block">
          <div class="result-label">Estimated Amps</div>
          <div class="result-value accent">${fmt(amps, 1)}A</div>
          <div class="result-sub">Watts ÷ 120V</div>
        </div>
        <div class="result-block">
          <div class="result-label">Total Running Watts</div>
          <div class="result-value">${fmtW(totalW)}</div>
          <div class="result-sub">Selected appliances</div>
        </div>
        <div class="result-block">
          <div class="result-label">Headroom Remaining</div>
          <div class="result-value ${headClass}">${headSign}${fmtW(Math.abs(headW))}</div>
          <div class="result-sub">${headSign}${fmt(Math.abs(headAmps), 1)}A to 24A limit</div>
        </div>
        <div class="result-block">
          <div class="result-label">% of 30A Capacity</div>
          <div class="result-value">${Math.round(pctOf30)}%</div>
          <div class="result-sub">of 3,600W max</div>
        </div>
      </div>
    </div>

    ${showAcRec ? `
    <!-- A/C recommendation -->
    <div class="card shore-rec">
      <div class="shore-rec-icon">💡</div>
      <div class="shore-rec-body">
        <p class="shore-rec-text">Consider switching A/C to Fan Only before using high-load appliances.</p>
        <p class="shore-rec-sub">A/C Cooling (~1,700W) plus ${highNames} draws heavily on a 30A pedestal. A/C Fan Only (250W) frees up roughly 1,450W of headroom.</p>
        <button class="shore-rec-btn" onclick="shoreAcFanOnly()">Switch A/C to Fan Only</button>
      </div>
    </div>` : ''}

    <!-- Counted load + presets -->
    <div class="card">
      <h2>Counted Load</h2>
      <div class="preset-combo-row" style="display:flex;margin-bottom:12px;">${activeChips}</div>
      <p class="ft-calc-nudge">Change appliances on the <a class="ft-calc-link" onclick="showTab('calc')">Calculator</a> tab, or apply a preset:</p>
      <div class="preset-btn-row" id="shore-preset-row"></div>
    </div>

    <!-- Reference -->
    <div class="card">
      <div class="about-section">
        <h3>How 30A Shore Power Works</h3>
        <ul class="guidance-list">
          <li><span>🔌</span><span>A 30A RV service is a single 120V leg at 30A = <strong>3,600W</strong> theoretical maximum.</span></li>
          <li><span>📊</span><span>Breakers are rated for <strong>80% continuous</strong> draw — <strong>24A / 2,880W</strong> is the safe sustained limit.</span></li>
          <li><span>⚡</span><span><strong>Amps = Watts ÷ 120.</strong> Keep estimated amps at or below 24A to avoid nuisance trips.</span></li>
          <li><span>🚦</span><span><strong>Safe</strong> ≤ 24A &nbsp;·&nbsp; <strong>Near Limit</strong> 24–30A &nbsp;·&nbsp; <strong>Likely Trip Breaker</strong> &gt; 30A</span></li>
          <li><span>🏕️</span><span>This tab ignores fuel, runtime, weather, and elevation — it is strictly about electrical loading on shore power.</span></li>
        </ul>
      </div>
    </div>
  `;

  renderShorePresetButtons();
}

function renderShorePresetButtons() {
  const row = document.getElementById('shore-preset-row');
  if (!row) return;
  row.innerHTML = getAllPresets().map(p => `
    <button class="quick-preset-btn${state.activePresetId === p.id ? ' active' : ''}" onclick="applyPreset('${p.id}')">${p.name}</button>
  `).join('');
}

function shoreAcFanOnly() {
  state.appliances['ac_cool'] = false;
  state.appliances['ac_fan']  = true;
  // Keep Calculator DOM toggles in sync if they've been built
  const cool = document.getElementById('toggle-ac_cool');
  const fan  = document.getElementById('toggle-ac_fan');
  if (cool) cool.checked = false;
  if (fan)  fan.checked  = true;
  saveState();
  renderCalculator();
  renderShorePowerTab();
}

// ── Presets ───────────────────────────────────────────────────────────────────
const ELEV_LABELS = { 0: 'Sea level', 1400: 'Sioux Falls', 5280: 'Denver', 7000: '7,000 ft', 8000: '8,000 ft', 9000: '9,000 ft', 11000: '11,000 ft' };

function getAllPresets() {
  const visible = BUILT_IN_PRESETS.filter(p => !state.hiddenBuiltIns.includes(p.id));
  return [...visible, ...state.userPresets];
}

function presetComboChips(preset) {
  const battLabels = { full: 'Full battery', partial: 'Partial battery', heavy: 'Heavy battery' };
  const elevLabel = ELEV_LABELS[preset.elevation] || `${preset.elevation.toLocaleString()} ft`;
  const appChips = APPLIANCES
    .filter(a => preset.appliances[a.id])
    .map(a => `<span class="preset-combo-chip">${a.name}</span>`)
    .join('');
  const metaChips = [battLabels[preset.battery], elevLabel]
    .map(t => `<span class="preset-combo-chip chip-meta">${t}</span>`)
    .join('');
  return appChips + metaChips;
}

function renderPresetButtons() {
  const row = document.getElementById('preset-btn-row');
  if (!row) return;
  row.innerHTML = getAllPresets().map(p => `
    <button class="quick-preset-btn${state.activePresetId === p.id ? ' active' : ''}" onclick="applyPreset('${p.id}')">${p.name}</button>
  `).join('');

  const combo = document.getElementById('preset-combo-row');
  if (!combo) return;
  const active = getAllPresets().find(p => p.id === state.activePresetId);
  if (active) {
    const desc = active.description
      ? `<p class="preset-desc">${active.description}</p>` : '';
    combo.innerHTML = desc + presetComboChips(active);
    combo.style.display = 'flex';
  } else {
    combo.style.display = 'none';
  }
}

function applyPreset(id) {
  const preset = getAllPresets().find(p => p.id === id);
  if (!preset) return;
  Object.assign(state.appliances, preset.appliances);
  state.battery = preset.battery;
  state.elevation = preset.elevation;

  // Sync DOM toggles
  APPLIANCES.forEach(a => {
    const el = document.getElementById('toggle-' + a.id);
    if (el) el.checked = state.appliances[a.id];
  });
  // Sync battery buttons
  document.querySelectorAll('.battery-btn').forEach((btn, i) => {
    btn.classList.toggle('active', ['full','partial','heavy'][i] === state.battery);
  });
  // Sync elevation input + preset buttons
  const elevInput = document.getElementById('elev-input');
  if (elevInput) elevInput.value = state.elevation;
  syncPresetButtons(state.elevation);

  state.activePresetId = id;
  saveState();
  renderCalculator();
  renderPresetButtons();
  renderShorePowerTab();
}

function saveCurrentAsPreset(name) {
  if (!name || !name.trim()) return;
  const id = 'user-' + Date.now();
  state.userPresets.push({
    id,
    name: name.trim(),
    builtIn: false,
    appliances: { ...state.appliances },
    battery: state.battery,
    elevation: state.elevation,
  });
  saveState();
  renderPresetButtons();
  renderManageModal();
}

function deleteUserPreset(id) {
  state.userPresets = state.userPresets.filter(p => p.id !== id);
  if (state.activePresetId === id) state.activePresetId = null;
  saveState();
  renderPresetButtons();
  renderManageModal();
}

function deleteBuiltInPreset(id) {
  if (!state.hiddenBuiltIns.includes(id)) state.hiddenBuiltIns.push(id);
  if (state.activePresetId === id) state.activePresetId = null;
  saveState();
  renderPresetButtons();
  renderManageModal();
}

function restoreBuiltIns() {
  state.hiddenBuiltIns = [];
  saveState();
  renderPresetButtons();
  renderManageModal();
}

function openManagePresets() {
  renderManageModal();
  document.getElementById('preset-modal').style.display = 'flex';
}

function closeManagePresets() {
  document.getElementById('preset-modal').style.display = 'none';
}

function renderManageModal() {
  const list = document.getElementById('modal-preset-list');
  if (!list) return;
  const visible = getAllPresets();
  const hasHidden = state.hiddenBuiltIns.length > 0;
  list.innerHTML = visible.map(p => `
    <div class="modal-preset-row">
      <span class="modal-preset-name">${escHtml(p.name)}${p.builtIn ? ' <span class="built-in-tag">built-in</span>' : ''}</span>
      <button class="modal-delete-btn" onclick="${p.builtIn ? `deleteBuiltInPreset('${p.id}')` : `deleteUserPreset('${p.id}')`}">Delete</button>
    </div>
  `).join('') + (hasHidden ? `
    <div style="margin-top:10px;text-align:center">
      <button class="modal-restore-btn" onclick="restoreBuiltIns()">Restore hidden built-ins</button>
    </div>` : '');
}

function submitSavePreset() {
  const input = document.getElementById('new-preset-name');
  saveCurrentAsPreset(input.value);
  input.value = '';
}

// ── Tab routing ───────────────────────────────────────────────────────────────
// ── Fuel Tracker Tab ──────────────────────────────────────────────────────────
let ftTickInterval  = null;
let ftLastLoadW     = null;

function activeFuelSource() {
  const ft = state.ft;
  if (ft.propaneConnected)             return 'propane';
  if (!ft.propaneConnected && ft.gasAvailable) return 'gas';
  return 'none';
}

function ftRuntimes(loadW) {
  const { gasGalHr, gasHrsPerTank, propLbHr, propHrsPer20lb } = estFuelBurn(loadW);
  return {
    gasGalHr,  gasHrs: isFinite(gasHrsPerTank) ? gasHrsPerTank : 0,
    propLbHr,  propHrs: isFinite(propHrsPer20lb) ? propHrsPer20lb : 0,
  };
}

function ftConfidence(hrs) {
  if (hrs >= 10) return { icon: '✅', label: 'High Confidence',     css: 'ft-conf-high',   desc: 'Estimated runtime exceeds 10 hours.' };
  if (hrs >= 6)  return { icon: '⚠️', label: 'Moderate Confidence', css: 'ft-conf-mid',    desc: 'Estimated runtime between 6 and 10 hours.' };
  return           { icon: '❌', label: 'Low Confidence',           css: 'ft-conf-low',    desc: 'Estimated runtime less than 6 hours.' };
}

function ftEmptyTime(fromMs, hrsRemaining) {
  if (!hrsRemaining || hrsRemaining <= 0) return '—';
  return fmtTime(fromMs + hrsRemaining * 3600000);
}

function setFtPropane(val) {
  state.ft.propaneConnected = val;
  saveState();
  renderFuelTrackerTab();
}

function setFtGas(val) {
  state.ft.gasAvailable = val;
  saveState();
  renderFuelTrackerTab();
}

function ftStartPropaneTracker() {
  if (!state.ft.propaneConnected) {
    // auto-enable propane and proceed (user confirmed via button tap)
    state.ft.propaneConnected = true;
  }
  const { running } = calcLoads();
  state.ft.trackingFuel = 'propane';
  state.ft.startMs      = Date.now();
  state.ft.startLoadW   = running;
  ftLastLoadW           = running;
  saveState();
  renderFuelTrackerTab();
}

function ftStartGasTracker() {
  // If propane is connected, auto-set to disconnected (user confirmed via button tap)
  if (state.ft.propaneConnected) {
    state.ft.propaneConnected = false;
  }
  const { running } = calcLoads();
  state.ft.trackingFuel = 'gas';
  state.ft.startMs      = Date.now();
  state.ft.startLoadW   = running;
  ftLastLoadW           = running;
  saveState();
  renderFuelTrackerTab();
}

function ftStopTracking() {
  state.ft.trackingFuel = null;
  saveState();
  renderFuelTrackerTab();
}

function ftResetTracking() {
  state.ft.trackingFuel = null;
  state.ft.startMs      = null;
  state.ft.startLoadW   = null;
  ftLastLoadW           = null;
  saveState();
  renderFuelTrackerTab();
}

function confirmFtPropane() {
  if (confirm('Propane is set to Not Connected. Set Propane Connected = Yes and start the propane tracker?')) {
    state.ft.propaneConnected = true;
    ftStartPropaneTracker();
  }
}

function confirmFtGas() {
  if (confirm('Propane is currently Connected. The WEN DF360iX will use propane first if the LPG hose is connected.\n\nOnly continue if you have already disconnected the LPG hose.\n\nSet Propane Connected = No and start the gasoline tracker?')) {
    ftStartGasTracker();
  }
}

function startFtTickTimer() {
  if (ftTickInterval) clearInterval(ftTickInterval);
  ftTickInterval = setInterval(() => {
    if (document.getElementById('ft-panel')) renderFuelTrackerTab();
  }, 30000);
}

function stopFtTickTimer() {
  if (ftTickInterval) { clearInterval(ftTickInterval); ftTickInterval = null; }
}

// ── Onboarding helpers ────────────────────────────────────────────────────────
function dismissWelcome() {
  state.welcomeDismissed = true;
  saveState();
  const el = document.getElementById('welcome-banner');
  if (el) el.style.display = 'none';
}

function toggleQuickStart() {
  state.quickStartCollapsed = !state.quickStartCollapsed;
  saveState();
  renderFuelTrackerTab();
}

function openHelp() {
  document.getElementById('help-modal').style.display = 'flex';
}
function closeHelp() {
  document.getElementById('help-modal').style.display = 'none';
}

function buildQuickStartCard() {
  if (state.quickStartCollapsed) {
    return `<div class="card qs-collapsed-bar">
      <span>🚐 How to Use</span>
      <button class="qs-toggle-btn" onclick="toggleQuickStart()">Show</button>
    </div>`;
  }
  return `
    <div class="card qs-card">
      <div class="qs-header">
        <h2>🚐 How to Use</h2>
        <button class="qs-toggle-btn" onclick="toggleQuickStart()">Hide</button>
      </div>
      <ol class="qs-list">
        <li>
          <strong>Choose a preset on the Calculator tab</strong>
          <div class="qs-sub">Normal A/C · Overnight · Microwave · Coffee Time · Hair Dryer</div>
        </li>
        <li>
          <strong>Return here to check runtime</strong>
          <div class="qs-sub">See Active Fuel Source, Runtime Remaining, and Overnight Confidence below.</div>
        </li>
        <li>
          <strong>For high-load appliances — switch A/C to Fan Only first</strong>
          <div class="qs-sub">Applies to: Microwave, Toaster, Coffee Maker, Hair Dryer, Clothes Iron.<br>
          The presets above do this automatically.</div>
        </li>
        <li>
          <strong>Use the Reference tab for load planning</strong>
          <div class="qs-sub">Static tables showing burn rates at different loads — useful before you know what you'll run.</div>
        </li>
      </ol>
    </div>`;
}

function buildWhatAmICard() {
  return `
    <details class="card what-card">
      <summary class="what-summary">❓ What am I looking at?</summary>
      <dl class="what-list">
        <dt>Active Fuel Source</dt>
        <dd>The fuel the generator is currently consuming. When propane is connected it is always active.</dd>
        <dt>Reserve Fuel</dt>
        <dd>Gasoline — available only after the LPG hose is disconnected. Not being consumed while propane is connected. Connecting a propane hose while running on gasoline switches the generator to propane automatically.</dd>
        <dt>Combined Runtime</dt>
        <dd>Maximum potential runtime: propane first, then gasoline after a manual restart. When propane runs out, the generator stops — disconnect the LPG hose and restart on gasoline. The generator will not switch fuels automatically.</dd>
        <dt>Overnight Confidence</dt>
        <dd>An estimate of whether fuel will last through the night. High ✅ = 10+ hrs, Moderate ⚠️ = 6–10 hrs, Low ❌ = under 6 hrs.</dd>
        <dt>Propane Only vs Combined</dt>
        <dd>Two separate confidence values: one assuming propane only, one assuming the manual propane→gasoline switch is made.</dd>
      </dl>
    </details>`;
}

function buildWorkflowsCard() {
  const workflows = [
    { icon: '☀️', title: 'Daytime Cooling', preset: 'Normal A/C', fuel: 'Either fuel', note: 'Maximum cooling. Highest generator load. Best used on gasoline for full capacity.' },
    { icon: '🌙', title: 'Overnight Cooling', preset: 'Overnight', fuel: 'Propane recommended', note: 'Lower load. Propane gives ~7 hrs on a 20 lb tank at this load. <strong>Generator will not auto-switch to gasoline if propane runs out.</strong>' },
    { icon: '☕', title: 'Morning Coffee', preset: 'Coffee Time', fuel: 'Either fuel', note: 'Switch A/C to Fan Only first — the preset does this automatically. Temporary; switch back after.' },
    { icon: '🍳', title: 'Microwave Cooking', preset: 'Microwave', fuel: 'Either fuel', note: 'Switch A/C to Fan Only first — the preset does this automatically. One high-load appliance at a time.' },
    { icon: '💨', title: 'Hair Dryer', preset: 'Hair Dryer', fuel: 'Either fuel', note: 'Switch A/C to Fan Only first — the preset does this automatically. Temporary; switch back after.' },
  ];
  return `
    <div class="card">
      <h2>⭐ Recommended Workflows</h2>
      <div class="wf-grid">
        ${workflows.map(w => `
          <div class="wf-card">
            <div class="wf-icon">${w.icon}</div>
            <div class="wf-title">${w.title}</div>
            <div class="wf-row"><span>Preset</span><span>${w.preset}</span></div>
            <div class="wf-row"><span>Fuel</span><span>${w.fuel}</span></div>
            <p class="wf-note">${w.note}</p>
          </div>`).join('')}
      </div>
    </div>`;
}

function ftComboGuidance(hasProp, propane, gas) {
  // Gas-only generators: no propane path at all.
  if (!hasProp) {
    if (gas) return `
      <div class="ft-combo-header ft-combo-gas">
        <span class="ft-combo-icon">⛽</span>
        <span>Gasoline Only</span>
      </div>
      <ul class="ft-combo-list">
        <li>⛽ <strong>Active fuel: Gasoline.</strong> This generator runs on gasoline only.</li>
        <li>📦 Runtime is limited to the gasoline tank. Refuel to extend.</li>
        <li>💡 Lowering the load (fewer high-draw appliances) is the main way to stretch runtime.</li>
      </ul>`;
    return `
      <div class="ft-combo-header ft-combo-none">
        <span class="ft-combo-icon">⛔</span>
        <span>No Fuel Available</span>
      </div>
      <ul class="ft-combo-list">
        <li>Generator cannot operate. Set <strong>Gasoline Available = Yes</strong> once the tank has fuel.</li>
      </ul>`;
  }
  if (propane && gas) return `
    <div class="ft-combo-header ft-combo-both">
      <span class="ft-combo-icon">🔥⛽</span>
      <span>Propane (Active) + Gasoline (Reserve)</span>
    </div>
    <ul class="ft-combo-list">
      <li>🔥 <strong>Active fuel: Propane.</strong> Gasoline is not consumed while propane is connected.</li>
      <li>🛑 <strong>No auto-switch:</strong> If propane runs out, the generator shuts down — it will not switch to gasoline automatically.</li>
      <li class="ft-combo-steps-label">To continue on gasoline after propane is depleted:</li>
      <li class="ft-combo-step">1. Generator stops when propane is exhausted.</li>
      <li class="ft-combo-step">2. Disconnect the LPG regulator hose.</li>
      <li class="ft-combo-step">3. Restart the generator — it will now run on gasoline.</li>
    </ul>`;
  if (propane && !gas) return `
    <div class="ft-combo-header ft-combo-prop">
      <span class="ft-combo-icon">🔥</span>
      <span>Propane Only</span>
    </div>
    <ul class="ft-combo-list">
      <li>🔥 <strong>Active fuel: Propane.</strong> Generator runs entirely on LPG.</li>
      <li>🛑 If propane is exhausted, the generator <strong>shuts down</strong> — it will not auto-switch to gasoline.</li>
      <li>📦 Runtime is limited to your propane tank. No gasoline reserve available.</li>
      <li>💡 If gasoline is available in the tank, toggle "Gasoline Available" above to see combined runtime potential.</li>
    </ul>`;
  if (!propane && gas) return `
    <div class="ft-combo-header ft-combo-gas">
      <span class="ft-combo-icon">⛽</span>
      <span>Gasoline Only</span>
    </div>
    <ul class="ft-combo-list">
      <li>⛽ <strong>Active fuel: Gasoline.</strong> No propane is connected, so the generator uses the gasoline tank.</li>
      <li>📦 Runtime is limited to the gasoline tank. No propane reserve.</li>
      <li>⚠️ <strong>Auto-switch to propane:</strong> If a propane hose is connected while the generator is running on gasoline, the generator will automatically switch to propane.</li>
      <li>💡 To run on propane, connect the LPG hose and set Propane Connected = Yes above — the generator will switch automatically.</li>
    </ul>`;
  return `
    <div class="ft-combo-header ft-combo-none">
      <span class="ft-combo-icon">⛔</span>
      <span>No Fuel Available</span>
    </div>
    <ul class="ft-combo-list">
      <li>Generator cannot operate. Connect propane and/or ensure the gasoline tank has fuel, then update the settings above.</li>
    </ul>`;
}

// Shared status computation (limiting fuel) used by the landing strip.
function computeStatus() {
  const { running, peak } = calcLoads();
  const derated = deratedGen(state.elevation);
  const hasProp = genHasPropane();
  const gas = fuelStatus(running, peak, derated.gas.running, derated.gas.peak);
  const prop = hasProp ? fuelStatus(running, peak, derated.prop.running, derated.prop.peak) : null;
  const lim = hasProp ? prop : gas;
  return { running, lim, fuelName: hasProp ? 'propane' : 'gasoline' };
}

// Compact "can I run this?" answer on the landing tab, linking to the full verdict.
function buildLandingStatus() {
  const { running, lim, fuelName } = computeStatus();
  const label = lim.status === 'good' ? 'Safe' : lim.status === 'near' ? 'Near Capacity' : 'Unsafe';
  const icon  = lim.status === 'good' ? '✅' : lim.status === 'near' ? '⚠️' : '⛔';
  const remain = lim.runHead;
  const headroom = remain >= 0
    ? `<strong>${remain.toLocaleString()}W</strong> headroom`
    : `<strong>${Math.abs(remain).toLocaleString()}W</strong> over`;
  return `
    <div class="card land-status v-${lim.status}">
      <div class="land-status-row">
        <span class="verdict-pill v-${lim.status}"><span aria-hidden="true">${icon}</span> ${label}</span>
        <button class="land-status-link" onclick="showTab('calc')">${lim.status === 'good' ? 'Adjust load' : 'What to change'} ›</button>
      </div>
      <div class="land-status-detail">Estimated load <strong>${running.toLocaleString()}W</strong> · ${headroom} on ${fuelName}</div>
    </div>`;
}

function buildHomeHero() {
  return `
    <div class="gpa-hero">
      <div class="gpa-hero-badge">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="9"/>
          <path d="M57 24 L34 53 H51 L44 76 L67 45 H49 L60 24 Z" fill="currentColor"/>
        </svg>
        Generator Power Advisor
      </div>
      <h2 class="gpa-hero-title">Know what you can safely run.</h2>
      <p class="gpa-hero-sub">Your generator's real-world capacity — accounting for startup surge, elevation, and fuel — turned into clear, confident decisions. No signal required.</p>
      <div class="gpa-hero-metrics">
        <span class="gpa-hero-chip">⚡ <b>Dual-fuel</b> aware</span>
        <span class="gpa-hero-chip">⛰️ <b>Elevation</b> derated</span>
        <span class="gpa-hero-chip">📶 Works <b>offline</b></span>
      </div>
    </div>`;
}

function buildFuelTrackerHTML() {
  return `${buildHomeHero()}<div id="ft-panel"></div>`;
}

function calcNudge(running) {
  const preset = getAllPresets().find(p => p.id === state.activePresetId);
  const label = preset ? preset.name : 'Custom';
  return `<p class="ft-calc-nudge">Showing load from Calculator: <strong>${escHtml(label)}</strong> — ${fmtW(running)}. <a class="ft-calc-link" onclick="showTab('calc')">Adjust appliances</a> to refine these estimates.</p>`;
}

function renderFuelTrackerTab() {
  const panel = document.getElementById('ft-panel');
  if (!panel) return;

  const { running } = calcLoads();
  const ft = state.ft;
  const gen = currentGen();
  const hasProp = genHasPropane();
  const gTank = gen.gas.tankGal + ' gal tank';
  const pTank = hasProp ? gen.prop.tankLb + ' lb tank' : '';
  const src = activeFuelSource();
  const { gasGalHr, gasHrs, propLbHr, propHrs } = ftRuntimes(running);
  const combinedHrs = gasHrs + propHrs;

  // Active runtime = runtime of active fuel source; combined for overnight
  const activeHrs = src === 'propane' ? propHrs : src === 'gas' ? gasHrs : 0;
  const conf = ftConfidence(activeHrs);
  const nowMs = Date.now();

  // Load change detection
  let loadChangedNote = '';
  if (ft.trackingFuel && ft.startLoadW != null && ft.startLoadW !== running) {
    loadChangedNote = `<div class="ft-load-changed">Load changed from ${fmtW(ft.startLoadW)} to ${fmtW(running)}. Runtime estimate updated.</div>`;
    state.ft.startLoadW = running;
    ftLastLoadW = running;
    saveState();
  }

  // Elapsed
  const elapsedMs  = ft.trackingFuel && ft.startMs ? nowMs - ft.startMs : 0;

  // Source label
  const srcLabel = src === 'propane'
    ? '<span class="ft-src-propane">🔥 Propane</span>'
    : src === 'gas'
    ? '<span class="ft-src-gas">⛽ Gasoline</span>'
    : '<span class="ft-src-none">⚠️ No Fuel Source</span>';

  panel.innerHTML = `
    <!-- Answer-first status strip (mirrors the Calculator verdict) -->
    ${buildLandingStatus()}

    <!-- Welcome banner (first-time only) -->
    ${!state.welcomeDismissed ? `
    <div class="welcome-banner" id="welcome-banner">
      <div class="welcome-body">
        <div class="welcome-title">👋 Welcome to Generator Power Advisor</div>
        <p class="welcome-sub">Advising on your <strong>${escHtml(gen.short)}</strong> (${escHtml(gen.kind)}). Change it any time from the <em>Calculator</em> tab.</p>
        <p class="welcome-sub" style="margin-top:4px;"><strong>Recommended workflow:</strong> Choose a preset on the <em>Calculator</em> tab, then come back here to check runtime.</p>
      </div>
      <button class="welcome-dismiss" onclick="dismissWelcome()">Got it ✓</button>
    </div>` : ''}

    <!-- Quick Start -->
    ${buildQuickStartCard()}

    <!-- What am I looking at (propane/reserve concepts — dual-fuel only) -->
    ${hasProp ? buildWhatAmICard() : ''}

    <!-- Fuel Tracker (moved here for quick access) -->
    <div class="card">
      <h2>Fuel Tracker</h2>

      <!-- Status badge -->
      <div class="ft-track-status ${ft.trackingFuel === 'propane' ? 'ft-track-prop' : ft.trackingFuel === 'gas' ? 'ft-track-gas' : 'ft-track-off'}">
        ${ft.trackingFuel === 'propane' ? '🔥 Tracking: Propane Active'
          : ft.trackingFuel === 'gas'   ? '⛽ Tracking: Gasoline Active'
          : '⏸ Not Started'}
      </div>

      ${ft.trackingFuel && ft.startMs ? `
        <div class="ft-tracking-active" style="margin-top:12px;">
          <div class="ft-empty-row"><span>Fuel</span><span>${ft.trackingFuel === 'propane' ? '🔥 Propane' : '⛽ Gasoline'}</span></div>
          <div class="ft-empty-row"><span>Started</span><span>${fmtTime(ft.startMs)}</span></div>
          <div class="ft-empty-row"><span>Elapsed</span><span>${fmtElapsed(elapsedMs)}</span></div>
          <div class="ft-empty-row"><span>Load at start</span><span>${ft.startLoadW != null ? fmtW(ft.startLoadW) : '—'}</span></div>
          ${loadChangedNote}
          ${hasProp && ft.trackingFuel === 'propane' && ft.gasAvailable ? `
          <p class="ft-reserve-note" style="margin-top:8px;">
            When propane is depleted, the generator shuts down — it will not switch to gasoline automatically. Disconnect the LPG hose and restart to continue on gasoline.
          </p>` : ''}
          ${hasProp && ft.trackingFuel === 'gas' ? `
          <p class="ft-reserve-note" style="margin-top:8px;">
            ⚠️ Gasoline remains active only while the propane hose is disconnected. Connecting a propane hose while the generator is running will automatically switch it to propane.
          </p>` : ''}
          <div class="ft-tracking-btns">
            <button class="tracker-stop-btn" onclick="ftStopTracking()" style="width:auto;margin-top:0;">⏹ Stop Active Tracker</button>
            <button class="ft-reset-btn" onclick="ftResetTracking()">↺ Reset Fuel Tracker</button>
          </div>
        </div>
      ` : `
        <div class="${hasProp ? 'ft-start-grid' : 'ft-start-col'}">
          ${hasProp ? `
          <div class="ft-start-col">
            <button class="tracker-start-btn tracker-prop-btn tracker-card-start-btn ft-start-full"
              onclick="${!ft.propaneConnected ? `confirmFtPropane()` : `ftStartPropaneTracker()`}">
              🔥 Start Propane Tracker
              <span class="tracker-btn-sub">Use when the LPG hose is connected — propane is used first</span>
            </button>
            ${!ft.propaneConnected ? `<p class="ft-start-warn">⚠️ Propane is set to Not Connected. Tapping will set it to Connected and start the propane tracker.</p>` : ''}
          </div>` : ''}
          <div class="ft-start-col">
            <button class="tracker-start-btn tracker-gas-btn tracker-card-start-btn ft-start-full"
              onclick="${hasProp && ft.propaneConnected ? `confirmFtGas()` : `ftStartGasTracker()`}">
              ⛽ Start Gasoline Tracker
              <span class="tracker-btn-sub">${hasProp ? 'Use after the LPG hose is disconnected or when running gas-only' : 'Track gasoline runtime at the current load'}</span>
            </button>
            ${hasProp && ft.propaneConnected ? `<p class="ft-start-warn">⚠️ Propane is Connected. Tapping will set it to Disconnected and start the gasoline tracker. Propane is used first if LPG is connected.</p>` : ''}
          </div>
        </div>
        ${ft.startMs ? `<button class="ft-reset-btn" style="margin-top:10px;" onclick="ftResetTracking()">↺ Clear Previous Session</button>` : ''}
      `}
    </div>

    <!-- Recommended Workflows (fuel guidance is propane-oriented — dual-fuel only) -->
    ${hasProp ? buildWorkflowsCard() : ''}

    <!-- Fuel Configuration -->
    <div class="card">
      <h2>Fuel Configuration</h2>
      <p class="ft-sub" style="margin-bottom:10px;">
        ${hasProp
          ? 'Propane is always active when the LPG hose is connected. Gasoline is reserve and is not consumed while propane is connected. Connecting a propane hose while running on gasoline will automatically switch the generator to propane.'
          : `The ${escHtml(gen.short)} runs on gasoline only. Runtime below is based on your gasoline tank.`}
      </p>
      <div class="ft-config-grid">
        ${hasProp ? `
        <div class="ft-config-item">
          <span class="ft-config-label">Propane Connected</span>
          <div class="ft-toggle-pair">
            <button class="ft-opt-btn ${ft.propaneConnected ? 'active' : ''}" onclick="setFtPropane(true)">Yes</button>
            <button class="ft-opt-btn ${!ft.propaneConnected ? 'active' : ''}" onclick="setFtPropane(false)">No</button>
          </div>
        </div>` : ''}
        <div class="ft-config-item">
          <span class="ft-config-label">Gasoline Available</span>
          <div class="ft-toggle-pair">
            <button class="ft-opt-btn ${ft.gasAvailable ? 'active' : ''}" onclick="setFtGas(true)">Yes</button>
            <button class="ft-opt-btn ${!ft.gasAvailable ? 'active' : ''}" onclick="setFtGas(false)">No</button>
          </div>
        </div>
      </div>
      <div class="ft-active-source">
        <span class="ft-active-label">Active Fuel Source</span>
        <span class="ft-active-value">${srcLabel}</span>
      </div>
      ${src === 'none' ? `<div class="ft-no-fuel">⚠️ No fuel source selected. ${hasProp ? 'Connect propane or confirm gasoline is available.' : 'Confirm gasoline is available.'}</div>` : ''}
    </div>

    <!-- Fuel Combination Guidance -->
    <div class="card ft-combo-card">
      ${ftComboGuidance(hasProp, ft.propaneConnected, ft.gasAvailable)}
    </div>

    <!-- Current Load -->
    <div class="card ft-load-card">
      <h2>Current Generator Load</h2>
      <div class="ft-big-stat">${fmtW(running)}</div>
      ${calcNudge(running)}
      ${loadChangedNote}
    </div>

    <!-- Runtime cards -->
    <div class="ft-runtime-grid">
      ${hasProp ? `
      <div class="card ft-runtime-card ${src === 'propane' ? 'ft-active-card' : ''}">
        <h2 class="ft-fuel-heading prop-title">🔥 Propane${src === 'propane' ? ' <span class="ft-active-badge">ACTIVE</span>' : ''}</h2>
        ${ft.propaneConnected ? `
          <div class="ft-runtime-val ${propHrs >= 10 ? 'ft-green' : propHrs >= 6 ? 'ft-yellow' : 'ft-red'}">${fmt(propHrs)} hrs</div>
          <div class="ft-runtime-sub">${fmt(propLbHr, 2)} lb/hr · ${pTank}</div>
          <div class="ft-empty-row"><span>Est. empty</span><span>${ftEmptyTime(nowMs, propHrs)}</span></div>
        ` : '<p class="tracker-idle">Not connected.</p>'}
      </div>` : ''}
      <div class="card ft-runtime-card ${src === 'gas' ? 'ft-active-card' : (hasProp ? 'ft-reserve-card' : '')} ${hasProp ? '' : 'ft-start-full'}">
        <h2 class="ft-fuel-heading gas-title">⛽ Gasoline${src === 'gas' ? ' <span class="ft-active-badge">ACTIVE</span>' : (hasProp && ft.propaneConnected && ft.gasAvailable ? ' <span class="ft-reserve-badge">RESERVE</span>' : '')}</h2>
        ${ft.gasAvailable ? (() => {
          if (hasProp && ft.propaneConnected) {
            // Gasoline is reserve — NOT being consumed while propane is connected
            const gasStartMs = nowMs + propHrs * 3600000;
            const gasCombinedEmptyMs = gasStartMs + gasHrs * 3600000;
            return `
              <div class="ft-runtime-val ft-reserve-val">${fmt(gasHrs)} hrs</div>
              <div class="ft-runtime-sub">Reserve runtime · ${gTank}</div>
              <div class="ft-empty-row"><span>Usable after propane at</span><span>${fmtTime(gasStartMs)}</span></div>
              <div class="ft-empty-row"><span>Est. gas empty at</span><span>${fmtTime(gasCombinedEmptyMs)}</span></div>
              <p class="ft-reserve-note">⚠️ Not being consumed now. When propane runs out, the generator shuts down — it will NOT auto-switch to gasoline. Disconnect the LPG hose and restart to use gasoline.</p>`;
          } else {
            return `
              <div class="ft-runtime-val ${gasHrs >= 10 ? 'ft-green' : gasHrs >= 6 ? 'ft-yellow' : 'ft-red'}">${fmt(gasHrs)} hrs</div>
              <div class="ft-runtime-sub">${fmt(gasGalHr, 2)} gal/hr · ${gTank}</div>
              <div class="ft-empty-row"><span>Est. empty</span><span>${ftEmptyTime(nowMs, gasHrs)}</span></div>`;
          }
        })() : '<p class="tracker-idle">Not available.</p>'}
      </div>
    </div>

    <!-- Combined Runtime (only when both fuels available) -->
    ${(ft.propaneConnected && ft.gasAvailable) ? `
    <div class="card">
      <h2>Combined Potential Runtime</h2>
      <div class="ft-combined-val ${combinedHrs >= 10 ? 'ft-green' : combinedHrs >= 6 ? 'ft-yellow' : 'ft-red'}">${fmt(combinedHrs)} hrs</div>
      <div class="ft-empty-row" style="margin-top:6px;"><span>Est. combined empty time</span><span>${ftEmptyTime(nowMs, combinedHrs)}</span></div>
      <p class="ft-sub" style="margin-top:8px;">
        Propane depleted → generator stops → disconnect LPG hose → restart on gasoline. Combined runtime requires this manual 3-step process — the generator will not switch fuels automatically.
      </p>
    </div>
    ` : ''}

    <!-- Overnight Confidence -->
    ${(() => {
      const propConf     = ft.propaneConnected ? ftConfidence(propHrs)     : null;
      const combinedConf = (ft.propaneConnected && ft.gasAvailable) ? ftConfidence(combinedHrs) : null;
      const soloConf     = (!ft.propaneConnected && ft.gasAvailable) ? ftConfidence(gasHrs) : null;
      const mainConf     = propConf || soloConf || { icon:'❌', label:'No Fuel', css:'ft-conf-low', desc:'No fuel source available.' };
      const nowStr = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return `
      <div class="card ft-conf-card ${mainConf.css}">
        <h2>Overnight Confidence</h2>
        <div class="ft-conf-grid">
          ${(ft.propaneConnected) ? `
          <div class="ft-conf-col">
            <div class="ft-conf-col-label">Propane Only</div>
            <div class="ft-conf-badge">${propConf.icon} ${propConf.label}</div>
            <p class="ft-conf-desc">${propConf.desc}</p>
            <div class="ft-empty-row"><span>Propane empty at</span><span>${ftEmptyTime(nowMs, propHrs)}</span></div>
          </div>` : ''}
          ${(ft.propaneConnected && ft.gasAvailable) ? `
          <div class="ft-conf-col">
            <div class="ft-conf-col-label">Combined (manual switch)</div>
            <div class="ft-conf-badge">${combinedConf.icon} ${combinedConf.label}</div>
            <p class="ft-conf-desc">${combinedConf.desc}</p>
            <div class="ft-empty-row"><span>Combined empty at</span><span>${ftEmptyTime(nowMs, combinedHrs)}</span></div>
          </div>` : ''}
          ${(!ft.propaneConnected && ft.gasAvailable) ? `
          <div class="ft-conf-col">
            <div class="ft-conf-col-label">Gasoline</div>
            <div class="ft-conf-badge">${soloConf.icon} ${soloConf.label}</div>
            <p class="ft-conf-desc">${soloConf.desc}</p>
            <div class="ft-empty-row"><span>Gasoline empty at</span><span>${ftEmptyTime(nowMs, gasHrs)}</span></div>
          </div>` : ''}
        </div>
        <div class="ft-conf-detail">
          <div class="ft-empty-row"><span>Current time</span><span>${nowStr}</span></div>
          ${state.weather.forecastLow !== null && !state.weather.error ? (() => {
            const wi = weatherImpact(state.weather.forecastLow);
            return `<div class="ft-empty-row wi-conf-row"><span>Weather Impact</span><span class="wi-badge ${wi.css}">${wi.level}</span></div>`;
          })() : ''}
        </div>
      </div>`;
    })()}

    <!-- Weather Advisory -->
    ${buildWeatherCard()}

  `;
}

// ── Weather Advisory ──────────────────────────────────────────────────────────
const WEATHER_CACHE_MS = 3 * 60 * 60 * 1000; // 3 hours

function weatherImpact(tempF) {
  if (tempF > 40)  return { level: 'Minimal',  css: 'wi-minimal',  advisory: 'Normal operation expected.' };
  if (tempF >= 25) return { level: 'Moderate', css: 'wi-moderate', advisory: 'Cold temperatures may slightly reduce propane performance.' };
  if (tempF >= 10) return { level: 'Elevated', css: 'wi-elevated', advisory: 'Consider gasoline overnight if high generator loads are expected.' };
  return           { level: 'High',    css: 'wi-high',     advisory: 'Propane vaporization may be reduced from a standard 20 lb tank. Consider gasoline operation.' };
}

async function fetchForecastLow(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_min&temperature_unit=fahrenheit&forecast_days=1&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Weather fetch failed');
  const d = await r.json();
  return Math.round(d.daily.temperature_2m_min[0]);
}

async function fetchWeatherGps() {
  if (!navigator.geolocation) { state.weather.error = true; renderFuelTrackerTab(); return; }
  state.weather.loading = true;
  renderFuelTrackerTab();
  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 })
    );
    const { latitude: lat, longitude: lon } = pos.coords;
    const low = await fetchForecastLow(lat, lon);
    Object.assign(state.weather, { locationMode: 'gps', lat, lon, forecastLow: low, fetchedMs: Date.now(), error: false, loading: false });
    saveState();
  } catch (_) {
    state.weather.error = true;
    state.weather.loading = false;
  }
  renderFuelTrackerTab();
}

async function fetchWeatherZip() {
  const input = document.getElementById('weather-zip-input');
  const zip = input ? input.value.trim() : state.weather.zip;
  if (!zip || !/^\d{5}$/.test(zip)) return;
  state.weather.loading = true;
  state.weather.zip = zip;
  renderFuelTrackerTab();
  try {
    const gr = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!gr.ok) throw new Error('ZIP not found');
    const gd = await gr.json();
    const lat = parseFloat(gd.places[0].latitude);
    const lon = parseFloat(gd.places[0].longitude);
    const low = await fetchForecastLow(lat, lon);
    Object.assign(state.weather, { locationMode: 'zip', lat, lon, forecastLow: low, fetchedMs: Date.now(), error: false, loading: false });
    saveState();
  } catch (_) {
    state.weather.error = true;
    state.weather.loading = false;
  }
  renderFuelTrackerTab();
}

async function refreshWeather() {
  if (!state.weather.lat || !state.weather.lon) return;
  state.weather.loading = true;
  renderFuelTrackerTab();
  try {
    const low = await fetchForecastLow(state.weather.lat, state.weather.lon);
    Object.assign(state.weather, { forecastLow: low, fetchedMs: Date.now(), error: false, loading: false });
    saveState();
  } catch (_) {
    state.weather.error = true;
    state.weather.loading = false;
  }
  renderFuelTrackerTab();
}

function clearWeatherLocation() {
  Object.assign(state.weather, { locationMode: null, zip: '', lat: null, lon: null, forecastLow: null, fetchedMs: null, error: false, loading: false });
  saveState();
  renderFuelTrackerTab();
}

function buildWeatherCard() {
  const w = state.weather;

  if (w.loading) return `
    <div class="card wi-card">
      <h2>🌤 Weather Advisory</h2>
      <p class="wi-loading">Fetching tonight's forecast…</p>
    </div>`;

  if (w.forecastLow !== null && !w.error) {
    const impact = weatherImpact(w.forecastLow);
    const stale  = w.fetchedMs && (Date.now() - w.fetchedMs > WEATHER_CACHE_MS);
    const fetchedStr = w.fetchedMs ? new Date(w.fetchedMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
    return `
      <div class="card wi-card">
        <h2>🌤 Weather Advisory</h2>
        <div class="wi-row"><span class="wi-label">Tonight's Forecast Low</span><span class="wi-val">${w.forecastLow}°F</span></div>
        <div class="wi-row"><span class="wi-label">Weather Impact</span><span class="wi-badge ${impact.css}">${impact.level}</span></div>
        <div class="wi-advisory-row">${impact.advisory}</div>
        ${stale
          ? `<button class="wi-action-btn" onclick="refreshWeather()">↻ Forecast may be outdated — Refresh</button>`
          : `<p class="wi-fetched">Updated ${fetchedStr} · <button class="wi-link-btn" onclick="refreshWeather()">Refresh</button> · <button class="wi-link-btn" onclick="clearWeatherLocation()">Change location</button></p>`}
        <p class="wi-disclaimer">Weather guidance is informational only and does not modify runtime estimates.</p>
      </div>`;
  }

  // Setup / error state
  return `
    <div class="card wi-card">
      <h2>🌤 Weather Advisory</h2>
      ${w.error ? `<p class="wi-error">⚠️ Could not retrieve forecast. Check your connection and try again.</p>` : `<p class="wi-intro">Get tonight's forecast low to see if cold temperatures may affect propane performance.</p>`}
      <div class="wi-setup">
        <button class="wi-gps-btn" onclick="fetchWeatherGps()">📍 Use Current Location</button>
        <div class="wi-zip-row">
          <input class="wi-zip-input" id="weather-zip-input" type="text" inputmode="numeric" maxlength="5" placeholder="ZIP Code" value="${w.zip || ''}">
          <button class="wi-zip-btn" onclick="fetchWeatherZip()">Get Forecast</button>
        </div>
      </div>
      <p class="wi-disclaimer">Weather guidance is informational only and does not modify runtime estimates.</p>
    </div>`;
}

const TABS = ['ftracker','calc','shore','tests','fuel','ambient','about'];

function showTab(id) {
  TABS.forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('active', t === id);
    document.getElementById('panel-' + t).classList.toggle('active', t === id);
  });
  // Calculator-only header buttons
  const calcOnly = id === 'calc';
  document.querySelector('.header-manage-btn').style.display = calcOnly ? '' : 'none';
  document.querySelector('.header-collapse-btn').style.display = calcOnly ? '' : 'none';

  if (id === 'tests')    renderTests();
  if (id === 'shore')    renderShorePowerTab();
  if (id === 'ftracker') {
    renderFuelTrackerTab();
    startFtTickTimer();
    // Auto-refresh stale weather in background
    const w = state.weather;
    if (w.lat && w.lon && w.fetchedMs && (Date.now() - w.fetchedMs > WEATHER_CACHE_MS)) {
      refreshWeather();
    }
  }
  if (id !== 'ftracker') stopFtTickTimer();
}

// ── Theme (light / dark) ──────────────────────────────────────────────────────
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  let next;
  if (cur === 'light') next = 'dark';
  else if (cur === 'dark') next = 'light';
  else {
    // No explicit choice yet — flip relative to the current system preference.
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    next = prefersDark ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('gpaTheme', next); } catch (_) {}
}

// ── Boot ──────────────────────────────────────────────────────────────────────
window.toggleTheme = toggleTheme;
window.applyFanRecommendation = applyFanRecommendation;
window.openGenPicker = openGenPicker;
window.closeGenPicker = closeGenPicker;
window.renderGenModal = renderGenModal;
window.filterGenList = filterGenList;
window.confirmGenSpecs = confirmGenSpecs;
window.cloneGenToCustom = cloneGenToCustom;
window.selectGenerator = selectGenerator;
window.openCustomGenForm = openCustomGenForm;
window.saveCustomGen = saveCustomGen;
window.deleteCustomGen = deleteCustomGen;
window.toggleAppliance = toggleAppliance;
window.toggleSection = toggleSection;
window.collapseAll = collapseAll;
window.setElevation = setElevation;
window.setCustomElevation = setCustomElevation;
window.setElevationPreset = setElevationPreset;
window.getGpsElevation = getGpsElevation;
window.setBattery = setBattery;
window.setChargeStrategy = setChargeStrategy;
window.dismissWelcome   = dismissWelcome;
window.toggleQuickStart = toggleQuickStart;
window.openHelp         = openHelp;
window.closeHelp        = closeHelp;
window.setFtPropane     = setFtPropane;
window.setFtGas         = setFtGas;
window.ftStartPropaneTracker = ftStartPropaneTracker;
window.ftStartGasTracker     = ftStartGasTracker;
window.confirmFtPropane      = confirmFtPropane;
window.confirmFtGas          = confirmFtGas;
window.ftStopTracking        = ftStopTracking;
window.ftResetTracking       = ftResetTracking;
window.fetchWeatherGps      = fetchWeatherGps;
window.fetchWeatherZip      = fetchWeatherZip;
window.refreshWeather       = refreshWeather;
window.clearWeatherLocation = clearWeatherLocation;
window.addTest = addTest;
window.deleteTest = deleteTest;
window.updateTest = updateTest;
window.showTab = showTab;
window.shoreAcFanOnly = shoreAcFanOnly;
window.applyPreset = applyPreset;
window.openManagePresets = openManagePresets;
window.closeManagePresets = closeManagePresets;
window.deleteUserPreset = deleteUserPreset;
window.deleteBuiltInPreset = deleteBuiltInPreset;
window.restoreBuiltIns = restoreBuiltIns;
window.submitSavePreset = submitSavePreset;

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initTests();

  // Always start on Normal A/C preset with Full battery — only tests persist
  const defaultPreset = BUILT_IN_PRESETS.find(p => p.id === 'normal-ac');
  if (defaultPreset) {
    Object.assign(state.appliances, defaultPreset.appliances);
    state.battery = 'full';
    state.chargeStrategy = 'solar';
    state.elevation = defaultPreset.elevation;
    state.elevSource = 'preset';
    state.activePresetId = 'normal-ac';
  }

  document.getElementById('panel-ftracker').innerHTML  = buildFuelTrackerHTML();
  document.getElementById('panel-calc').innerHTML      = buildCalculatorHTML();
  document.getElementById('panel-shore').innerHTML     = buildShorePowerHTML();
  document.getElementById('panel-fuel').innerHTML      = buildFuelHTML();
  document.getElementById('panel-ambient').innerHTML   = buildAmbientHTML();
  document.getElementById('panel-about').innerHTML     = buildAboutHTML();

  // Re-apply button active states after HTML rebuild
  document.querySelectorAll('.battery-btn').forEach((btn, i) => {
    btn.classList.toggle('active', ['full','partial','heavy'][i] === state.battery);
  });
  syncPresetButtons(state.elevation);

  renderCalculator();  // also sets warnings via renderCalculator
  renderPresetButtons();
  showTab('ftracker');
  window.scrollTo(0, 0);

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
});
