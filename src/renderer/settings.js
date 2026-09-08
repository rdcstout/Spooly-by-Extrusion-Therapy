const list = document.querySelector('#printers');
const template = document.querySelector('#printerTemplate');
const scale = document.querySelector('#scale');
const scaleOut = document.querySelector('#scaleOut');
const launch = document.querySelector('#launch');
const automaticUpdates = document.querySelector('#automaticUpdates');
const existingPrinterIds = new Set();
const MIN_SCALE = .65;
const MAX_SCALE = 1.1;
const PORT_DEFAULTS = { moonraker: 7125, repetierserver: 3344 };

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
  if (printer.type === 'repetierserver') {
    return `repetierserver:${normalizeHost(printer.host)}:${Number(printer.port) || 3344}:${String(printer.slug || '').trim().toLowerCase()}`;
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

function applyPortDefault(card) {
  const portInput = card.querySelector('[data-field="port"]');
  const type = card.querySelector('[data-field="type"]').value;
  const defaultPort = PORT_DEFAULTS[type] || PORT_DEFAULTS.moonraker;
  if (!portInput.value || portInput.dataset.auto === 'true') {
    portInput.value = defaultPort;
    portInput.dataset.auto = 'true';
  }
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
  const updateType = () => {
    const type = card.querySelector('[data-field="type"]').value;
    card.classList.toggle('is-bambu', type === 'bambu');
    card.classList.toggle('is-repetierserver', type === 'repetierserver');
    applyPortDefault(card);
  };
  card.querySelector('[data-field="type"]').addEventListener('change', updateType);
  card.querySelector('[data-field="port"]').addEventListener('input', (event) => { delete event.currentTarget.dataset.auto; });
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
      else button.textContent = 'No Moonraker printers found — try manual entry';
    } catch (_) {
      button.textContent = 'Scan failed — try manual entry';
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
      }
    } catch (_) {
      button.textContent = 'Scan failed — try manual entry';
    } finally {
      button.disabled = false;
      if (button.textContent === 'Scanning…') button.textContent = 'Scan local network';
    }
  });
  card.querySelector('.scan-repetier').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const results = card.querySelector('.repetier-scan-results');
    const host = card.querySelector('[data-field="host"]').value.trim();
    const apiKey = card.querySelector('[data-field="apiKey"]').value.trim();
    results.replaceChildren();
    if (!host || !apiKey) {
      results.textContent = !host ? 'Enter the host first.' : 'Enter the API key first.';
      return;
    }
    button.disabled = true;
    button.textContent = 'Fetching…';
    try {
      const printers = await window.spooly.listRepetierPrinters({
        host,
        port: Number(card.querySelector('[data-field="port"]').value) || undefined,
        apiKey,
      });
      const applyPrinter = (printer) => {
        card.querySelector('[data-field="slug"]').value = printer.slug;
        const name = card.querySelector('[data-field="name"]');
        if (!name.value) name.value = printer.name;
      };
      if (printers.length === 0) {
        results.textContent = 'No printers found — try manual entry';
      } else if (printers.length === 1) {
        applyPrinter(printers[0]);
        button.textContent = 'Printer selected';
      } else {
        const currentSlug = card.querySelector('[data-field="slug"]').value.trim();
        const select = document.createElement('select');
        select.append(new Option('Select a printer…', '', true, !currentSlug));
        select.firstChild.disabled = true;
        printers.forEach((printer) => select.append(new Option(`${printer.name} · ${printer.slug}`, printer.slug, false, printer.slug === currentSlug)));
        select.addEventListener('change', () => {
          const printer = printers.find((p) => p.slug === select.value);
          if (printer) applyPrinter(printer);
        });
        results.append(select);
      }
    } catch (_) {
      results.textContent = 'Fetch failed — check host, port, and API key.';
    } finally {
      button.disabled = false;
      if (button.textContent === 'Fetching…') button.textContent = 'Fetch printers';
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

// A RepetierServer connection is addressed by its printer slug, so a card
// without one cannot be saved. Flag the card instead of silently dropping it.
function invalidPrinterCard() {
  return [...list.children].find((card) => {
    const printer = cardValue(card);
    return printer.type === 'repetierserver' && printer.name && printer.host && !String(printer.slug || '').trim();
  }) || null;
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
  const invalidCard = invalidPrinterCard();
  if (invalidCard) {
    saved.textContent = 'Pick a RepetierServer printer before saving.';
    const slugInput = invalidCard.querySelector('[data-field="slug"]');
    slugInput.focus();
    return;
  }
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
