const net = require('node:net');

// These are access-denial errors, not proof of a particular macOS setting.
function connectionFailure(error) {
  const seen = new Set();
  const pending = [error];
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    if (['EACCES', 'EPERM'].includes(value.code)) return 'blocked';
    pending.push(value.cause, ...(Array.isArray(value.errors) ? value.errors : []));
  }
  return 'unreachable';
}

function showNetworkHelp(platform, printers) {
  return platform === 'darwin' && printers.length > 0
    && printers.every((printer) => printer.status === 'offline');
}

function probeConnection(config, { connect = net.createConnection, timeoutMs = 4000 } = {}) {
  const host = String(config.host || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const port = config.type === 'bambu' ? 8883 : Number(config.port || 7125);
  if (!host || /[\s/]/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
    return Promise.resolve({ id: config.id, name: config.name, result: 'invalid' });
  }
  return new Promise((resolve) => {
    let socket;
    let timer;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.destroy();
      resolve({ id: config.id, name: config.name, result });
    };
    // Wall-clock deadline also covers DNS and sockets that never connect.
    timer = setTimeout(() => finish('unreachable'), timeoutMs);
    try {
      socket = connect({ host, port });
      socket.once('connect', () => finish('reachable'));
      socket.once('error', (error) => finish(connectionFailure(error)));
      socket.once('close', () => finish('unreachable'));
    } catch (error) { finish(connectionFailure(error)); }
  });
}

async function checkConnections(configs, options) {
  const results = [];
  // Do not open an unbounded number of sockets for large fleets.
  for (let index = 0; index < configs.length; index += 4) {
    results.push(...await Promise.all(configs.slice(index, index + 4).map((config) => probeConnection(config, options))));
  }
  return results;
}

module.exports = { connectionFailure, showNetworkHelp, probeConnection, checkConnections };
