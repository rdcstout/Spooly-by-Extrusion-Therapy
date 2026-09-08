const test = require('node:test');
const assert = require('node:assert/strict');
const { DuetAdapter } = require('../src/adapters/duet');

test('maps a Duet object-model printing state to progress and temperatures', () => {
  const adapter = new DuetAdapter({ id: 'duet3', name: 'Duet 3 Mini' });
  const state = adapter.toPrinterState({
    state: { status: 'processing', currentTool: 0 },
    job: { file: { fileName: 'cube.gcode', size: 100000 }, filePosition: 42600 },
    heat: {
      heaters: [
        { current: 59.8, active: 60, standby: 0, state: 'active' },
        { current: 214.6, active: 215, standby: 0, state: 'active' },
      ],
      bedHeaters: [0],
    },
    tools: [{ heaters: [1], active: [215], standby: [0] }],
    fans: [{ name: 'PART', actualValue: 1, requestedValue: 1, rpm: -1 }],
  });
  assert.equal(state.status, 'printing');
  assert.equal(state.filename, 'cube.gcode');
  assert.equal(state.progress, 42.6);
  assert.equal(state.nozzleTemp, 214.6);
  assert.equal(state.nozzleTarget, 215);
  assert.equal(state.bedTemp, 59.8);
  assert.equal(state.bedTarget, 60);
  assert.deepEqual(state.fans, [{ key: 'fan0', label: 'PART', on: true }]);
});

test('maps a Duet object-model idle state without fabricating progress', () => {
  const adapter = new DuetAdapter({ id: 'duet3', name: 'Duet 3 Mini' });
  const state = adapter.toPrinterState({
    state: { status: 'idle', currentTool: -1 },
    job: { file: null, filePosition: null },
    heat: {
      heaters: [
        { current: 24.1, active: 0, standby: 0, state: 'off' },
        { current: 23.4, active: 0, standby: 0, state: 'off' },
      ],
      bedHeaters: [0],
    },
    tools: [{ heaters: [1], active: [0], standby: [0] }],
    fans: [],
  });
  assert.equal(state.status, 'idle');
  assert.equal(state.filename, '');
  assert.equal(state.progress, null);
  assert.equal(state.nozzleTemp, 23.4);
  assert.equal(state.nozzleTarget, 0);
  assert.equal(state.bedTemp, 24.1);
  assert.equal(state.bedTarget, 0);
  assert.deepEqual(state.fans, []);
});

test('maps a paused Duet job and a halted Duet machine', () => {
  const adapter = new DuetAdapter({ id: 'duet3', name: 'Duet 3 Mini' });
  const paused = adapter.toPrinterState({ state: { status: 'paused', currentTool: -1 }, job: {}, heat: {}, tools: [], fans: [] });
  assert.equal(paused.status, 'paused');

  const halted = adapter.toPrinterState({ state: { status: 'halted', currentTool: -1 }, job: {}, heat: {}, tools: [], fans: [] });
  assert.equal(halted.status, 'error');
  assert.equal(halted.message, 'Machine halted');
});

test('reports filament_out when a Duet filament monitor sees no filament', () => {
  const adapter = new DuetAdapter({ id: 'duet3', name: 'Duet 3 Mini' });
  const state = adapter.toPrinterState({
    state: { status: 'processing', currentTool: 0 },
    job: {},
    heat: { heaters: [], bedHeaters: [] },
    tools: [],
    fans: [],
    sensors: { filamentMonitors: [{ status: 'noFilament' }] },
  });
  assert.equal(state.status, 'filament_out');
  assert.equal(state.message, 'Filament runout reported');
});

test('read() fetches the Duet object model and normalizes it', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.equal(url, 'http://192.168.5.20:80/rr_model?key=&flags=d99fn');
    return {
      ok: true,
      json: async () => ({
        key: '',
        flags: 'd99fn',
        result: {
          state: { status: 'processing', currentTool: 0 },
          job: { file: { fileName: 'vase.gcode', size: 200000 }, filePosition: 100000 },
          heat: {
            heaters: [
              { current: 60, active: 60, standby: 0, state: 'active' },
              { current: 210, active: 210, standby: 0, state: 'active' },
            ],
            bedHeaters: [0],
          },
          tools: [{ heaters: [1], active: [210], standby: [0] }],
          fans: [{ name: 'PART', actualValue: 0.5, requestedValue: 0.5, rpm: 4200 }],
        },
      }),
    };
  };
  try {
    const adapter = new DuetAdapter({ id: 'duet3', name: 'Duet 3 Mini', host: '192.168.5.20' });
    const state = await adapter.read();
    assert.equal(state.status, 'printing');
    assert.equal(state.filename, 'vase.gcode');
    assert.equal(state.progress, 50);
    assert.equal(state.nozzleTemp, 210);
    assert.equal(state.bedTemp, 60);
    assert.deepEqual(state.fans, [{ key: 'fan0', label: 'PART', on: true }]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('read() throws when the Duet HTTP endpoint responds with an error status', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 503 });
  try {
    const adapter = new DuetAdapter({ id: 'duet3', name: 'Duet 3 Mini', host: '192.168.5.20' });
    await assert.rejects(() => adapter.read(), /Duet returned 503/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('reports a completed Duet print once a finished job leaves the processing state', () => {
  const adapter = new DuetAdapter({ id: 'duet', name: 'Duet' });
  const printing = adapter.toPrinterState({
    state: { status: 'processing' },
    job: { file: { fileName: 'bracket.gcode', size: 1000 }, filePosition: 995 },
  });
  assert.equal(printing.status, 'printing');
  const finished = adapter.toPrinterState({ state: { status: 'idle' }, job: {} });
  assert.equal(finished.status, 'complete');
  assert.equal(finished.filename, 'bracket.gcode');
  assert.equal(finished.progress, 100);
});

test('a cancelled Duet print never reports completion', () => {
  const adapter = new DuetAdapter({ id: 'duet', name: 'Duet' });
  adapter.toPrinterState({
    state: { status: 'processing' },
    job: { file: { fileName: 'bracket.gcode', size: 1000 }, filePosition: 999 },
  });
  assert.equal(adapter.toPrinterState({ state: { status: 'cancelling' }, job: {} }).status, 'idle');
  assert.equal(adapter.toPrinterState({ state: { status: 'idle' }, job: {} }).status, 'idle');
});

test('a Duet print stopped part way through does not report completion', () => {
  const adapter = new DuetAdapter({ id: 'duet', name: 'Duet' });
  adapter.toPrinterState({
    state: { status: 'processing' },
    job: { file: { fileName: 'bracket.gcode', size: 1000 }, filePosition: 120 },
  });
  assert.equal(adapter.toPrinterState({ state: { status: 'idle' }, job: {} }).status, 'idle');
});

test('a paused Duet print is not mistaken for a completed one', () => {
  const adapter = new DuetAdapter({ id: 'duet', name: 'Duet' });
  adapter.toPrinterState({
    state: { status: 'processing' },
    job: { file: { fileName: 'bracket.gcode', size: 1000 }, filePosition: 999 },
  });
  const paused = adapter.toPrinterState({
    state: { status: 'paused' },
    job: { file: { fileName: 'bracket.gcode', size: 1000 }, filePosition: 999 },
  });
  assert.equal(paused.status, 'paused');
});

test('a new Duet print clears a previously reported completion', () => {
  const adapter = new DuetAdapter({ id: 'duet', name: 'Duet' });
  adapter.toPrinterState({
    state: { status: 'processing' },
    job: { file: { fileName: 'bracket.gcode', size: 1000 }, filePosition: 1000 },
  });
  assert.equal(adapter.toPrinterState({ state: { status: 'idle' }, job: {} }).status, 'complete');
  const next = adapter.toPrinterState({
    state: { status: 'processing' },
    job: { file: { fileName: 'plate.gcode', size: 500 }, filePosition: 10 },
  });
  assert.equal(next.status, 'printing');
  assert.equal(next.filename, 'plate.gcode');
});
