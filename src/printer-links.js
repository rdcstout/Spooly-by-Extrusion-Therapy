const path = require('path');

// Where a click on a printer name in the bubble should go. Pure lookup so it
// can be unit-tested without Electron; main.js hands the result to shell.*.

function stripScheme(host = '') {
  return String(host).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function moonrakerWebUrl(printer) {
  const raw = String(printer.host || '').trim().replace(/\/+$/, '');
  const host = stripScheme(raw);
  if (!host) return null;
  // Mirror MoonrakerAdapter.baseUrl's scheme choice: LAN addresses (bare
  // IPv4, localhost, .local names, single-label hostnames) are direct boxes
  // on http; a routable domain is usually behind a reverse proxy on https.
  const schemeMatch = /^(https?):\/\//.exec(raw);
  const isLanHost = /^(\d{1,3}\.){3}\d{1,3}$/.test(host)
    || host === 'localhost'
    || /\.local$/i.test(host)
    || !host.includes('.');
  const scheme = schemeMatch ? schemeMatch[1] : (isLanHost ? 'http' : 'https');
  const port = Number(printer.port) || 0;
  // 7125 is Moonraker's API port; Mainsail/Fluidd sit on the plain web port.
  const webPort = port && port !== 7125 ? port : 0;
  return webPort ? `${scheme}://${host}:${webPort}` : `${scheme}://${host}`;
}

const WEB_URL_BY_TYPE = {
  moonraker: moonrakerWebUrl,
};

function printerWebUrl(printer = {}) {
  const urlFn = WEB_URL_BY_TYPE[printer.type];
  return urlFn ? urlFn(printer) : null;
}

function bambuStudioCandidates(platform = process.platform, env = process.env) {
  if (platform === 'win32') {
    return [
      env.LOCALAPPDATA && path.win32.join(env.LOCALAPPDATA, 'Programs', 'BambuStudio', 'bambu-studio.exe'),
      env.ProgramFiles && path.win32.join(env.ProgramFiles, 'Bambu Studio', 'bambu-studio.exe'),
    ].filter(Boolean);
  }
  if (platform === 'darwin') return ['/Applications/BambuStudio.app'];
  return [];
}

module.exports = { printerWebUrl, bambuStudioCandidates };
