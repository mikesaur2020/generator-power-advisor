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

// ── Generator specs ───────────────────────────────────────────────────────────
const GEN = {
  gas:  { running: 2900, peak: 3600 },
  prop: { running: 2600, peak: 3500 },
};

// ── Battery charging load by state (only applied when strategy = generator) ───
const BATTERY_LOAD = { full: 0, partial: 300, heavy: 700 };

// ── 30A Shore Power ───────────────────────────────────────────────────────────
// Standard campground 30A RV pedestal: single 120V leg at 30A.
//   Theoretical max         = 120V × 30A = 3,600W
//   Recommended continuous  = 80% of breaker = 24A / 2,880W
const SHORE_30A = { volts: 120, maxAmps: 30, maxW: 3600, contAmps: 24, contW: 2880 };
// High-load appliances that warrant switching A/C to Fan Only first.
const SHORE_HIGHLOAD = ['micro', 'toaster', 'coffee', 'hairdryer', 'iron'];

// ── Fuel burn reference data (from WEN specs / Home Depot listing) ────────────
// Gas: 5 hrs @ half-load (1450W) on 1.5 gal tank
// Propane: 11 hrs @ half-load (1300W) on 20 lb tank
const FUEL = {
  gas:  { tankGal: 1.5, halfLoadHrs: 5,  halfLoadW: 1450 },
  prop: { tankLb: 20,  halfLoadHrs: 11, halfLoadW: 1300 },
};

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
  const factor = Math.max(0, 1 - (elevFt / 1000) * DERATE_PER_1000FT);
  return {
    factor,
    gas:  { running: Math.round(GEN.gas.running  * factor), peak: Math.round(GEN.gas.peak  * factor) },
    prop: { running: Math.round(GEN.prop.running * factor), peak: Math.round(GEN.prop.peak * factor) },
  };
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
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('camperPowerState') || '{}');
    if (saved.appliances)  Object.assign(state.appliances, saved.appliances);
    if (saved.battery)        state.battery = saved.battery;
    if (saved.chargeStrategy) state.chargeStrategy = saved.chargeStrategy;
    if (saved.elevation != null) state.elevation = saved.elevation;
    if (saved.elevSource)    state.elevSource = saved.elevSource;
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
  // Proportional from half-load published figure
  const gasGalHr = (loadW / FUEL.gas.halfLoadW) * (FUEL.gas.tankGal / FUEL.gas.halfLoadHrs);
  const gasHrsPerTank = loadW > 0 ? FUEL.gas.tankGal / gasGalHr : Infinity;
  const gasHrsPer5gal = loadW > 0 ? 5 / gasGalHr : Infinity;

  const propLbHr = (loadW / FUEL.prop.halfLoadW) * (FUEL.prop.tankLb / FUEL.prop.halfLoadHrs);
  const propHrsPer20lb = loadW > 0 ? FUEL.prop.tankLb / propLbHr : Infinity;
  const propHrsPer40lb = propHrsPer20lb * 2;

  return { gasGalHr, gasHrsPerTank, gasHrsPer5gal, propLbHr, propHrsPer20lb, propHrsPer40lb };
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
  const derated = deratedGen(state.elevation);
  const gas  = fuelStatus(running, peak, derated.gas.running,  derated.gas.peak);
  const prop = fuelStatus(running, peak, derated.prop.running, derated.prop.peak);

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
  setText('derate-prop-run', derated.prop.running.toLocaleString() + ' W');
  setText('derate-prop-peak',derated.prop.peak.toLocaleString() + ' W');

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

  // Propane status
  const propBadge = document.getElementById('prop-badge');
  propBadge.textContent = prop.label;
  propBadge.className = 'status-badge status-' + prop.status;
  document.getElementById('prop-run-head').innerHTML = fmtHead(prop.runHead);
  document.getElementById('prop-peak-head').innerHTML = fmtHead(prop.peakHead);
  document.getElementById('prop-capacity').textContent = `${derated.prop.running.toLocaleString()}W / ${derated.prop.peak.toLocaleString()}W peak`;

  // Running % display
  document.getElementById('gas-run-pct').textContent  = Math.round(gas.runPct * 100) + '% of running capacity';
  document.getElementById('prop-run-pct').textContent = Math.round(prop.runPct * 100) + '% of running capacity';

  // Load status banner
  const banner = document.getElementById('load-banner');
  if (banner) {
    const worstStatus = (gas.status === 'over' || prop.status === 'over') ? 'over'
                      : (gas.status === 'near' || prop.status === 'near') ? 'near' : 'good';
    if (worstStatus === 'over') {
      const msgs = [];
      if (gas.status  === 'over') msgs.push(`⛽ Gas: ${gas.label}`);
      if (prop.status === 'over') msgs.push(`🔵 Propane: ${prop.label}`);
      banner.textContent = msgs.join('  ·  ');
      banner.className = 'load-banner load-banner-over';
      banner.style.display = 'block';
    } else if (worstStatus === 'near') {
      const msgs = [];
      if (gas.status  === 'near') msgs.push('⛽ Gas: Near Limit');
      if (prop.status === 'near') msgs.push('🔵 Propane: Near Limit');
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
          <div class="derate-row"><span>🔵 Propane Running Capacity</span><span id="derate-prop-run">—</span></div>
          <div class="derate-row"><span>🔵 Propane Peak Capacity</span><span id="derate-prop-peak">—</span></div>
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
        <div class="fuel-block">
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
  const rows = [0.25, 0.50, 0.75, 1.00].map(pct => {
    const gW = Math.round(GEN.gas.running  * pct);
    const pW = Math.round(GEN.prop.running * pct);
    const { gasHrsPerTank, gasHrsPer5gal, propHrsPer20lb, propHrsPer40lb } = estFuelBurn(gW);
    const { propHrsPer20lb: pProp20, propHrsPer40lb: pProp40 } = estFuelBurn(pW);
    const label = pct === 0.25 ? 'Light (25%)' : pct === 0.5 ? '½ Load (50%) — spec basis' : pct === 0.75 ? 'Heavy (75%)' : 'Full (100%)';
    const isHalf = pct === 0.5;
    return `<tr${isHalf ? ' class="highlight-row"' : ''}>
      <td>${label}</td><td>${gW}W</td><td>${fmt(gasHrsPerTank)} hrs</td><td>${fmt(gasHrsPer5gal)} hrs</td>
      <td>${pW}W</td><td>${fmt(pProp20)} hrs</td><td>${fmt(pProp40)} hrs</td>
    </tr>`;
  });

  return `
    <!-- Reference table -->
    <div class="card">
      <h2>Runtime Reference Table</h2>
      <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px;">
        Planning table for estimating runtime at different load levels — useful before you know what appliance combination you'll run.
      </p>
      <div class="fuel-table-wrap">
        <table class="fuel-table">
          <thead>
            <tr>
              <th rowspan="2">Load Level</th>
              <th colspan="3" class="gas-col">⛽ Gasoline</th>
              <th colspan="3" class="prop-col">🔵 Propane</th>
            </tr>
            <tr>
              <th class="gas-col">Watts</th><th class="gas-col">Hrs/1.5 gal</th><th class="gas-col">Hrs/5 gal</th>
              <th class="prop-col">Watts</th><th class="prop-col">Hrs/20 lb</th><th class="prop-col">Hrs/2×20 lb</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
      <p style="font-size:0.68rem;color:var(--text-muted);margin-top:8px;">
        Highlighted row = published spec basis (WEN / Home Depot). All other rows are proportional estimates.
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
        Sources: WEN DF360iX product page · Home Depot listing #330761409<br>
        ~5 hrs gasoline at half-load (1.5 gal) · ~11 hrs propane at half-load (20 lb)
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
  return `
    <div class="card">
      <div class="about-section">
        <h3>Equipment</h3>
        <div class="spec-row"><span>Camper</span><span>2025 Coachmen Apex Ultra-Lite 28RBS</span></div>
        <div class="spec-row"><span>Generator</span><span>WEN DF360iX Dual-Fuel Inverter</span></div>
        <div class="spec-row"><span>Gas capacity</span><span>2,900W running / 3,600W peak</span></div>
        <div class="spec-row"><span>Propane capacity</span><span>2,600W running / 3,500W peak</span></div>
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

    <div class="card">
      <div class="about-section">
        <h3>WEN DF360iX Auto Fuel Selection</h3>
        <p style="font-size:0.75rem;color:var(--text-muted);line-height:1.6;">
          Propane is always the active fuel when the LPG hose is connected. Gasoline is reserve and not consumed while propane is connected.<br><br>
          <strong>Propane runs out with hose connected:</strong> Generator shuts down — it will not auto-switch to gasoline. To continue: disconnect the LPG hose, then restart the generator.<br><br>
          <strong>Running on gasoline + connect propane hose:</strong> Generator automatically switches to propane.<br><br>
          Full switchover steps are on the <strong>Live Fuel Tracker</strong> tab. <em>Confirmed by WEN Technical Support.</em>
        </p>
      </div>
    </div>

    <div class="card">
      <div class="disclaimer">
        <strong>Disclaimer:</strong> This app provides estimates only. Real-world generator output, A/C efficiency,
        and fuel consumption vary with temperature, elevation, fuel quality, generator condition, and load profile.
        Always monitor your generator while running and do not leave it unattended in enclosed or unsafe spaces.
        Carbon monoxide is odorless and deadly — run the generator outdoors only.
      </div>
    </div>

    <div class="version">Mike's Camper Power Calculator · RV Energy Management &amp; Generator Runtime Planning<br>Built for WEN DF360iX + Coachmen Apex 28RBS · Offline-capable PWA</div>
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

function ftComboGuidance(propane, gas) {
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
      <li>📦 Runtime is limited to the gasoline tank (1.5 gal). No propane reserve.</li>
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

function buildFuelTrackerHTML() {
  return `<div id="ft-panel"></div>`;
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
    <!-- Welcome banner (first-time only) -->
    ${!state.welcomeDismissed ? `
    <div class="welcome-banner" id="welcome-banner">
      <div class="welcome-body">
        <div class="welcome-title">👋 Welcome to Mike's Camper Power Calculator</div>
        <p class="welcome-sub">Built for the 2025 Coachmen Apex 28RBS · WEN DF360iX · GE 15,000 BTU A/C · Starlink Mini · 300W solar</p>
        <p class="welcome-sub" style="margin-top:4px;"><strong>Recommended workflow:</strong> Choose a preset on the <em>Calculator</em> tab, then come back here to check runtime.</p>
      </div>
      <button class="welcome-dismiss" onclick="dismissWelcome()">Got it ✓</button>
    </div>` : ''}

    <!-- Quick Start -->
    ${buildQuickStartCard()}

    <!-- What am I looking at -->
    ${buildWhatAmICard()}

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
          ${ft.trackingFuel === 'propane' && ft.gasAvailable ? `
          <p class="ft-reserve-note" style="margin-top:8px;">
            When propane is depleted, the generator shuts down — it will not switch to gasoline automatically. Disconnect the LPG hose and restart to continue on gasoline.
          </p>` : ''}
          ${ft.trackingFuel === 'gas' ? `
          <p class="ft-reserve-note" style="margin-top:8px;">
            ⚠️ Gasoline remains active only while the propane hose is disconnected. Connecting a propane hose while the generator is running will automatically switch it to propane.
          </p>` : ''}
          <div class="ft-tracking-btns">
            <button class="tracker-stop-btn" onclick="ftStopTracking()" style="width:auto;margin-top:0;">⏹ Stop Active Tracker</button>
            <button class="ft-reset-btn" onclick="ftResetTracking()">↺ Reset Fuel Tracker</button>
          </div>
        </div>
      ` : `
        <div class="ft-start-grid">
          <div class="ft-start-col">
            <button class="tracker-start-btn tracker-prop-btn tracker-card-start-btn ft-start-full"
              onclick="${!ft.propaneConnected ? `confirmFtPropane()` : `ftStartPropaneTracker()`}">
              🔥 Start Propane Tracker
              <span class="tracker-btn-sub">Use when LPG hose is connected — WEN uses propane first</span>
            </button>
            ${!ft.propaneConnected ? `<p class="ft-start-warn">⚠️ Propane is set to Not Connected. Tapping will set it to Connected and start the propane tracker.</p>` : ''}
          </div>
          <div class="ft-start-col">
            <button class="tracker-start-btn tracker-gas-btn tracker-card-start-btn ft-start-full"
              onclick="${ft.propaneConnected ? `confirmFtGas()` : `ftStartGasTracker()`}">
              ⛽ Start Gasoline Tracker
              <span class="tracker-btn-sub">Use only after LPG hose is disconnected or when running gas-only</span>
            </button>
            ${ft.propaneConnected ? `<p class="ft-start-warn">⚠️ Propane is Connected. Tapping will set it to Disconnected and start the gasoline tracker. The WEN uses propane first if LPG is connected.</p>` : ''}
          </div>
        </div>
        ${ft.startMs ? `<button class="ft-reset-btn" style="margin-top:10px;" onclick="ftResetTracking()">↺ Clear Previous Session</button>` : ''}
      `}
    </div>

    <!-- Recommended Workflows -->
    ${buildWorkflowsCard()}

    <!-- Fuel Configuration -->
    <div class="card">
      <h2>Fuel Configuration</h2>
      <p class="ft-sub" style="margin-bottom:10px;">
        Propane is always active when the LPG hose is connected. Gasoline is reserve and is not consumed while propane is connected. Connecting a propane hose while running on gasoline will automatically switch the generator to propane.
      </p>
      <div class="ft-config-grid">
        <div class="ft-config-item">
          <span class="ft-config-label">Propane Connected</span>
          <div class="ft-toggle-pair">
            <button class="ft-opt-btn ${ft.propaneConnected ? 'active' : ''}" onclick="setFtPropane(true)">Yes</button>
            <button class="ft-opt-btn ${!ft.propaneConnected ? 'active' : ''}" onclick="setFtPropane(false)">No</button>
          </div>
        </div>
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
      ${src === 'none' ? '<div class="ft-no-fuel">⚠️ No fuel source selected. Connect propane or confirm gasoline is available.</div>' : ''}
    </div>

    <!-- Fuel Combination Guidance -->
    <div class="card ft-combo-card">
      ${ftComboGuidance(ft.propaneConnected, ft.gasAvailable)}
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
      <div class="card ft-runtime-card ${src === 'propane' ? 'ft-active-card' : ''}">
        <h2 class="ft-fuel-heading prop-title">🔥 Propane${src === 'propane' ? ' <span class="ft-active-badge">ACTIVE</span>' : ''}</h2>
        ${ft.propaneConnected ? `
          <div class="ft-runtime-val ${propHrs >= 10 ? 'ft-green' : propHrs >= 6 ? 'ft-yellow' : 'ft-red'}">${fmt(propHrs)} hrs</div>
          <div class="ft-runtime-sub">${fmt(propLbHr, 2)} lb/hr · 20 lb tank</div>
          <div class="ft-empty-row"><span>Est. empty</span><span>${ftEmptyTime(nowMs, propHrs)}</span></div>
        ` : '<p class="tracker-idle">Not connected.</p>'}
      </div>
      <div class="card ft-runtime-card ${src === 'gas' ? 'ft-active-card' : 'ft-reserve-card'}">
        <h2 class="ft-fuel-heading gas-title">⛽ Gasoline${src === 'gas' ? ' <span class="ft-active-badge">ACTIVE</span>' : (ft.propaneConnected && ft.gasAvailable ? ' <span class="ft-reserve-badge">RESERVE</span>' : '')}</h2>
        ${ft.gasAvailable ? (() => {
          if (ft.propaneConnected) {
            // Gasoline is reserve — NOT being consumed while propane is connected
            const gasStartMs = nowMs + propHrs * 3600000;
            const gasCombinedEmptyMs = gasStartMs + gasHrs * 3600000;
            return `
              <div class="ft-runtime-val ft-reserve-val">${fmt(gasHrs)} hrs</div>
              <div class="ft-runtime-sub">Reserve runtime · 1.5 gal tank</div>
              <div class="ft-empty-row"><span>Usable after propane at</span><span>${fmtTime(gasStartMs)}</span></div>
              <div class="ft-empty-row"><span>Est. gas empty at</span><span>${fmtTime(gasCombinedEmptyMs)}</span></div>
              <p class="ft-reserve-note">⚠️ Not being consumed now. When propane runs out, the generator shuts down — it will NOT auto-switch to gasoline. Disconnect the LPG hose and restart to use gasoline.</p>`;
          } else {
            return `
              <div class="ft-runtime-val ${gasHrs >= 10 ? 'ft-green' : gasHrs >= 6 ? 'ft-yellow' : 'ft-red'}">${fmt(gasHrs)} hrs</div>
              <div class="ft-runtime-sub">${fmt(gasGalHr, 2)} gal/hr · 1.5 gal tank</div>
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

// ── Boot ──────────────────────────────────────────────────────────────────────
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
