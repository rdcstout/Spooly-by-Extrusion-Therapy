const list = document.querySelector('#printers');
const template = document.querySelector('#printerTemplate');
const scale = document.querySelector('#scale');
const scaleOut = document.querySelector('#scaleOut');
const launch = document.querySelector('#launch');
const automaticUpdates = document.querySelector('#automaticUpdates');
let supportsNetworkHelp = false;
function revealNetworkHelp() {
  if (!supportsNetworkHelp) return;
  document.querySelector('#networkHelpDetails').open = true;
  document.querySelector('#networkHelp').scrollIntoView({ block: 'start' });
}
window.spooly.onNetworkHelp(() => {
  window.spooly.getSettings().then((settings) => {
    supportsNetworkHelp = settings.supportsNetworkHelp === true;
    document.querySelector('#networkHelp').hidden = !supportsNetworkHelp;
    revealNetworkHelp();
  });
});
document.querySelector('#networkSettings').addEventListener('click', async () => {
  try { await window.spooly.openNetworkSettings(); }
  catch (_) { document.querySelector('#networkResult').textContent = 'Open System Settings → Privacy & Security → Local Network manually.'; }
});
document.querySelector('#networkRetry').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const output = document.querySelector('#networkResult');
  button.disabled = true;
  output.textContent = 'Checking saved printer addresses…';
  try {
    const results = await window.spooly.checkNetwork();
    output.replaceChildren();
    if (!results.length) output.textContent = 'Add a printer and Save & connect first, or try Scan after checking permission.';
    const messages = {
      reachable: 'Network connection succeeded. This does not verify the access code or printer data. Spooly continues reconnecting automatically.',
      blocked: 'Network access was denied. Check Local Network permission above; another security tool could also block access.',
      unreachable: 'Could not reach this address. Check power, IP address, network, and Local Network permission—even if it already says On.',
      invalid: 'The saved address or port is invalid. Correct it and Save & connect.',
    };
    for (const result of results) {
      const line = document.createElement('p');
      line.textContent = `${result.name}: ${messages[result.result] || messages.unreachable}`;
      output.append(line);
    }
  } catch (_) { output.textContent = 'The check could not complete. Check Local Network permission and try again.'; }
  finally { button.disabled = false; }
});
window.spooly.getSettings().then((settings) => {
  supportsNetworkHelp = settings.supportsNetworkHelp === true;
  document.querySelector('#networkHelp').hidden = !supportsNetworkHelp;
  if (settings.supportsLaunchAtLogin === false) {
    launch.disabled = true;
    launch.checked = false;
    launch.title = 'Automatic launch at login is not yet supported on Linux.';
  }
  if (!settings.linuxTest) return;
  document.title = 'Spooly Linux Test';
  automaticUpdates.disabled = true;
  automaticUpdates.title = 'No public Linux update channel is available yet.';
});
const existingPrinterIds = new Set();
const MIN_SCALE = .65;
const MAX_SCALE = 1.1;

function sliderToScale(value) {
  return MIN_SCALE + ((Number(value) - 1) / 99) * (MAX_SCALE - MIN_SCALE);
}

function scaleToSlider(value) {
  const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number(value) || 1));
  return Math.round(1 + ((clamped - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * 99);
}

function normalizeHost(value = '') {
  return String(value).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function printerKey(printer = {}) {
  if (printer.type === 'bambu') {
    const serial = String(printer.serial || '').trim().toUpperCase();
    return serial ? `bambu:serial:${serial}` : `bambu:host:${normalizeHost(printer.host)}`;
  }
  return `moonraker:${normalizeHost(printer.host)}:${Number(printer.port) || 7125}`;
}

function cardValue(card) {
  const printer = { id: card.dataset.id };
  card.querySelectorAll('[data-field]').forEach((input) => {
    printer[input.dataset.field] = input.type === 'number' ? Number(input.value) : input.value.trim();
  });
  return printer;
}

function existingCard(printer, excludingCard) {
  const key = printerKey(printer);
  if (!key || key.endsWith(':')) return null;
  return [...list.children].find((card) => card !== excludingCard && printerKey(cardValue(card)) === key) || null;
}

function revealDuplicate(card, results, name) {
  results.textContent = `No new printer selected — ${name || cardValue(card).name || 'this printer'} is already added.`;
}

function showConnectionStatus(value) {
  if (value?.phase === 'failed') revealNetworkHelp();
  const card = [...list.children].find((entry) => entry.dataset.id === value?.id);
  if (!card) return;
  const output = card.querySelector('.connection-status');
  clearTimeout(output.connectionStatusTimer);
  output.replaceChildren();
  output.dataset.phase = value.phase || '';
  if (value.code) {
    const code = document.createElement('span');
    code.className = 'connection-code';
    code.textContent = value.code;
    output.append(code);
  }
  output.append(document.createTextNode(value.message || ''));
  if (value.phase === 'connected') {
    output.connectionStatusTimer = setTimeout(() => {
      output.replaceChildren();
      delete output.dataset.phase;
    }, 2500);
  }
}

function addPrinter(data = {}, { prepend = false, focus = false } = {}) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.dataset.id = data.id || crypto.randomUUID();
  card.querySelectorAll('[data-field]').forEach((input) => { if (data[input.dataset.field] !== undefined) input.value = data[input.dataset.field]; });
  const updateType = () => card.classList.toggle('is-bambu', card.querySelector('[data-field="type"]').value === 'bambu');
  card.querySelector('[data-field="type"]').addEventListener('change', updateType);
  card.querySelector('.guide-button').addEventListener('click', () => document.querySelector('#bambuGuide').showModal());
  card.querySelector('.scan-moonraker').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const results = card.querySelector('.moon-scan-results');
    button.disabled = true;
    button.textContent = 'Scanning…';
    results.replaceChildren();
    try {
      const printers = await window.spooly.scanMoonraker();
      const selectPrinter = (printer) => {
        const duplicate = existingCard({ ...printer, type: 'moonraker' }, card);
        if (duplicate) { revealDuplicate(duplicate, results, printer.name); return false; }
        card.querySelector('[data-field="host"]').value = printer.host;
        card.querySelector('[data-field="port"]').value = printer.port;
        const name = card.querySelector('[data-field="name"]');
        if (!name.value) name.value = printer.name;
        results.replaceChildren();
        button.textContent = 'Printer selected';
        return true;
      };
      if (printers.length === 1) selectPrinter(printers[0]);
      else if (printers.length > 1) printers.forEach((printer) => {
        const choice = document.createElement('button');
        choice.type = 'button';
        const duplicate = existingCard({ ...printer, type: 'moonraker' }, card);
        choice.textContent = `${printer.name} · ${printer.host}:${printer.port}${duplicate ? ' · already added' : ''}`;
        choice.disabled = Boolean(duplicate);
        choice.addEventListener('click', () => selectPrinter(printer));
        results.append(choice);
      });
      else { button.textContent = 'No Moonraker printers found — try manual entry'; revealNetworkHelp(); }
    } catch (_) {
      button.textContent = 'Scan failed — try manual entry';
      revealNetworkHelp();
    } finally {
      button.disabled = false;
      if (button.textContent === 'Scanning…') button.textContent = 'Scan local network';
    }
  });
  card.querySelector('.scan-bambu').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const results = card.querySelector('.bambu-scan-results');
    button.disabled = true;
    button.textContent = 'Scanning…';
    results.replaceChildren();
    try {
      const printers = await window.spooly.scanBambu();
      const selectPrinter = (printer) => {
        const duplicate = existingCard({ ...printer, type: 'bambu' }, card);
        if (duplicate) { revealDuplicate(duplicate, results, printer.name); return false; }
        card.querySelector('[data-field="host"]').value = printer.host;
        card.querySelector('[data-field="serial"]').value = printer.serial;
        const name = card.querySelector('[data-field="name"]');
        if (!name.value) name.value = printer.name;
        results.replaceChildren();
        button.textContent = 'Printer selected';
        return true;
      };
      if (printers.length === 1) selectPrinter(printers[0]);
      else if (printers.length > 1) printers.forEach((printer) => {
        const choice = document.createElement('button');
        choice.type = 'button';
        const duplicate = existingCard({ ...printer, type: 'bambu' }, card);
        choice.textContent = `${printer.name} · ${printer.host}${duplicate ? ' · already added' : ''}`;
        choice.disabled = Boolean(duplicate);
        choice.addEventListener('click', () => selectPrinter(printer));
        results.append(choice);
      });
      else {
        button.textContent = 'Scan local network';
        results.textContent = 'BAMBU-DISCOVERY-01 — No Bambu printers answered the scan. Try manual entry.';
        revealNetworkHelp();
      }
    } catch (error) {
      button.textContent = 'Scan failed — try manual entry';
      revealNetworkHelp();
      results.textContent = String(error?.message || '').includes('BAMBU-DISCOVERY-02')
        ? 'BAMBU-DISCOVERY-02 — Could not send discovery requests. Check your network adapter connection and try again.'
        : 'BAMBU-DISCOVERY-03 — The scan could not complete. Try again or enter the printer manually.';
    } finally {
      button.disabled = false;
      if (button.textContent === 'Scanning…') button.textContent = 'Scan local network';
    }
  });
  card.querySelector('.remove').addEventListener('click', () => card.remove());
  updateType();
  if (data.accessCodeNeedsReentry) {
    card.querySelector('.bambu-scan-results').textContent = 'Re-enter this printer’s access code once to finish the Beta 4 upgrade.';
  }
  if (prepend) list.prepend(card); else list.append(card);
  if (focus) requestAnimationFrame(() => {
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.querySelector('[data-field="name"]').focus({ preventScroll: true });
  });
}

function readPrinters() {
  const seen = new Set();
  return [...list.children].map(cardValue).filter((printer) => {
    const key = printerKey(printer);
    if (!printer.name || !printer.host || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

document.querySelector('#add').addEventListener('click', () => addPrinter({}, { prepend: true, focus: true }));
document.querySelector('#credit').addEventListener('click', () => window.spooly.openExtrusionTherapy());
document.querySelector('#checkUpdates').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const status = document.querySelector('#updateStatus');
  button.disabled = true;
  status.replaceChildren();
  status.textContent = 'Checking GitHub…';
  try {
    const result = await window.spooly.checkForUpdates();
    if (!result.updateAvailable) {
      status.textContent = `You’re up to date — version ${result.current}.`;
      return;
    }
    status.textContent = `Version ${result.latest} is available. `;
    const download = document.createElement('button');
    download.type = 'button';
    download.className = 'link-button';
    download.textContent = 'View download';
    download.addEventListener('click', () => window.spooly.openRelease(result.releaseUrl));
    status.append(download);
  } catch (_) {
    status.textContent = 'Could not reach GitHub. Try again later.';
  } finally {
    button.disabled = false;
  }
});
document.querySelector('#exportConfig').addEventListener('click', async () => {
  const saved = document.querySelector('#saved');
  try {
    const result = await window.spooly.exportSettings();
    if (result.ok) saved.textContent = 'Configuration backup saved.';
  } catch (error) { saved.textContent = error.message || 'Could not export configuration.'; }
});
document.querySelector('#importConfig').addEventListener('click', async () => {
  const saved = document.querySelector('#saved');
  try {
    const result = await window.spooly.importSettings();
    if (!result.ok) return;
    list.replaceChildren();
    result.settings.printers.forEach(addPrinter);
    scale.value = scaleToSlider(result.settings.scale);
    scale.dispatchEvent(new Event('input'));
    launch.checked = result.settings.launchAtLogin;
    automaticUpdates.checked = result.settings.automaticUpdates !== false;
    saved.textContent = 'Configuration restored.';
  } catch (error) { saved.textContent = error.message || 'Could not restore configuration.'; }
});
scale.addEventListener('input', () => {
  scaleOut.value = `${Math.round(scale.value)}%`;
  scaleOut.textContent = scaleOut.value;
  window.spooly.previewScale(sliderToScale(scale.value));
});
document.querySelector('#save').addEventListener('click', async () => {
  const saved = document.querySelector('#saved');
  const printers = readPrinters();
  const newPrinterCount = printers.filter((printer) => !existingPrinterIds.has(printer.id)).length;
  const saveMessage = newPrinterCount > 0
    ? `Saved. Connecting ${newPrinterCount === 1 ? 'new printer' : `${newPrinterCount} new printers`}…`
    : 'Saved.';
  saved.textContent = saveMessage;
  await window.spooly.saveSettings({ printers, scale: sliderToScale(scale.value), launchAtLogin: launch.checked, automaticUpdates: automaticUpdates.checked });
  printers.forEach((printer) => existingPrinterIds.add(printer.id));
  setTimeout(() => {
    if (saved.textContent === saveMessage) saved.textContent = '';
  }, 2500);
});
window.spooly.getSettings().then((settings) => { document.querySelector('#version').textContent = `Version ${settings.version}`; settings.printers.forEach((printer) => { existingPrinterIds.add(printer.id); addPrinter(printer); }); (settings.connectionStatuses || []).forEach(showConnectionStatus); scale.value = scaleToSlider(settings.scale); scale.dispatchEvent(new Event('input')); launch.checked = settings.launchAtLogin; automaticUpdates.checked = settings.automaticUpdates !== false; if (!settings.printers.length) addPrinter({ type: 'moonraker', port: 7125 }); });
window.spooly.onPrinterConnected(({ name }) => {
  document.querySelector('#saved').textContent = `${name} connected successfully.`;
  setTimeout(() => document.querySelector('#saved').textContent = '', 3500);
});
window.spooly.onPrinterConnectionStatus(showConnectionStatus);
