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
  { id: 'leds',    name: 'Interior LED Lighting', detail: '', running: 75, surge: 0, on: false, group: 'other' },
];

// ── Generator specs ───────────────────────────────────────────────────────────
const GEN = {
  gas:  { running: 2900, peak: 3600 },
  prop: { running: 2600, peak: 3500 },
};

// ── Battery charging load by state ────────────────────────────────────────────
const BATTERY_LOAD = { full: 0, partial: 300, heavy: 700 };

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
    gas:  { running: Math.round(GEN.gas.running  * factor), peak: Math.round(GEN.gas.peak  * factor) },
    prop: { running: Math.round(GEN.prop.running * factor), peak: Math.round(GEN.prop.peak * factor) },
  };
}

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  appliances: Object.fromEntries(APPLIANCES.map(a => [a.id, a.on])),
  battery: 'full',
  elevation: 0,
  tests: [],
};

// ── Persistence ───────────────────────────────────────────────────────────────
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('camperPowerState') || '{}');
    if (saved.appliances) Object.assign(state.appliances, saved.appliances);
    if (saved.battery)    state.battery = saved.battery;
    if (saved.elevation != null) state.elevation = saved.elevation;
    if (saved.tests)      state.tests = saved.tests;
  } catch (_) {}
}

function saveState() {
  localStorage.setItem('camperPowerState', JSON.stringify({
    appliances: state.appliances,
    battery: state.battery,
    elevation: state.elevation,
    tests: state.tests,
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
  const battLoad = BATTERY_LOAD[state.battery];
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

  // Elevation indicator
  const elevEl = document.getElementById('res-elev');
  if (elevEl) {
    const deratePct = Math.round((1 - derated.gas.running / GEN.gas.running) * 100);
    elevEl.textContent = state.elevation > 0
      ? `${state.elevation.toLocaleString()} ft — ~${deratePct}% derating applied`
      : 'Sea level (no derating)';
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

  // Sync fuel burn tab
  updateFuelDisplay(running);
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
      <h2>Recommended Operating Strategy</h2>
      <p><strong>Normal mode:</strong> A/C Cooling + Refrigerator + Starlink + USB + TV</p>
      <p><strong>Temporary high-load mode:</strong> Switch A/C to Fan Only before running microwave, toaster, coffee maker, hair dryer, or clothes iron.</p>
    </div>

    <!-- Elevation -->
    <div class="card">
      <h2>Elevation</h2>
      <div class="elev-row">
        <div class="elev-input-wrap">
          <input type="number" id="elev-input" min="0" max="14000" step="100"
            value="${state.elevation}"
            oninput="setElevation(this.value)"
            placeholder="0">
          <span class="elev-unit">ft</span>
        </div>
        <div class="elev-presets">
          <button class="preset-btn" onclick="setElevationPreset(0)">Sea level</button>
          <button class="preset-btn" onclick="setElevationPreset(1400)">Sioux Falls</button>
          <button class="preset-btn" onclick="setElevationPreset(5280)">Denver</button>
          <button class="preset-btn" onclick="setElevationPreset(7000)">7,000 ft</button>
          <button class="preset-btn" onclick="setElevationPreset(9000)">9,000 ft</button>
          <button class="preset-btn" onclick="setElevationPreset(11000)">11,000 ft</button>
        </div>
      </div>
      <div class="elev-note" id="res-elev">Sea level (no derating)</div>
    </div>

    <!-- Results -->
    <div class="card collapsible-card">
      <h2 class="collapsible-heading" onclick="toggleSection('summary-detail', this)">
        Generator Load Summary <span class="collapse-icon">▾</span>
      </h2>

      <div id="summary-detail">
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

    <!-- Battery State -->
    <div class="card">
      <h2>Battery State</h2>
      <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">
        Estimates converter charging load added to generator while running.
      </p>
      <div class="battery-selector">
        <button class="battery-btn ${state.battery === 'full' ? 'active' : ''}" onclick="setBattery('full')">
          Full <span class="battery-sub">+0W</span>
        </button>
        <button class="battery-btn ${state.battery === 'partial' ? 'active' : ''}" onclick="setBattery('partial')">
          Partial <span class="battery-sub">+300W</span>
        </button>
        <button class="battery-btn ${state.battery === 'heavy' ? 'active' : ''}" onclick="setBattery('heavy')">
          Heavy <span class="battery-sub">+700W</span>
        </button>
      </div>
    </div>

    <!-- Always-on -->
    <div class="card collapsible-card">
      <h2 class="collapsible-heading" onclick="toggleSection('always-body', this)">
        Always-On Group <span class="collapse-icon">▾</span>
      </h2>
      <div id="always-body">
        ${always.map(buildApplianceRow).join('')}
      </div>
    </div>

    <!-- A/C alternate -->
    <div class="card">
      <h2>A/C Alternate Mode</h2>
      ${acAlt.map(buildApplianceRow).join('')}
      <div class="warn-note" id="ac-warn" style="display:none">
        ⚠️ A/C Cooling is active. Turn it off before enabling Fan Only.
      </div>
    </div>

    <!-- High-load -->
    <div class="card collapsible-card">
      <h2 class="collapsible-heading" onclick="toggleSection('highload-body', this)">
        Temporary High-Load — Use A/C Fan Only <span class="collapse-icon">▾</span>
      </h2>
      <div id="highload-body">
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
    <div class="card">
      <h2>Other / Intermittent Loads</h2>
      ${other.map(buildApplianceRow).join('')}
    </div>
  `;
}

function setElevation(val) {
  const ft = Math.max(0, Math.min(14000, parseInt(val) || 0));
  state.elevation = ft;
  saveState();
  renderCalculator();
}

function setElevationPreset(ft) {
  state.elevation = ft;
  const input = document.getElementById('elev-input');
  if (input) input.value = ft;
  saveState();
  renderCalculator();
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

  // Warn if high-load + A/C cooling both on
  const highLoadOn = ['micro','toaster','coffee','hairdryer','iron'].some(i => state.appliances[i]);
  const hlWarn = document.getElementById('highload-warn');
  if (hlWarn) hlWarn.style.display = (highLoadOn && state.appliances['ac_cool']) ? 'block' : 'none';

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

// ── Render: Fuel Burn ─────────────────────────────────────────────────────────
function updateFuelDisplay(currentLoad) {
  const el = document.getElementById('fuel-current');
  if (!el) return;

  const { gasGalHr, gasHrsPerTank, gasHrsPer5gal,
          propLbHr, propHrsPer20lb, propHrsPer40lb } = estFuelBurn(currentLoad);

  el.innerHTML = `
    <p>Current load from Calculator: <strong>${fmtW(currentLoad)}</strong></p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;">
      <div>
        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.05em;color:#60a5fa;margin-bottom:4px;">⛽ Gasoline</div>
        <div style="font-size:0.78rem;">${fmt(gasGalHr, 2)} gal/hr</div>
        <div style="font-size:0.78rem;">${fmt(gasHrsPerTank)} hrs / 1.5 gal tank</div>
        <div style="font-size:0.78rem;">${fmt(gasHrsPer5gal)} hrs / 5 gal jug</div>
      </div>
      <div>
        <div style="font-size:0.68rem;text-transform:uppercase;letter-spacing:0.05em;color:#a78bfa;margin-bottom:4px;">🔵 Propane</div>
        <div style="font-size:0.78rem;">${fmt(propLbHr, 2)} lb/hr</div>
        <div style="font-size:0.78rem;">${fmt(propHrsPer20lb)} hrs / 20 lb tank</div>
        <div style="font-size:0.78rem;">${fmt(propHrsPer40lb)} hrs / 2×20 lb</div>
      </div>
    </div>`;
}

function buildFuelHTML() {
  const rows = [0.25, 0.50, 0.75, 1.00].map(pct => {
    const gW = Math.round(GEN.gas.running  * pct);
    const pW = Math.round(GEN.prop.running * pct);
    const { gasHrsPerTank, gasHrsPer5gal, propHrsPer20lb, propHrsPer40lb } = estFuelBurn(gW);
    const { propHrsPer20lb: pProp20, propHrsPer40lb: pProp40 } = estFuelBurn(pW);
    const label = pct === 0.25 ? 'Light (25%)' : pct === 0.5 ? '½ Load (50%) — spec basis' : pct === 0.75 ? 'Heavy (75%)' : 'Full (100%)';
    const isHalf = pct === 0.5;
    return `<tr${isHalf ? ' class="highlight-row"' : ''}>
      <td>${label}</td>
      <td>${gW}W</td>
      <td>${fmt(gasHrsPerTank)} hrs</td>
      <td>${fmt(gasHrsPer5gal)} hrs</td>
      <td>${pW}W</td>
      <td>${fmt(pProp20)} hrs</td>
      <td>${fmt(pProp40)} hrs</td>
    </tr>`;
  });

  return `
    <div class="current-load-box" id="fuel-current">
      <strong>Load from Calculator: —</strong>
    </div>

    <div class="card">
      <h2>Runtime Reference Table</h2>
      <div class="fuel-table-wrap">
        <table class="fuel-table">
          <thead>
            <tr>
              <th rowspan="2">Load Level</th>
              <th colspan="3" class="gas-col">⛽ Gasoline</th>
              <th colspan="3" class="prop-col">🔵 Propane</th>
            </tr>
            <tr>
              <th class="gas-col">Watts</th>
              <th class="gas-col">Hrs/1.5 gal</th>
              <th class="gas-col">Hrs/5 gal</th>
              <th class="prop-col">Watts</th>
              <th class="prop-col">Hrs/20 lb</th>
              <th class="prop-col">Hrs/2×20 lb</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>
      <p style="font-size:0.68rem;color:var(--text-muted);margin-top:8px;">
        Highlighted row = published spec basis (WEN / Home Depot listing).
        All other rows are proportional estimates.
      </p>
    </div>

    <div class="card">
      <h2>Important Caveats</h2>
      <ul class="guidance-list">
        <li><span>📊</span><span>Estimates scale proportionally from the published half-load figure. Real burn varies.</span></li>
        <li><span>🌡️</span><span>Hot weather increases A/C duty cycle and average fuel use — the Calculator shows worst-case instant load.</span></li>
        <li><span>⛰️</span><span>High elevation reduces generator output and may increase fuel burn.</span></li>
        <li><span>🔋</span><span>ECO mode can extend runtime significantly at light loads, but you noted you won't use it often.</span></li>
        <li><span>⛽</span><span>Tank fill level, fuel age, and generator condition all affect real runtime.</span></li>
        <li><span>📝</span><span>Track your actual tank-to-tank times in Real-World Tests to refine your estimates.</span></li>
      </ul>
    </div>

    <div class="card">
      <h2>Sources</h2>
      <p style="font-size:0.73rem;color:var(--text-muted);line-height:1.7;">
        WEN DF360iX product page (wenproducts.com) · Home Depot listing #330761409<br>
        Published spec: ~5 hrs gasoline at half-load (1.5 gal) · ~11 hrs propane at half-load (20 lb).<br>
        Propane half-load watts ≈ 1,300W (50% × 2,600W running rating).
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
          <li><span>🔋</span><span>The 300W solar panel reduces battery charging demand on the generator but is not counted as generator output.</span></li>
          <li><span>🌙</span><span>Starlink overnight is fine when the generator is running — generator/converter power the 12V system so battery drain is minimal.</span></li>
          <li><span>🔌</span><span>Battery state adds estimated converter charging load while generator is running. Full = 0W, Partial = 300W, Heavy = 700W.</span></li>
          <li><span>⚠️</span><span>Peak load = selected running load + <em>largest single</em> startup surge (appliances don't all surge simultaneously).</span></li>
          <li><span>🔋</span><span>Flooded lead-acid batteries should not be deeply discharged regularly — try to keep them above 50% (68Ah used of 136Ah).</span></li>
          <li><span>📊</span><span>Good = running ≤85% of capacity and peak ≤ peak rating. Near Limit = running 85–100%. Over Limit = either threshold exceeded.</span></li>
        </ul>
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

    <div class="version">Camper Power Calculator · v1.0 · Built for WEN DF360iX + Coachmen Apex 28RBS</div>
  `;
}

// ── Tab routing ───────────────────────────────────────────────────────────────
const TABS = ['calc','tests','fuel','ambient','about'];

function showTab(id) {
  TABS.forEach(t => {
    document.getElementById('tab-' + t).classList.toggle('active', t === id);
    document.getElementById('panel-' + t).classList.toggle('active', t === id);
  });
  if (id === 'tests')   renderTests();
  if (id === 'fuel')    { const { running } = calcLoads(); updateFuelDisplay(running); }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
window.toggleAppliance = toggleAppliance;
window.toggleSection = toggleSection;
window.setElevation = setElevation;
window.setElevationPreset = setElevationPreset;
window.setBattery = setBattery;
window.addTest = addTest;
window.deleteTest = deleteTest;
window.updateTest = updateTest;
window.showTab = showTab;

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initTests();

  document.getElementById('panel-calc').innerHTML    = buildCalculatorHTML();
  document.getElementById('panel-fuel').innerHTML    = buildFuelHTML();
  document.getElementById('panel-ambient').innerHTML = buildAmbientHTML();
  document.getElementById('panel-about').innerHTML   = buildAboutHTML();

  // Re-apply battery button active state after HTML rebuild
  document.querySelectorAll('.battery-btn').forEach((btn, i) => {
    btn.classList.toggle('active', ['full','partial','heavy'][i] === state.battery);
  });

  renderCalculator();
  showTab('calc');

  // High-load warning initial state
  const highLoadOn = ['micro','toaster','coffee','hairdryer','iron'].some(i => state.appliances[i]);
  const hlWarn = document.getElementById('highload-warn');
  if (hlWarn) hlWarn.style.display = (highLoadOn && state.appliances['ac_cool']) ? 'block' : 'none';

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
});
