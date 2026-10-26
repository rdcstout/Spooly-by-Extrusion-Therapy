const test = require('node:test');
const assert = require('node:assert/strict');
const { findInstallation, filterReport } = require('../src/bambu-fallback');
const { BambuFallbackAdapter } = require('../src/adapters/bambu-fallback');
const { samePrinterConfiguration, dedupePrinters } = require('../src/printers');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const config = { id: 'test', name: 'Test printer', type: 'bambu', serial: 'SERIAL123', host: '192.168.1.2' };
test('Local and Cloud names preserve saved transport identifiers', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/settings.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../src/renderer/settings.js'), 'utf8');
  assert.match(html, /value="bambu">Bambu Local/);
  assert.match(js, /fallback.value = 'bambu-fallback';fallback.textContent = 'Bambu Cloud'/);
  assert.match(js, /printer.connection = 'fallback'/);
  assert.doesNotMatch(html + js, /Bambu \(Fallback\)|Bambu Fallback|Bambu LAN/);
});
test('fallback discovery keeps its Find printers label after successful discovery', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/renderer/settings.js'), 'utf8');
  assert.match(source, /if \(button\.textContent === 'Scanning…'\) button\.textContent = usingFallback \? 'Find printers' : 'Scan local network';/);
});
function fixture(options = {}) {
  let emit, killed = 0, launches = 0;
  const states = [], statuses = [];let connections = 0;
  const adapter = new BambuFallbackAdapter(config, {
    retryMs: 10000, staleMs: 10000,
    launch(_serial, callback) { launches++;emit = callback;return { kill() { killed++; } }; }, ...options,
  });
  adapter.connect(state => states.push(state), () => connections++, status => statuses.push(status));
  return { adapter, states, statuses, emit: event => emit(event), get killed() { return killed; }, get connections() { return connections; }, get launches() { return launches; } };
}
test('fallback requires session, installed library, and certificates on every platform', () => {
  for (const platform of ['darwin', 'win32', 'linux']) {
    assert.ok(findInstallation({ platform, home: '/test', env: { ProgramFiles: '/programs' }, exists: () => true }));
    assert.equal(findInstallation({ platform, home: '/test', env: {}, exists: () => false }), null);
    assert.equal(findInstallation({ platform, home: '/test', env: {}, exists: p => !p.endsWith('BambuNetworkEngine.conf') }), null);
  }
});
test('fallback filters non-telemetry data and does not expose unrelated fields', () => {
  assert.equal(filterReport({ token: 'private' }), null);
  assert.equal(filterReport({ print: { token: 'private' } }), null);
  assert.deepEqual(filterReport({ print: { gcode_state: 'RUNNING', token: 'private', mc_percent: 42 } }), { print: { gcode_state: 'RUNNING', mc_percent: 42 } });
});
test('fallback waits for state before declaring success and merges later deltas', () => {
  const f = fixture();
  f.emit({ kind: 'connection', value: 'connected' });
  f.emit({ kind: 'report', report: { print: { mc_percent: 42 } } });
  assert.equal(f.connections, 0);
  f.emit({ kind: 'report', report: { print: { gcode_state: 'RUNNING', mc_percent: 42, nozzle_temper: 220 } } });
  f.emit({ kind: 'report', report: { print: { mc_percent: 43 } } });
  assert.equal(f.connections, 1);
  assert.equal(f.states.at(-1).progress, 43);
  assert.equal(f.states.at(-1).nozzleTemp, 220);
  f.adapter.disconnect();
});
test('fallback shares completion, pause and error behavior with direct Bambu', () => {
  const f = fixture();
  for (const [gcode_state, expected] of [['RUNNING', 'printing'], ['PAUSE', 'paused'], ['FINISH', 'complete']]) {
    f.emit({ kind: 'report', report: { print: { gcode_state } } });
    assert.equal(f.states.at(-1).status, expected);
  }
  f.emit({ kind: 'report', report: { print: { print_error: 123 } } });
  assert.equal(f.states.at(-1).status, 'error');
  f.adapter.disconnect();
});
test('fallback rejects stale state, stops worker, and does not callback after disconnect', async () => {
  const f = fixture({ staleMs: 20 });
  f.emit({ kind: 'report', report: { print: { gcode_state: 'RUNNING' } } });
  await wait(35);
  assert.equal(f.states.at(-1).status, 'offline');
  assert.equal(f.killed, 1);
  assert.equal(f.statuses.at(-1).phase, 'connected'); // runtime outage is offline, not a setup error
  f.adapter.disconnect();
  const count = f.states.length;
  f.emit({ kind: 'report', report: { print: { gcode_state: 'FINISH' } } });
  assert.equal(f.states.length, count);
});
test('fallback launch failures are bounded and do not throw from setup', () => {
  const f = fixture({ launch() { throw new Error('unavailable'); } });
  assert.equal(f.states.at(-1).status, 'offline');
  assert.equal(f.statuses.at(-1).phase, 'failed');
  f.adapter.disconnect();
});
test('transport switching reconnects only that printer and keeps one identity', () => {
  assert.equal(samePrinterConfiguration(config, { ...config, connection: 'direct' }), true);
  assert.equal(samePrinterConfiguration(config, { ...config, connection: 'fallback' }), false);
  assert.equal(dedupePrinters([config, { ...config, connection: 'fallback' }]).length, 1);
});
