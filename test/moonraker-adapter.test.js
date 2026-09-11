const test = require('node:test');
const assert = require('node:assert/strict');
const { MoonrakerAdapter } = require('../src/adapters/moonraker');

test('maps Moonraker print progress and temperatures', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron' });
  const state = adapter.toPrinterState({ state: 'printing', filename: 'cube.gcode' }, null, {
    virtualSdcard: { progress: 0.426 },
    extruder: { temperature: 214.6, target: 215 },
    heaterBed: { temperature: 59.8, target: 60 },
    fans: [{ key: 'part', label: 'PART', on: true }],
  });
  assert.equal(state.status, 'printing');
  assert.equal(state.progress, 42.6);
  assert.equal(state.nozzleTemp, 214.6);
  assert.equal(state.nozzleTarget, 215);
  assert.equal(state.bedTemp, 59.8);
  assert.equal(state.bedTarget, 60);
  assert.deepEqual(state.fans, [{ key: 'part', label: 'PART', on: true }]);
});

test('maps a cancelled Moonraker job to an idle one-shot notification', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron' });
  const state = adapter.toPrinterState({ state: 'cancelled' });
  assert.equal(state.status, 'idle');
  assert.deepEqual(state.attention, { type: 'stopped', message: 'Print stopped' });
});

test('uses the Moonraker toolhead active extruder on a multi-tool printer', () => {
  const adapter = new MoonrakerAdapter({ id: 'u1', name: 'Snapmaker U1' });
  const active = adapter.selectActiveExtruder({
    toolhead: { extruder: 'extruder1' },
    extruder: { temperature: 24, target: 0 },
    extruder1: { temperature: 255, target: 255 },
    extruder2: { temperature: 24, target: 0 },
    extruder3: { temperature: 24, target: 0 },
  }, ['extruder', 'extruder1', 'extruder2', 'extruder3']);
  assert.deepEqual(active, { temperature: 255, target: 255 });
});

test('does not fabricate zeroes from missing Moonraker telemetry', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron' });
  const state = adapter.toPrinterState({ state: 'standby' }, null, {
    virtualSdcard: { progress: null },
    extruder: { temperature: null, target: null },
    heaterBed: { temperature: null, target: null },
  });
  assert.equal(state.progress, null);
  assert.equal(state.nozzleTemp, null);
  assert.equal(state.nozzleTarget, null);
  assert.equal(state.bedTemp, null);
  assert.equal(state.bedTarget, null);
});

test('defaults a bare LAN IP to http with the Moonraker port', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: '192.168.1.42' });
  assert.equal(adapter.baseUrl, 'http://192.168.1.42:7125');
});

test('treats a bare .local name like a bare LAN IP', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'voron.local' });
  assert.equal(adapter.baseUrl, 'http://voron.local:7125');
});

test('treats a bare single-label hostname like a bare LAN IP', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'voron' });
  assert.equal(adapter.baseUrl, 'http://voron:7125');
});

test('still defaults localhost to http with the Moonraker port', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'localhost' });
  assert.equal(adapter.baseUrl, 'http://localhost:7125');
});

test('defaults a bare routable domain to https with no forced port', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'voron.example.com' });
  assert.equal(adapter.baseUrl, 'https://voron.example.com');
});

test('keeps an explicit https scheme without forcing the default port', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'https://voron.local' });
  assert.equal(adapter.baseUrl, 'https://voron.local');
});

test('keeps an explicit http scheme on a domain without forcing port 7125', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'http://voron.example.com' });
  assert.equal(adapter.baseUrl, 'http://voron.example.com');
});

test('keeps an explicit http scheme on a LAN IP with the Moonraker port', () => {
  const adapter = new MoonrakerAdapter({ id: 'voron', name: 'Voron', host: 'http://192.168.1.42' });
  assert.equal(adapter.baseUrl, 'http://192.168.1.42:7125');
});

test('honors a configured port on every scheme', () => {
  assert.equal(new MoonrakerAdapter({ host: 'https://voron.local', port: 8443 }).baseUrl, 'https://voron.local:8443');
  assert.equal(new MoonrakerAdapter({ host: 'voron.example.com', port: 8443 }).baseUrl, 'https://voron.example.com:8443');
  assert.equal(new MoonrakerAdapter({ host: '192.168.1.42', port: 7130 }).baseUrl, 'http://192.168.1.42:7130');
});

test('keeps a port typed into the address field itself', () => {
  assert.equal(new MoonrakerAdapter({ host: 'voron.example.com:8443' }).baseUrl, 'https://voron.example.com:8443');
  assert.equal(new MoonrakerAdapter({ host: 'http://192.168.1.42:7130' }).baseUrl, 'http://192.168.1.42:7130');
});

test('strips trailing slashes before building the URL', () => {
  assert.equal(new MoonrakerAdapter({ host: 'https://voron.example.com/' }).baseUrl, 'https://voron.example.com');
  assert.equal(new MoonrakerAdapter({ host: '192.168.1.42//' }).baseUrl, 'http://192.168.1.42:7125');
  assert.equal(new MoonrakerAdapter({ host: 'voron.local/' }).baseUrl, 'http://voron.local:7125');
});
