const dgram = require('node:dgram');
const os = require('node:os');

const MULTICAST_HOST = '239.255.255.250';
const DISCOVERY_PORTS = [1900, 1990, 2021];
const DEVICE_TYPE = 'urn:bambulab-com:device:3dprinter:1';

function parseDiscoveryPacket(payload, sender = {}) {
  const text = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload || '');
  if (!text.toLowerCase().includes(DEVICE_TYPE)) return null;
  const headers = {};
  text.split(/\r?\n/).slice(1).forEach((line) => {
    const colon = line.indexOf(':');
    if (colon < 1) return;
    headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
  });
  const host = (headers.location || sender.address || '').replace(/^https?:\/\//, '').split('/')[0];
  const serial = headers.usn || '';
  if (!host || !serial) return null;
  return {
    host,
    serial,
    model: headers['devmodel.bambu.com'] || '',
    name: headers['devname.bambu.com'] || `Bambu ${serial.slice(-4)}`,
    connection: headers['devconnect.bambu.com'] || '',
  };
}

function localIPv4Addresses(networkInterfaces = os.networkInterfaces) {
  return [...new Set(Object.values(networkInterfaces()).flat().filter((address) =>
    address && address.family === 'IPv4' && !address.internal
  ).map((address) => address.address))];
}

function scanBambuPrinters(timeoutMs = 3200, {
  createSocket = dgram.createSocket,
  networkInterfaces = os.networkInterfaces,
} = {}) {
  return new Promise((resolve, reject) => {
    const sockets = new Set();
    const found = new Map();
    let sent = 0;
    let failed = false;
    let finished = false;
    const close = (socket) => {
      sockets.delete(socket);
      try { socket.close(); } catch (_) {}
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      for (const socket of sockets) close(socket);
      if (!found.size && !sent && failed) {
        const error = new Error('BAMBU-DISCOVERY-02 — The scan could not send discovery requests on any network adapter.');
        error.code = 'BAMBU-DISCOVERY-02';
        reject(error);
        return;
      }
      resolve([...found.values()].sort((a, b) => a.name.localeCompare(b.name)));
    };
    // Start before binding: even an adapter that never becomes ready is bounded.
    const timer = setTimeout(finish, timeoutMs);
    let addresses;
    try { addresses = localIPv4Addresses(networkInterfaces); }
    catch (_) { failed = true; finish(); return; }
    // A socket belongs to one adapter for its entire lifetime. Changing the
    // multicast interface on a shared socket races Node's asynchronous sends.
    for (const address of addresses.length ? addresses : [null]) {
      let socket;
      try {
        socket = createSocket({ type: 'udp4', reuseAddr: true });
        sockets.add(socket);
        socket.on('message', (payload, sender) => {
          if (finished || !sockets.has(socket)) return;
          const printer = parseDiscoveryPacket(payload, sender);
          if (printer) found.set(printer.serial, printer);
        });
        socket.on('error', () => { failed = true; close(socket); });
        socket.bind(0, address || '0.0.0.0', () => {
          if (finished || !sockets.has(socket)) return;
          try { if (address) socket.setMulticastInterface(address); }
          catch (_) { failed = true; close(socket); return; }
          for (const port of DISCOVERY_PORTS) {
            const request = Buffer.from([
              'M-SEARCH * HTTP/1.1',
              `HOST: ${MULTICAST_HOST}:${port}`,
              'MAN: "ssdp:discover"',
              'MX: 1',
              `ST: ${DEVICE_TYPE}`,
              '', '',
            ].join('\r\n'));
            try {
              socket.send(request, port, MULTICAST_HOST, (error) => {
                if (finished) return;
                if (error) failed = true;
                else sent += 1;
              });
            } catch (_) { failed = true; }
          }
        });
      } catch (_) { failed = true; if (socket) close(socket); }
    }
    if (!sockets.size) finish();
  });
}

module.exports = { parseDiscoveryPacket, scanBambuPrinters };
