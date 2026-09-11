const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDiscoveryPacket, scanBambuPrinters } = require('../src/discovery/bambu');
const { EventEmitter } = require('node:events');

function harness({ fail = [], neverBind = false, noReply = false } = {}) {
  const sockets = [];
  const options = {
    networkInterfaces: () => ({ lan: [{ family: 'IPv4', address: '192.168.5.99' }], vpn: [{ family: 'IPv4', address: '100.126.114.38' }] }),
    createSocket: () => {
      const socket = new EventEmitter();
      socket.bind = (_, address, ready) => { socket.address = address; if (!neverBind) queueMicrotask(ready); };
      socket.setMulticastInterface = address => { socket.adapter = address; };
      socket.send = (_, port, host, callback) => setImmediate(() => {
        if (fail.includes(socket.adapter)) return callback(new Error('unreachable'));
        callback(null);
        if (!noReply && socket.adapter === '192.168.5.99') socket.emit('message', 'NOTIFY * HTTP/1.1\r\nNT: urn:bambulab-com:device:3dprinter:1\r\nUSN: printer1\r\nLocation: 192.168.5.60\r\n', {});
      });
      socket.close = () => { socket.closed = true; };
      sockets.push(socket);
      return socket;
    },
  };
  return { sockets, options };
}

test('LAN discovery survives a later VPN adapter and deduplicates replies', async () => {
  const { sockets, options } = harness();
  const printers = await scanBambuPrinters(40, options);
  assert.equal(printers.length, 1);
  assert.equal(printers[0].host, '192.168.5.60');
  assert.equal(sockets.length, 2);
  assert.ok(sockets.every(s => s.closed && s.address === s.adapter));
});

test('one failed adapter does not discard successful LAN results', async () => {
  const { sockets, options } = harness({ fail: ['100.126.114.38'] });
  assert.equal((await scanBambuPrinters(40, options)).length, 1);
  assert.ok(sockets.every(s => s.closed));
});

test('total transport failure is distinct from no printers answering', async () => {
  const { options, sockets } = harness({ fail: ['192.168.5.99', '100.126.114.38'] });
  await assert.rejects(scanBambuPrinters(40, options), { code: 'BAMBU-DISCOVERY-02' });
  assert.ok(sockets.every(s => s.closed));
  assert.deepEqual(await scanBambuPrinters(40, harness({ noReply: true }).options), []);
});

test('stalled bind is bounded and late replies cannot mutate completed results', async () => {
  const { options, sockets } = harness({ neverBind: true });
  const result = await scanBambuPrinters(10, options);
  assert.deepEqual(result, []);
  assert.ok(sockets.every(s => s.closed));
  sockets[0].emit('message', 'NOTIFY * HTTP/1.1\r\nNT: urn:bambulab-com:device:3dprinter:1\r\nUSN: late\r\nLocation: 1.2.3.4\r\n');
  assert.deepEqual(result, []);
});

test('synchronous socket creation failures reject and do not hang', async () => {
  const { options } = harness();
  options.createSocket = () => { throw new Error('socket denied'); };
  await assert.rejects(scanBambuPrinters(40, options), { code: 'BAMBU-DISCOVERY-02' });
});

test('socket errors and multicast setup errors remain isolated to their adapter', async () => {
  for (const mode of ['error', 'interface']) {
    const { sockets, options } = harness();
    const create = options.createSocket;
    options.createSocket = () => {
      const socket = create();
      const bind = socket.bind;
      socket.bind = (port, address, ready) => {
        if (address.startsWith('100.') && mode === 'error') {
          queueMicrotask(() => socket.emit('error', new Error('adapter disappeared')));
        } else bind(port, address, ready);
      };
      const setInterface = socket.setMulticastInterface;
      socket.setMulticastInterface = address => {
        if (address.startsWith('100.') && mode === 'interface') throw new Error('no multicast');
        setInterface(address);
      };
      return socket;
    };
    assert.equal((await scanBambuPrinters(40, options)).length, 1);
    assert.ok(sockets.every(s => s.closed));
  }
});

test('parses a Bambu SSDP discovery announcement', () => {
  const packet = [
    'NOTIFY * HTTP/1.1',
    'HOST: 239.255.255.250:1900',
    'Location: 192.168.1.64',
    'NT: urn:bambulab-com:device:3dprinter:1',
    'USN: 01S00A123456789',
    'DevModel.bambu.com: 3DPrinter-X1-Carbon',
    'DevName.bambu.com: Workshop X1C',
    'DevConnect.bambu.com: cloud',
    '', '',
  ].join('\r\n');
  assert.deepEqual(parseDiscoveryPacket(packet), {
    host: '192.168.1.64',
    serial: '01S00A123456789',
    model: '3DPrinter-X1-Carbon',
    name: 'Workshop X1C',
    connection: 'cloud',
  });
});

test('ignores unrelated SSDP traffic', () => {
  assert.equal(parseDiscoveryPacket('NOTIFY * HTTP/1.1\r\nNT: upnp:rootdevice\r\n'), null);
});
