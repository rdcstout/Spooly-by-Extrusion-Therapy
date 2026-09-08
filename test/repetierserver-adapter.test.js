const test = require('node:test');
const assert = require('node:assert/strict');
const { RepetierServerAdapter } = require('../src/adapters/repetierserver');

test('maps a running Repetier-Server job to progress and temperatures', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const state = adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: false, jobstate: 'running', job: 'cube.gcode', done: 42.6 },
    {
      activeExtruder: 0,
      extruder: [{ tempRead: 214.6, tempSet: 215, output: 128, error: 0 }],
      heatedBeds: [{ tempRead: 59.8, tempSet: 60, output: 80, error: 0 }],
      fans: [{ on: true, voltage: 255 }],
    },
  );
  assert.equal(state.status, 'printing');
  assert.equal(state.filename, 'cube.gcode');
  assert.equal(state.progress, 42.6);
  assert.equal(state.nozzleTemp, 214.6);
  assert.equal(state.nozzleTarget, 215);
  assert.equal(state.bedTemp, 59.8);
  assert.equal(state.bedTarget, 60);
  assert.deepEqual(state.fans, [{ key: 'fan0', label: 'FAN 0', on: true }]);
});

test('maps an idle Repetier-Server printer without fabricating progress', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const state = adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: false, jobstate: 'none', job: '', done: null },
    {
      activeExtruder: 0,
      extruder: [{ tempRead: 24.1, tempSet: 0, output: 0, error: 0 }],
      heatedBeds: [{ tempRead: 23.4, tempSet: 0, output: 0, error: 0 }],
      fans: [],
    },
  );
  assert.equal(state.status, 'idle');
  assert.equal(state.filename, '');
  assert.equal(state.progress, null);
  assert.equal(state.nozzleTemp, 24.1);
  assert.equal(state.nozzleTarget, 0);
  assert.equal(state.bedTemp, 23.4);
  assert.equal(state.bedTarget, 0);
  assert.deepEqual(state.fans, []);
});

test('maps a paused Repetier-Server job', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const state = adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: true, jobstate: 'running', job: 'vase.gcode', done: 10 },
    { extruder: [], heatedBeds: [], fans: [] },
  );
  assert.equal(state.status, 'paused');
});

test('reports offline when the Repetier-Server printer is not online', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const state = adapter.toPrinterState(
    { slug: 'ender3', online: 0, paused: false, jobstate: 'none', job: '', done: null },
    null,
  );
  assert.equal(state.status, 'offline');
});

test('reports error when a Repetier-Server heater error code is set', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const state = adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: false, jobstate: 'running', job: 'cube.gcode', done: 5 },
    {
      extruder: [{ tempRead: 10, tempSet: 215, output: 0, error: 2 }],
      heatedBeds: [{ tempRead: 20, tempSet: 60, output: 0, error: 0 }],
      fans: [],
    },
  );
  assert.equal(state.status, 'error');
  assert.equal(state.message, 'Heater error reported');
});

test('read() fetches the Repetier-Server printer list and state endpoints and normalizes them', async () => {
  const originalFetch = global.fetch;
  const requestedUrls = [];
  const requestedOptions = [];
  global.fetch = async (url, options) => {
    requestedUrls.push(url);
    requestedOptions.push(options);
    if (url.includes('/printer/list')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            { slug: 'ender3', name: 'Ender 3', online: 1, paused: false, jobstate: 'running', job: 'vase.gcode', jobid: 4, done: 50 },
          ],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        ender3: {
          activeExtruder: 0,
          extruder: [{ tempRead: 210, tempSet: 210, output: 128, error: 0 }],
          heatedBeds: [{ tempRead: 60, tempSet: 60, output: 80, error: 0 }],
          fans: [{ on: true, voltage: 255 }],
        },
      }),
    };
  };
  try {
    const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', host: '192.168.5.30', slug: 'ender3', apiKey: 'abc123' });
    const state = await adapter.read();
    assert.equal(requestedUrls[0], 'http://192.168.5.30:3344/printer/list');
    assert.equal(requestedUrls[1], 'http://192.168.5.30:3344/printer/api/ender3?a=stateList');
    assert.deepEqual(requestedOptions[0].headers, { 'X-Api-Key': 'abc123' });
    assert.deepEqual(requestedOptions[1].headers, { 'X-Api-Key': 'abc123' });
    assert.equal(state.status, 'printing');
    assert.equal(state.filename, 'vase.gcode');
    assert.equal(state.progress, 50);
    assert.equal(state.nozzleTemp, 210);
    assert.equal(state.bedTemp, 60);
    assert.deepEqual(state.fans, [{ key: 'fan0', label: 'FAN 0', on: true }]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('read() omits the X-Api-Key header when no apiKey is configured', async () => {
  const originalFetch = global.fetch;
  const requestedOptions = [];
  global.fetch = async (url, options) => {
    requestedOptions.push(options);
    if (url.includes('/printer/list')) return { ok: true, json: async () => ({ data: [] }) };
    return { ok: true, json: async () => ({}) };
  };
  try {
    const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', host: '192.168.5.30', slug: 'ender3' });
    await adapter.read();
    assert.deepEqual(requestedOptions[0].headers, {});
    assert.deepEqual(requestedOptions[1].headers, {});
  } finally {
    global.fetch = originalFetch;
  }
});

test('listPrinters() returns normalized slug/name pairs from /printer/list', async () => {
  const originalFetch = global.fetch;
  const requestedUrls = [];
  const requestedOptions = [];
  global.fetch = async (url, options) => {
    requestedUrls.push(url);
    requestedOptions.push(options);
    return {
      ok: true,
      json: async () => ({
        data: [
          { slug: 'ender3', name: 'Ender 3', online: 1 },
          { slug: 'voron', name: '', online: 0 },
        ],
      }),
    };
  };
  try {
    const adapter = new RepetierServerAdapter({ id: 'x', name: 'X', host: '192.168.5.30', apiKey: 'abc123' });
    const printers = await adapter.listPrinters();
    assert.equal(requestedUrls[0], 'http://192.168.5.30:3344/printer/list');
    assert.deepEqual(requestedOptions[0].headers, { 'X-Api-Key': 'abc123' });
    assert.deepEqual(printers, [
      { slug: 'ender3', name: 'Ender 3' },
      { slug: 'voron', name: 'voron' },
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('read() throws when the Repetier-Server HTTP endpoint responds with an error status', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (url.includes('/printer/list')) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({}) };
  };
  try {
    const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', host: '192.168.5.30', slug: 'ender3' });
    await assert.rejects(() => adapter.read(), /RepetierServer returned 503/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('reports a completed print once a finished job leaves the running state', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const telemetry = { extruder: [], heatedBeds: [], fans: [] };
  const printing = adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: false, jobstate: 'running', job: 'cube.gcode', done: 99.4 },
    telemetry,
  );
  assert.equal(printing.status, 'printing');
  const finished = adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: false, jobstate: 'none', job: '', done: null },
    telemetry,
  );
  assert.equal(finished.status, 'complete');
  assert.equal(finished.filename, 'cube.gcode');
  assert.equal(finished.progress, 100);
});

test('does not report completion for a print that was stopped part way through', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const telemetry = { extruder: [], heatedBeds: [], fans: [] };
  adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: false, jobstate: 'running', job: 'cube.gcode', done: 18 },
    telemetry,
  );
  const stopped = adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: false, jobstate: 'none', job: '', done: null },
    telemetry,
  );
  assert.equal(stopped.status, 'idle');
});

test('a paused print is not mistaken for a completed one', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const telemetry = { extruder: [], heatedBeds: [], fans: [] };
  adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: false, jobstate: 'running', job: 'cube.gcode', done: 99.8 },
    telemetry,
  );
  const paused = adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: true, jobstate: 'paused', job: 'cube.gcode', done: 99.8 },
    telemetry,
  );
  assert.equal(paused.status, 'paused');
});

test('a new print clears a previously reported completion', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const telemetry = { extruder: [], heatedBeds: [], fans: [] };
  adapter.toPrinterState({ slug: 'ender3', online: 1, jobstate: 'running', job: 'cube.gcode', done: 100 }, telemetry);
  assert.equal(adapter.toPrinterState({ slug: 'ender3', online: 1, jobstate: 'none', job: '', done: null }, telemetry).status, 'complete');
  const next = adapter.toPrinterState({ slug: 'ender3', online: 1, jobstate: 'running', job: 'vase.gcode', done: 2 }, telemetry);
  assert.equal(next.status, 'printing');
  assert.equal(next.filename, 'vase.gcode');
});

test('reads the documented single heatedBed and fanOn/fanVoltage telemetry shape', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const state = adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: false, jobstate: 'running', job: 'cube.gcode', done: 42.6 },
    {
      activeExtruder: 0,
      extruder: [{ tempRead: 214.6, tempSet: 215, output: 128, error: 0 }],
      heatedBed: { tempRead: 59.8, tempSet: 60, output: 80, error: 0 },
      fanOn: true,
      fanVoltage: 255,
    },
  );
  assert.equal(state.bedTemp, 59.8);
  assert.equal(state.bedTarget, 60);
  assert.deepEqual(state.fans, [{ key: 'fan0', label: 'FAN 0', on: true }]);
});

test('reports a heater error from the documented single heatedBed shape', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const state = adapter.toPrinterState(
    { slug: 'ender3', online: 1, paused: false, jobstate: 'running', job: 'cube.gcode', done: 5 },
    { extruder: [{ tempRead: 20, tempSet: 215, output: 0, error: 0 }], heatedBed: { tempRead: 20, tempSet: 60, error: 3 } },
  );
  assert.equal(state.status, 'error');
  assert.equal(state.message, 'Heater error reported');
});

test('a printer that goes offline mid-print does not report a completion when it returns', () => {
  const adapter = new RepetierServerAdapter({ id: 'ender3', name: 'Ender 3', slug: 'ender3' });
  const telemetry = { extruder: [], heatedBeds: [], fans: [] };
  adapter.toPrinterState({ slug: 'ender3', online: 1, jobstate: 'running', job: 'cube.gcode', done: 99.9 }, telemetry);
  assert.equal(adapter.toPrinterState({ slug: 'ender3', online: 0, jobstate: 'none', job: '', done: null }, telemetry).status, 'offline');
  assert.equal(adapter.toPrinterState({ slug: 'ender3', online: 1, jobstate: 'none', job: '', done: null }, telemetry).status, 'idle');
});
