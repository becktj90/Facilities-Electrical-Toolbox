const STANDARD_G9000 = [100, 160, 225, 300, 500, 750, 1050];
const STORAGE_KEY = "ee-ups-sizing-projects";

const PRESETS = {
  "Custom":            { type: "linear",    pf: 0.95, demand: 1.00, factor: 1.00, current: 50,  notes: "Editable custom row" },
  "IT Rack / PDU":     { type: "nonlinear", pf: 0.98, demand: 1.00, factor: 1.15, current: 60,  notes: "Electronic nonlinear load" },
  "Server Room Panel": { type: "nonlinear", pf: 0.98, demand: 0.90, factor: 1.15, current: 100, notes: "Diverse IT branch load" },
  "VFD Input":         { type: "nonlinear", pf: 0.95, demand: 1.00, factor: 1.12, current: 80,  notes: "Rectifier/VFD source approximation" },
  "Motor Group":       { type: "motor",     pf: 0.85, demand: 1.00, factor: 1.20, current: 100, notes: "Steady-state motor screening row" },
  "General Panel":     { type: "linear",    pf: 0.92, demand: 0.85, factor: 1.10, current: 80,  notes: "Mixed panel load" },
  "Lighting Panel":    { type: "linear",    pf: 0.95, demand: 0.90, factor: 1.00, current: 50,  notes: "Lighting placeholder" }
};

const AMPACITY_CU_75 = [
  { size: "1/0", amp: 150, area: 0.3237 },
  { size: "2/0", amp: 175, area: 0.3655 },
  { size: "3/0", amp: 200, area: 0.4170 },
  { size: "4/0", amp: 230, area: 0.4777 },
  { size: "250 kcmil", amp: 255, area: 0.5565 },
  { size: "300 kcmil", amp: 285, area: 0.6121 },
  { size: "350 kcmil", amp: 310, area: 0.6677 },
  { size: "400 kcmil", amp: 335, area: 0.7234 },
  { size: "500 kcmil", amp: 380, area: 0.8346 },
  { size: "600 kcmil", amp: 420, area: 0.9459 },
  { size: "700 kcmil", amp: 460, area: 1.0571 },
  { size: "750 kcmil", amp: 475, area: 1.1128 },
  { size: "800 kcmil", amp: 490, area: 1.1684 },
  { size: "900 kcmil", amp: 520, area: 1.2796 },
  { size: "1000 kcmil", amp: 545, area: 1.3909 }
];

const EGC_TABLE = [
  { ocpd: 100, egc: "8 AWG Cu" },
  { ocpd: 200, egc: "6 AWG Cu" },
  { ocpd: 300, egc: "4 AWG Cu" },
  { ocpd: 400, egc: "3 AWG Cu" },
  { ocpd: 600, egc: "1 AWG Cu" },
  { ocpd: 800, egc: "1/0 AWG Cu" },
  { ocpd: 1000, egc: "2/0 AWG Cu" },
  { ocpd: 1200, egc: "3/0 AWG Cu" },
  { ocpd: 1600, egc: "4/0 AWG Cu" }
];

const RMC_40 = [
  { trade: "2 in", area: 1.342 },
  { trade: "2-1/2 in", area: 1.953 },
  { trade: "3 in", area: 2.899 },
  { trade: "3-1/2 in", area: 3.875 },
  { trade: "4 in", area: 5.094 },
  { trade: "5 in", area: 8.313 },
  { trade: "6 in", area: 12.864 }
];

const $ = (id) => document.getElementById(id);

function fmt(n, d = 1) {
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: d,
    maximumFractionDigits: d
  });
}

function getNum(id) {
  return Number($(id).value || 0);
}

function threePhaseKVA(vll, amps) {
  return Math.sqrt(3) * vll * amps / 1000;
}

function nextG9000(requiredKva) {
  return STANDARD_G9000.find((x) => x >= requiredKva) || null;
}

function frameCurrent(kva, vll) {
  return kva * 1000 / (Math.sqrt(3) * vll);
}

function roundOCPD(amps) {
  const common = [100,125,150,175,200,225,250,300,350,400,450,500,600,700,800,1000,1200,1600,2000];
  return common.find((x) => x >= amps) || Math.ceil(amps / 100) * 100;
}

function chooseConductor(requiredAmp) {
  for (const c of AMPACITY_CU_75) {
    if (c.amp >= requiredAmp) return { parallel: 1, size: c.size, amp: c.amp, area: c.area };
  }
  for (let p = 2; p <= 6; p++) {
    for (const c of AMPACITY_CU_75) {
      if (c.amp * p >= requiredAmp) {
        return { parallel: p, size: c.size, amp: c.amp * p, area: c.area };
      }
    }
  }
  return { parallel: "check", size: "custom", amp: requiredAmp, area: 1.5 };
}

function chooseEGC(ocpd) {
  for (const row of EGC_TABLE) {
    if (ocpd <= row.ocpd) return row.egc;
  }
  return "Check proportional upsizing";
}

function chooseRMC(conductor, includeGround = true) {
  const conductors = conductor.parallel * 3 + (includeGround ? conductor.parallel : 0);
  const totalArea = conductors * conductor.area;
  for (const r of RMC_40) {
    if (r.area >= totalArea) return { trade: r.trade, fillArea: totalArea };
  }
  return { trade: "Check > 6 in / multiple raceways", fillArea: totalArea };
}

function batteryRequiredKWh(pDesignKw, runtimeMin, eff, usable, aging, reserve) {
  const acEnergy = pDesignKw * runtimeMin / 60;
  return acEnergy / eff * aging * reserve / usable;
}

function runtimeFromBatteryKWh(battKwh, pDesignKw, eff, usable, aging, reserve) {
  if (pDesignKw <= 0) return 0;
  const usableDelivered = battKwh * eff * usable / (aging * reserve);
  return usableDelivered / pDesignKw * 60;
}

function typeOptions(selected) {
  return [
    ["linear", "Linear / general"],
    ["nonlinear", "Nonlinear / electronic"],
    ["motor", "Motor / inductive"]
  ].map(([v, t]) => `<option value="${v}" ${selected === v ? "selected" : ""}>${t}</option>`).join("");
}

function presetOptions(selected) {
  return Object.keys(PRESETS).map((k) => `<option value="${k}" ${selected === k ? "selected" : ""}>${k}</option>`).join("");
}

function addRow(data = null) {
  const d = data || {
    name: "Load",
    preset: "Custom",
    type: "linear",
    vll: getNum("systemVoltage"),
    ph: 3,
    current: 50,
    pf: 0.95,
    demand: 1.00,
    factor: 1.00,
    ride: "Yes",
    restart: "No",
    length: 100,
    notes: ""
  };

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input value="${d.name}"></td>
    <td><select class="presetSel">${presetOptions(d.preset)}</select></td>
    <td><select class="typeSel">${typeOptions(d.type)}</select></td>
    <td><input type="number" step="1" value="${d.vll}"></td>
    <td><input type="number" step="1" value="${d.ph}"></td>
    <td><input type="number" step="0.1" value="${d.current}"></td>
    <td><input type="number" step="0.01" value="${d.pf}"></td>
    <td><input type="number" step="0.01" value="${d.demand}"></td>
    <td><input type="number" step="0.01" value="${d.factor}"></td>
    <td><select><option ${d.ride === "Yes" ? "selected" : ""}>Yes</option><option ${d.ride === "No" ? "selected" : ""}>No</option></select></td>
    <td><select><option ${d.restart === "Yes" ? "selected" : ""}>Yes</option><option ${d.restart === "No" ? "selected" : ""}>No</option></select></td>
    <td><input type="number" step="1" value="${d.length}"></td>
    <td><input value="${d.notes}"></td>
    <td><button type="button" class="ghost-btn rowDeleteBtn">Delete</button></td>
  `;
  $("loadBody").appendChild(tr);

  tr.querySelector(".presetSel").addEventListener("change", () => applyPreset(tr));
  tr.querySelector(".typeSel").addEventListener("change", () => syncFactorFromType(tr));
  tr.querySelector(".rowDeleteBtn").addEventListener("click", () => {
    tr.remove();
    runAll();
  });
}

function applyPreset(row) {
  const preset = PRESETS[row.cells[1].querySelector("select").value];
  row.cells[2].querySelector("select").value = preset.type;
  row.cells[5].querySelector("input").value = preset.current;
  row.cells[6].querySelector("input").value = preset.pf;
  row.cells[7].querySelector("input").value = preset.demand;
  row.cells[8].querySelector("input").value = preset.factor;
  row.cells[12].querySelector("input").value = preset.notes;
  runAll();
}

function syncFactorFromType(row) {
  const type = row.cells[2].querySelector("select").value;
  const factor =
    type === "linear" ? getNum("factorLinear") :
    type === "nonlinear" ? getNum("factorNonlinear") :
    getNum("factorMotor");
  row.cells[8].querySelector("input").value = factor;
  runAll();
}

function readRows() {
  return [...$("loadBody").querySelectorAll("tr")].map((r) => ({
    name: r.cells[0].querySelector("input").value,
    preset: r.cells[1].querySelector("select").value,
    type: r.cells[2].querySelector("select").value,
    vll: Number(r.cells[3].querySelector("input").value || 0),
    ph: Number(r.cells[4].querySelector("input").value || 3),
    current: Number(r.cells[5].querySelector("input").value || 0),
    pf: Number(r.cells[6].querySelector("input").value || 1),
    demand: Number(r.cells[7].querySelector("input").value || 1),
    factor: Number(r.cells[8].querySelector("input").value || 1),
    ride: r.cells[9].querySelector("select").value,
    restart: r.cells[10].querySelector("select").value,
    length: Number(r.cells[11].querySelector("input").value || 0),
    notes: r.cells[12].querySelector("input").value
  }));
}

function clearRows() {
  $("loadBody").innerHTML = "";
}

function drawBarChart(canvasId, labels, values, colors, title) {
  const canvas = $(canvasId);
  const ctx = canvas.getContext("2d");
  const width = canvas.clientWidth || 500;
  const height = canvas.clientHeight || 220;
  canvas.width = width;
  canvas.height = height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0c1824";
  ctx.fillRect(0, 0, width, height);

  const pad = { l: 48, r: 18, t: 28, b: 54 };
  const chartW = width - pad.l - pad.r;
  const chartH = height - pad.t - pad.b;
  const max = Math.max(1, ...values) * 1.15;

  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.fillStyle = "#9fb0bf";
  ctx.font = "12px Inter";
  for (let i = 0; i <= 5; i++) {
    const y = pad.t + chartH - chartH * i / 5;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(width - pad.r, y);
    ctx.stroke();
    ctx.fillText((max * i / 5).toFixed(0), 8, y + 4);
  }

  const gap = 14;
  const bw = (chartW - gap * (values.length + 1)) / Math.max(values.length, 1);

  values.forEach((v, i) => {
    const x = pad.l + gap + i * (bw + gap);
    const barH = (v / max) * chartH;
    const y = pad.t + chartH - barH;
    ctx.fillStyle = colors[i] || "#54b6ff";
    ctx.fillRect(x, y, bw, barH);
    ctx.fillStyle = "#ebf2f8";
    ctx.textAlign = "center";
    ctx.fillText(v.toFixed(1), x + bw / 2, y - 6);

    ctx.save();
    ctx.translate(x + bw / 2, height - 18);
    ctx.rotate(-0.35);
    ctx.textAlign = "right";
    ctx.fillText(labels[i], 0, 0);
    ctx.restore();
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "#ebf2f8";
  ctx.font = "bold 14px Inter";
  ctx.fillText(title, pad.l, 18);
}

function buildBOM(selected, conductor, ocpd, rmc, modeText, rows) {
  const rideCount = rows.filter((r) => r.ride === "Yes").length;
  const restartCount = rows.filter((r) => r.ride === "Yes" && r.restart === "Yes").length;

  return `
    <ol>
      <li>1 x UPS frame placeholder: ${selected ? `${selected} kVA` : "check larger / parallel arrangement"}</li>
      <li>1 x Main bypass / maintenance bypass arrangement per project one-line</li>
      <li>Input feeder screening: ${conductor.parallel} x ${conductor.size} Cu per phase</li>
      <li>Output feeder screening: ${conductor.parallel} x ${conductor.size} Cu per phase</li>
      <li>Bypass feeder screening: verify separately on final one-line</li>
      <li>1 x Protective device family placeholder: ${ocpd} A</li>
      <li>1 x Battery option A: VRLA</li>
      <li>1 x Battery option B: LTO</li>
      <li>1 x Grounding / bonding package</li>
      <li>1 x Monitoring / controls package</li>
      <li>Ride-through rows included: ${rideCount}</li>
      <li>Restart-on-battery rows included: ${restartCount}</li>
      <li>${modeText}</li>
      <li>Rigid conduit planning placeholder: ${rmc.trade}</li>
    </ol>
  `;
}

function runAll() {
  const rows = readRows();
  const spare = getNum("spareFactor");
  const systemVoltage = getNum("systemVoltage");
  const continuous = getNum("continuousFactor");

  let baseKVA = 0;
  let baseKW = 0;
  let designKVA = 0;
  let designKW = 0;
  let linear = 0;
  let nonlinear = 0;
  let motor = 0;
  let restartCount = 0;

  rows.forEach((r) => {
    if (r.ride !== "Yes") return;
    const kva = threePhaseKVA(r.vll, r.current) * r.demand;
    const kw = kva * r.pf;
    const adjKva = kva * r.factor;
    const adjKw = kw * r.factor;

    baseKVA += kva;
    baseKW += kw;
    designKVA += adjKva;
    designKW += adjKw;

    if (r.type === "linear") linear += adjKva;
    if (r.type === "nonlinear") nonlinear += adjKva;
    if (r.type === "motor") motor += adjKva;
    if (r.restart === "Yes") restartCount += 1;
  });

  designKVA *= spare;
  designKW *= spare;

  const selected = nextG9000(designKVA);
  const upsAmps = selected ? frameCurrent(selected, systemVoltage) : 0;
  const designAmps = designKVA > 0 ? frameCurrent(designKVA, systemVoltage) : 0;
  const ocpd = selected ? roundOCPD(upsAmps * continuous) : 0;
  const conductor = selected ? chooseConductor(ocpd) : { parallel: 0, size: "—", amp: 0, area: 0 };
  const egc = selected ? chooseEGC(ocpd) : "—";
  const rmc = selected ? chooseRMC(conductor, $("includeGround").value === "Yes") : { trade: "—" };

  $("kpiBase").textContent = `${fmt(baseKVA)} kVA`;
  $("kpiBaseKw").textContent = `${fmt(baseKW)} kW`;
  $("kpiDesign").textContent = `${fmt(designKVA)} kVA`;
  $("kpiDesignKw").textContent = `${fmt(designKW)} kW`;
  $("kpiUps").textContent = selected ? `${selected} kVA` : "Above standard range";
  $("kpiUpsAmps").textContent = selected ? `${fmt(upsAmps)} A full-frame output` : "Consider larger / parallel";

  const mode = $("batteryMode").value;
  const eff = getNum("upsEff");

  const vrlaReq = batteryRequiredKWh(designKW, getNum("targetRuntimeMin"), eff, getNum("vrlaUsable"), getNum("vrlaAging"), getNum("vrlaReserve"));
  const ltoReq = batteryRequiredKWh(designKW, getNum("targetRuntimeMin"), eff, getNum("ltoUsable"), getNum("ltoAging"), getNum("ltoReserve"));

  const vrlaRun = runtimeFromBatteryKWh(getNum("availableBatteryKwh"), designKW, eff, getNum("vrlaUsable"), getNum("vrlaAging"), getNum("vrlaReserve"));
  const ltoRun = runtimeFromBatteryKWh(getNum("availableBatteryKwh"), designKW, eff, getNum("ltoUsable"), getNum("ltoAging"), getNum("ltoReserve"));

  let modeText = "";

  if (mode === "runtimeToBattery") {
    $("kpiBattery").textContent = `${fmt(vrlaReq)} / ${fmt(ltoReq)} kWh`;
    $("kpiBatterySub").textContent = `VRLA / LTO required stored energy`;
    modeText = `Battery target sizing mode. VRLA ≈ ${fmt(vrlaReq)} kWh, LTO ≈ ${fmt(ltoReq)} kWh.`;
    $("batterySummary").innerHTML = `
      VRLA required energy: <strong>${fmt(vrlaReq)} kWh</strong><br>
      LTO required energy: <strong>${fmt(ltoReq)} kWh</strong><br>
      Result reflects usable, aging, reserve, and UPS efficiency assumptions.
    `;
  } else {
    $("kpiBattery").textContent = `${fmt(vrlaRun)} / ${fmt(ltoRun)} min`;
    $("kpiBatterySub").textContent = `VRLA / LTO runtime`;
    modeText = `Battery runtime mode with available installed energy = ${fmt(getNum("availableBatteryKwh"))} kWh.`;
    $("batterySummary").innerHTML = `
      VRLA runtime: <strong>${fmt(vrlaRun)} min</strong><br>
      LTO runtime: <strong>${fmt(ltoRun)} min</strong><br>
      Available installed energy entered: ${fmt(getNum("availableBatteryKwh"))} kWh.
    `;
  }

  const loadingPct = selected ? designKVA / selected * 100 : 0;
  let dominant = "linear";
  if (nonlinear >= linear && nonlinear >= motor) dominant = "nonlinear";
  if (motor >= linear && motor >= nonlinear) dominant = "motor";

  let narrative = "";
  if (!selected) {
    narrative = `The adjusted design load is ${fmt(designKVA)} kVA, which is above the standard frame table used on this page. Consider a larger platform or a parallel UPS arrangement.`;
  } else {
    narrative = `The selected frame is ${selected} kVA because the adjusted design load is ${fmt(designKVA)} kVA, which places the frame at about ${fmt(loadingPct)}% loading. `;
    narrative += dominant === "nonlinear"
      ? `Nonlinear load content is the dominant driver, so waveform-related overhead is materially affecting the recommendation. `
      : dominant === "motor"
      ? `Motor / inductive content is the dominant driver, so dynamic behavior and restart sensitivity deserve extra margin. `
      : `The load mix is mostly linear, so the recommendation tracks more directly with the entered load schedule. `;
    if (restartCount > 0) {
      narrative += `${restartCount} load row(s) are marked for restart on battery, which is a flag for additional transient review before final design. `;
    }
    if (loadingPct > 90) {
      narrative += `This is a relatively hard-loaded frame; checking the next size up may be worthwhile if uncertainty or growth is meaningful.`;
    } else if (loadingPct < 60) {
      narrative += `This leaves significant room; assumptions could be tightened later if cost optimization becomes a priority.`;
    } else {
      narrative += `This is a reasonable concept-level loading range.`;
    }
  }

  $("decisionNarrative").textContent = narrative;

  $("frameTable").innerHTML = STANDARD_G9000.map((k) => {
    const pct = designKVA > 0 ? designKVA / k * 100 : 0;
    return `${k} kVA frame: ${fmt(pct)}% loaded, full-frame current ≈ ${fmt(frameCurrent(k, systemVoltage))} A`;
  }).join("<br>");

  $("feederSummary").innerHTML = selected
    ? `
      <strong>Recommended frame:</strong> ${selected} kVA<br>
      <strong>Design load current:</strong> ${fmt(designAmps)} A<br>
      <strong>Frame full-load current:</strong> ${fmt(upsAmps)} A<br>
      <strong>Preliminary OCPD basis:</strong> ${fmt(upsAmps * continuous)} A → ${ocpd} A screening value<br>
      <strong>Preliminary conductor:</strong> ${conductor.parallel} x ${conductor.size} Cu per phase<br>
      <strong>Preliminary EGC:</strong> ${egc}<br>
      <strong>Preliminary rigid conduit:</strong> ${rmc.trade}<br>
      <strong>Note:</strong> final conductor, OCPD, and conduit still require code, ambient, termination, derating, and manufacturer review.
    `
    : `Adjusted design load is above the standard frame list used by this page.`;

  $("bomOutput").innerHTML = buildBOM(selected, conductor, ocpd, rmc, modeText, rows);

  drawBarChart(
    "upsChart",
    STANDARD_G9000.map((k) => `${k} kVA`),
    STANDARD_G9000.map((k) => designKVA > 0 ? designKVA / k * 100 : 0),
    STANDARD_G9000.map((k) => {
      const pct = designKVA > 0 ? designKVA / k * 100 : 0;
      return pct > 90 ? "#ff7f7f" : pct > 75 ? "#f4c86a" : "#69e3b0";
    }),
    "Adjusted load as % of standard frame"
  );

  drawBarChart(
    "batteryChart",
    mode === "runtimeToBattery" ? ["VRLA kWh", "LTO kWh"] : ["VRLA min", "LTO min"],
    mode === "runtimeToBattery" ? [vrlaReq, ltoReq] : [vrlaRun, ltoRun],
    ["#54b6ff", "#69e3b0"],
    mode === "runtimeToBattery" ? "Required battery energy" : "Expected runtime"
  );

  drawBarChart(
    "loadChart",
    ["Linear", "Nonlinear", "Motor"],
    [linear, nonlinear, motor],
    ["#7be49b", "#54b6ff", "#f4c86a"],
    "Adjusted kVA by load type"
  );

  persistState();
}

function collectState() {
  return {
    projectName: $("projectName").value,
    engineerName: $("engineerName").value,
    systemVoltage: getNum("systemVoltage"),
    systemFreq: getNum("systemFreq"),
    systemPhases: getNum("systemPhases"),
    batteryMode: $("batteryMode").value,
    targetRuntimeMin: getNum("targetRuntimeMin"),
    availableBatteryKwh: getNum("availableBatteryKwh"),
    upsEff: getNum("upsEff"),
    spareFactor: getNum("spareFactor"),
    continuousFactor: getNum("continuousFactor"),
    includeGround: $("includeGround").value,
    factorLinear: getNum("factorLinear"),
    factorNonlinear: getNum("factorNonlinear"),
    factorMotor: getNum("factorMotor"),
    vrlaUsable: getNum("vrlaUsable"),
    vrlaAging: getNum("vrlaAging"),
    vrlaReserve: getNum("vrlaReserve"),
    ltoUsable: getNum("ltoUsable"),
    ltoAging: getNum("ltoAging"),
    ltoReserve: getNum("ltoReserve"),
    loads: readRows()
  };
}

function persistState() {
  const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const payload = collectState();
  const next = [payload, ...existing.filter((x) => x.projectName !== payload.projectName)].slice(0, 25);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  $("savedCount").textContent = String(next.length);
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(collectState(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ups-sizing-inputs.json";
  a.click();
}

function downloadReport() {
  const rows = readRows();
  let baseKVA = 0;
  let baseKW = 0;
  let designKVA = 0;
  let designKW = 0;

  rows.forEach((r) => {
    if (r.ride !== "Yes") return;
    const kva = threePhaseKVA(r.vll, r.current) * r.demand;
    const kw = kva * r.pf;
    baseKVA += kva;
    baseKW += kw;
    designKVA += kva * r.factor;
    designKW += kw * r.factor;
  });

  designKVA *= getNum("spareFactor");
  designKW *= getNum("spareFactor");

  const selected = nextG9000(designKVA);
  const md = `# ${$("projectName").value}

## Basis
- Engineer: ${$("engineerName").value}
- System voltage: ${getNum("systemVoltage")} V
- Frequency: ${getNum("systemFreq")} Hz
- Phases: ${getNum("systemPhases")}
- Battery mode: ${$("batteryMode").value}

## Summary
- Base load: ${fmt(baseKVA)} kVA / ${fmt(baseKW)} kW
- Adjusted design load: ${fmt(designKVA)} kVA / ${fmt(designKW)} kW
- Recommended frame: ${selected ? `${selected} kVA` : "Above listed standard frame table"}

## Equations
- S = √3 × V × I / 1000
- P = S × PF
- E_batt = (P × t / η) × aging × reserve / usable

## Load Schedule
| Name | Type | VLL | A | PF | Demand | Factor | Ride Through | Restart on Battery | Notes |
|---|---:|---:|---:|---:|---:|---:|---|---|---|
${rows.map((r) => `| ${r.name} | ${r.type} | ${r.vll} | ${r.current} | ${r.pf} | ${r.demand} | ${r.factor} | ${r.ride} | ${r.restart} | ${r.notes} |`).join("\n")}
`;

  const blob = new Blob([md], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ups-sizing-report.md";
  a.click();
}

function loadSample() {
  clearRows();
  [
    { name: "Server Room Panel A", preset: "Server Room Panel", type: "nonlinear", vll: 480, ph: 3, current: 140, pf: 0.98, demand: 0.90, factor: 1.15, ride: "Yes", restart: "No", length: 140, notes: "critical IT" },
    { name: "Server Room Panel B", preset: "Server Room Panel", type: "nonlinear", vll: 480, ph: 3, current: 120, pf: 0.98, demand: 0.90, factor: 1.15, ride: "Yes", restart: "No", length: 150, notes: "critical IT" },
    { name: "Cooling VFD 1", preset: "VFD Input", type: "nonlinear", vll: 480, ph: 3, current: 95, pf: 0.95, demand: 1.00, factor: 1.12, ride: "Yes", restart: "No", length: 180, notes: "cooling" },
    { name: "Pump Motor Group", preset: "Motor Group", type: "motor", vll: 480, ph: 3, current: 80, pf: 0.85, demand: 1.00, factor: 1.20, ride: "Yes", restart: "No", length: 210, notes: "inductive" },
    { name: "Lighting Panel", preset: "Lighting Panel", type: "linear", vll: 480, ph: 3, current: 45, pf: 0.95, demand: 0.90, factor: 1.00, ride: "Yes", restart: "No", length: 120, notes: "critical lighting" }
  ].forEach(addRow);
  runAll();
}

function init() {
  $("calcBtn").addEventListener("click", runAll);
  $("sampleBtn").addEventListener("click", loadSample);
  $("clearBtn").addEventListener("click", () => { clearRows(); runAll(); });
  $("addRowBtn").addEventListener("click", () => addRow());
  $("exportJsonBtn").addEventListener("click", exportJSON);
  $("downloadReportBtn").addEventListener("click", downloadReport);

  [
    "batteryMode", "targetRuntimeMin", "availableBatteryKwh", "upsEff", "spareFactor", "continuousFactor",
    "factorLinear", "factorNonlinear", "factorMotor",
    "vrlaUsable", "vrlaAging", "vrlaReserve",
    "ltoUsable", "ltoAging", "ltoReserve",
    "systemVoltage", "includeGround"
  ].forEach((id) => $(id).addEventListener("input", runAll));

  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  $("savedCount").textContent = String(saved.length);

  loadSample();
}

window.addEventListener("resize", runAll);
window.addEventListener("DOMContentLoaded", init);
