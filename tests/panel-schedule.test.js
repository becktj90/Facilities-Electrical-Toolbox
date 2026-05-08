const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadPanelScheduleApi() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'panel-schedule.js'), 'utf8');
  const sandbox = {
    window: {
      __ENABLE_PANEL_SCHEDULE_TEST_API__: true,
      addEventListener: () => {},
      print: () => {}
    },
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => []
    },
    URL: {
      revokeObjectURL: () => {},
      createObjectURL: () => 'blob:mock'
    },
    console,
    Date,
    Math,
    Number,
    String,
    Array,
    Set,
    RegExp
  };

  vm.runInNewContext(source, sandbox, { filename: 'panel-schedule.js' });
  assert.ok(sandbox.window.__panelScheduleTestApi, 'Expected panel schedule test API to be exposed');
  return sandbox.window.__panelScheduleTestApi;
}

const api = loadPanelScheduleApi();

test('parseScheduleText extracts metadata and rows while ignoring headers', () => {
  const input = [
    'Panel Name: LP-1',
    'Voltage: 480Y/277V',
    'Feed: MDP-1',
    'Date: 04/02/2026',
    'Circuit Description Trip Poles',
    '1 | Lighting East Wing | 20A | 1P',
    '3 | AHU-1 | 30A-2P',
    '5 Reception 20A 1P'
  ].join('\n');

  const parsed = api.parseScheduleText(input);

  assert.deepEqual(toPlain(parsed.meta), {
    panelName: 'LP-1',
    voltage: '480Y/277V',
    feed: 'MDP-1',
    date: '04/02/2026'
  });
  assert.equal(parsed.rows.length, 3);
  assert.deepEqual(toPlain(parsed.rows[0]), {
    circuit: '1',
    description: 'Lighting East Wing',
    trip: '20A',
    poles: '1'
  });
  assert.deepEqual(toPlain(parsed.rows[1]), {
    circuit: '3',
    description: 'AHU-1',
    trip: '30A',
    poles: '2'
  });
  assert.deepEqual(toPlain(parsed.rows[2]), {
    circuit: '5',
    description: 'Reception',
    trip: '20A',
    poles: '1'
  });
});

test('parseScheduleText splits dual-circuit lines and de-duplicates repeated rows', () => {
  const input = [
    '1 | Lighting East Wing | 20A | 1P | 2 | Receptacles North | 20A | 1P',
    '1 | Lighting | 20A | 1P'
  ].join('\n');

  const parsed = api.parseScheduleText(input);

  assert.equal(parsed.rows.length, 3);
  assert.deepEqual(toPlain(parsed.rows.map(row => row.circuit)), ['1', '1', '2']);
});

test('parseColumnsToRow handles compact and separated trip/pole formats', () => {
  assert.deepEqual(
    toPlain(api.parseColumnsToRow(['7', 'Elevator', '40A-3P'])),
    { circuit: '7', description: 'Elevator', trip: '40A', poles: '3' }
  );

  assert.deepEqual(
    toPlain(api.parseColumnsToRow(['8', 'Pump', '50A', '2P'])),
    { circuit: '8', description: 'Pump', trip: '50A', poles: '2' }
  );

  assert.equal(api.parseColumnsToRow(['NotACircuit', 'Bad']), null);
});

test('normalizeRows canonicalizes values and sorts by first circuit number', () => {
  const rows = toPlain(api.normalizeRows([
    { circuit: 'AUX', description: 'Aux', trip: '15', poles: '1P' },
    { circuit: '10a', description: '  Motor  ', trip: '30', poles: '2P' },
    { circuit: '2', description: 'Lights', trip: '20a', poles: '1' }
  ]));

  assert.deepEqual(rows.map(row => row.circuit), ['2', '10A', 'AUX']);
  assert.equal(rows[1].trip, '30A');
  assert.equal(rows[1].description, 'Motor');
  assert.equal(rows[1].poles, '2');
});

test('buildCircuitSlots preserves in-range circuit placement and fills overflow slots', () => {
  const slots = toPlain(api.buildCircuitSlots([
    { circuit: '1', description: 'Lighting', trip: '20A', poles: '1' },
    { circuit: '50', description: 'Overflow Named', trip: '30A', poles: '2' },
    { circuit: '', description: 'Overflow Blank Circuit', trip: '15A', poles: '1' },
    { circuit: '2', description: 'Receptacles', trip: '20A', poles: '1' }
  ]));

  assert.equal(slots[1].description, 'Lighting');
  assert.equal(slots[2].description, 'Receptacles');
  assert.equal(slots[3].description, 'Overflow Named');
  assert.equal(slots[3].circuit, '50');
  assert.equal(slots[4].description, 'Overflow Blank Circuit');
  assert.equal(slots[4].circuit, '4');
});

test('humanizeStatus maps OCR statuses and provides default text', () => {
  assert.equal(api.humanizeStatus('recognizing text'), 'Reading schedule text…');
  assert.equal(api.humanizeStatus('loading language traineddata'), 'Loading OCR language pack…');
  assert.equal(api.humanizeStatus('initializing api'), 'Initializing OCR engine…');
  assert.equal(api.humanizeStatus('initializing tesseract'), 'Starting Tesseract.js…');
  assert.equal(api.humanizeStatus('other status'), 'other status');
  assert.equal(api.humanizeStatus(''), 'Processing…');
});
