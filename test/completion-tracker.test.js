const test = require('node:test');
const assert = require('node:assert/strict');
const { observeCompletion } = require('../src/completion-tracker');

test('a completed job already present on startup is not a new celebration', () => {
  assert.deepEqual(observeCompletion(undefined, { status: 'complete' }), { armed: false, celebrate: false });
});
test('one completion per observed job, including repeating the same file', () => {
  let record;
  const results = ['printing', 'paused', 'printing', 'complete', 'complete', 'offline', 'complete', 'printing', 'complete'].map(status => {
    const result = observeCompletion(record, { status });record = result.armed;return result.celebrate;
  });
  assert.deepEqual(results, [false, false, false, true, false, false, false, false, true]);
});
test('persisted history prevents replay after restart but preserves an active job', () => {
  for (const [saved, expected] of [[false, false], [true, true]]) {
    const restored = JSON.parse(JSON.stringify({ printer: saved }));
    assert.equal(observeCompletion(restored.printer, { status: 'complete' }).celebrate, expected);
  }
});
test('errors and outages preserve progress; cancellation/idle clears it', () => {
  assert.equal(observeCompletion(true, { status: 'error' }).armed, true);
  assert.equal(observeCompletion(true, { status: 'offline' }).armed, true);
  assert.equal(observeCompletion(true, { status: 'idle' }).armed, false);
  assert.equal(observeCompletion('invalid', { status: 'complete' }).celebrate, false);
});
test('printer completion histories are independent', () => {
  const a = observeCompletion(true, { status: 'complete' });
  const b = observeCompletion(false, { status: 'complete' });
  assert.equal(a.celebrate, true);assert.equal(b.celebrate, false);
});
