/**
 * Facilities Electrical Toolbox — Calculator Logic
 * Tools for Facilities Electrical Engineering
 */

'use strict';

/* ============================================================
   NAVIGATION
   ============================================================ */
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const sec = document.getElementById(target);
    if (sec) sec.classList.add('active');
  });
});

/* ── Tab switcher (within sections) ── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.closest('.tab-group');
    group.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    group.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    group.querySelector('#' + btn.dataset.tab).classList.add('active');
  });
});

/* ============================================================
   HELPER UTILITIES
   ============================================================ */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showResult(id, rows) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'result show';
  el.innerHTML = rows.map(r =>
    `<div class="res-row"><span class="res-label">${escapeHtml(r[0])}</span><span class="res-val">${escapeHtml(r[1])}</span></div>`
  ).join('');
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'result error show';
  el.textContent = '⚠ ' + msg;
}

function val(id) {
  const el = document.getElementById(id);
  return el ? parseFloat(el.value) : NaN;
}

function fmt(n, decimals = 4) {
  if (!isFinite(n)) return '—';
  if (Math.abs(n) >= 1e6)  return n.toExponential(3);
  if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const d = Math.abs(n) < 0.01 ? 6 : decimals;
  return parseFloat(n.toFixed(d)).toString();
}

function deg(rad) { return rad * 180 / Math.PI; }

function isPos(...args) { return args.every(v => isFinite(v) && v > 0); }
function isNum(...args) { return args.every(v => isFinite(v)); }

/* ============================================================
   1. OHM'S LAW
   ============================================================ */
window.calcOhmsLaw = function () {
  const V = val('ohm_v'), I = val('ohm_i'), R = val('ohm_r');
  const known = [
    isFinite(V) && V >= 0,
    isFinite(I) && I >= 0,
    isFinite(R) && R > 0
  ].filter(Boolean).length;

  if (known < 2) return showError('ohm_result', 'Enter any two values to solve for the third.');

  let vv = V, iv = I, rv = R;
  if (!isFinite(vv)) {
    vv = iv * rv;
  } else if (!isFinite(iv)) {
    if (rv === 0) return showError('ohm_result', 'Resistance cannot be zero.');
    iv = vv / rv;
  } else {
    if (iv === 0) return showError('ohm_result', 'Current cannot be zero.');
    rv = vv / iv;
  }

  const P = vv * iv;
  showResult('ohm_result', [
    ['Voltage (V)', fmt(vv) + ' V'],
    ['Current (I)', fmt(iv) + ' A'],
    ['Resistance (R)', fmt(rv) + '\u03a9'],
    ['Power (P = V \u00d7 I)', fmt(P) + ' W (' + fmt(P / 1000) + ' kW)']
  ]);
};

/* ============================================================
   2. DC POWER
   ============================================================ */
window.calcDCPower = function () {
  const mode = document.getElementById('dcpower_mode').value;
  let P, V, I, R;
  if (mode === 'pvi') {
    V = val('dcp_v'); I = val('dcp_i');
    if (!isNum(V, I)) return showError('dcp_result', 'Enter V and I.');
    P = V * I; R = I !== 0 ? V / I : NaN;
  } else if (mode === 'pi2r') {
    I = val('dcp_i2'); R = val('dcp_r2');
    if (!isPos(I, R)) return showError('dcp_result', 'Enter I and R (both > 0).');
    P = I * I * R; V = I * R;
  } else {
    V = val('dcp_v3'); R = val('dcp_r3');
    if (!isPos(V, R)) return showError('dcp_result', 'Enter V and R (both > 0).');
    P = V * V / R; I = V / R;
  }
  if (!isFinite(P)) return showError('dcp_result', 'Invalid inputs.');
  showResult('dcp_result', [
    ['Power (P)', fmt(P) + ' W (' + fmt(P / 1000) + ' kW)'],
    ['Voltage (V)', fmt(V) + ' V'],
    ['Current (I)', fmt(I) + ' A'],
    ['Resistance (R)', fmt(R) + ' \u03a9']
  ]);
};

window.dcPowerModeChange = function () {
  const mode = document.getElementById('dcpower_mode').value;
  document.querySelectorAll('.dcpower-form').forEach(f => f.style.display = 'none');
  document.getElementById('dcp_form_' + mode).style.display = '';
};

/* ============================================================
   3. AC POWER — SINGLE PHASE
   ============================================================ */
window.calcAC1Phase = function () {
  const V = val('ac1_v'), I = val('ac1_i'), PF = val('ac1_pf') / 100;
  if (!isPos(V, I) || !isFinite(PF) || PF <= 0 || PF > 1)
    return showError('ac1_result', 'Enter V, I (>0) and PF (1–100%).');
  const kVA = V * I / 1000;
  const kW  = kVA * PF;
  const kVAR = kVA * Math.sqrt(1 - PF * PF);
  const theta = deg(Math.acos(PF));
  showResult('ac1_result', [
    ['Apparent Power (kVA)', fmt(kVA) + ' kVA'],
    ['True Power (kW)', fmt(kW) + ' kW'],
    ['Reactive Power (kVAR)', fmt(kVAR) + ' kVAR'],
    ['Power Factor (PF)', fmt(PF * 100) + ' %'],
    ['Phase Angle (θ)', fmt(theta) + ' °']
  ]);
};

/* ============================================================
   4. AC POWER — THREE PHASE
   ============================================================ */
window.calcAC3Phase = function () {
  const V = val('ac3_v'), I = val('ac3_i'), PF = val('ac3_pf') / 100;
  if (!isPos(V, I) || !isFinite(PF) || PF <= 0 || PF > 1)
    return showError('ac3_result', 'Enter V, I (>0) and PF (1–100%).');
  const kVA = Math.sqrt(3) * V * I / 1000;
  const kW  = kVA * PF;
  const kVAR = kVA * Math.sqrt(1 - PF * PF);
  const theta = deg(Math.acos(PF));
  showResult('ac3_result', [
    ['Apparent Power (kVA)', fmt(kVA) + ' kVA'],
    ['True Power (kW)', fmt(kW) + ' kW'],
    ['Reactive Power (kVAR)', fmt(kVAR) + ' kVAR'],
    ['Power Factor (PF)', fmt(PF * 100) + ' %'],
    ['Phase Angle (θ)', fmt(theta) + ' °']
  ]);
};

/* ============================================================
   5. REACTANCE & IMPEDANCE
   ============================================================ */
window.calcXL = function () {
  const f = val('xl_f'), L = val('xl_l');
  if (!isPos(f, L)) return showError('xl_result', 'Enter frequency (Hz) and inductance (H).');
  const XL = 2 * Math.PI * f * L;
  showResult('xl_result', [
    ['Inductive Reactance (XL)', fmt(XL) + ' Ω'],
    ['Formula', 'XL = 2π × f × L']
  ]);
};

window.calcXC = function () {
  const f = val('xc_f'), C = val('xc_c');
  if (!isPos(f, C)) return showError('xc_result', 'Enter frequency (Hz) and capacitance (F).');
  const XC = 1 / (2 * Math.PI * f * C);
  showResult('xc_result', [
    ['Capacitive Reactance (XC)', fmt(XC) + ' Ω'],
    ['Formula', 'XC = 1 / (2π × f × C)']
  ]);
};

window.calcImpedance = function () {
  const R = val('imp_r'), XL = val('imp_xl'), XC = val('imp_xc');
  if (!isNum(R, XL, XC) || R < 0)
    return showError('imp_result', 'Enter R (≥0), XL (≥0), XC (≥0).');
  const X = XL - XC;
  const Z = Math.sqrt(R * R + X * X);
  const theta = deg(Math.atan2(X, R));
  const PF = R / Z;
  showResult('imp_result', [
    ['Impedance (Z)', fmt(Z) + ' Ω'],
    ['Net Reactance (X = XL − XC)', fmt(X) + ' Ω'],
    ['Phase Angle (θ)', fmt(theta) + ' °'],
    ['Power Factor (cos θ)', fmt(PF * 100) + ' %'],
    ['Circuit Type', X > 0 ? 'Inductive (lagging)' : X < 0 ? 'Capacitive (leading)' : 'Resistive (unity PF)']
  ]);
};

/* ============================================================
   6. RESONANCE
   ============================================================ */
window.calcResonance = function () {
  const L = val('res_l'), C = val('res_c');
  if (!isPos(L, C)) return showError('res_result', 'Enter L (H) and C (F).');
  const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
  const omega0 = 2 * Math.PI * f0;
  const XL = omega0 * L;
  showResult('res_result', [
    ['Resonant Frequency (f₀)', fmt(f0) + ' Hz'],
    ['Angular Frequency (ω₀)', fmt(omega0) + ' rad/s'],
    ['Reactance at Resonance (XL = XC)', fmt(XL) + ' Ω'],
    ['Formula', 'f₀ = 1 / (2π√LC)']
  ]);
};

window.calcQFactor = function () {
  const R = val('qf_r'), L = val('qf_l'), C = val('qf_c');
  if (!isPos(R, L, C)) return showError('qf_result', 'Enter R, L, C (all > 0).');
  const f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
  const omega0 = 2 * Math.PI * f0;
  const XL = omega0 * L;
  const Q = XL / R;
  const BW = f0 / Q;
  showResult('qf_result', [
    ['Q Factor', fmt(Q)],
    ['Resonant Frequency (f₀)', fmt(f0) + ' Hz'],
    ['Bandwidth (BW = f₀/Q)', fmt(BW) + ' Hz']
  ]);
};

/* ============================================================
   7. POWER FACTOR CORRECTION
   ============================================================ */
window.calcPFC = function () {
  const kW = val('pfc_kw'), PF1 = val('pfc_pf1') / 100, PF2 = val('pfc_pf2') / 100;
  if (!isPos(kW) || !isFinite(PF1) || !isFinite(PF2) || PF1 <= 0 || PF1 >= 1 || PF2 <= 0 || PF2 > 1)
    return showError('pfc_result', 'Enter kW and valid power factors (1–99% existing, 1–100% target).');
  if (PF2 <= PF1) return showError('pfc_result', 'Target PF must be greater than existing PF.');
  const theta1 = Math.acos(PF1), theta2 = Math.acos(PF2);
  const kVAR = kW * (Math.tan(theta1) - Math.tan(theta2));
  const kVA1 = kW / PF1, kVA2 = kW / PF2;
  const I_reduction = (kVA1 - kVA2) / kVA1 * 100;
  showResult('pfc_result', [
    ['Required Capacitor Bank (kVAR)', fmt(kVAR) + ' kVAR'],
    ['Existing Apparent Power (kVA)', fmt(kVA1) + ' kVA'],
    ['New Apparent Power (kVA)', fmt(kVA2) + ' kVA'],
    ['Apparent Current Reduction', fmt(I_reduction) + ' %'],
    ['Formula', 'kVAR = kW × (tan θ₁ − tan θ₂)']
  ]);
};

/* ============================================================
   8. VOLTAGE DROP
   ============================================================ */
const WIRE_CM = {
  '14':  4110,  '12':  6530,  '10': 10380,   '8': 16510,
  '6':  26240,   '4': 41740,   '3': 52620,   '2': 66360,
  '1':  83690, '1/0': 105600, '2/0': 133100, '3/0': 167800,
  '4/0': 211600, '250': 250000, '300': 300000, '350': 350000,
  '400': 400000, '500': 500000
};
const K_CU = 12.9, K_AL = 21.2;
const KCMIL_SIZES = new Set(['250', '300', '350', '400', '500']);
/* Explicit ascending-CM order — Object.keys() cannot be used because JS sorts
   integer-like keys numerically first, placing '1/0'–'4/0' after '500 kcmil'. */
const WIRE_SIZES  = ['14', '12', '10', '8', '6', '4', '3', '2', '1',
                     '1/0', '2/0', '3/0', '4/0',
                     '250', '300', '350', '400', '500'];

window.calcVDrop = function (phase) {
  const I = val('vd_i_' + phase), L = val('vd_l_' + phase);
  const awg = document.getElementById('vd_awg_' + phase).value;
  const mat = document.getElementById('vd_mat_' + phase).value;
  const Vs = val('vd_vs_' + phase);
  if (!isPos(I, L, Vs)) return showError('vd_result_' + phase, 'Enter current (A), one-way length (ft), and supply voltage.');
  const CM = WIRE_CM[awg];
  if (!CM) return showError('vd_result_' + phase, 'Invalid conductor size selected.');
  const K = mat === 'CU' ? K_CU : K_AL;
  const multiplier = phase === '1p' ? 2 : Math.sqrt(3);
  const VD = multiplier * K * I * L / CM;
  const VDpct = VD / Vs * 100;
  showResult('vd_result_' + phase, [
    ['Voltage Drop (VD)', fmt(VD, 2) + ' V'],
    ['Voltage Drop %', fmt(VDpct, 2) + ' %'],
    ['Receiving End Voltage', fmt(Vs - VD, 2) + ' V'],
    ['NEC Recommendation (≤ 3%)', VDpct <= 3 ? '✔ PASS' : '✘ EXCEEDS 3%'],
    ['Combined Drop Guideline (≤ 5%)', VDpct <= 5 ? '✔ PASS' : '✘ EXCEEDS 5%']
  ]);
};

window.calcMinWire = function (phase) {
  const I = val('vdm_i_' + phase), L = val('vdm_l_' + phase);
  const mat = document.getElementById('vdm_mat_' + phase).value;
  const Vs = val('vdm_vs_' + phase);
  const pct = val('vdm_pct_' + phase);
  if (!isPos(I, L, Vs, pct)) return showError('vdm_result_' + phase, 'Enter all values (all > 0).');
  const K = mat === 'CU' ? K_CU : K_AL;
  const multiplier = phase === '1p' ? 2 : Math.sqrt(3);
  const maxVD = Vs * pct / 100;
  const minCM = multiplier * K * I * L / maxVD;
  // Find smallest wire that meets requirement
  const chosen = WIRE_SIZES.find(s => WIRE_CM[s] >= minCM);
  showResult('vdm_result_' + phase, [
    ['Minimum CM Required', fmt(minCM, 0) + ' CM'],
    ['Recommended Wire Size', chosen ? chosen + (KCMIL_SIZES.has(chosen) ? ' kcmil' : ' AWG') : '> 500 kcmil (consult engineer)'],
    ['Actual CM', chosen ? WIRE_CM[chosen].toLocaleString() + ' CM' : '\u2014'],
    ['Formula', phase === '1p' ? 'CM = 2\u00d7K\u00d7I\u00d7L / VD' : 'CM = \u221a3\u00d7K\u00d7I\u00d7L / VD']
  ]);
};

/* ============================================================
   9. SERIES / PARALLEL CIRCUITS
   ============================================================ */
function getDynValues(prefix) {
  const inputs = document.querySelectorAll(`[id^="${prefix}_"]`);
  return Array.from(inputs).map(el => parseFloat(el.value)).filter(v => isFinite(v));
}

window.addDynRow = function (containerId, prefix, unit) {
  const container = document.getElementById(containerId);
  const idx = container.children.length + 1;
  const row = document.createElement('div');
  row.className = 'dynamic-row';

  const lbl = document.createElement('label');
  lbl.style.cssText = 'min-width:40px;margin:0';
  lbl.textContent = '#' + idx;

  const inp = document.createElement('input');
  inp.type = 'number';
  inp.id = prefix + '_' + idx;
  inp.placeholder = unit;
  inp.step = 'any';

  const btn = document.createElement('button');
  btn.className = 'btn-remove';
  btn.textContent = '\u00d7';
  btn.addEventListener('click', () => row.remove());

  row.appendChild(lbl);
  row.appendChild(inp);
  row.appendChild(btn);
  container.appendChild(row);
};

window.calcSeriesR = function () {
  const vals = getDynValues('sr');
  if (vals.length < 2) return showError('sp_result_sr', 'Add at least 2 resistors.');
  const RT = vals.reduce((a, b) => a + b, 0);
  showResult('sp_result_sr', [
    ['Total Resistance (RT)', fmt(RT) + ' Ω'],
    ['Number of Resistors', vals.length],
    ['Formula', 'RT = R₁ + R₂ + … + Rn']
  ]);
};

window.calcParallelR = function () {
  const vals = getDynValues('pr');
  if (vals.length < 2) return showError('sp_result_pr', 'Add at least 2 resistors.');
  if (vals.some(v => Math.abs(v) < 1e-10)) return showError('sp_result_pr', 'Zero or near-zero resistance in parallel creates a short circuit (RT \u2248 0 \u03a9). Remove the zero-value resistor.');
  const RT = 1 / vals.reduce((a, b) => a + 1 / b, 0);
  showResult('sp_result_pr', [
    ['Total Resistance (RT)', fmt(RT) + ' \u03a9'],
    ['Number of Resistors', vals.length],
    ['Two-R Formula', vals.length === 2 ? fmt(vals[0] * vals[1] / (vals[0] + vals[1])) + ' \u03a9' : 'N/A'],
    ['Formula', '1/RT = 1/R\u2081 + 1/R\u2082 + \u2026 + 1/Rn']
  ]);
};

window.calcSeriesC = function () {
  const vals = getDynValues('sc');
  if (vals.length < 2) return showError('sp_result_sc', 'Add at least 2 capacitors.');
  if (vals.some(v => Math.abs(v) < 1e-18)) return showError('sp_result_sc', 'Zero or near-zero capacitance is not a valid capacitor value.');
  const CT = 1 / vals.reduce((a, b) => a + 1 / b, 0);
  showResult('sp_result_sc', [
    ['Total Capacitance (CT)', fmt(CT) + ' F'],
    ['Formula', '1/CT = 1/C\u2081 + 1/C\u2082 + \u2026 + 1/Cn']
  ]);
};

window.calcParallelC = function () {
  const vals = getDynValues('pc');
  if (vals.length < 2) return showError('sp_result_pc', 'Add at least 2 capacitors.');
  const CT = vals.reduce((a, b) => a + b, 0);
  showResult('sp_result_pc', [
    ['Total Capacitance (CT)', fmt(CT) + ' F'],
    ['Formula', 'CT = C\u2081 + C\u2082 + \u2026 + Cn']
  ]);
};

window.calcSeriesL = function () {
  const vals = getDynValues('sl');
  if (vals.length < 2) return showError('sp_result_sl', 'Add at least 2 inductors.');
  const LT = vals.reduce((a, b) => a + b, 0);
  showResult('sp_result_sl', [
    ['Total Inductance (LT)', fmt(LT) + ' H'],
    ['Formula', 'LT = L\u2081 + L\u2082 + \u2026 + Ln']
  ]);
};

window.calcParallelL = function () {
  const vals = getDynValues('pl');
  if (vals.length < 2) return showError('sp_result_pl', 'Add at least 2 inductors.');
  if (vals.some(v => Math.abs(v) < 1e-12)) return showError('sp_result_pl', 'Zero or near-zero inductance is not a valid inductor value.');
  const LT = 1 / vals.reduce((a, b) => a + 1 / b, 0);
  showResult('sp_result_pl', [
    ['Total Inductance (LT)', fmt(LT) + ' H'],
    ['Formula', '1/LT = 1/L\u2081 + 1/L\u2082 + \u2026 + 1/Ln']
  ]);
};

/* ============================================================
   10. MOTOR CALCULATIONS
   ============================================================ */
window.calcMotorHP = function () {
  const V = val('mhp_v'), I = val('mhp_i'), eff = val('mhp_eff') / 100, PF = val('mhp_pf') / 100;
  const ph = document.getElementById('mhp_phase').value;
  if (!isPos(V, I, eff, PF)) return showError('mhp_result', 'Enter all values > 0. Eff and PF in %.');
  const mult = ph === '3' ? Math.sqrt(3) : 1;
  const HP = V * I * mult * eff * PF / 746;
  const kW = V * I * mult * PF / 1000;
  showResult('mhp_result', [
    ['Output Horsepower (HP)', fmt(HP, 2) + ' HP'],
    ['Input Power (kW)', fmt(kW) + ' kW'],
    ['Efficiency', fmt(eff * 100) + ' %']
  ]);
};

window.calcMotorFLA = function () {
  const HP = val('mfla_hp'), V = val('mfla_v'), eff = val('mfla_eff') / 100, PF = val('mfla_pf') / 100;
  const ph = document.getElementById('mfla_phase').value;
  if (!isPos(HP, V, eff, PF)) return showError('mfla_result', 'Enter all values > 0.');
  const mult = ph === '3' ? Math.sqrt(3) : 1;
  const I = HP * 746 / (V * mult * eff * PF);
  const branchCircuit = I * 1.25;
  showResult('mfla_result', [
    ['Full-Load Current (FLA)', fmt(I, 2) + ' A'],
    ['NEC Branch Circuit (125%)', fmt(branchCircuit, 2) + ' A'],
    ['Formula', ph === '3' ? 'I = HP×746 / (V×√3×Eff×PF)' : 'I = HP×746 / (V×Eff×PF)']
  ]);
};

/* ============================================================
   11. TRANSFORMER CALCULATIONS
   ============================================================ */
window.calcXfmr = function () {
  const topology = document.getElementById('xfmr_topology').value;
  const kVA = val('xfmr_kva'), Vp = val('xfmr_vp'), Vs = val('xfmr_vs');
  if (!isPos(kVA, Vp, Vs)) return showError('xfmr_result', 'Enter kVA, primary voltage, and secondary voltage.');

  const is3ph = topology !== '1ph';
  const phaseMult = is3ph ? Math.sqrt(3) : 1;
  const Ip = kVA * 1000 / (Vp * phaseMult);
  const Is = kVA * 1000 / (Vs * phaseMult);
  const turnRatio = Vp / Vs;

  /* Next standard kVA size */
  const stdKVA = XFMR_STD_KVA.find(s => s >= kVA) || kVA;

  /* Secondary conductor + conduit sizing */
  const cond = selectConductorAndConduit(Is);

  /* NEC 450.3(B) OCP — next standard OCPD ≥ 125% of FLA */
  const pOCPD = nextStdOCPD(Ip * 1.25);
  const sOCPD = nextStdOCPD(Is * 1.25);

  /* Topology label and notes */
  const topoLabels = {
    '1ph': '1Ø Single-Phase', 'delta-wye': '3Ø Delta-Wye',
    'wye-wye': '3Ø Wye-Wye', 'delta-delta': '3Ø Delta-Delta',
    'highleg': '3Ø High-Leg Delta', 'corner': '3Ø Corner-Grounded Delta'
  };
  const topoLabel = topoLabels[topology] || topology;

  const rows = [
    ['Topology', topoLabel],
    ['Primary Current (Ip)', fmt(Ip, 2) + ' A'],
    ['Secondary Current (Is)', fmt(Is, 2) + ' A'],
    ['Turns Ratio (Np:Ns)', fmt(turnRatio, 4) + ' : 1'],
    ['─── Standard Size ───', ''],
    ['Next Standard kVA', stdKVA + ' kVA (ANSI/NEMA)'],
    ['─── Secondary Conductors (Cu THHN 75°C) ───', ''],
    ['Conductor Size (per run)', cond.size],
    ['Parallel Runs Required', cond.runs + (cond.runs > 1 ? ' sets (1/0 AWG min per NEC 310.10(C))' : '')],
    ['Conduit per Run (3 ckts)', cond.conduit],
    ['Conductor Ampacity', cond.ampsEach > 0 ? (cond.ampsEach * cond.runs) + ' A total (' + cond.ampsEach + ' A × ' + cond.runs + ')' : '—'],
    ['─── NEC 450.3(B) OCP Recommendations ───', ''],
    ['Primary OCPD (≤125% of Ip)', pOCPD + ' A'],
    ['Secondary OCPD (≤125% of Is)', sOCPD + ' A'],
  ];

  if (topology === 'highleg') {
    rows.push(['⚠ High-Leg B-Phase V to N', fmt(Vs * Math.sqrt(3) / 2, 1) + ' V (tag orange — NEC 110.15)']);
  }
  if (topology === 'corner') {
    rows.push(['⚠ Corner-Ground Note', 'Grounded phase at 0 V potential — no neutral for 1Ø loads']);
  }
  if (topology === 'delta-delta') {
    rows.push(['⚠ Neutral', 'No secondary neutral — 3-wire load only']);
  }

  const el = document.getElementById('xfmr_result');
  if (el) {
    el.className = 'result show';
    el.innerHTML = rows.map(r => {
      const isHdr = r[0].startsWith('───');
      const isWarn = r[0].startsWith('⚠');
      const lblStyle = isHdr ? 'color:var(--amber);text-shadow:var(--glow-amber)' : isWarn ? 'color:var(--red);text-shadow:var(--glow-red)' : '';
      const valStyle = isWarn ? 'color:var(--amber)' : '';
      return `<div class="res-row"><span class="res-label" style="${lblStyle}">${escapeHtml(r[0])}</span><span class="res-val" style="${valStyle}">${escapeHtml(r[1])}</span></div>`;
    }).join('');
  }
};

window.calcXfmrKVA = function () {
  const phase = document.getElementById('xfmrkva_phase').value;
  const V = val('xfmrkva_v'), I = val('xfmrkva_i');
  if (!isPos(V, I)) return showError('xfmrkva_result', 'Enter voltage (V) and current (A).');
  const kVA = phase === '3' ? Math.sqrt(3) * V * I / 1000 : V * I / 1000;
  showResult('xfmrkva_result', [
    ['kVA Rating', fmt(kVA) + ' kVA'],
    ['Formula', phase === '3' ? 'kVA = √3 × V × I / 1000' : 'kVA = V × I / 1000']
  ]);
};

/* ============================================================
   12. CONDUIT FILL
   ============================================================ */
// EMT internal areas (sq in) and trade sizes
const EMT_SIZES = {
  '1/2':  { area: 0.304,  id: 0.622 },
  '3/4':  { area: 0.533,  id: 0.824 },
  '1':    { area: 0.864,  id: 1.049 },
  '1-1/4':{ area: 1.496,  id: 1.380 },
  '1-1/2':{ area: 2.036,  id: 1.610 },
  '2':    { area: 3.356,  id: 2.067 },
  '2-1/2':{ area: 4.788,  id: 2.469 },
  '3':    { area: 7.393,  id: 3.068 },
  '3-1/2':{ area: 9.893,  id: 3.548 },
  '4':    { area: 12.72,  id: 4.026 }
};

// Conductor cross-sectional areas (THHN/THWN-2, sq in) per NEC Table 5
const THHN_AREAS = {
  '14':  0.0097, '12': 0.0133, '10': 0.0211,  '8': 0.0366,
  '6':   0.0507,  '4': 0.0824,  '3': 0.0973,  '2': 0.1158,
  '1':   0.1562,'1/0': 0.1855,'2/0': 0.2223,'3/0': 0.2679,
  '4/0': 0.3237,'250': 0.3970,'300': 0.4608,'350': 0.5242,
  '400': 0.5863,'500': 0.7073
};

/* ── Standard transformer kVA sizes (ANSI/NEMA) ── */
const XFMR_STD_KVA = [1, 1.5, 2, 3, 5, 7.5, 10, 15, 25, 37.5, 50, 75, 100,
                       150, 167, 200, 250, 333, 500, 750, 1000, 1500, 2000, 2500];

/* ── Cu THHN 75°C ampacity + area (NEC Table 310.12 / Table 5) ── */
const CU_THHN = [
  { size: '14 AWG',   amps: 20,  area: 0.0097 },
  { size: '12 AWG',   amps: 25,  area: 0.0133 },
  { size: '10 AWG',   amps: 35,  area: 0.0211 },
  { size: '8 AWG',    amps: 50,  area: 0.0366 },
  { size: '6 AWG',    amps: 65,  area: 0.0507 },
  { size: '4 AWG',    amps: 85,  area: 0.0824 },
  { size: '3 AWG',    amps: 100, area: 0.0973 },
  { size: '2 AWG',    amps: 115, area: 0.1158 },
  { size: '1 AWG',    amps: 130, area: 0.1562 },
  { size: '1/0 AWG',  amps: 150, area: 0.1855 },
  { size: '2/0 AWG',  amps: 175, area: 0.2223 },
  { size: '3/0 AWG',  amps: 200, area: 0.2679 },
  { size: '4/0 AWG',  amps: 230, area: 0.3237 },
  { size: '250 kcmil',amps: 255, area: 0.3970 },
  { size: '300 kcmil',amps: 285, area: 0.4608 },
  { size: '350 kcmil',amps: 310, area: 0.5242 },
  { size: '400 kcmil',amps: 335, area: 0.5863 },
  { size: '500 kcmil',amps: 380, area: 0.7073 },
];

function nextStdOCPD(amps) {
  return STD_OCPD.find(s => s >= amps) || Math.ceil(amps / 100) * 100;
}

/* NEC 310.10(C): parallel conductors must be 1/0 AWG or larger */
const MIN_PARALLEL_AMPACITY = 150; /* 1/0 AWG Cu THHN 75°C = 150 A */

function selectConductorAndConduit(amps) {
  /* single conductor run */
  const single = CU_THHN.find(c => c.amps >= amps);
  if (single) {
    const totalArea = 3 * single.area;  /* 3 current-carrying conductors */
    const conduitEntry = Object.entries(EMT_SIZES).find(([, v]) => v.area * 0.40 >= totalArea);
    return {
      runs: 1,
      size: single.size,
      ampsEach: single.amps,
      conduit: conduitEntry ? conduitEntry[0] + '" EMT' : '> 4" EMT'
    };
  }
  /* parallel runs (NEC allows ≥ 1/0 AWG, max 500 kcmil typical) */
  for (let runs = 2; runs <= 6; runs++) {
    const perRun = amps / runs;
    /* parallel conductors must be ≥ 1/0 AWG per NEC 310.10(C) */
    const cond = CU_THHN.find(c => c.amps >= perRun && c.amps >= MIN_PARALLEL_AMPACITY);
    if (cond) {
      const totalArea = 3 * cond.area;
      const conduitEntry = Object.entries(EMT_SIZES).find(([, v]) => v.area * 0.40 >= totalArea);
      return {
        runs,
        size: cond.size,
        ampsEach: cond.amps,
        conduit: conduitEntry ? conduitEntry[0] + '" EMT' : '> 4" EMT'
      };
    }
  }
  return { runs: 1, size: 'Special — consult engineer', ampsEach: 0, conduit: 'Special' };
}

window.calcConduitFill = function () {
  const qty = parseInt(document.getElementById('cf_qty').value) || 0;
  const awg = document.getElementById('cf_awg').value;
  const tradeSize = document.getElementById('cf_conduit').value;
  const conduit = EMT_SIZES[tradeSize];
  const wireArea = THHN_AREAS[awg];
  if (!conduit || !wireArea || qty < 1) return showError('cf_result', 'Select conduit size, wire size, and quantity.');

  const totalWireArea = qty * wireArea;
  const maxFillPct = qty === 1 ? 53 : qty === 2 ? 31 : 40;
  const maxFillArea = conduit.area * maxFillPct / 100;
  const fillPct = totalWireArea / conduit.area * 100;
  const pass = totalWireArea <= maxFillArea;

  const rows = [
    ['Total Wire Area', fmt(totalWireArea, 4) + ' sq in'],
    ['Conduit Internal Area (' + tradeSize + '" EMT)', fmt(conduit.area) + ' sq in'],
    ['NEC Max Fill % for ' + qty + ' wire(s)', maxFillPct + ' %'],
    ['Max Allowable Wire Area', fmt(maxFillArea, 4) + ' sq in'],
    ['Actual Fill %', fmt(fillPct, 2) + ' %'],
    ['Status', pass ? '✔ PASS — within NEC limits' : '✘ FAIL — exceeds NEC fill limit']
  ];
  showResult('cf_result', rows);

  if (!pass) {
    // suggest minimum conduit — append an extra row using DOM methods
    const sizes = Object.keys(EMT_SIZES);
    const minSize = sizes.find(s => EMT_SIZES[s].area * maxFillPct / 100 >= totalWireArea);
    if (minSize) {
      const el = document.getElementById('cf_result');
      const row = document.createElement('div');
      row.className = 'res-row';
      const lblSpan = document.createElement('span');
      lblSpan.className = 'res-label';
      lblSpan.textContent = 'Minimum Conduit Size';
      const valSpan = document.createElement('span');
      valSpan.className = 'res-val';
      valSpan.textContent = minSize + '" EMT';
      row.appendChild(lblSpan);
      row.appendChild(valSpan);
      el.appendChild(row);
    }
  }
};

/* ============================================================
   13. SHORT CIRCUIT (AVAILABLE FAULT CURRENT)
   ============================================================ */
window.calcSC = function () {
  const kVA = val('sc_kva'), Vs = val('sc_vs'), Zp = val('sc_z') / 100;
  if (!isPos(kVA, Vs, Zp)) return showError('sc_result', 'Enter transformer kVA, secondary voltage (V), and impedance %.');
  const I_base = kVA * 1000 / (Math.sqrt(3) * Vs);
  const I_fault = I_base / Zp;  // simplified (neglects line impedance)
  const I_sym  = I_fault;
  const I_asym = I_fault * 1.25; // simplified asymmetric factor ~1.25
  showResult('sc_result', [
    ['Base Current (I_base)', fmt(I_base, 2) + ' A'],
    ['Available Short Circuit (Symmetrical)', fmt(I_sym, 0) + ' A'],
    ['Available Short Circuit (Asymmetrical \u00d71.25)', fmt(I_asym, 0) + ' A'],
    ['Note', 'Simplified \u2014 excludes conductor/bus impedance']
  ]);
};

/* ============================================================
   14. UNIT CONVERSIONS
   ============================================================ */
window.convertUnits = function () {
  const val_in = parseFloat(document.getElementById('uc_val').value);
  const from = document.getElementById('uc_from').value;
  const to   = document.getElementById('uc_to').value;
  if (!isFinite(val_in)) return showError('uc_result', 'Enter a value to convert.');

  /* Temperature: special handling (non-multiplicative) */
  if (from === 'degC' || from === 'degF' || from === 'K' ||
      to   === 'degC' || to   === 'degF' || to   === 'K') {
    let tempC;
    if (from === 'degC') tempC = val_in;
    else if (from === 'degF') tempC = (val_in - 32) * 5 / 9;
    else if (from === 'K')   tempC = val_in - 273.15;
    else return showError('uc_result', 'Select compatible units (both must be temperature).');
    let result;
    if (to === 'degC') result = tempC;
    else if (to === 'degF') result = tempC * 9 / 5 + 32;
    else if (to === 'K')   result = tempC + 273.15;
    else return showError('uc_result', 'Select compatible units (both must be temperature).');
    return showResult('uc_result', [
      ['Result', fmt(result, 4) + ' ' + to],
      ['Input', fmt(val_in, 4) + ' ' + from]
    ]);
  }

  const toBase = {
    'W':   1, 'kW': 1e3, 'MW': 1e6,
    'HP':  746, 'BTU/h': 0.29307107,
    'V':   1, 'kV': 1e3, 'mV': 1e-3,
    'A':   1, 'mA': 1e-3, 'kA': 1e3,
    'Ohm': 1, 'kOhm': 1e3, 'MOhm': 1e6,
    'F':   1, 'mF': 1e-3, 'uF': 1e-6, 'nF': 1e-9, 'pF': 1e-12,
    'H':   1, 'mH': 1e-3, 'uH': 1e-6,
    'Hz':  1, 'kHz': 1e3, 'MHz': 1e6,
    'VA':  1, 'kVA': 1e3, 'MVA': 1e6,
    'VAR': 1, 'kVAR': 1e3,
    'ft':  0.3048, 'm': 1, 'in': 0.0254,
    'AWG_CM': 1,
    /* Illuminance (base: lux) */
    'lux': 1, 'fc': 10.76391,
    /* Energy (base: joules) */
    'J': 1, 'Wh': 3600, 'kWh': 3.6e6, 'MWh': 3.6e9, 'BTU': 1055.06,
  };

  if (!(from in toBase) || !(to in toBase))
    return showError('uc_result', 'Select compatible units.');

  const inBase = val_in * toBase[from];
  const result = inBase / toBase[to];
  showResult('uc_result', [
    ['Result', fmt(result) + ' ' + to],
    ['Input', fmt(val_in) + ' ' + from]
  ]);
};

/* circular mils ↔ inches */
window.calcCM = function () {
  const mode = document.getElementById('cm_mode').value;
  if (mode === 'to_cm') {
    const d = val('cm_d');
    if (!isPos(d)) return showError('cm_result', 'Enter diameter in inches.');
    const CM = Math.pow(d * 1000, 2);
    showResult('cm_result', [['Circular Mils', fmt(CM, 0) + ' CM'],['Formula', 'CM = (d × 1000)²']]);
  } else {
    const CM = val('cm_cm');
    if (!isPos(CM)) return showError('cm_result', 'Enter circular mils.');
    const d = Math.sqrt(CM) / 1000;
    showResult('cm_result', [['Diameter', fmt(d, 6) + ' in'],['Formula', 'd = √CM / 1000']]);
  }
};

window.cmModeChange = function () {
  const mode = document.getElementById('cm_mode').value;
  document.getElementById('cm_form_to_cm').style.display  = mode === 'to_cm'   ? '' : 'none';
  document.getElementById('cm_form_to_in').style.display  = mode === 'to_in'   ? '' : 'none';
};

/* ============================================================
   15. UPS SIZING CALCULATOR
   ============================================================ */
window.calcUPS = function () {
  const loadKW = val('ups_kw');
  const pf     = val('ups_pf') / 100;
  const runtimeMin = val('ups_runtime');
  const eff    = val('ups_eff') / 100;
  const dcV    = val('ups_dcv');

  if (!isPos(loadKW, pf, runtimeMin, eff, dcV))
    return showError('ups_result', 'Enter all values greater than zero.');
  if (pf > 1 || eff > 1)
    return showError('ups_result', 'Power factor and efficiency must be 1–100%.');

  const loadKVA   = loadKW / pf;
  const designKVA = loadKVA * 1.25;
  const runtimeH  = runtimeMin / 60;
  const battWh    = (loadKW * 1000 / eff) * runtimeH;
  const battAh    = battWh / dcV;

  const upsSizes = [0.5, 1, 1.5, 2, 3, 5, 6, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75,
                    100, 125, 150, 200, 250, 300, 400, 500];
  const recSize = upsSizes.find(s => s >= designKVA) || Math.ceil(designKVA / 50) * 50;

  showResult('ups_result', [
    ['Load kVA',                        fmt(loadKVA, 2) + ' kVA'],
    ['Design Load (x1.25 headroom)',     fmt(designKVA, 2) + ' kVA'],
    ['Battery Energy Required',          fmt(battWh / 1000, 3) + ' kWh'],
    ['Required Battery Ah @ ' + dcV + ' VDC', fmt(battAh, 1) + ' Ah'],
    ['Recommended UPS Size',             recSize + ' kVA (next standard tier)']
  ]);
};

/* ============================================================
   16. GENERATOR SIZING (IEEE 446 / NFPA 110)
   ============================================================ */
window.calcGenerator = function () {
  const pf     = val('gen_pf') / 100;
  const margin = val('gen_margin') / 100;

  if (!isPos(pf)) return showError('gen_result', 'Enter power factor (> 0%).');

  const motorKW = val('gen_motor_kw');
  const motorQty = val('gen_motor_qty');
  const motorDF  = val('gen_motor_df') / 100;
  const lightKW  = val('gen_light_kw');
  const lightDF  = val('gen_light_df') / 100;
  const hvacKW   = val('gen_hvac_kw');
  const hvacDF   = val('gen_hvac_df') / 100;
  const otherKW  = val('gen_other_kw');

  const motorLoad = (isPos(motorKW) && isPos(motorQty) && isFinite(motorDF))
    ? motorKW * motorQty * motorDF : 0;
  const lightLoad = (isPos(lightKW) && isFinite(lightDF)) ? lightKW * lightDF : 0;
  const hvacLoad  = (isPos(hvacKW)  && isFinite(hvacDF))  ? hvacKW  * hvacDF  : 0;
  const otherLoad = isPos(otherKW) ? otherKW : 0;

  const totalKW  = motorLoad + lightLoad + hvacLoad + otherLoad;
  if (totalKW <= 0) return showError('gen_result', 'Enter at least one load value.');

  const totalKVA  = totalKW / pf;
  const safetyMult = isFinite(margin) && margin >= 0 ? (1 + margin) : 1.1;
  const designKW  = totalKW * safetyMult;
  const designKVA = totalKVA * safetyMult;

  const genSizes = [20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 175, 200,
                    250, 300, 350, 400, 500, 600, 750, 1000];
  const recSize = genSizes.find(s => s >= designKW) || Math.ceil(designKW / 100) * 100;

  showResult('gen_result', [
    ['Motor Loads',             fmt(motorLoad, 1) + ' kW'],
    ['Lighting / Receptacle',   fmt(lightLoad, 1) + ' kW'],
    ['HVAC Loads',              fmt(hvacLoad,  1) + ' kW'],
    ['Other Critical Loads',    fmt(otherLoad, 1) + ' kW'],
    ['Total Connected Load',    fmt(totalKW, 1) + ' kW / ' + fmt(totalKVA, 1) + ' kVA'],
    ['Design Load (x' + fmt(safetyMult, 2) + ')', fmt(designKW, 1) + ' kW / ' + fmt(designKVA, 1) + ' kVA'],
    ['Recommended Generator',   recSize + ' kW (next standard size)']
  ]);
};

/* ============================================================
   17. HYBRID GENERATOR CALCULATOR
   ============================================================ */
window.calcHybridGen = function () {
  const genKW       = val('hyb_gen_kw');
  const avgLoadPct  = val('hyb_avg_load') / 100;
  const hoursDay    = val('hyb_hours_day');
  const daysYear    = val('hyb_days_year');
  const fuelCost    = val('hyb_fuel_cost');
  const fuelRate    = val('hyb_fuel_rate');   // gal/hr at full load
  const hybridGain  = val('hyb_gain') / 100;
  const battCost    = val('hyb_batt_cost');

  if (!isPos(genKW, avgLoadPct, hoursDay, daysYear, fuelCost, fuelRate, hybridGain))
    return showError('hyb_result', 'Enter all required values (generator kW, load %, hours, days, fuel cost, fuel rate, gain %).');

  const annualHours      = hoursDay * daysYear;
  const avgFuelRate      = fuelRate * avgLoadPct;     // gal/hr at average load
  const convFuel         = avgFuelRate * annualHours;  // gal/yr conventional
  const hybridFuel       = convFuel * (1 - hybridGain);
  const savingsGal       = convFuel - hybridFuel;
  const savingsDollar    = savingsGal * fuelCost;
  const co2Lbs           = savingsGal * 22.4;         // EPA: 22.4 lbs CO2/gal diesel
  const avgKW            = genKW * avgLoadPct;

  const rows = [
    ['Generator Rated Output',    fmt(genKW, 0) + ' kW'],
    ['Average Load',              fmt(avgKW, 1) + ' kW (' + fmt(avgLoadPct * 100, 0) + '% of rated)'],
    ['Annual Operating Hours',    fmt(annualHours, 0) + ' hrs/yr'],
    ['Conventional Annual Fuel',  fmt(convFuel, 0) + ' gal/yr'],
    ['Hybrid Annual Fuel',        fmt(hybridFuel, 0) + ' gal/yr'],
    ['Annual Fuel Savings',       fmt(savingsGal, 0) + ' gal ($' + fmt(savingsDollar, 0) + '/yr)'],
    ['CO\u2082 Reduction',        fmt(co2Lbs, 0) + ' lbs/yr (~' + fmt(co2Lbs / 2204.6, 2) + ' metric tons/yr)']
  ];
  if (isPos(battCost) && savingsDollar > 0) {
    rows.push(['Battery System Cost',  '$' + fmt(battCost, 0)]);
    rows.push(['Simple Payback Period', fmt(battCost / savingsDollar, 1) + ' years']);
  }
  showResult('hyb_result', rows);
};

/* ============================================================
   18. NEC CIRCUIT CALCULATOR
   ============================================================ */

/* NEC 310.15(B)(16) — 75°C column
   [label, Cu ampacity, Al ampacity (null = not listed), circular mils, THHN area in²] */
const NEC_CONDUCTORS = [
  { label: '14 AWG', cu: 15,  al: null, cm: 4110,    area: 0.0097 },
  { label: '12 AWG', cu: 20,  al: 15,   cm: 6530,    area: 0.0133 },
  { label: '10 AWG', cu: 30,  al: 25,   cm: 10380,   area: 0.0211 },
  { label: '8 AWG',  cu: 50,  al: 40,   cm: 16510,   area: 0.0366 },
  { label: '6 AWG',  cu: 65,  al: 50,   cm: 26240,   area: 0.0507 },
  { label: '4 AWG',  cu: 85,  al: 65,   cm: 41740,   area: 0.0824 },
  { label: '3 AWG',  cu: 100, al: 75,   cm: 52620,   area: 0.0973 },
  { label: '2 AWG',  cu: 115, al: 90,   cm: 66360,   area: 0.1158 },
  { label: '1 AWG',  cu: 130, al: 100,  cm: 83690,   area: 0.1562 },
  { label: '1/0',    cu: 150, al: 120,  cm: 105600,  area: 0.1855 },
  { label: '2/0',    cu: 175, al: 135,  cm: 133100,  area: 0.2223 },
  { label: '3/0',    cu: 200, al: 155,  cm: 167800,  area: 0.2679 },
  { label: '4/0',    cu: 230, al: 180,  cm: 211600,  area: 0.3237 },
  { label: '250 kcmil', cu: 255, al: 205, cm: 250000, area: 0.3970 },
  { label: '300 kcmil', cu: 285, al: 230, cm: 300000, area: 0.4608 },
  { label: '350 kcmil', cu: 310, al: 250, cm: 350000, area: 0.5242 },
  { label: '400 kcmil', cu: 335, al: 270, cm: 400000, area: 0.5863 },
  { label: '500 kcmil', cu: 380, al: 310, cm: 500000, area: 0.7073 },
  { label: '600 kcmil', cu: 420, al: 340, cm: 600000, area: 0.8676 },
  { label: '700 kcmil', cu: 460, al: 375, cm: 700000, area: 0.9887 },
  { label: '750 kcmil', cu: 475, al: 385, cm: 750000, area: 1.0496 },
  { label: '800 kcmil', cu: 490, al: 395, cm: 800000, area: 1.1085 },
  { label: '1000 kcmil', cu: 545, al: 445, cm: 1000000, area: 1.3478 }
];

/* NEC 240.4(D) maximum OCPD for small conductors */
const NEC_SMALL_WIRE_MAX = { '14 AWG': 15, '12 AWG': 20, '10 AWG': 30 };

/* Standard OCPD ratings (A) per NEC 240.6(A) */
const STD_OCPD = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125,
                  150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800,
                  1000, 1200];

/* EMT conduit — 40%-fill allowable area (in²) per NEC Ch.9 Table 4 */
const EMT_CONDUIT = [
  { size: '1/2"',   area: 0.122 },
  { size: '3/4"',   area: 0.213 },
  { size: '1"',     area: 0.346 },
  { size: '1-1/4"', area: 0.598 },
  { size: '1-1/2"', area: 0.814 },
  { size: '2"',     area: 1.342 },
  { size: '2-1/2"', area: 1.915 },
  { size: '3"',     area: 2.957 },
  { size: '3-1/2"', area: 3.957 },
  { size: '4"',     area: 5.088 }
];

/* NEC 250.122 — EGC sizing based on OCPD rating */
const EGC_TABLE = [
  { maxOCPD: 15,   cu: '14 AWG', al: '12 AWG' },
  { maxOCPD: 20,   cu: '12 AWG', al: '10 AWG' },
  { maxOCPD: 60,   cu: '10 AWG', al: '8 AWG'  },
  { maxOCPD: 100,  cu: '8 AWG',  al: '6 AWG'  },
  { maxOCPD: 200,  cu: '6 AWG',  al: '4 AWG'  },
  { maxOCPD: 300,  cu: '4 AWG',  al: '2 AWG'  },
  { maxOCPD: 400,  cu: '3 AWG',  al: '1 AWG'  },
  { maxOCPD: 500,  cu: '2 AWG',  al: '1/0'    },
  { maxOCPD: 600,  cu: '1 AWG',  al: '2/0'    },
  { maxOCPD: 800,  cu: '1/0',    al: '3/0'    },
  { maxOCPD: 1000, cu: '2/0',    al: '4/0'    },
  { maxOCPD: 1200, cu: '3/0',    al: '250 kcmil' }
];

/* NEC 310.15(B)(2)(a) temperature correction factors */
function necTempFactor(ambientC, insulRating) {
  // 90°C-rated insulation (THHN, XHHW-2, etc.)
  const f90 = [[25,1.04],[30,1.00],[35,0.96],[40,0.91],[45,0.87],[50,0.82],[55,0.76],[60,0.71]];
  // 75°C-rated insulation
  const f75 = [[25,1.05],[30,1.00],[35,0.94],[40,0.88],[45,0.82],[50,0.75],[55,0.67],[60,0.58]];
  const tbl = insulRating >= 90 ? f90 : f75;
  for (const [temp, factor] of tbl) if (ambientC <= temp) return factor;
  return 0; // above 60°C — not rated
}

/* NEC multipliers for conductor sizing */
const NEC_COND_MULT = {
  'motor': 1.25, 'motor-multi': 1.25, 'lighting-general': 1.25,
  'lighting-hospital': 1.25, 'hvac': 1.25,
  'heat': 1.0, 'welder': 1.0, 'general': 1.0
};

/* NEC multipliers for OCPD sizing (separate from conductor mult) */
const NEC_OCPD_MULT = {
  'motor': 2.50,          // NEC 430.52 inverse-time breaker (250% max)
  'motor-multi': 2.50,
  'lighting-general': 1.25,
  'lighting-hospital': 1.25,
  'hvac': 2.25,           // NEC 440.22 (225% max for hermetic motor)
  'heat': 1.25,
  'welder': 2.00,         // NEC 630.12 (200% of rated input)
  'general': 1.25
};

function necCodeRef(loadType) {
  return { motor: '430.22', 'motor-multi': '430.24', 'lighting-general': '210.20(A)',
           'lighting-hospital': '210.20(A)', hvac: '440.32', heat: '424.3(B)',
           welder: '630.11', general: '210.20(A)' }[loadType] || '210.20(A)';
}

function necNextStdOCPD(minAmps) {
  return STD_OCPD.find(s => s >= minAmps) || Math.ceil(minAmps);
}

window.necKwChange = function () {
  const kw    = val('nec_kw');
  const pf    = val('nec_pf') / 100;
  const v     = parseFloat(document.getElementById('nec_voltage').value);
  const ph    = parseInt(document.getElementById('nec_phases').value);
  if (!isPos(kw, pf, v)) return;
  const fla = ph === 3 ? kw * 1000 / (Math.sqrt(3) * v * pf)
                        : kw * 1000 / (v * pf);
  const el = document.getElementById('nec_fla');
  if (el) el.value = fmt(fla, 2);
};

window.necMaterialChange = function () {
  const isal = document.getElementById('nec_material').value === 'al';
  const note = document.getElementById('nec_al_note');
  if (note) note.style.display = isal ? '' : 'none';
};

window.calcNEC = function () {
  const loadType = document.getElementById('nec_load_type').value;
  const voltage  = parseFloat(document.getElementById('nec_voltage').value);
  const phases   = parseInt(document.getElementById('nec_phases').value);
  const pf       = val('nec_pf') / 100;
  const dist     = val('nec_dist');
  const ambientC = val('nec_temp');
  const material = document.getElementById('nec_material').value;   // 'cu' | 'al'
  const insulR   = parseInt(document.getElementById('nec_insulation').value);
  const cccDF    = parseFloat(document.getElementById('nec_ccc').value);

  // Resolve FLA from field or compute from kW
  let fla = val('nec_fla');
  if (!isFinite(fla)) {
    const kw = val('nec_kw');
    if (!isPos(kw)) return showError('nec_result', 'Enter FLA in amps, or load kW/kVA.');
    if (!isPos(pf))  return showError('nec_result', 'Enter power factor.');
    fla = phases === 3 ? kw * 1000 / (Math.sqrt(3) * voltage * pf)
                       : kw * 1000 / (voltage * pf);
  }
  if (!isPos(fla))      return showError('nec_result', 'FLA must be greater than zero.');
  if (!isPos(voltage))  return showError('nec_result', 'Select a valid system voltage.');
  if (!isPos(dist))     return showError('nec_result', 'Enter one-way distance in feet.');
  if (!isFinite(ambientC)) return showError('nec_result', 'Enter ambient temperature in \u00b0C.');

  // Step 1 — design current
  const condMult   = NEC_COND_MULT[loadType] || 1.0;
  const designI    = fla * condMult;

  // Step 2 — temperature correction
  const tempFactor = necTempFactor(ambientC, insulR);
  if (tempFactor <= 0)
    return showError('nec_result', 'Ambient temperature exceeds conductor rating. Select higher-rated insulation or reduce ambient exposure.');

  // Step 3 — combined derating
  const totalDerating = tempFactor * cccDF;

  // Step 4 — find smallest conductor meeting derated ampacity >= designI
  const conductor = NEC_CONDUCTORS.find(c => {
    const baseAmp = material === 'cu' ? c.cu : c.al;
    return baseAmp !== null && (baseAmp * totalDerating) >= designI;
  });
  if (!conductor)
    return showError('nec_result', 'Load exceeds 1000 kcmil capacity. Consider parallel conductors.');

  const baseAmp     = material === 'cu' ? conductor.cu : conductor.al;
  const deratedAmp  = baseAmp * totalDerating;

  // Step 5 — voltage drop
  // K = 12.9 Ω·CM/ft (Cu @ 75°C), 21.2 (Al @ 75°C)
  // 1-phase: VD = 2×K×I×L / CM; 3-phase: VD = 1.732×K×I×L / CM
  const K          = material === 'cu' ? 12.9 : 21.2;
  const phaseFactor = phases === 3 ? Math.sqrt(3) : 2.0;
  const vdVolts    = phaseFactor * K * fla * dist / conductor.cm;
  const vdPct      = (vdVolts / voltage) * 100;
  const vdFlag     = vdPct > 5 ? ' EXCEEDS 5% — CRITICAL' : (vdPct > 3 ? ' EXCEEDS 3% — WARNING' : ' OK');

  // Step 6 — OCPD sizing
  const ocpdMult   = NEC_OCPD_MULT[loadType] || 1.25;
  const ocpdMin    = fla * ocpdMult;
  const ocpdSize   = necNextStdOCPD(ocpdMin);

  // Step 7 — max OCPD per NEC 240.4
  const smallMax   = NEC_SMALL_WIRE_MAX[conductor.label];
  const maxOCPD    = smallMax !== undefined ? smallMax : baseAmp; // larger conductors: limited to base ampacity

  // Step 8 — conduit fill (phase conductors + 1 EGC at same size, conservative)
  const condCount  = phases === 3 ? 4 : 3;  // 3 or 2 phase + 1 EGC
  const fillNeeded = conductor.area * condCount;
  const conduitEl  = EMT_CONDUIT.find(c => c.area >= fillNeeded);
  const conduitStr = conduitEl ? conduitEl.size + ' EMT' : '> 4" EMT (consult engineer)';
  const condType   = document.getElementById('nec_conduit_type').value.toUpperCase();

  // Step 9 — EGC size per NEC 250.122
  const egcEntry = EGC_TABLE.find(g => g.maxOCPD >= ocpdSize) || EGC_TABLE[EGC_TABLE.length - 1];
  const egc      = material === 'cu' ? egcEntry.cu : egcEntry.al;

  const ocpdNote = loadType.startsWith('motor') ? ' (NEC 430.52, up to 250% FLA)'
                 : loadType === 'hvac'            ? ' (NEC 440.22, up to 225% FLA)'
                 : '';

  showResult('nec_result', [
    ['Load FLA',                                     fmt(fla, 2) + ' A'],
    ['NEC Conductor Mult (NEC ' + necCodeRef(loadType) + ')', '\u00d7' + condMult + ' \u2192 Design I = ' + fmt(designI, 2) + ' A'],
    ['Temp Correction @ ' + ambientC + '\u00b0C',    '\u00d7' + fmt(tempFactor, 3) + ' (NEC 310.15(B)(2)(a), ' + insulR + '\u00b0C insul)'],
    ['Conduit Fill Derating',                        '\u00d7' + cccDF.toFixed(2) + ' (NEC 310.15(B)(3)(a))'],
    ['Total Derating Factor',                        '\u00d7' + fmt(totalDerating, 3)],
    ['Selected Conductor',                           conductor.label + ' ' + (material === 'cu' ? 'Cu' : 'Al') + ' THHN'],
    ['Base Ampacity (NEC 310.15(B)(16) 75\u00b0C)',  baseAmp + ' A'],
    ['Derated Ampacity',                             fmt(deratedAmp, 1) + ' A (must be \u2265 ' + fmt(designI, 1) + ' A)'],
    ['Voltage Drop',                                 fmt(vdPct, 2) + '% (' + fmt(vdVolts, 2) + ' V)' + vdFlag],
    ['Conduit Size (40% fill, ' + condType + ' ref)', conduitStr + ' (' + condCount + ' cond. incl. EGC)'],
    ['OCPD Size (NEC 240.6 std. rating)',             ocpdSize + ' A' + ocpdNote],
    ['Max OCPD Allowed (NEC 240.4)',                  maxOCPD + ' A'],
    ['Equipment Ground (NEC 250.122)',                egc + (material === 'cu' ? ' Cu' : ' Al') + ' min']
  ]);
};

/* ============================================================
   19. ROCKET RIDER — ARCADE GAME
   ============================================================ */
(function () {
  'use strict';

  const SCORE_LABELS = [
    { min: 0,   label: 'WARM UP'           },
    { min: 3,   label: '14 AWG'            },
    { min: 5,   label: '12 AWG'            },
    { min: 8,   label: '10 AWG'            },
    { min: 12,  label: '8 AWG'             },
    { min: 17,  label: '6 AWG'             },
    { min: 23,  label: '4 AWG'             },
    { min: 30,  label: '2 AWG'             },
    { min: 38,  label: '1/0'               },
    { min: 47,  label: '2/0'               },
    { min: 57,  label: '3/0'               },
    { min: 68,  label: '4/0'               },
    { min: 80,  label: '250 kcmil'         },
    { min: 93,  label: '350 kcmil'         },
    { min: 107, label: '500 kcmil'         },
    { min: 122, label: '750 kcmil'         },
    { min: 138, label: '1000 kcmil \u2605 LEGEND \u2605' }
  ];

  function scoreLabel(n) {
    let lbl = SCORE_LABELS[0].label;
    for (const s of SCORE_LABELS) if (n >= s.min) lbl = s.label;
    return lbl;
  }

  const CW = 600, CH = 350;
  const GRAVITY               = 0.38;
  const THRUST                = -5.0;
  const OBS_W                 = 32;
  const GAP_480V              = 130;
  const GAP_23KV              = 90;
  const ARC_DIST              = 20;
  const TARGET_FPS            = 60;
  const FARADAY_FRAMES        = TARGET_FPS * 5;   // 5 s at target frame rate
  const SPAWN_23KV_PROB       = 0.30;             // 30 % of barriers are 23 kV
  const POWERUP_SPAWN_INTERVAL = 250;             // frames between power-up spawns

  let canvas, ctx;
  let state;             // 'READY' | 'PLAYING' | 'GAMEOVER'
  let rocket, obstacles, particles, stars, powerups;
  let score, hiScore, frame, speedMult, faradayCageTimer, lightningFlash;

  function init() {
    canvas = document.getElementById('arcadeCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    hiScore = parseInt(localStorage.getItem('rocketRiderHi') || '0', 10);
    updateHiDisplay();
    buildStars();
    resetGame();

    canvas.addEventListener('click',      handleInput);
    canvas.addEventListener('touchstart', handleInput, { passive: true });
    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && isSectionActive()) { e.preventDefault(); handleInput(); }
    });

    requestAnimationFrame(loop);
  }

  function isSectionActive() {
    const s = document.getElementById('sec-arcade');
    return s && s.classList.contains('active');
  }

  function handleInput() {
    if      (state === 'READY')    { state = 'PLAYING'; }
    else if (state === 'PLAYING')  { rocket.vy = THRUST; }
    else if (state === 'GAMEOVER') { resetGame(); state = 'READY'; }
  }

  function buildStars() {
    stars = [];
    for (let i = 0; i < 70; i++) {
      stars.push({ x: Math.random() * CW, y: Math.random() * CH,
                   r: Math.random() * 1.4 + 0.4, spd: Math.random() * 0.35 + 0.08,
                   bright: Math.random() });
    }
  }

  function resetGame() {
    rocket           = { x: 90, y: CH / 2, vy: 0, w: 28, h: 14 };
    obstacles        = [];
    particles        = [];
    powerups         = [];
    score            = 0;
    frame            = 0;
    speedMult        = 1;
    faradayCageTimer = 0;
    lightningFlash   = null;
    state            = state === 'GAMEOVER' ? 'GAMEOVER' : 'READY';
  }

  function spawnObs() {
    const voltage = Math.random() < SPAWN_23KV_PROB ? '23kV' : '480V';
    const gap     = voltage === '23kV' ? GAP_23KV : GAP_480V;
    const gapY    = Math.random() * (CH - gap - 80) + 40;
    obstacles.push({ x: CW + 4, topH: gapY, botY: gapY + gap, passed: false, voltage });
  }

  function spawnPowerup() {
    powerups.push({
      x: CW + 4,
      y: Math.random() * (CH - 80) + 40,
      type: 'faraday',
      r: 12,
      collected: false
    });
  }

  function loop() {
    requestAnimationFrame(loop);
    update();
    draw();
  }

  function update() {
    if (state !== 'PLAYING') { frame++; return; }
    frame++;
    speedMult = 1 + score * 0.018;

    // Faraday cage timer countdown
    if (faradayCageTimer > 0) faradayCageTimer--;

    // Physics
    rocket.vy += GRAVITY;
    rocket.y  += rocket.vy;

    // Exhaust particles
    if (frame % 2 === 0) {
      for (let i = 0; i < 2; i++) {
        particles.push({
          x: rocket.x - rocket.w / 2 - 2,
          y: rocket.y + (Math.random() - 0.5) * 6,
          vx: -(Math.random() * 2.5 + 0.5),
          vy: (Math.random() - 0.5) * 1.5,
          life: 1.0,
          r: Math.random() * 3 + 1
        });
      }
    }
    particles = particles.filter(p => {
      p.x += p.vx; p.y += p.vy; p.life -= 0.07;
      return p.life > 0;
    });

    // Obstacles
    const spawnEvery = Math.max(55, Math.round(110 / speedMult));
    if (frame % spawnEvery === 0) spawnObs();

    // Power-ups: spawn every POWERUP_SPAWN_INTERVAL frames
    if (frame % POWERUP_SPAWN_INTERVAL === 0) spawnPowerup();

    const spd = 2.8 * speedMult;
    for (const o of obstacles) {
      o.x -= spd;
      if (!o.passed && o.x + OBS_W < rocket.x) { o.passed = true; score++; }
    }
    obstacles = obstacles.filter(o => o.x + OBS_W > -5);

    // Power-up movement and collection
    for (const pu of powerups) {
      pu.x -= spd;
      if (!pu.collected) {
        const dx = rocket.x - pu.x, dy = rocket.y - pu.y;
        const pickupDist = rocket.w / 2 + pu.r;
        if (dx * dx + dy * dy < pickupDist * pickupDist) {
          pu.collected     = true;
          faradayCageTimer = FARADAY_FRAMES;
        }
      }
    }
    powerups = powerups.filter(pu => !pu.collected && pu.x + pu.r > -5);

    // Scroll stars
    for (const s of stars) { s.x -= s.spd * speedMult; if (s.x < 0) s.x = CW; }

    // Boundary collision
    if (rocket.y - rocket.h / 2 < 0 || rocket.y + rocket.h / 2 > CH) { endGame(); return; }

    // Arc proximity check for 23kV barriers (skip if Faraday cage is active)
    lightningFlash = null;
    if (faradayCageTimer <= 0) {
      for (const o of obstacles) {
        if (o.voltage !== '23kV') continue;
        const inXRange = rocket.x > o.x - ARC_DIST && rocket.x < o.x + OBS_W + ARC_DIST;
        const nearTop  = inXRange && rocket.y < o.topH + ARC_DIST;
        const nearBot  = inXRange && rocket.y > o.botY - ARC_DIST;
        if (nearTop || nearBot) {
          const ay = nearTop ? o.topH : o.botY;
          lightningFlash = { x1: o.x + OBS_W / 2, y1: ay, x2: rocket.x, y2: rocket.y };
          endGame();
          return;
        }
      }
    }

    // Obstacle collision (shrunk hitbox for fairness)
    const hx = rocket.x - rocket.w / 2 + 4, hy = rocket.y - rocket.h / 2 + 3;
    const hw = rocket.w - 8,                  hh = rocket.h - 6;
    for (const o of obstacles) {
      if (hx + hw > o.x + 2 && hx < o.x + OBS_W - 2) {
        if (hy < o.topH || hy + hh > o.botY) { endGame(); return; }
      }
    }
  }

  function endGame() {
    state = 'GAMEOVER';
    if (score > hiScore) {
      hiScore = score;
      localStorage.setItem('rocketRiderHi', hiScore);
      updateHiDisplay();
    }
  }

  function updateHiDisplay() {
    const el = document.getElementById('arcade-hi-score');
    if (!el) return;
    el.textContent = hiScore > 0
      ? scoreLabel(hiScore) + '  (score: ' + hiScore + ')'
      : '---';
  }

  /* ── Draw ── */
  function draw() {
    // Background
    ctx.fillStyle = '#020602';
    ctx.fillRect(0, 0, CW, CH);

    // Stars
    for (const s of stars) {
      ctx.fillStyle = 'rgba(51,255,51,' + (0.25 + s.bright * 0.5) + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Exhaust particles (amber glow)
    for (const p of particles) {
      const a = p.life * 0.85;
      ctx.fillStyle = 'rgba(255,179,0,' + a + ')';
      ctx.shadowColor = '#ffb300'; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Obstacles
    for (const o of obstacles) drawObs(o);

    // Power-ups
    for (const pu of powerups) drawPowerup(pu);

    // Rocket (always drawn in PLAYING; blink in READY/GAMEOVER)
    const showRocket = state === 'PLAYING' || (Math.floor(Date.now() / 500) % 2 === 0);
    if (showRocket) {
      drawRocket(rocket.x, rocket.y, rocket.vy);
      if (faradayCageTimer > 0) drawFaradayCage(rocket.x, rocket.y);
    }

    // Lightning arc (visible on impact frame and game-over screen)
    if (lightningFlash) drawLightning(lightningFlash.x1, lightningFlash.y1, lightningFlash.x2, lightningFlash.y2);

    // Overlays
    if      (state === 'READY')    drawReady();
    else if (state === 'PLAYING')  drawHUD();
    else if (state === 'GAMEOVER') drawGameOver();
  }

  function drawObs(o) {
    const is23kV = o.voltage === '23kV';
    ctx.save();

    // Panel body colours based on voltage level
    if (is23kV) {
      ctx.fillStyle   = '#150505';
      ctx.strokeStyle = '#ff3300';
      ctx.shadowColor = '#ff3300';
    } else {
      ctx.fillStyle   = '#15110a';
      ctx.strokeStyle = '#ffcc00';
      ctx.shadowColor = '#ffcc00';
    }
    ctx.lineWidth  = 2;
    ctx.shadowBlur = 6;

    ctx.fillRect(o.x, 0, OBS_W, o.topH);
    ctx.strokeRect(o.x, 0, OBS_W, o.topH);
    ctx.fillRect(o.x, o.botY, OBS_W, CH - o.botY);
    ctx.strokeRect(o.x, o.botY, OBS_W, CH - o.botY);

    // Electric field glow for 23 kV barriers
    if (is23kV) {
      const glowPulse = 0.35 + 0.25 * Math.sin(Date.now() / 120);
      ctx.strokeStyle = 'rgba(255,80,0,' + glowPulse + ')';
      ctx.shadowBlur  = 20;
      ctx.lineWidth   = 6;
      ctx.strokeRect(o.x, 0, OBS_W, o.topH);
      ctx.strokeRect(o.x, o.botY, OBS_W, CH - o.botY);
    }

    // Hazard bolt icons
    ctx.shadowBlur = 12;
    ctx.fillStyle  = is23kV ? '#ff6633' : '#ffcc00';
    ctx.font       = '14px sans-serif';
    ctx.textAlign  = 'center';
    if (o.topH > 22)       ctx.fillText('\u26a1', o.x + OBS_W / 2, o.topH - 6);
    if (CH - o.botY > 22)  ctx.fillText('\u26a1', o.x + OBS_W / 2, o.botY + 18);

    // Voltage label
    ctx.shadowBlur = 8;
    ctx.fillStyle  = is23kV ? '#ff3300' : '#ffcc00';
    ctx.font       = '9px "Share Tech Mono",monospace';
    if (o.topH > 30)       ctx.fillText(o.voltage, o.x + OBS_W / 2, o.topH - 20);
    if (CH - o.botY > 30)  ctx.fillText(o.voltage, o.x + OBS_W / 2, o.botY + 30);

    // Gap indicator lines
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = is23kV ? 'rgba(255,80,0,0.3)' : 'rgba(255,204,0,0.25)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(o.x, o.topH);
    ctx.lineTo(o.x + OBS_W, o.topH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(o.x, o.botY);
    ctx.lineTo(o.x + OBS_W, o.botY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawLightning(x1, y1, x2, y2) {
    const segments = 8;
    ctx.save();
    ctx.strokeStyle = '#ffff33';
    ctx.shadowColor = '#ffff33';
    ctx.shadowBlur  = 18;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
      const t  = i / segments;
      const jx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 28;
      const jy = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 28;
      ctx.lineTo(jx, jy);
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPowerup(pu) {
    ctx.save();
    ctx.translate(pu.x, pu.y);
    const pulse = 0.5 + 0.4 * Math.sin(Date.now() / 200);
    ctx.strokeStyle = 'rgba(100,200,255,' + pulse + ')';
    ctx.shadowColor = '#64c8ff';
    ctx.shadowBlur  = 14;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, pu.r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, pu.r, pu.r * 0.35, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, pu.r * 0.35, pu.r, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle    = 'rgba(100,200,255,' + pulse + ')';
    ctx.shadowBlur   = 8;
    ctx.font         = '8px "Share Tech Mono",monospace';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FC', 0, 0);
    ctx.restore();
  }

  function drawFaradayCage(cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    const pulse = 0.6 + 0.3 * Math.sin(Date.now() / 150);
    ctx.strokeStyle = 'rgba(100,200,255,' + pulse + ')';
    ctx.shadowColor = '#64c8ff';
    ctx.shadowBlur  = 16;
    ctx.lineWidth   = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 22, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 9, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 22, Math.PI / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawRocket(cx, cy, vy) {
    // Blue Origin New Glenn — 8-bit pixel-art style
    // Nose points right (+x), engine bells at left (-x)
    ctx.save();
    ctx.translate(cx, cy);
    const tilt = Math.max(-0.45, Math.min(0.45, (vy || 0) * 0.035));
    ctx.rotate(tilt);

    ctx.shadowColor = '#5abcf0';
    ctx.shadowBlur  = 14;

    // ── Swept-back fins (drawn first, behind body) ──
    ctx.fillStyle = '#002a52';
    // top fin
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(-14, -20);
    ctx.lineTo(-19, -20);
    ctx.lineTo(-14, -8);
    ctx.closePath(); ctx.fill();
    // bottom fin
    ctx.beginPath();
    ctx.moveTo(-8, 8);
    ctx.lineTo(-14, 20);
    ctx.lineTo(-19, 20);
    ctx.lineTo(-14, 8);
    ctx.closePath(); ctx.fill();

    // ── Main booster body (Blue Origin blue) ──
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#004b8d';
    ctx.fillRect(-18, -8, 28, 16);

    // 8-bit panel shading: dark top & bottom bands
    ctx.fillStyle = '#003468';
    ctx.fillRect(-18, -8, 28, 3);
    ctx.fillRect(-18,  5, 28, 3);

    // light reflection strip
    ctx.fillStyle = '#1a6fad';
    ctx.fillRect(-18, -5, 28, 2);

    // ── Payload fairing (white section, right portion) ──
    ctx.fillStyle = '#c8daf0';
    ctx.fillRect(2, -8, 10, 16);
    ctx.fillStyle = '#ddeeff';
    ctx.fillRect(4, -8, 8, 16);
    ctx.fillStyle = '#eef5ff';
    ctx.fillRect(6, -8, 4, 16);

    // ── Nose cone (8-bit triangle, points right) ──
    ctx.fillStyle = '#ddeeff';
    ctx.beginPath();
    ctx.moveTo(12, -8);
    ctx.lineTo(21,  0);
    ctx.lineTo(12,  8);
    ctx.closePath(); ctx.fill();
    // nose highlight pixel
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(17, -1, 3, 2);

    // ── Blue Origin livery: blue band across fairing ──
    ctx.fillStyle = '#004b8d';
    ctx.fillRect(2, -2, 14, 4);
    // light-blue accent lines above/below band
    ctx.fillStyle = '#5abcf0';
    ctx.fillRect(2, -4, 14, 2);
    ctx.fillRect(2,  2, 14, 2);

    // ── Engine bay backing ──
    ctx.fillStyle = '#111826';
    ctx.fillRect(-22, -7, 5, 14);

    // ── BE-4 engine bells (3 simplified nozzles) ──
    ctx.fillStyle = '#5a6880';
    // top bell
    ctx.beginPath();
    ctx.moveTo(-22, -6); ctx.lineTo(-27, -7); ctx.lineTo(-27, -2); ctx.lineTo(-22, -2);
    ctx.closePath(); ctx.fill();
    // centre bell
    ctx.beginPath();
    ctx.moveTo(-22, -1); ctx.lineTo(-28, -2); ctx.lineTo(-28,  2); ctx.lineTo(-22,  1);
    ctx.closePath(); ctx.fill();
    // bottom bell
    ctx.beginPath();
    ctx.moveTo(-22,  2); ctx.lineTo(-27,  2); ctx.lineTo(-27,  7); ctx.lineTo(-22,  6);
    ctx.closePath(); ctx.fill();

    // nozzle exits (dark interior)
    ctx.fillStyle = '#08081a';
    ctx.fillRect(-27, -7, 2, 5);
    ctx.fillRect(-28, -2, 2, 4);
    ctx.fillRect(-27,  2, 2, 5);

    // nozzle heat glow
    ctx.fillStyle = 'rgba(255, 140, 30, 0.7)';
    ctx.fillRect(-29, -1, 2, 2);

    ctx.restore();
  }

  function drawHUD() {
    const lbl = scoreLabel(score);
    ctx.save();
    ctx.shadowColor = '#ffb300'; ctx.shadowBlur = 8;
    ctx.fillStyle   = '#ffb300';
    ctx.font        = 'bold 13px "Share Tech Mono",monospace';
    ctx.textAlign   = 'left';
    ctx.fillText('Score: ' + score + '  \u2014  ' + lbl, 10, 22);
    if (faradayCageTimer > 0) {
      const secs = (faradayCageTimer / TARGET_FPS).toFixed(1);
      ctx.fillStyle   = '#64c8ff';
      ctx.shadowColor = '#64c8ff';
      ctx.fillText('\u26f6 FARADAY CAGE: ' + secs + 's', 10, 40);
    }
    ctx.restore();
  }

  function drawReady() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.52)';
    ctx.fillRect(0, 0, CW, CH);

    ctx.textAlign = 'center';
    ctx.shadowColor = '#33ff33'; ctx.shadowBlur = 16;
    ctx.fillStyle   = '#33ff33';
    ctx.font = '28px "VT323",monospace';
    ctx.fillText('ROCKET RIDER', CW / 2, CH / 2 - 32);

    const blink = Math.floor(Date.now() / 550) % 2 === 0;
    if (blink) {
      ctx.shadowColor = '#ffb300'; ctx.shadowBlur = 10;
      ctx.fillStyle   = '#ffb300';
      ctx.font = '15px "Share Tech Mono",monospace';
      ctx.fillText('PRESS SPACE or TAP TO START', CW / 2, CH / 2 + 8);
    }

    ctx.shadowColor = '#33ff33'; ctx.shadowBlur = 4;
    ctx.fillStyle   = '#22cc22';
    ctx.font = '12px "Share Tech Mono",monospace';
    ctx.fillText('HI-SCORE: ' + (hiScore > 0 ? scoreLabel(hiScore) + ' (' + hiScore + ')' : '---'),
                 CW / 2, CH / 2 + 36);
    ctx.restore();
  }

  function drawGameOver() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, CW, CH);

    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff3300'; ctx.shadowBlur = 16;
    ctx.fillStyle   = '#ff3300';
    ctx.font = '32px "VT323",monospace';
    ctx.fillText('GAME OVER', CW / 2, CH / 2 - 40);

    if (lightningFlash) {
      ctx.shadowColor = '#ffff33'; ctx.shadowBlur = 12;
      ctx.fillStyle   = '#ffff33';
      ctx.font = '13px "Share Tech Mono",monospace';
      ctx.fillText('\u26a1 23kV ARC FLASH \u26a1', CW / 2, CH / 2 - 20);
    }

    ctx.shadowColor = '#33ff33'; ctx.shadowBlur = 8;
    ctx.fillStyle   = '#33ff33';
    ctx.font = '15px "Share Tech Mono",monospace';
    ctx.fillText('Score: ' + score + '  \u2014  ' + scoreLabel(score), CW / 2, lightningFlash ? CH / 2 + 4 : CH / 2 - 8);

    if (score >= hiScore && score > 0) {
      ctx.shadowColor = '#ffb300'; ctx.shadowBlur = 12;
      ctx.fillStyle   = '#ffb300';
      ctx.fillText('\u2605 NEW HIGH SCORE! \u2605', CW / 2, CH / 2 + 20);
    }

    const blink = Math.floor(Date.now() / 550) % 2 === 0;
    if (blink) {
      ctx.shadowColor = '#22cc22'; ctx.shadowBlur = 4;
      ctx.fillStyle   = '#22cc22';
      ctx.font = '12px "Share Tech Mono",monospace';
      ctx.fillText('CLICK / SPACE TO PLAY AGAIN', CW / 2, CH / 2 + 50);
    }
    ctx.restore();
  }

  /* Global reset button handler */
  window.arcadeReset = function () {
    hiScore = 0;
    localStorage.removeItem('rocketRiderHi');
    updateHiDisplay();
  };

  document.addEventListener('DOMContentLoaded', init);
}());

/* ============================================================
   LSI BREAKER SETTINGS VISUALIZER
   ============================================================ */
window.drawLsiTcc = function () {
  const ltPickup   = val('lsi_lt_pickup');
  const ltDelay    = val('lsi_lt_delay');
  const stPickup   = val('lsi_st_pickup');
  const stDelay    = val('lsi_st_delay');
  const instPickup = val('lsi_inst_pickup');

  if (!isPos(ltPickup, ltDelay, stPickup, stDelay, instPickup))
    return showError('lsi_result', 'Enter all five positive values.');
  if (stPickup <= ltPickup)
    return showError('lsi_result', 'Short-time pickup must be greater than long-time pickup.');
  if (instPickup <= stPickup)
    return showError('lsi_result', 'Instantaneous pickup must be greater than short-time pickup.');

  const canvas = document.getElementById('lsiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const PAD = { top: 30, right: 30, bottom: 50, left: 65 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top  - PAD.bottom;

  /* log scale helpers */
  const Imin = Math.pow(10, Math.floor(Math.log10(ltPickup * 0.5)));
  const Imax = Math.pow(10, Math.ceil(Math.log10(instPickup * 3)));
  const Tmin = 0.01, Tmax = 100;

  function xOf(I) {
    return PAD.left + (Math.log10(I) - Math.log10(Imin)) /
           (Math.log10(Imax) - Math.log10(Imin)) * plotW;
  }
  function yOf(T) {
    return PAD.top + (1 - (Math.log10(T) - Math.log10(Tmin)) /
           (Math.log10(Tmax) - Math.log10(Tmin))) * plotH;
  }

  /* clear */
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0d1a0d';
  ctx.fillRect(0, 0, W, H);

  /* grid */
  ctx.strokeStyle = '#1a3a1a';
  ctx.lineWidth = 1;
  const iDecades = [];
  for (let d = Math.log10(Imin); d <= Math.log10(Imax); d++) {
    for (let m = 1; m < 10; m++) {
      const I = Math.pow(10, d) * m;
      if (I < Imin || I > Imax) continue;
      ctx.beginPath();
      ctx.moveTo(xOf(I), PAD.top);
      ctx.lineTo(xOf(I), PAD.top + plotH);
      ctx.stroke();
    }
  }
  for (let d = Math.log10(Tmin); d <= Math.log10(Tmax); d++) {
    for (let m = 1; m < 10; m++) {
      const T = Math.pow(10, d) * m;
      if (T < Tmin || T > Tmax) continue;
      ctx.beginPath();
      ctx.moveTo(PAD.left, yOf(T));
      ctx.lineTo(PAD.left + plotW, yOf(T));
      ctx.stroke();
    }
  }

  /* axes */
  ctx.strokeStyle = '#33cc33';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(PAD.left, PAD.top, plotW, plotH);

  /* axis labels */
  ctx.fillStyle = '#33cc33';
  ctx.font = '11px "Share Tech Mono",monospace';
  ctx.textAlign = 'center';

  /* X axis ticks and labels */
  for (let d = Math.log10(Imin); d <= Math.log10(Imax); d++) {
    const I = Math.pow(10, d);
    if (I < Imin || I > Imax) continue;
    const x = xOf(I);
    ctx.beginPath();
    ctx.moveTo(x, PAD.top + plotH);
    ctx.lineTo(x, PAD.top + plotH + 5);
    ctx.stroke();
    ctx.fillText(I >= 1000 ? (I / 1000) + 'k' : String(I), x, PAD.top + plotH + 18);
  }
  ctx.fillText('Current (A)', PAD.left + plotW / 2, H - 5);

  /* Y axis ticks and labels */
  ctx.textAlign = 'right';
  for (let d = Math.log10(Tmin); d <= Math.log10(Tmax); d++) {
    const T = Math.pow(10, d);
    if (T < Tmin || T > Tmax) continue;
    const y = yOf(T);
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left - 5, y);
    ctx.stroke();
    ctx.fillText(T < 1 ? T.toFixed(2) : String(T), PAD.left - 7, y + 4);
  }

  ctx.save();
  ctx.translate(14, PAD.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('Time (s)', 0, 0);
  ctx.restore();

  /* ── TCC curve segments ── */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* 1. Long-time region: from ltPickup to stPickup, time drops from ltDelay
        using a simplified I²t inverse characteristic */
  ctx.beginPath();
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 2.5;
  const ltSteps = 80;
  for (let k = 0; k <= ltSteps; k++) {
    const frac = k / ltSteps;
    const I = ltPickup * Math.pow(stPickup / ltPickup, frac);
    /* I²t: t = ltDelay × (ltPickup/I)² */
    const T = clamp(ltDelay * Math.pow(ltPickup / I, 2), Tmin, Tmax);
    if (I < Imin || I > Imax) continue;
    if (k === 0) ctx.moveTo(xOf(I), yOf(T));
    else ctx.lineTo(xOf(I), yOf(T));
  }
  ctx.stroke();

  /* 2. Short-time region: flat band at stDelay from stPickup to instPickup */
  ctx.beginPath();
  ctx.strokeStyle = '#ffcc00';
  ctx.lineWidth = 2.5;
  const stT = clamp(stDelay, Tmin, Tmax);
  ctx.moveTo(xOf(clamp(stPickup, Imin, Imax)), yOf(stT));
  ctx.lineTo(xOf(clamp(instPickup, Imin, Imax)), yOf(stT));
  ctx.stroke();

  /* Vertical line connecting LT end to ST band */
  ctx.beginPath();
  ctx.strokeStyle = '#00ff88';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  const ltEndT = clamp(ltDelay * Math.pow(ltPickup / stPickup, 2), Tmin, Tmax);
  ctx.moveTo(xOf(clamp(stPickup, Imin, Imax)), yOf(ltEndT));
  ctx.lineTo(xOf(clamp(stPickup, Imin, Imax)), yOf(stT));
  ctx.stroke();
  ctx.setLineDash([]);

  /* 3. Instantaneous: vertical drop at instPickup from stDelay down */
  ctx.beginPath();
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 2.5;
  ctx.moveTo(xOf(clamp(instPickup, Imin, Imax)), yOf(stT));
  ctx.lineTo(xOf(clamp(instPickup, Imin, Imax)), yOf(Tmin));
  ctx.stroke();

  /* Region labels */
  ctx.font = 'bold 12px "Share Tech Mono",monospace';
  ctx.textAlign = 'left';

  ctx.fillStyle = '#00ff88';
  const ltMidI = ltPickup * Math.pow(stPickup / ltPickup, 0.3);
  const ltMidT = clamp(ltDelay * Math.pow(ltPickup / ltMidI, 2), Tmin * 2, Tmax / 2);
  if (ltMidI > Imin && ltMidI < Imax) {
    ctx.fillText('L', xOf(ltMidI) + 4, yOf(ltMidT) - 4);
  }

  ctx.fillStyle = '#ffcc00';
  const stMidI = Math.sqrt(stPickup * instPickup);
  if (stMidI > Imin && stMidI < Imax) {
    ctx.fillText('S', xOf(stMidI) + 4, yOf(stT) - 6);
  }

  ctx.fillStyle = '#ff4444';
  if (instPickup > Imin && instPickup < Imax) {
    ctx.fillText('I', xOf(instPickup) + 6, PAD.top + plotH * 0.8);
  }

  showResult('lsi_result', [
    ['Long-time Pickup', fmt(ltPickup) + ' A'],
    ['Long-time Delay (at pickup)', fmt(ltDelay) + ' s'],
    ['Short-time Pickup', fmt(stPickup) + ' A'],
    ['Short-time Delay', fmt(stDelay) + ' s'],
    ['Instantaneous Pickup', fmt(instPickup) + ' A']
  ]);
};

/* ============================================================
   BESS PEAK-SHAVE OPTIMIZER (LP)
   ============================================================ */
window.calcBessPeakShave = function () {
  const battery = val('bess_battery');
  const solar   = val('bess_solar');
  if (!isFinite(battery) || battery < 0) return showError('bess_result', 'Enter a valid battery capacity (kW ≥ 0).');
  if (!isFinite(solar)   || solar   < 0) return showError('bess_result', 'Enter a valid solar forecast (kW ≥ 0).');
  const available = battery + solar;

  const loads = [];
  for (let i = 1; i <= 5; i++) {
    const nameEl = document.getElementById('bess_name_' + i);
    const name   = nameEl ? nameEl.value.trim() || ('Load ' + i) : ('Load ' + i);
    const kw     = val('bess_kw_'  + i);
    const pri    = val('bess_pri_' + i);
    if (!isFinite(kw) || kw < 0) return showError('bess_result', 'Load ' + i + ': enter a valid kW value (≥ 0).');
    if (!isFinite(pri) || pri < 1 || pri > 10) return showError('bess_result', 'Load ' + i + ': priority must be 1–10.');
    loads.push({ name, kw, pri });
  }

  /* Build LP model for the solver */
  const variables = {};
  const ints = {};
  loads.forEach((ld, idx) => {
    const key = 'x' + idx;
    variables[key] = { score: ld.pri, capacity: ld.kw };
    ints[key] = 1;
  });

  const model = {
    optimize:    'score',
    opType:      'max',
    constraints: { capacity: { max: available } },
    variables,
    ints
  };

  let result;
  try {
    /* javascript-lp-solver exposes itself as window.solver */
    if (typeof window.solver === 'undefined')
      throw new Error('LP solver library not loaded. Check internet connection.');
    result = window.solver.Solve(model);
  } catch (e) {
    return showError('bess_result', 'Solver error: ' + e.message);
  }

  if (!result || result.feasible === false)
    return showError('bess_result', 'No feasible solution found. Check inputs.');

  const selected = loads.filter((_, idx) => result['x' + idx] >= 0.5);
  const totalKw  = selected.reduce((s, ld) => s + ld.kw, 0);
  const totalPri = selected.reduce((s, ld) => s + ld.pri, 0);

  const rows = [
    ['Available Capacity', fmt(available) + ' kW (Battery ' + fmt(battery) + ' + Solar ' + fmt(solar) + ')'],
    ['Total Load Served', fmt(totalKw) + ' kW'],
    ['Total Priority Score', String(totalPri) + ' / ' + (loads.length * 10)],
    ['Loads Selected', selected.length + ' of ' + loads.length]
  ];
  selected.forEach(ld => rows.push(['\u2714 ' + ld.name, fmt(ld.kw) + ' kW  |  Priority: ' + ld.pri]));
  const notSelected = loads.filter(ld => !selected.includes(ld));
  notSelected.forEach(ld => rows.push(['\u2718 ' + ld.name + ' (shed)', fmt(ld.kw) + ' kW  |  Priority: ' + ld.pri]));

  showResult('bess_result', rows);
};

/* ============================================================
   TRANSFORMER TAP-CHANGER CALCULATOR (23 kV / 480 V)
   ============================================================ */
window.calcTapChanger = function () {
  const measuredV    = val('tap_measured_v');
  const currentTapEl = document.getElementById('tap_current_setting');
  if (!currentTapEl) return;
  const currentTap   = parseFloat(currentTapEl.value);   /* % */

  if (!isPos(measuredV))
    return showError('tap_result', 'Enter a positive measured secondary voltage.');
  if (!isFinite(currentTap))
    return showError('tap_result', 'Select a valid current tap setting.');

  const nominalPrimary   = 23000; /* V */
  const nominalSecondary = 480;   /* V */
  const nominalRatio     = nominalPrimary / nominalSecondary; /* 47.9167 */

  /* Available tap positions in % */
  const tapPositions = [-5, -2.5, 0, 2.5, 5];

  /* Effective primary turns factor at current tap: primary winding adjusted by tap% */
  /* V_sec = V_pri / (nominalRatio × (1 + tap/100)) */
  /* Derive implied primary voltage from measured secondary and current tap */
  const impliedPrimary = measuredV * nominalRatio * (1 + currentTap / 100);

  /* For each tap position, compute expected secondary voltage */
  const tapResults = tapPositions.map(tap => ({
    tap,
    expectedV: impliedPrimary / (nominalRatio * (1 + tap / 100)),
    label: tap > 0 ? '+' + tap + '%' : (tap < 0 ? tap + '%' : '0% (Nominal)')
  }));

  /* Find tap closest to 480 V */
  tapResults.forEach(t => { t.error = Math.abs(t.expectedV - nominalSecondary); });
  const best = tapResults.reduce((a, b) => a.error < b.error ? a : b);

  const rows = [
    ['Measured Secondary Voltage', fmt(measuredV, 2) + ' V'],
    ['Current Tap Setting', currentTap > 0 ? '+' + currentTap + '%' : currentTap + '%'],
    ['Implied Primary Voltage', fmt(impliedPrimary, 2) + ' V'],
    ['Nominal Ratio (23kV/480V)', fmt(nominalRatio, 4)],
    ['', ''],
    ['--- Expected Secondary by Tap ---', ''],
    ...tapResults.map(t => [
      t.tap === parseFloat(currentTapEl.value) ? t.label + ' (current)' : t.label,
      fmt(t.expectedV, 2) + ' V  (error: ' + fmt(t.error, 2) + ' V)'
    ]),
    ['', ''],
    ['Recommended Tap Setting', best.label],
    ['Expected Secondary at Rec. Tap', fmt(best.expectedV, 2) + ' V']
  ];

  showResult('tap_result', rows);
};

/* ============================================================
   HAZARDOUS AREA MATERIAL LOOKUP (NEC 500)
   ============================================================ */
const HAZ_DATA = {
  hydrogen: {
    name: 'Hydrogen (H₂)',
    class: 'Class I',
    division: 'Division 1 (near release points) / Division 2 (general area)',
    group: 'Group B',
    tcode: 'T1 (AIT 500°C — equipment max surface temp ≤ 450°C)',
    notes: 'Most stringent gas group. Requires Group B listed equipment. Very wide flammability range (4–75% in air). Used as LH₂ propellant. Venting areas are typically Class I, Div 1 within a defined radius.'
  },
  rp1: {
    name: 'RP-1 Kerosene (Rocket Propellant-1)',
    class: 'Class I',
    division: 'Division 1 (fueling operations) / Division 2 (storage/handling areas)',
    group: 'Group D',
    tcode: 'T3 (AIT 210°C — equipment max surface temp ≤ 200°C)',
    notes: 'Petroleum-based fuel similar to kerosene. Flash point ~43–72°C. Classified similarly to kerosene/fuel oil. Group D applies to most petroleum distillates. Division 1 applies during active fueling; Division 2 for storage areas.'
  },
  methane: {
    name: 'Methane (CH₄) / LNG / Natural Gas',
    class: 'Class I',
    division: 'Division 1 (near equipment and release points) / Division 2 (general storage area)',
    group: 'Group D',
    tcode: 'T1 (AIT 537°C — equipment max surface temp ≤ 450°C)',
    notes: 'Natural gas and LNG (liquefied natural gas) are primarily methane. Lighter than air — tends to accumulate at ceiling level. Flammability range 5–15% in air. Used as Methox (CH₄/LOX) propellant. Group D per NEC 500.6.'
  },
  ammonia: {
    name: 'Ammonia (NH₃)',
    class: 'Class I',
    division: 'Division 1 (near release points) / Division 2 (storage and handling)',
    group: 'Group D',
    tcode: 'T1 (AIT 651°C — equipment max surface temp ≤ 450°C)',
    notes: 'Ammonia is classified as a Group D material per NEC 500.6(A)(4). Flammability range 15–28% in air. Also a toxic gas — TLV-TWA 25 ppm. Used as a propellant in some green propulsion systems. Refrigeration systems using NH₃ in machine rooms require Class I, Div 2 classification.'
  },
  lox_venting: {
    name: 'LOX Venting / Oxygen-Enriched Atmosphere (OEA)',
    class: 'Not a flammable gas (oxidizer)',
    division: 'N/A — Oxygen is not classified under NEC 500 (not flammable)',
    group: 'N/A',
    tcode: 'N/A — but OEA significantly lowers ignition energy of all other materials',
    notes: 'Liquid Oxygen (LOX) and oxygen-enriched atmospheres are oxidizers, not flammables — they do not fall under NEC 500 Class/Division. However, OEA dramatically lowers the ignition energy of adjacent flammable materials. Areas with LOX venting must have oxygen monitoring, strict material controls, and may require enhanced electrical safety measures. Consult NFPA 50B and facility-specific hazard analysis.'
  },
  nitrogen: {
    name: 'Nitrogen (N₂) / Inert Purge Gas',
    class: 'Non-flammable / Non-classified',
    division: 'N/A — Not a flammable gas; no NEC 500 classification applies',
    group: 'N/A',
    tcode: 'N/A',
    notes: 'Pure nitrogen is inert and non-flammable. Inert purge gas systems using N₂ do not create NEC 500 classified areas by themselves. However, nitrogen is an asphyxiant — confined space procedures and O₂ monitoring are required. Areas purged with N₂ eliminate flammable atmospheres, reducing or eliminating NEC 500 classification where previously classified.'
  }
};

window.lookupHazArea = function () {
  const sub = document.getElementById('haz_substance').value;
  if (!sub) return showError('haz_result', 'Select a substance from the dropdown.');
  const d = HAZ_DATA[sub];
  if (!d) return showError('haz_result', 'Substance data not found.');
  showResult('haz_result', [
    ['Substance',    d.name],
    ['NEC Class',    d.class],
    ['Division',     d.division],
    ['Group',        d.group],
    ['T-Code',       d.tcode],
    ['Notes',        d.notes]
  ]);
};

/* ============================================================
   LIGHTING LOAD & VOLTAGE DROP OPTIMIZER (LP)
   ============================================================ */
const LO_WIRE_SIZES = [
  { awg: '14',  cm: 4110,   cost: 1.0  },
  { awg: '12',  cm: 6530,   cost: 1.5  },
  { awg: '10',  cm: 10380,  cost: 2.5  },
  { awg: '8',   cm: 16510,  cost: 4.0  },
  { awg: '6',   cm: 26240,  cost: 6.0  },
  { awg: '4',   cm: 41740,  cost: 9.5  },
  { awg: '2',   cm: 66360,  cost: 14.5 },
  { awg: '1',   cm: 83690,  cost: 18.0 },
  { awg: '1/0', cm: 105600, cost: 24.0 },
  { awg: '2/0', cm: 133100, cost: 30.0 }
];

window.calcLightingOptimizer = function () {
  const count   = val('lo_count');
  const watts   = val('lo_watts');
  const length  = val('lo_length');
  const vdPct   = val('lo_vd');
  const voltage = parseFloat(document.getElementById('lo_voltage').value);
  const matEl   = document.getElementById('lo_material');
  const K = matEl.value === 'CU' ? 12.9 : 21.2;

  if (!isPos(count, watts, length, vdPct, voltage))
    return showError('lo_result', 'Enter all fields with positive values.');

  const totalW = count * watts;
  const I      = totalW / voltage;
  const vdMax  = (vdPct / 100) * voltage;  /* max absolute VD in volts */

  /* Find all wire sizes that satisfy VD constraint */
  const passing = LO_WIRE_SIZES.filter(w => {
    const vd = (2 * K * I * length) / w.cm;
    return vd <= vdMax;
  });

  let chosen, note;
  if (passing.length === 0) {
    /* No size passes — use largest available and flag */
    chosen = LO_WIRE_SIZES[LO_WIRE_SIZES.length - 1];
    const actualVd = (2 * K * I * length) / chosen.cm;
    const actualPct = (actualVd / voltage) * 100;
    note = 'WARNING: No standard size meets ' + vdPct + '% VD. Largest size (' + chosen.awg + ' AWG) gives ' + fmt(actualPct, 2) + '% VD. Consider splitting the circuit.';
  } else {
    /* LP objective: minimize cost — the passing array is already sorted by ascending CM (ascending cost) */
    chosen = passing[0];
    note = null;
  }

  const actualVd     = (2 * K * I * length) / chosen.cm;
  const actualVdPct  = (actualVd / voltage) * 100;
  const totalVA      = totalW;   /* unity PF assumption for lighting */

  const rows = [
    ['Total Load',            fmt(totalW) + ' W (' + fmt(totalVA / 1000, 2) + ' kVA)'],
    ['Circuit Current (I)',   fmt(I, 2) + ' A'],
    ['Run Length',            fmt(length) + ' ft (one-way)'],
    ['Conductor Material',    matEl.value === 'CU' ? 'Copper (K=12.9)' : 'Aluminum (K=21.2)'],
    ['Target VD%',            fmt(vdPct, 1) + '%'],
    ['Optimal Wire Size',     chosen.awg + ' AWG'],
    ['Actual VD at this size',fmt(actualVd, 2) + ' V (' + fmt(actualVdPct, 2) + '%)'],
    ['VD Constraint',         actualVdPct <= vdPct ? 'PASS ✓' : 'EXCEED — see note']
  ];
  if (note) rows.push(['⚠ Note', note]);
  showResult('lo_result', rows);
};

/* ============================================================
   BUILDING SERVICE LOAD CALCULATOR (NEC 220)
   ============================================================ */
const BL_VA_PER_SQFT = {
  industrial: 1.0,
  office:     3.5,
  warehouse:  0.25,
  retail:     3.0,
  school:     3.0,
  hospital:   2.0
};

window.calcBuildingLoad = function () {
  const sqft    = val('bl_sqft');
  const outlets = val('bl_outlets');
  const voltage = parseFloat(document.getElementById('bl_voltage').value);
  const phases  = parseInt(document.getElementById('bl_phases').value, 10);
  const occ     = document.getElementById('bl_occupancy').value;

  if (!isPos(sqft, voltage) || isNaN(outlets) || outlets < 0)
    return showError('bl_result', 'Enter square footage (>0) and outlet count (≥0).');

  const vaPerSqFt = BL_VA_PER_SQFT[occ] || 1.0;

  /* NEC 220.12 — General Lighting Load */
  const lightingVA = sqft * vaPerSqFt;

  /* NEC 220.14(I) — Receptacle Load */
  const receptacleVA_raw = outlets * 180;

  /* NEC Table 220.44 — Receptacle Demand Factor */
  let receptacleVA_demand;
  if (receptacleVA_raw <= 10000) {
    receptacleVA_demand = receptacleVA_raw; /* 100% of first 10 kVA */
  } else {
    receptacleVA_demand = 10000 + (receptacleVA_raw - 10000) * 0.5;
  }

  const totalVA = lightingVA + receptacleVA_demand;

  /* Service Amperes */
  let serviceAmps;
  if (phases === 3) {
    serviceAmps = totalVA / (Math.sqrt(3) * voltage);
  } else {
    serviceAmps = totalVA / voltage;
  }

  /* NEC 210.20 — Continuous load sizing: multiply by 1.25 for breaker/conductor */
  const designAmps = serviceAmps * 1.25;

  showResult('bl_result', [
    ['Occupancy Type',              document.getElementById('bl_occupancy').options[document.getElementById('bl_occupancy').selectedIndex].text],
    ['Lighting Load Rate',          fmt(vaPerSqFt, 2) + ' VA/sq ft (NEC Table 220.12)'],
    ['General Lighting Load',       fmt(lightingVA) + ' VA (' + fmt(lightingVA / 1000, 2) + ' kVA)'],
    ['Receptacle Load (raw)',        fmt(receptacleVA_raw) + ' VA (' + outlets + ' outlets × 180 VA)'],
    ['Receptacle Load (after demand)',fmt(receptacleVA_demand, 0) + ' VA (NEC Table 220.44)'],
    ['Total Calculated Load',       fmt(totalVA) + ' VA (' + fmt(totalVA / 1000, 2) + ' kVA)'],
    ['Service Voltage',             (phases === 3 ? '3Ø ' : '1Ø ') + voltage + ' V'],
    ['Calculated Service Current',  fmt(serviceAmps, 2) + ' A'],
    ['Design Amps (×1.25 NEC 210.20)', fmt(designAmps, 2) + ' A']
  ]);
};

/* ============================================================
   INTRINSICALLY SAFE LOOP VERIFIER
   ============================================================ */
window.verifyISLoop = function () {
  const voc  = val('is_voc');
  const isc  = val('is_isc');
  const ca   = val('is_ca');
  const la   = val('is_la');
  const vmax = val('is_vmax');
  const imax = val('is_imax');
  const ci   = val('is_ci');
  const li   = val('is_li');

  if (!isPos(voc, isc, ca, la) || !isPos(vmax, imax))
    return showError('is_result', 'Enter all barrier and device parameters (all must be > 0). Ci and Li may be 0.');

  /* Ci and Li may be 0 — treat NaN as 0 */
  const ciVal = isFinite(ci) && ci >= 0 ? ci : 0;
  const liVal = isFinite(li) && li >= 0 ? li : 0;

  const vPass  = voc  <= vmax;
  const iPass  = isc  <= imax;
  const cPass  = ca   >= ciVal;
  const lPass  = la   >= liVal;
  const allPass = vPass && iPass && cPass && lPass;

  const checkMark = s => s ? 'PASS ✓' : 'FAIL ✗';

  const rows = [
    ['─── Barrier Parameters ───', ''],
    ['Barrier Voc',                fmt(voc, 2) + ' V'],
    ['Barrier Isc',                fmt(isc, 2) + ' mA'],
    ['Barrier Ca (max allowed C)', fmt(ca, 4) + ' µF'],
    ['Barrier La (max allowed L)', fmt(la, 4) + ' mH'],
    ['─── Field Device Parameters ───', ''],
    ['Device Vmax',                fmt(vmax, 2) + ' V'],
    ['Device Imax',                fmt(imax, 2) + ' mA'],
    ['Device Ci (internal C)',     fmt(ciVal, 4) + ' µF'],
    ['Device Li (internal L)',     fmt(liVal, 4) + ' mH'],
    ['─── Entity Check Results ───', ''],
    ['Voltage:  Voc (' + fmt(voc,2) + ') ≤ Vmax (' + fmt(vmax,2) + ')',  checkMark(vPass)],
    ['Current:  Isc (' + fmt(isc,2) + ') ≤ Imax (' + fmt(imax,2) + ')', checkMark(iPass)],
    ['Capacitance: Ca (' + fmt(ca,4) + ') ≥ Ci (' + fmt(ciVal,4) + ')', checkMark(cPass)],
    ['Inductance:  La (' + fmt(la,4) + ') ≥ Li (' + fmt(liVal,4) + ')', checkMark(lPass)],
    ['─── OVERALL RESULT ───',     allPass ? '✔ PASS — Loop is IS compatible' : '✘ FAIL — One or more entity parameters do not comply']
  ];

  const el = document.getElementById('is_result');
  if (el) {
    el.className = allPass ? 'result show' : 'result error show';
  }
  /* Use raw innerHTML to highlight pass/fail colors */
  if (el) {
    el.innerHTML = rows.map(r => {
      const isHeader = r[0].startsWith('───');
      const labelStyle = isHeader ? 'color:var(--amber);text-shadow:var(--glow-amber)' : '';
      const valStyle   = r[1].includes('PASS') ? 'color:var(--green-bright);text-shadow:var(--glow-sm)' :
                         r[1].includes('FAIL') ? 'color:var(--red);text-shadow:var(--glow-red)' : '';
      return `<div class="res-row"><span class="res-label" style="${labelStyle}">${escapeHtml(r[0])}</span><span class="res-val" style="${valStyle}">${escapeHtml(r[1])}</span></div>`;
    }).join('');
  }
};

/* ============================================================
   PHOTOMETRICS CALCULATOR
   ============================================================ */
window.calcPhotometrics = function () {
  const lumens   = val('ph_lumens');
  const fixtures = val('ph_fixtures');
  const cu       = val('ph_cu');
  const mf       = val('ph_mf');
  const area     = val('ph_area');
  if (!isPos(lumens, fixtures, area)) return showError('ph_result', 'Enter lumens, fixture count, and area (all > 0).');
  if (!isFinite(cu) || cu <= 0 || cu > 1) return showError('ph_result', 'CU must be between 0 and 1.');
  if (!isFinite(mf) || mf <= 0 || mf > 1) return showError('ph_result', 'MF must be between 0 and 1.');
  const totalLumens = lumens * fixtures;
  const fc  = (totalLumens * cu * mf) / area;
  const lux = fc * 10.76391;
  showResult('ph_result', [
    ['Total Fixture Lumens', fmt(totalLumens, 0) + ' lm'],
    ['Illuminance', fmt(fc, 2) + ' foot-candles (fc)'],
    ['Illuminance', fmt(lux, 1) + ' lux (lx)'],
    ['Formula', 'FC = (lm × Fixtures × CU × MF) / Area']
  ]);
};

window.calcLuxFC = function () {
  const v   = parseFloat(document.getElementById('ph_conv_val').value);
  const dir = document.getElementById('ph_conv_dir').value;
  if (!isFinite(v)) return showError('ph_conv_result', 'Enter a value to convert.');
  if (dir === 'fc2lux') {
    showResult('ph_conv_result', [['Result', fmt(v * 10.76391, 2) + ' lux'],['Input', fmt(v, 4) + ' fc']]);
  } else {
    showResult('ph_conv_result', [['Result', fmt(v * 0.092903, 4) + ' fc'],['Input', fmt(v, 4) + ' lux']]);
  }
};

window.calcInverseSquare = function () {
  const cd   = val('ph_isl_cd');
  const d    = val('ph_isl_d');
  const unit = document.getElementById('ph_isl_unit').value;
  if (!isPos(cd, d)) return showError('ph_isl_result', 'Enter intensity (cd) and distance (> 0).');
  const E = cd / (d * d);
  const unitLabel = unit === 'm' ? 'lux' : 'foot-candles';
  showResult('ph_isl_result', [
    ['Illuminance at d=' + fmt(d,2) + ' ' + unit, fmt(E, 2) + ' ' + unitLabel],
    ['Luminous Intensity', fmt(cd, 2) + ' cd'],
    ['Formula', 'E = I / d²']
  ]);
};

/* ============================================================
   HARMONICS TOOL
   ============================================================ */
window.harmLookup = function () {
  const type = document.getElementById('harm_load_type').value;
  const data = {
    vfd6: {
      name: 'VFD / 6-Pulse Rectifier',
      orders: '5th, 7th, 11th, 13th, 17th, 19th … (6k±1, k=1,2,3…)',
      dominant: '5th (300 Hz) and 7th (420 Hz)',
      typicalTHD: '25–40% at full load',
      filter: 'Passive 5th-harmonic filter, 12-pulse transformer, or Active Harmonic Filter (AHF)',
      note: 'Most common harmonic source in industrial facilities. 5th harmonic is negative-sequence — causes motor heating and torque pulsation.'
    },
    vfd12: {
      name: '12-Pulse Rectifier Drive',
      orders: '11th, 13th, 23rd, 25th … (12k±1, k=1,2,3…)',
      dominant: '11th (660 Hz) and 13th (780 Hz)',
      typicalTHD: '8–15% at full load',
      filter: 'Passive 11th/13th filter or AHF if needed. 5th/7th already cancelled.',
      note: 'Phase-shifting transformer (30° phase shift) cancels 5th and 7th harmonics. Requires matched transformer.'
    },
    smps: {
      name: 'Switch-Mode Power Supply (PC/UPS/Charger)',
      orders: '3rd, 5th, 7th, 9th, 11th … (all odd)',
      dominant: '3rd (180 Hz) — zero-sequence, accumulates in neutral',
      typicalTHD: '60–150% (high for single-phase SMPS)',
      filter: 'Active harmonic filter or zero-sequence blocking transformer (ZSB). Size neutral conductor at 200% for SMPS-heavy loads.',
      note: 'Single-phase SMPS creates large triplen harmonics. In 3Ø 4-wire systems neutral current can exceed phase current by 173%.'
    },
    fluor: {
      name: 'Fluorescent / LED Driver (Electronic Ballast)',
      orders: '3rd, 5th, 7th (odd harmonics)',
      dominant: '3rd (180 Hz) in older ballasts; modern LED drivers may have <20% THD',
      typicalTHD: '15–30% (magnetic ballast), 5–20% (electronic ballast), <20% (LED driver)',
      filter: 'Typically no filter needed if %THD < 20%. For large lighting loads, ZSB transformer or derating neutral.',
      note: 'LED drivers with PFC (power factor correction) have much lower harmonic content. Specify THD < 20% for procurement.'
    },
    arc: {
      name: 'Arc Furnace / Arc Welder',
      orders: '2nd, 3rd, 4th, 5th … broadband (all orders); highly variable',
      dominant: 'Broadband — 2nd through 9th; random variation due to arc instability',
      typicalTHD: '20–50%; flicker is also a significant concern',
      filter: 'Static VAR compensator (SVC) or STATCOM for flicker. Active filter for harmonics. Dedicated transformer/supply recommended.',
      note: 'Arc loads are non-periodic — stochastic harmonic generation. Also produces voltage flicker (IEC 61000-3-7). Best served from dedicated HV supply.'
    },
    ups1ph: {
      name: 'Single-Phase UPS',
      orders: '3rd, 9th, 15th … (triplen — zero-sequence)',
      dominant: '3rd harmonic — zero-sequence, adds in neutral',
      typicalTHD: '25–40%',
      filter: 'Online double-conversion UPS with input PFC reduces input THD. ZSB transformer at feeder level.',
      note: 'Triplen harmonics are zero-sequence and do not cancel in balanced 3Ø systems — they add in the neutral. Size neutral conductors to 200% for UPS-heavy circuits.'
    },
    motor: {
      name: 'Linear Load (Motor / Resistive Heater) — Baseline',
      orders: 'None significant (linear load)',
      dominant: 'Fundamental only (60 Hz)',
      typicalTHD: '< 3% (negligible)',
      filter: 'No harmonic filtering required.',
      note: 'Induction motors and resistive heaters are essentially linear loads and generate minimal harmonic content. They are, however, victims of harmonics from other loads.'
    }
  };
  const d = data[type];
  if (!d) return showError('harm_lookup_result', 'Select a load type.');
  showResult('harm_lookup_result', [
    ['Load Type', d.name],
    ['Harmonic Orders Generated', d.orders],
    ['Dominant Harmonics', d.dominant],
    ['Typical Input %THD', d.typicalTHD],
    ['─── Mitigation ───', ''],
    ['Recommended Filter/Solution', d.filter],
    ['Notes', d.note]
  ]);
};

window.calcTHD = function () {
  const I1  = val('thd_i1');
  const I2  = val('thd_i2')  || 0;
  const I3  = val('thd_i3')  || 0;
  const I5  = val('thd_i5')  || 0;
  const I7  = val('thd_i7')  || 0;
  const I9  = val('thd_i9')  || 0;
  const I11 = val('thd_i11') || 0;
  const I13 = val('thd_i13') || 0;

  if (!isPos(I1)) return showError('thd_result', 'Enter fundamental current I₁ (must be > 0).');

  const harmonics = [
    { n: 2,  v: isFinite(I2)  && I2  >= 0 ? I2  : 0 },
    { n: 3,  v: isFinite(I3)  && I3  >= 0 ? I3  : 0 },
    { n: 5,  v: isFinite(I5)  && I5  >= 0 ? I5  : 0 },
    { n: 7,  v: isFinite(I7)  && I7  >= 0 ? I7  : 0 },
    { n: 9,  v: isFinite(I9)  && I9  >= 0 ? I9  : 0 },
    { n: 11, v: isFinite(I11) && I11 >= 0 ? I11 : 0 },
    { n: 13, v: isFinite(I13) && I13 >= 0 ? I13 : 0 },
  ];

  const sumSq = harmonics.reduce((acc, h) => acc + h.v * h.v, 0);
  const thd = Math.sqrt(sumSq) / I1 * 100;
  const dominant = harmonics.reduce((a, b) => a.v > b.v ? a : b);

  let filterRec = '—';
  if (dominant.v > 0) {
    if (dominant.n === 3 || dominant.n === 9) filterRec = 'Zero-sequence blocking transformer (ZSB) or Active Harmonic Filter';
    else if (dominant.n === 5 || dominant.n === 7) filterRec = 'Passive 5th/7th filter or 12-pulse transformer or AHF';
    else if (dominant.n === 11 || dominant.n === 13) filterRec = 'Passive 11th/13th filter or Active Harmonic Filter';
    else filterRec = 'Active Harmonic Filter (broadband)';
  }
  const thdStatus = thd < 5 ? 'ACCEPTABLE (<5% IEEE 519 typical)' : thd < 15 ? 'MODERATE — evaluate IEEE 519 limits at PCC' : 'HIGH — likely exceeds IEEE 519 limits; mitigation recommended';

  showResult('thd_result', [
    ['Fundamental I₁', fmt(I1, 2) + ' A (or % base)'],
    ['Total Harmonic Content (rms)', fmt(Math.sqrt(sumSq), 2)],
    ['%THD', fmt(thd, 2) + '%'],
    ['THD Status', thdStatus],
    ['Dominant Harmonic', dominant.v > 0 ? dominant.n + 'th (' + fmt(dominant.v, 2) + ' A)' : 'None'],
    ['Recommended Mitigation', filterRec]
  ]);
};

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // activate first nav button
  document.querySelector('.nav-btn').click();
  // activate first tab in each tab-group
  document.querySelectorAll('.tab-group').forEach(g => {
    const first = g.querySelector('.tab-btn');
    if (first) first.click();
  });
  // show default DC power form
  dcPowerModeChange();
  cmModeChange();
});
