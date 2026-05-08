const MAX_CIRCUIT_SLOTS = 42;
const PRINT_ROW_PAIRS = MAX_CIRCUIT_SLOTS / 2;

const state = {
  file: null,
  imageUrl: '',
  rows: [],
  rawText: ''
};

const elements = {};

window.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  seedRows(MAX_CIRCUIT_SLOTS);
  renderAll();
});

function cacheElements() {
  elements.imageInput = document.getElementById('imageInput');
  elements.processButton = document.getElementById('processButton');
  elements.resetButton = document.getElementById('resetButton');
  elements.dropZone = document.getElementById('dropZone');
  elements.statusText = document.getElementById('statusText');
  elements.fileName = document.getElementById('fileName');
  elements.progressFill = document.getElementById('progressFill');
  elements.progressLabel = document.getElementById('progressLabel');
  elements.imagePreview = document.getElementById('imagePreview');
  elements.previewPlaceholder = document.getElementById('previewPlaceholder');
  elements.previewFrame = document.querySelector('.preview-frame');
  elements.rawText = document.getElementById('rawText');
  elements.panelName = document.getElementById('panelName');
  elements.panelVoltage = document.getElementById('panelVoltage');
  elements.panelFeed = document.getElementById('panelFeed');
  elements.panelDate = document.getElementById('panelDate');
  elements.parseTextButton = document.getElementById('parseTextButton');
  elements.addRowButton = document.getElementById('addRowButton');
  elements.fillSlotsButton = document.getElementById('fillSlotsButton');
  elements.editorTableBody = document.getElementById('editorTableBody');
  elements.printButton = document.getElementById('printButton');
  elements.sheetPanelName = document.getElementById('sheetPanelName');
  elements.sheetVoltage = document.getElementById('sheetVoltage');
  elements.sheetFeed = document.getElementById('sheetFeed');
  elements.sheetDate = document.getElementById('sheetDate');
  elements.printScheduleBody = document.getElementById('printScheduleBody');
}

function bindEvents() {
  elements.imageInput.addEventListener('change', event => {
    const [file] = event.target.files || [];
    handleFileSelection(file);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    elements.dropZone.addEventListener(eventName, event => {
      event.preventDefault();
      elements.dropZone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    elements.dropZone.addEventListener(eventName, event => {
      event.preventDefault();
      elements.dropZone.classList.remove('is-dragover');
    });
  });

  elements.dropZone.addEventListener('drop', event => {
    const [file] = event.dataTransfer?.files || [];
    handleFileSelection(file);
  });

  elements.processButton.addEventListener('click', runOcr);
  elements.resetButton.addEventListener('click', resetApp);
  elements.printButton.addEventListener('click', handlePrint);
  elements.parseTextButton.addEventListener('click', handleParseText);
  elements.addRowButton.addEventListener('click', () => {
    state.rows.push(createEmptyRow());
    renderAll();
  });
  elements.fillSlotsButton.addEventListener('click', () => {
    seedRows(MAX_CIRCUIT_SLOTS);
    renderAll();
    setStatus('Seeded 42 editable circuit rows for manual entry.');
  });

  [elements.panelName, elements.panelVoltage, elements.panelFeed, elements.panelDate].forEach(input => {
    input.addEventListener('input', renderPrintSheet);
  });
}

function handleFileSelection(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('Please choose a valid image file.');
    return;
  }

  if (state.imageUrl) {
    URL.revokeObjectURL(state.imageUrl);
  }

  state.file = file;
  state.imageUrl = URL.createObjectURL(file);
  elements.imagePreview.src = state.imageUrl;
  elements.previewFrame.classList.add('has-image');
  elements.fileName.textContent = file.name;
  elements.processButton.disabled = false;
  resetProgress();
  setStatus('Image ready. Click “Read Schedule” to run OCR.');
}

async function runOcr() {
  if (!state.file) {
    setStatus('Upload an image before starting OCR.');
    return;
  }

  if (!window.Tesseract) {
    setStatus('Tesseract.js failed to load. Check your network connection and try again.');
    return;
  }

  elements.processButton.disabled = true;
  updateProgress(0, 'Starting OCR…');

  let worker;
  try {
    worker = await Tesseract.createWorker('eng', 1, {
      logger: message => {
        const ratio = typeof message.progress === 'number' ? message.progress : 0;
        updateProgress(ratio, humanizeStatus(message.status));
      }
    });

    const result = await worker.recognize(state.file);
    const text = result?.data?.text || '';
    state.rawText = text;
    elements.rawText.value = text;
    parseAndApplyText(text, true);
    updateProgress(1, 'OCR complete. Review the preview grid before printing.');
  } catch (error) {
    console.error(error);
    setStatus('OCR failed. Try a sharper image or edit the text manually.');
    updateProgress(0, 'OCR failed');
  } finally {
    if (worker) {
      await worker.terminate();
    }
    elements.processButton.disabled = false;
  }
}

function parseAndApplyText(text, allowMetadataFill) {
  const parsed = parseScheduleText(text || '');
  if (allowMetadataFill) {
    applyMetadataIfBlank(parsed.meta);
  }

  if (parsed.rows.length) {
    state.rows = parsed.rows;
    setStatus(`Parsed ${parsed.rows.length} circuit row${parsed.rows.length === 1 ? '' : 's'}. Correct any OCR misreads before printing.`);
  } else {
    setStatus('No clear circuit rows were detected. Edit the OCR text or enter rows manually below.');
  }

  renderAll();
}

function parseScheduleText(text) {
  const rawLines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map(cleanLine)
    .filter(line => line.trim());
  const lines = rawLines.map(compactLine);

  const meta = extractMetadata(lines, text);
  const rows = [];
  const seen = new Set();

  rawLines.forEach(line => {
    const compact = compactLine(line);
    if (isIgnoredLine(compact)) {
      return;
    }

    const columns = splitColumns(line);
    if (columns.length >= 6) {
      const splitIndex = findSecondaryCircuitIndex(columns);
      if (splitIndex > 0) {
        [columns.slice(0, splitIndex), columns.slice(splitIndex)].forEach(group => {
          const row = parseColumnsToRow(group);
          pushUniqueRow(row, rows, seen);
        });
        return;
      }
    }

    if (columns.length >= 3) {
      pushUniqueRow(parseColumnsToRow(columns), rows, seen);
      return;
    }

    pushUniqueRow(parseFreeformRow(compact), rows, seen);
  });

  return { meta, rows: normalizeRows(rows) };
}

function cleanLine(line) {
  return line
    .replace(/[|]+/g, ' | ')
    .replace(/[•·]/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function compactLine(line) {
  return line.replace(/\s+/g, ' ').trim();
}

function splitColumns(line) {
  if (!line) {
    return [];
  }

  if (line.includes('|')) {
    return line.split('|').map(part => part.trim()).filter(Boolean);
  }

  return line
    .split(/\t+|\s{2,}/)
    .map(part => part.trim())
    .filter(Boolean);
}

function isIgnoredLine(line) {
  return /^(panel schedule|branch circuits?|circuit directory|load summary|notes?)$/i.test(line)
    || /(ckt|circuit).*(load|description)/i.test(line)
    || /(trip|amps?).*(poles?)/i.test(line)
    || /^odd\s+even$/i.test(line)
    || isPanelMetadataLine(line);
}

function looksLikeCircuit(value) {
  return /^\d+[A-Z]?(?:[-/,]\d+[A-Z]?)*$/.test(String(value).replace(/\s+/g, '').toUpperCase());
}

function looksLikeTrip(value) {
  return /^\d+(?:\.\d+)?\s*(?:A|AMP|AMPS)?$/i.test(String(value).trim());
}

function looksLikePoles(value) {
  return /^(?:[123]|1P|2P|3P)$/i.test(String(value).trim());
}

function isPanelMetadataLine(line) {
  return /^panel\b/i.test(line) && !looksLikeCircuit(line.split(' ')[0]);
}

function findSecondaryCircuitIndex(columns) {
  for (let index = 2; index < columns.length - 1; index += 1) {
    const candidate = columns[index];
    const previous = columns[index - 1] || '';
    if (
      looksLikeCircuit(candidate)
      && !/P$/i.test(String(candidate).trim())
      && (looksLikeTrip(previous) || looksLikePoles(previous))
    ) {
      return index;
    }
  }
  return -1;
}

function parseColumnsToRow(columns) {
  if (!columns.length || !looksLikeCircuit(columns[0])) {
    return null;
  }

  const row = createEmptyRow();
  row.circuit = normalizeCircuit(columns[0]);

  const trailing = [...columns.slice(1)];
  const compactMatch = trailing.length
    ? trailing[trailing.length - 1].match(/^(\d+(?:\.\d+)?)\s*(?:A|AMP|AMPS)?\s*[/\\-]\s*([123])P?$/i)
    : null;

  if (compactMatch) {
    row.trip = `${compactMatch[1]}A`;
    row.poles = compactMatch[2];
    trailing.pop();
  } else {
    if (trailing.length && looksLikePoles(trailing[trailing.length - 1])) {
      row.poles = trailing.pop().replace(/P/i, '');
    }
    if (trailing.length && looksLikeTrip(trailing[trailing.length - 1])) {
      row.trip = normalizeTrip(trailing.pop());
    }
  }

  row.description = trailing.join(' ').trim();

  if (!row.description && (!row.trip || !row.poles)) {
    return null;
  }

  return row;
}

function parseFreeformRow(line) {
  const match = line.match(/^(\d+[A-Z]?(?:[-/,]\d+[A-Z]?)*)\s+(.+?)\s+(\d+(?:\.\d+)?)\s*(?:A|AMP|AMPS)?\s+([123])P?$/i);
  if (!match) {
    return null;
  }

  return {
    circuit: normalizeCircuit(match[1]),
    description: match[2].trim(),
    trip: `${match[3]}A`,
    poles: match[4]
  };
}

function pushUniqueRow(row, rows, seen) {
  if (!row) {
    return;
  }

  const signature = `${row.circuit}|${row.description}|${row.trip}|${row.poles}`.toUpperCase();
  if (seen.has(signature)) {
    return;
  }

  seen.add(signature);
  rows.push(row);
}

function normalizeRows(rows) {
  return rows
    .map(row => ({
      circuit: normalizeCircuit(row.circuit),
      description: String(row.description || '').trim(),
      trip: normalizeTrip(row.trip),
      poles: String(row.poles || '').replace(/P/i, '').trim()
    }))
    .filter(row => row.circuit || row.description || row.trip || row.poles)
    .sort(compareCircuitRows);
}

function compareCircuitRows(a, b) {
  const aNum = firstCircuitNumber(a.circuit);
  const bNum = firstCircuitNumber(b.circuit);
  if (aNum === bNum) {
    return a.circuit.localeCompare(b.circuit, undefined, { numeric: true, sensitivity: 'base' });
  }
  if (aNum === Number.MAX_SAFE_INTEGER) {
    return 1;
  }
  if (bNum === Number.MAX_SAFE_INTEGER) {
    return -1;
  }
  return aNum - bNum;
}

function normalizeCircuit(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, '');
}

function normalizeTrip(value) {
  const cleaned = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) {
    return '';
  }
  return /A$/.test(cleaned) ? cleaned : `${cleaned}A`;
}

function firstCircuitNumber(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function extractMetadata(lines, rawText) {
  const joined = rawText.replace(/\r/g, '\n');
  return {
    panelName: findMetadata(lines, [/panel\s*(?:name|board)?\s*[:\-]?\s*(.+)/i]),
    voltage: findMetadata(lines, [/voltage\s*[:\-]?\s*(.+)/i, /(\d{2,4}(?:Y)?\s*\/\s*\d{2,4}\s*V?)/i, /(\d{3,4}\s*V)/i]),
    feed: findMetadata(lines, [/feed(?:er)?\s*[:\-]?\s*(.+)/i, /mains?\s*[:\-]?\s*(.+)/i]),
    date: findMetadata(lines, [/date\s*[:\-]?\s*(.+)/i, /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/, /([A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4})/])
  };
}

function findMetadata(lines, patterns) {
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }
  return '';
}

function applyMetadataIfBlank(meta) {
  if (meta.panelName && !elements.panelName.value.trim()) {
    elements.panelName.value = meta.panelName;
  }
  if (meta.voltage && !elements.panelVoltage.value.trim()) {
    elements.panelVoltage.value = meta.voltage;
  }
  if (meta.feed && !elements.panelFeed.value.trim()) {
    elements.panelFeed.value = meta.feed;
  }
  if (meta.date && !elements.panelDate.value.trim()) {
    elements.panelDate.value = meta.date;
  }
}

function renderAll() {
  renderEditorTable();
  renderPrintSheet();
}

function renderEditorTable() {
  const rows = state.rows.length ? state.rows : [createEmptyRow()];

  elements.editorTableBody.innerHTML = rows.map((row, index) => `
      <tr>
      <td><input type="text" data-field="circuit" data-index="${index}" value="${escapeHtml(row.circuit)}" placeholder="1"></td>
      <td><input type="text" data-field="description" data-index="${index}" value="${escapeHtml(row.description)}" placeholder="Lighting"></td>
      <td><input type="text" data-field="trip" data-index="${index}" value="${escapeHtml(row.trip)}" placeholder="20A"></td>
      <td>
        <select data-field="poles" data-index="${index}">
          <option value="" ${row.poles ? '' : 'selected'}>—</option>
          <option value="1" ${row.poles === '1' ? 'selected' : ''}>1</option>
          <option value="2" ${row.poles === '2' ? 'selected' : ''}>2</option>
          <option value="3" ${row.poles === '3' ? 'selected' : ''}>3</option>
        </select>
      </td>
      <td><button class="btn btn-row-delete" type="button" data-delete-index="${index}">Delete</button></td>
    </tr>
  `).join('');

  elements.editorTableBody.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('input', handleRowEdit);
    input.addEventListener('change', handleRowEdit);
  });

  elements.editorTableBody.querySelectorAll('[data-delete-index]').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.deleteIndex);
      state.rows.splice(index, 1);
      renderAll();
    });
  });
}

function handleRowEdit(event) {
  const index = Number(event.target.dataset.index);
  const field = event.target.dataset.field;
  if (!state.rows[index]) {
    state.rows[index] = createEmptyRow();
  }

  if (field === 'circuit') {
    state.rows[index][field] = normalizeCircuit(event.target.value);
  } else if (field === 'trip') {
    state.rows[index][field] = normalizeTrip(event.target.value);
  } else {
    state.rows[index][field] = String(event.target.value || '').trim();
  }

  renderPrintSheet();
}

function renderPrintSheet() {
  elements.sheetPanelName.textContent = elements.panelName.value.trim() || 'Untitled Panel';
  elements.sheetVoltage.textContent = elements.panelVoltage.value.trim() || '—';
  elements.sheetFeed.textContent = elements.panelFeed.value.trim() || '—';
  elements.sheetDate.textContent = elements.panelDate.value.trim() || defaultPrintDate();

  const slots = buildCircuitSlots(state.rows);
  const bodyRows = [];

  for (let pair = 0; pair < PRINT_ROW_PAIRS; pair += 1) {
    const left = slots[pair * 2 + 1] || createPlaceholderRow(pair * 2 + 1);
    const right = slots[pair * 2 + 2] || createPlaceholderRow(pair * 2 + 2);
    bodyRows.push(`
      <tr>
        ${renderPrintCell(left.circuit, 'circuit')}
        ${renderPrintCell(left.description, 'description')}
        ${renderPrintCell(left.trip, 'trip')}
        ${renderPrintCell(left.poles, 'poles')}
        ${renderPrintCell(right.trip, 'trip')}
        ${renderPrintCell(right.poles, 'poles')}
        ${renderPrintCell(right.description, 'description')}
        ${renderPrintCell(right.circuit, 'circuit')}
      </tr>
    `);
  }

  elements.printScheduleBody.innerHTML = bodyRows.join('');
}

function buildCircuitSlots(rows) {
  const normalized = normalizeRows(rows);
  const slots = {};
  const overflow = [];

  normalized.forEach(row => {
    const slot = firstCircuitNumber(row.circuit);
    if (slot >= 1 && slot <= MAX_CIRCUIT_SLOTS && !slots[slot]) {
      slots[slot] = row;
    } else {
      overflow.push(row);
    }
  });

  overflow.forEach(row => {
    for (let slot = 1; slot <= MAX_CIRCUIT_SLOTS; slot += 1) {
      if (!slots[slot]) {
        slots[slot] = { ...row, circuit: row.circuit || String(slot) };
        break;
      }
    }
  });

  return slots;
}

function renderPrintCell(value, type) {
  const safe = escapeHtml(value || '');
  const text = safe || '&nbsp;';
  const blankClass = safe ? '' : ' blank';
  return `<td class="${type}${blankClass}">${text}</td>`;
}

function createPlaceholderRow(circuit) {
  return { circuit: String(circuit), description: '', trip: '', poles: '' };
}

function createEmptyRow() {
  return { circuit: '', description: '', trip: '', poles: '' };
}

function seedRows(count) {
  const safeCount = Math.max(1, Math.min(MAX_CIRCUIT_SLOTS, Number(count) || MAX_CIRCUIT_SLOTS));
  state.rows = Array.from({ length: safeCount }, (_, index) => ({
    circuit: String(index + 1),
    description: '',
    trip: '',
    poles: ''
  }));
}

function resetApp() {
  if (state.imageUrl) {
    URL.revokeObjectURL(state.imageUrl);
  }

  state.file = null;
  state.imageUrl = '';
  state.rawText = '';
  seedRows(MAX_CIRCUIT_SLOTS);
  elements.imageInput.value = '';
  elements.rawText.value = '';
  elements.panelName.value = '';
  elements.panelVoltage.value = '';
  elements.panelFeed.value = '';
  elements.panelDate.value = '';
  elements.imagePreview.removeAttribute('src');
  elements.previewFrame.classList.remove('has-image');
  elements.fileName.textContent = 'No file selected';
  elements.processButton.disabled = true;
  resetProgress();
  setStatus('Reset complete. Upload a new schedule image to begin again.');
  renderAll();
}

function handleParseText() {
  parseAndApplyText(elements.rawText.value, false);
}

function updateProgress(value, statusMessage) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  elements.progressFill.style.width = `${percent}%`;
  elements.progressLabel.textContent = `${percent}%`;
  if (statusMessage) {
    setStatus(statusMessage);
  }
}

function resetProgress() {
  updateProgress(0);
}

function setStatus(message) {
  elements.statusText.textContent = message;
}

function humanizeStatus(status) {
  if (!status) {
    return 'Processing…';
  }
  return status
    .replace(/recognizing text/i, 'Reading schedule text…')
    .replace(/loading language traineddata/i, 'Loading OCR language pack…')
    .replace(/initializing api/i, 'Initializing OCR engine…')
    .replace(/initializing tesseract/i, 'Starting Tesseract.js…');
}

function defaultPrintDate() {
  return new Date().toLocaleDateString();
}

function handlePrint() {
  if (!state.rows.some(row => row.description || row.trip || row.poles)) {
    setStatus('Add or parse at least one circuit row before printing.');
    return;
  }

  window.print();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

if (typeof window !== 'undefined' && window.__ENABLE_PANEL_SCHEDULE_TEST_API__) {
  window.__panelScheduleTestApi = {
    parseScheduleText,
    splitColumns,
    parseColumnsToRow,
    parseFreeformRow,
    normalizeRows,
    normalizeTrip,
    normalizeCircuit,
    firstCircuitNumber,
    extractMetadata,
    buildCircuitSlots,
    humanizeStatus,
    isIgnoredLine,
    findSecondaryCircuitIndex,
    createEmptyRow,
    createPlaceholderRow
  };
}
