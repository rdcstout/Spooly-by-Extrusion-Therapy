const test = require('node:test');
const assert = require('node:assert/strict');
const { printerWebUrl, bambuStudioCandidates } = require('../src/printer-links');

test('moonraker on the default API port opens the web UI on the bare host', () => {
  assert.equal(printerWebUrl({ type: 'moonraker', host: '192.168.1.8', port: 7125 }), 'http://192.168.1.8');
});

test('moonraker without a port opens the bare host', () => {
  assert.equal(printerWebUrl({ type: 'moonraker', host: '192.168.1.8' }), 'http://192.168.1.8');
});

test('moonraker on a custom port keeps that port', () => {
  assert.equal(printerWebUrl({ type: 'moonraker', host: '192.168.1.8', port: 8080 }), 'http://192.168.1.8:8080');
});

test('moonraker behind a domain defaults to https like the adapter', () => {
  assert.equal(printerWebUrl({ type: 'moonraker', host: 'voron.example.com' }), 'https://voron.example.com');
});

test('moonraker on a bare .local or single-label host stays on http like the adapter', () => {
  assert.equal(printerWebUrl({ type: 'moonraker', host: 'voron.local' }), 'http://voron.local');
  assert.equal(printerWebUrl({ type: 'moonraker', host: 'voron' }), 'http://voron');
  assert.equal(printerWebUrl({ type: 'moonraker', host: 'localhost' }), 'http://localhost');
});

test('moonraker keeps an explicit http scheme and strips trailing slashes', () => {
  assert.equal(printerWebUrl({ type: 'moonraker', host: 'http://voron.local/', port: 7125 }), 'http://voron.local');
});

test('bambu and unknown types have no web url', () => {
  assert.equal(printerWebUrl({ type: 'bambu', host: '10.0.0.7' }), null);
  assert.equal(printerWebUrl({ type: 'nope', host: '10.0.0.7' }), null);
  assert.equal(printerWebUrl({ type: 'moonraker', host: '' }), null);
});

test('bambu studio candidates cover the windows install locations', () => {
  const env = { LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local', ProgramFiles: 'C:\\Program Files' };
  const candidates = bambuStudioCandidates('win32', env);
  assert.deepEqual(candidates, [
    'C:\\Users\\me\\AppData\\Local\\Programs\\BambuStudio\\bambu-studio.exe',
    'C:\\Program Files\\Bambu Studio\\bambu-studio.exe',
  ]);
});

test('bambu studio candidates cover the macos application bundle', () => {
  assert.deepEqual(bambuStudioCandidates('darwin', {}), ['/Applications/BambuStudio.app']);
});

test('bambu studio candidates skip windows locations whose env var is missing', () => {
  assert.deepEqual(bambuStudioCandidates('win32', {}), []);
});
