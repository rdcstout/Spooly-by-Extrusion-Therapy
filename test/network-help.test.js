const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const net = require('node:net');
const { connectionFailure, showNetworkHelp, probeConnection, checkConnections } = require('../src/network-help');

test('only explicit access errors count as blocked, including nested fetch errors', () => {
  assert.equal(connectionFailure({ code: 'EPERM' }), 'blocked');
  assert.equal(connectionFailure({ cause: { code: 'EACCES' } }), 'blocked');
  assert.equal(connectionFailure({ errors: [{ code: 'EHOSTUNREACH' }, { code: 'EPERM' }] }), 'blocked');
  for (const code of ['ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND']) {
    assert.equal(connectionFailure({ code }), 'unreachable');
  }
  const cycle = {}; cycle.cause = cycle;
  assert.equal(connectionFailure(cycle), 'unreachable');
});

test('network help is Mac-only and does not change a partially online fleet', () => {
  const offline = [{ status: 'offline' }];
  assert.equal(showNetworkHelp('darwin', offline), true);
  assert.equal(showNetworkHelp('darwin', []), false);
  assert.equal(showNetworkHelp('win32', offline), false);
  assert.equal(showNetworkHelp('linux', offline), false);
  assert.equal(showNetworkHelp('darwin', [...offline, { status: 'printing' }]), false);
});

function fakeConnect(event, error) {
  let destroyed = false;
  let target;
  return {
    connect: (options) => {
      target = options;
      const socket = new EventEmitter();
      socket.destroy = () => { destroyed = true; };
      if (event) process.nextTick(() => socket.emit(event, error));
      return socket;
    },
    inspect: () => ({ destroyed, target }),
  };
}

test('connection check uses printer port and returns no credentials or addresses', async () => {
  const fake = fakeConnect('connect');
  const result = await probeConnection({ id: 'a', name: 'Printer', host: '192.168.1.2', type: 'bambu', accessCode: 'secret', port: 7125 }, fake);
  assert.deepEqual(result, { id: 'a', name: 'Printer', result: 'reachable' });
  assert.deepEqual(fake.inspect(), { destroyed: true, target: { host: '192.168.1.2', port: 8883 } });
});

test('permission failure, refusal, synchronous failure, and hanging socket all settle', async () => {
  const config = { host: '192.168.1.2', type: 'moonraker' };
  assert.equal((await probeConnection(config, fakeConnect('error', { code: 'EPERM' }))).result, 'blocked');
  assert.equal((await probeConnection(config, fakeConnect('error', { code: 'ECONNREFUSED' }))).result, 'unreachable');
  assert.equal((await probeConnection(config, { connect: () => { throw Object.assign(new Error(), { code: 'EACCES' }); } })).result, 'blocked');
  const hanging = fakeConnect();
  assert.equal((await probeConnection(config, { ...hanging, timeoutMs: 10 })).result, 'unreachable');
  assert.equal(hanging.inspect().destroyed, true);
});

test('invalid addresses and ports are rejected without opening sockets', async () => {
  for (const config of [{}, { host: 'a/b' }, { host: 'a', port: -1 }, { host: 'a', port: 99999 }]) {
    assert.equal((await probeConnection(config, { connect: () => assert.fail('unexpected connection') })).result, 'invalid');
  }
});

test('fleet check keeps results ordered and returns an empty fleet without traffic', async () => {
  const configs = Array.from({ length: 9 }, (_, id) => ({ id, name: String(id), host: '192.168.1.2' }));
  const results = await checkConnections(configs, fakeConnect('connect'));
  assert.deepEqual(results.map((r) => r.id), configs.map((c) => c.id));
  assert.deepEqual(await checkConnections([], { connect: () => assert.fail('unexpected connection') }), []);
});

test('real TCP probe closes its connection and accurately reports a listening service', async () => {
  const server = net.createServer((socket) => socket.end());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    assert.equal((await probeConnection({ host: '127.0.0.1', port: server.address().port })).result, 'reachable');
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
