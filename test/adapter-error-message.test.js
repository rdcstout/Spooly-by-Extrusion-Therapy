const test = require('node:test');
const assert = require('node:assert/strict');
const { formatAdapterError } = require('../src/adapter-errors');

test('appends the cause message when fetch failed wraps a lower-level error', () => {
  const error = new TypeError('fetch failed');
  error.cause = new Error('getaddrinfo ENOTFOUND voron.local');
  assert.equal(formatAdapterError(error), 'fetch failed: getaddrinfo ENOTFOUND voron.local');
});

test('falls back to the cause code when the cause has no message', () => {
  const error = new TypeError('fetch failed');
  error.cause = { code: 'ECONNREFUSED' };
  assert.equal(formatAdapterError(error), 'fetch failed: ECONNREFUSED');
});

test('falls back to the plain error message when there is no cause', () => {
  const error = new Error('Unexpected token in JSON');
  assert.equal(formatAdapterError(error), 'Unexpected token in JSON');
});
