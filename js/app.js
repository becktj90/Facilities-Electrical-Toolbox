/**
 * Facilities Electrical Toolbox — Calculator Logic
 * Based on Ugly's Electrical References formulas and NEC tables
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
const WIRE_SIZES  = Object.keys(WIRE_CM);

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
  const phase = document.getElementById('xfmr_phase').value;
  const kVA = val('xfmr_kva'), Vp = val('xfmr_vp'), Vs = val('xfmr_vs');
  if (!isPos(kVA, Vp, Vs)) return showError('xfmr_result', 'Enter kVA, primary voltage, and secondary voltage.');
  const phaseMult = phase === '3' ? Math.sqrt(3) : 1;
  const Ip = kVA * 1000 / (Vp * phaseMult);
  const Is = kVA * 1000 / (Vs * phaseMult);
  const turnRatio = Vp / Vs;
  showResult('xfmr_result', [
    ['Primary Current (Ip)', fmt(Ip, 2) + ' A'],
    ['Secondary Current (Is)', fmt(Is, 2) + ' A'],
    ['Turns Ratio (Np:Ns = Vp:Vs)', fmt(turnRatio, 4) + ' : 1'],
    ['kVA Rating', fmt(kVA) + ' kVA'],
    ['Phase', phase === '3' ? 'Three-Phase' : 'Single-Phase']
  ]);
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

  // conversion table: all to SI base then to target
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
    'AWG_CM': 1 // special
  };

  if (!(from in toBase) || !(to in toBase))
    return showError('uc_result', 'Select compatible units.');

  // Group check (rough: same order of magnitude base type)
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
