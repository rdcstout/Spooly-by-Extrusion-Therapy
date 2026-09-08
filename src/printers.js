function normalizeHost(value = '') {
  return String(value).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

// Single lookup point for per-type dedup key logic. Add a new printer type by
// adding one entry here instead of extending an if/else chain.
const CANONICAL_KEY_BY_TYPE = {
  bambu: (printer) => {
    const serial = String(printer.serial || '').trim().toUpperCase();
    if (serial) return `bambu:serial:${serial}`;
    const host = normalizeHost(printer.host);
    return host ? `bambu:host:${host}` : null;
  },
  moonraker: (printer) => {
    const host = normalizeHost(printer.host);
    return host ? `moonraker:${host}:${Number(printer.port) || 7125}` : null;
  },
  duet: (printer) => {
    const host = normalizeHost(printer.host);
    return host ? `duet:${host}:${Number(printer.port) || 80}` : null;
  },
  repetierserver: (printer) => {
    const host = normalizeHost(printer.host);
    const slug = String(printer.slug || '').trim().toLowerCase();
    return host && slug ? `repetierserver:${host}:${Number(printer.port) || 3344}:${slug}` : null;
  },
};

function canonicalPrinterKey(printer = {}) {
  const keyFn = CANONICAL_KEY_BY_TYPE[printer.type];
  return keyFn ? keyFn(printer) : null;
}

function dedupePrinters(printers = []) {
  const seen = new Set();
  return printers.filter((printer) => {
    const key = canonicalPrinterKey(printer);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function samePrinterConfiguration(left = {}, right = {}) {
  const textFields = ['id', 'type', 'name', 'host', 'serial', 'accessCode'];
  if (!textFields.every((field) => String(left[field] ?? '') === String(right[field] ?? ''))) return false;
  if (left.type === 'moonraker') return (Number(left.port) || 7125) === (Number(right.port) || 7125);
  return true;
}

module.exports = { canonicalPrinterKey, dedupePrinters, normalizeHost, samePrinterConfiguration };
