const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const activeChildren = new Set();

function findInstallation({ platform = process.platform, home = os.homedir(), env = process.env, exists = fs.existsSync } = {}) {
  let bases, libraries, certificates;
  if (platform === 'darwin') {
    bases = [path.join(home, 'Library/Application Support/BambuStudio')];
    libraries = ['libbambu_networking.dylib'];
    certificates = ['/Applications/BambuStudio.app/Contents/Resources/cert/slicer_base64.cer'];
  } else if (platform === 'win32') {
    bases = [path.join(env.APPDATA || path.join(home, 'AppData/Roaming'), 'BambuStudio')];
    libraries = ['bambu_networking.dll'];
    certificates = [env.ProgramW6432, env.ProgramFiles, env['ProgramFiles(x86)']].filter(Boolean)
      .map(root => path.join(root, 'Bambu Studio/resources/cert/slicer_base64.cer'));
  } else if (platform === 'linux') {
    bases = [path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'BambuStudio'), path.join(home, '.var/app/com.bambulab.BambuStudio/config/BambuStudio')];
    libraries = ['libbambu_networking.so'];
    certificates = ['/etc/ssl/certs/ca-certificates.crt'];
  } else return null;
  for (const base of bases) {
    const session = path.join(base, 'BambuNetworkEngine.conf');
    const library = libraries.map(name => path.join(base, 'plugins', name)).find(exists);
    const certificate = certificates.find(exists);
    if (exists(session) && library && certificate) return { base, session, library, certificate };
  }
  return null;
}

function helperPath() {
  const name = process.platform === 'win32' ? 'bambu-fallback.exe' : 'bambu-fallback';
  const root = __dirname.includes('app.asar') ? path.join(process.resourcesPath, 'fallback') : path.join(__dirname, '..', 'build', 'fallback', `${process.platform}-${process.arch}`);
  return path.join(root, name);
}

// Only operational printer fields cross the native bridge boundary into state.
function filterReport(value) {
  const print = value?.print;
  if (!print || typeof print !== 'object' || Array.isArray(print)) return null;
  const keys = ['gcode_state', 'mc_percent', 'mc_remaining_time', 'nozzle_temper', 'bed_temper', 'nozzle_target_temper', 'bed_target_temper', 'print_error', 'subtask_name', 'gcode_file', 'error_msg', 'cooling_fan_speed', 'big_fan1_speed', 'big_fan2_speed', 'device'];
  const filtered = Object.fromEntries(keys.filter(key => Object.hasOwn(print, key)).map(key => [key, print[key]]));
  return Object.keys(filtered).length ? { print: filtered } : null;
}

function launch(serial, onEvent, options = {}) {
  const installation = options.installation || findInstallation();
  const executable = options.executable || helperPath();
  if (!installation || !fs.existsSync(executable)) throw new Error('unavailable');
  if (!/^(?:[A-Za-z0-9_-]{4,100}|--check)$/.test(serial)) throw new Error('serial');
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spooly-fallback-'));
  fs.chmodSync(sessionDir, 0o700);
  let child;
  try {
    const destination = path.join(sessionDir, 'BambuNetworkEngine.conf');
    fs.copyFileSync(installation.session, destination);fs.chmodSync(destination, 0o600);
    const env = { ...process.env };
    delete env.DYLD_INSERT_LIBRARIES;delete env.LD_PRELOAD;
    if (process.platform === 'linux') env.LD_LIBRARY_PATH = path.dirname(installation.library);
    child = spawn(executable, [], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true, env });
    activeChildren.add(child);
    let buffer = '';
    child.stdout.on('data', chunk => {
      buffer += chunk.toString();
      if (buffer.length > 2 * 1024 * 1024) { child.kill(); return; }
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end);buffer = buffer.slice(end + 1);
        const delimiter = line.indexOf('\t');
        if (delimiter < 0) continue;
        const kind = line.slice(0, delimiter), body = line.slice(delimiter + 1);
        if (kind === 'printers') {
          try {
            const value = JSON.parse(body);
            const printers = (Array.isArray(value.devices) ? value.devices : []).filter(p => typeof p.dev_id === 'string')
              .map(p => ({ serial: p.dev_id, name: String(p.name || p.dev_name || p.dev_product_name || 'Bambu printer'), host: '' }));
            onEvent({ kind, printers });
          } catch (_) { onEvent({ kind: 'error', value: 'data' }); }
        } else if (kind === 'report') { try { const report = filterReport(JSON.parse(body));if (report) onEvent({ kind, report }); } catch (_) {} }
        else if (['connection', 'available', 'error'].includes(kind)) onEvent({ kind, value: body });
      }
    });
    child.stdin.on('error', () => {});
    child.once('error', () => onEvent({ kind: 'error', value: 'unavailable' }));
    child.once('close', () => {
      activeChildren.delete(child);
      try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (_) {}
      onEvent({ kind: 'exit' });
    });
    // Studio's region is a routing hint, never an account secret.
    let country = 'US';
    try {
      const text = fs.readFileSync(path.join(installation.base, 'BambuStudio.conf'), 'utf8');
      const match = text.match(/"country_code"\s*:\s*"([A-Z]{2})"/);
      if (match) country = match[1];
    } catch (_) {}
    const lines = [installation.library, sessionDir, path.dirname(installation.certificate), path.basename(installation.certificate), country, serial];
    if (lines.some(line => /[\r\n]/.test(line))) throw new Error('unavailable');
    child.stdin.write(lines.join('\n') + '\n');
    return child;
  } catch (error) {
    child?.kill();
    if (!child) fs.rmSync(sessionDir, { recursive: true, force: true });
    throw error;
  }
}

let cached = null, pending = null;
function availability() {
  if (cached && Date.now() - cached.at < 30000) return Promise.resolve(cached.available);
  if (pending) return pending;
  pending = new Promise(resolve => {
    let child, timer, done = false;
    const finish = available => {
      if (done) return;done = true;clearTimeout(timer);child?.kill();
      cached = { at: Date.now(), available };resolve(available);
    };
    try {
      child = launch('--check', event => {
        if (event.kind === 'available') finish(event.value === 'true');
        if (event.kind === 'error' || event.kind === 'exit') finish(false);
      });
      timer = setTimeout(() => finish(false), 8000);
    } catch (_) { finish(false); }
  }).finally(() => { pending = null; });
  return pending;
}

function listPrinters() {
  return new Promise((resolve, reject) => {
    let child, timer, done = false;
    const finish = (printers, error) => {
      if (done) return;done = true;clearTimeout(timer);child?.kill();
      if (error) reject(new Error('Bambu Fallback could not find printers. Check your internet connection and that the printer is online.'));
      else resolve(printers);
    };
    try {
      child = launch('--list', event => {
        if (event.kind === 'printers') finish(event.printers);
        else if (event.kind === 'error' || event.kind === 'exit') finish(null, true);
      });
      timer = setTimeout(() => finish(null, true), 30000);
    } catch (_) { finish(null, true); }
  });
}
function hasActiveHelpers() { return activeChildren.size > 0; }
function shutdown() {
  return Promise.all([...activeChildren].map(child => new Promise(resolve => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
    child.once('close', () => { clearTimeout(timer);resolve(); });
    child.kill();
  })));
}
module.exports = { findInstallation, helperPath, filterReport, launch, availability, listPrinters, hasActiveHelpers, shutdown };
