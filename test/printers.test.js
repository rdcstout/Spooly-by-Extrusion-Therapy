const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalPrinterKey, dedupePrinters, samePrinterConfiguration } = require('../src/printers');

test('identifies duplicate Bambu printers by serial regardless of IP', () => {
  assert.equal(
    canonicalPrinterKey({ type: 'bambu', host: '192.168.1.2', serial: 'abc123' }),
    canonicalPrinterKey({ type: 'bambu', host: '192.168.1.9', serial: 'ABC123' }),
  );
});

test('identifies duplicate Moonraker printers by normalized host and port', () => {
  assert.equal(
    canonicalPrinterKey({ type: 'moonraker', host: 'http://Voron.local/', port: 7125 }),
    canonicalPrinterKey({ type: 'moonraker', host: 'voron.local', port: 7125 }),
  );
});

test('deduplicates printer configurations while preserving the first', () => {
  const first = { id: 'one', type: 'moonraker', host: '192.168.1.8', port: 7125 };
  const duplicate = { id: 'two', type: 'moonraker', host: '192.168.1.8', port: 7125 };
  assert.deepEqual(dedupePrinters([first, duplicate]), [first]);
});

test('recognizes unchanged printer connections during settings saves', () => {
  const bambu = { id: 'b1', type: 'bambu', name: 'X1C', host: '192.168.1.8', serial: 'ABC', accessCode: '12345678' };
  assert.equal(samePrinterConfiguration(bambu, { ...bambu }), true);
  assert.equal(samePrinterConfiguration(bambu, { ...bambu, accessCode: '87654321' }), false);
  const moonraker = { id: 'm1', type: 'moonraker', name: 'U1', host: '192.168.1.9', port: 7125 };
  assert.equal(samePrinterConfiguration(moonraker, { ...moonraker, port: '7125' }), true);
  assert.equal(samePrinterConfiguration(moonraker, { ...moonraker, host: '192.168.1.10' }), false);
});

test('treats RepetierServer printers on the same host and port but different slugs as distinct', () => {
  const first = canonicalPrinterKey({ type: 'repetierserver', host: '192.168.1.30', port: 3344, slug: 'printer1' });
  const second = canonicalPrinterKey({ type: 'repetierserver', host: '192.168.1.30', port: 3344, slug: 'printer2' });
  assert.notEqual(first, second);
  assert.ok(first);
  assert.ok(second);
});

test('identifies duplicate RepetierServer printers by normalized host, port, and slug', () => {
  assert.equal(
    canonicalPrinterKey({ type: 'repetierserver', host: 'http://Repetier.local/', port: 3344, slug: 'Printer1' }),
    canonicalPrinterKey({ type: 'repetierserver', host: 'repetier.local', port: 3344, slug: 'printer1' }),
  );
});

test('treats Duet printers on different hosts as distinct', () => {
  assert.notEqual(
    canonicalPrinterKey({ type: 'duet', host: '192.168.1.20', port: 80 }),
    canonicalPrinterKey({ type: 'duet', host: '192.168.1.21', port: 80 }),
  );
});

test('identifies duplicate Duet printers by normalized host and port', () => {
  assert.equal(
    canonicalPrinterKey({ type: 'duet', host: 'http://Voron2.local/', port: 80 }),
    canonicalPrinterKey({ type: 'duet', host: 'voron2.local', port: 80 }),
  );
});
