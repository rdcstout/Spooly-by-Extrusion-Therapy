const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const name = process.platform === 'win32' ? 'bambu-fallback.exe' : 'bambu-fallback';
const helper = path.join(__dirname, '..', 'build', 'fallback', process.platform + '-' + process.arch, name);
// Closed stdin makes the helper reject missing configuration before loading a vendor library.
const result = spawnSync(helper, [], { input: '', encoding: 'utf8', timeout: 5000 });
if (result.error) throw result.error;
assert.equal(result.signal, null);
assert.equal(result.status, 2, 'Helper should reject missing configuration');
assert.equal(result.stdout, '', 'Helper should not emit telemetry without configuration');
console.log('Native monitoring helper smoke test passed (' + process.platform + '/' + process.arch + ')');
